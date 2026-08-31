import type {
  JobPostingRecord,
  NormalizedInput,
  SitemapEntry,
  WafToken,
  WafTokenSource,
} from './types.js';
import { decodeSitemapBody, parseJobPostingHtml, parseSitemapXml } from './parsers.js';
import { matchesFilters } from './filters.js';
import { WafTokenCache, isWafChallenge } from './waf.js';

/**
 * Fallback identity for hosts that issue no WAF challenge.
 *
 * When a token is in play this constant is *not* used: the token is bound to the
 * User-Agent of the browser that solved the challenge, so the fetcher must send
 * that one instead.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';

const RETRYABLE_STATUS = [408, 425, 429, 500, 502, 503, 504];

/**
 * Browser launches one request may cause: one for "I hold no token", one for
 * "the token I held was rejected mid-flight". Beyond that the host is blocking
 * this identity, and more launches only cost money.
 */
const MAX_MINTS_PER_REQUEST = 2;

export interface ScrapeSummary {
  sitemapEntries: number;
  candidatePages: number;
  fetchedPages: number;
  parsedPostings: number;
  matchedResults: number;
  requestFailures: number;
  invalidPages: number;
  /** Requests that came back as a WAF interstitial and were retried with a new token. */
  wafChallenges: number;
  /** Browser launches spent minting tokens. Kept visible because it is the cost driver. */
  wafTokenMints: number;
}

export class WafChallengeError extends Error {
  constructor(url: string) {
    super(`AWS WAF challenge for ${url}`);
    this.name = 'WafChallengeError';
  }
}

interface FetchResult {
  body: Uint8Array;
  /** Token generation that produced this body, so a failure can be attributed. */
  generation: number | null;
}

/**
 * Token-aware fetcher.
 *
 * Without a `WafTokenSource` this behaves exactly as the original `fetchBody`
 * did, which keeps the local-fixture test path browser-free. With one, every
 * request carries the current token, and a challenge response triggers one
 * re-mint and one retry rather than being silently counted as a parse failure.
 */
class TokenAwareFetcher {
  private readonly cache: WafTokenCache | null;
  private challenges = 0;

  constructor(source: WafTokenSource | null, ttlMs?: number) {
    this.cache = source ? new WafTokenCache(source, { ttlMs }) : null;
  }

  get challengeCount(): number {
    return this.challenges;
  }

  get mintCount(): number {
    return this.cache?.mintCount ?? 0;
  }

  /**
   * Fetch with a bounded budget for transport retries and a separate bounded
   * budget for WAF mints.
   *
   * The two budgets are deliberately separate. A challenge is not a transport
   * failure, and letting it consume the retry budget would mean a request that
   * needed one mint and one refresh could run out of attempts before it ever got
   * to succeed with a valid token.
   */
  async fetchBody(url: string, timeoutMs: number, retries = 2): Promise<Uint8Array> {
    let lastError: unknown;
    let transportAttempts = 0;
    let challengeMints = 0;
    while (true) {
      // Lazy by design: a cached token is reused, but no browser is launched
      // until a challenge is actually observed. The sitemap endpoints answer 200
      // with no token at all, so minting up front would spend a browser launch
      // on requests that never needed one.
      const held = this.cache ? this.cache.peek() : null;
      try {
        const result = await this.attempt(url, timeoutMs, held);
        return result.body;
      } catch (error) {
        lastError = error;
        if (error instanceof WafChallengeError) {
          // Two mints at most: one for "I had no token", one for "the token I
          // held was rejected". A third challenge is a real block, and looping
          // would turn one URL into an unbounded stream of browser launches.
          if (!this.cache || challengeMints >= MAX_MINTS_PER_REQUEST) break;
          this.challenges += 1;
          challengeMints += 1;
          // The URL being fetched is also the mint hint: it is by definition
          // inside the protected space, so it is guaranteed to serve a challenge,
          // whereas the site root was measured not to issue a token at all.
          if (held) await this.cache.refresh(held.generation, url);
          else await this.cache.acquire(url);
          continue;
        }
        // Preserve the original contract: a 404 is final, a 503 is worth another
        // try. Without this a dead URL would burn the full retry budget.
        if (transportAttempts >= retries || !isRetryableStatusError(error)) break;
        transportAttempts += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * transportAttempts));
    }
    throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
  }

  private async attempt(
    url: string,
    timeoutMs: number,
    held: { token: WafToken; generation: number } | null,
  ): Promise<FetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        'user-agent': held ? held.token.userAgent : USER_AGENT,
        accept: 'text/html,application/xml;q=0.9,*/*;q=0.8',
      };
      if (held) headers.cookie = held.token.cookie;
      const response = await fetch(url, { headers, signal: controller.signal });
      const body = new Uint8Array(await response.arrayBuffer());
      if (this.looksChallenged(response, body)) throw new WafChallengeError(url);
      if (response.ok) return { body, generation: held?.generation ?? null };
      throw new Error(`HTTP ${response.status} for ${url}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * `202` is the shape the WTTJ challenge arrives in, and `fetch` reports it as
   * `response.ok`. Decoding is deferred until the status or headers already
   * suggest a challenge so that gzipped sitemap payloads are never text-decoded.
   */
  private looksChallenged(response: Response, body: Uint8Array): boolean {
    if (response.status === 200 && !response.headers.get('x-amzn-waf-action')) return false;
    const head = new TextDecoder('utf-8', { fatal: false }).decode(body.subarray(0, 4096));
    return isWafChallenge(response.status, response.headers, head);
  }
}

function isRetryableStatusError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const match = /^HTTP (\d{3}) for /.exec(error.message);
  return match ? RETRYABLE_STATUS.includes(Number(match[1])) : true;
}

async function loadSitemapEntries(
  fetcher: TokenAwareFetcher,
  sitemapUrl: string,
  timeoutMs: number,
): Promise<SitemapEntry[]> {
  const indexXml = decodeSitemapBody(await fetcher.fetchBody(sitemapUrl, timeoutMs));
  const indexEntries = parseSitemapXml(indexXml);
  const sitemapChildren = indexEntries.filter(({ loc }) => /\.xml(?:\.gz)?(?:$|\?)/i.test(loc));
  if (!sitemapChildren.length) return indexEntries;
  const isWttjIndex = new URL(sitemapUrl).hostname.endsWith('welcometothejungle.com');
  const childSitemaps = isWttjIndex
    ? sitemapChildren.filter(({ loc }) => /\/job-listings\.\d+\.xml(?:\.gz)?(?:$|\?)/i.test(loc))
    : sitemapChildren;
  if (!childSitemaps.length) throw new Error('No job-listings child sitemaps found');

  const allEntries: SitemapEntry[] = [];
  for (const child of childSitemaps) {
    const xml = decodeSitemapBody(await fetcher.fetchBody(child.loc, timeoutMs));
    allEntries.push(...parseSitemapXml(xml));
  }
  return allEntries;
}

export interface ScrapeOptions {
  onWarning?: (url: string, error: unknown) => void;
  /**
   * Supplied for hosts behind AWS WAF. Omitted for local fixtures, which keeps
   * the test path from needing a browser.
   */
  tokenSource?: WafTokenSource | null;
  tokenTtlMs?: number;
}

export async function scrape(
  input: NormalizedInput,
  options: ScrapeOptions | ((url: string, error: unknown) => void) = {},
): Promise<{ results: JobPostingRecord[]; summary: ScrapeSummary }> {
  const resolved: ScrapeOptions = typeof options === 'function' ? { onWarning: options } : options;
  const onWarning = resolved.onWarning ?? ((): void => undefined);
  const fetcher = new TokenAwareFetcher(resolved.tokenSource ?? null, resolved.tokenTtlMs);

  const sitemapEntries = await loadSitemapEntries(
    fetcher,
    input.sitemapUrl,
    input.requestTimeoutMs,
  );
  const candidates = sitemapEntries
    .filter((entry) => entry.loc.startsWith('https://') || entry.loc.startsWith('http://'))
    .filter(
      (entry) =>
        !input.updatedSince || !entry.lastmod || new Date(entry.lastmod) >= input.updatedSince,
    )
    .slice(0, input.maxPages);
  if (!candidates.length) throw new Error('No sitemap URLs matched the input constraints');

  const results: JobPostingRecord[] = [];
  let cursor = 0;
  let fetchedPages = 0;
  let parsedPostings = 0;
  let requestFailures = 0;
  let invalidPages = 0;
  let blockedPages = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= candidates.length || results.length >= input.maxResults) return;
      const candidate = candidates[index];
      try {
        const html = new TextDecoder().decode(
          await fetcher.fetchBody(candidate.loc, input.requestTimeoutMs),
        );
        fetchedPages += 1;
        const posting = parseJobPostingHtml(html, candidate.loc, input.includeDescription);
        if (!posting) {
          invalidPages += 1;
          continue;
        }
        parsedPostings += 1;
        posting.sourceLastModified = candidate.lastmod;
        if (matchesFilters(posting, input)) results.push(posting);
      } catch (error) {
        // A challenge that survived a re-mint is a block, not a broken page.
        // Keeping the two apart is the whole point: conflating them is what
        // produced the "detail pages became unparseable" misdiagnosis.
        if (error instanceof WafChallengeError) blockedPages += 1;
        requestFailures += 1;
        onWarning(candidate.loc, error);
      }
    }
  };
  await Promise.all(Array.from({ length: input.concurrency }, () => worker()));

  const summary: ScrapeSummary = {
    sitemapEntries: sitemapEntries.length,
    candidatePages: candidates.length,
    fetchedPages,
    parsedPostings,
    matchedResults: results.length,
    requestFailures,
    invalidPages,
    wafChallenges: fetcher.challengeCount,
    wafTokenMints: fetcher.mintCount,
  };
  if (parsedPostings === 0) {
    throw new Error(
      `No JobPosting records parsed (fetched=${fetchedPages}, invalid=${invalidPages}, ` +
        `requestFailures=${requestFailures}, wafBlocked=${blockedPages}, ` +
        `wafChallenges=${fetcher.challengeCount}, tokenMints=${fetcher.mintCount})`,
    );
  }
  return { results: results.slice(0, input.maxResults), summary };
}

export { isRetryableStatusError };
