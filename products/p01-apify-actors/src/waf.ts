import type { WafToken, WafTokenSource } from './types.js';

/** Bytes of a WTTJ challenge interstitial, measured 2026-09-01: 2452. */
const CHALLENGE_MARKERS = ['awsWafCookie', 'awswaf', 'challenge.js', 'token.awswaf'];

/**
 * Recognise an AWS WAF interstitial.
 *
 * This exists because the challenge arrives as `HTTP 202`, which `fetch` reports
 * as `response.ok`. Without this check the interstitial reaches the JSON-LD
 * parser, which finds no `JobPosting`, and the run reports a parse failure for
 * what is actually a network-identity block. That misattribution is exactly what
 * the 2026-08-10 "WTTJ redesigned its detail pages" conclusion was.
 */
export function isWafChallenge(status: number, headers: Headers, body: string): boolean {
  if (headers.get('x-amzn-waf-action')) return true;
  if (status !== 202 && status !== 403 && status !== 405) return false;
  const head = body.slice(0, 4096);
  return CHALLENGE_MARKERS.some((marker) => head.includes(marker));
}

/**
 * A token plus the User-Agent it was minted under.
 *
 * The pair is inseparable: replaying the cookie under a different User-Agent
 * gets challenged again, so the fetcher must send the browser's own UA rather
 * than the module-level constant.
 */
export interface WafTokenCacheOptions {
  /**
   * Proactive re-mint age. Must stay under the measured usable window
   * (`FIRST_SUSTAINED_BLOCK_AT_MIN=5.77` under steady traffic), *not* the 96h
   * the cookie's own expiry advertises.
   */
  ttlMs?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 240_000;

interface CachedToken {
  token: WafToken;
  mintedAt: number;
  generation: number;
}

/**
 * Holds one WAF token and re-mints it at most once at a time.
 *
 * Concurrency matters here: N workers share one token, so when it dies all N
 * see a challenge within milliseconds of each other. Without single-flight that
 * is N browser launches. The generation counter lets a worker say "the token I
 * used is dead" without clobbering a token some other worker already replaced.
 */
export class WafTokenCache {
  private readonly source: WafTokenSource;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private cached: CachedToken | null = null;
  private pending: Promise<CachedToken> | null = null;
  private generation = 0;
  private mints = 0;

  constructor(source: WafTokenSource, options: WafTokenCacheOptions = {}) {
    this.source = source;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  /** Number of browser launches performed; asserted by the tests and logged by the Actor. */
  get mintCount(): number {
    return this.mints;
  }

  /**
   * Return the current token only if it is still inside its ttl.
   *
   * Never mints. Callers fetch token-less when this is null and let the observed
   * challenge drive the mint, which keeps two measured facts intact: the sitemap
   * endpoints answer 200 with no token at all (so an eager mint would launch a
   * browser for nothing), and a token can only be issued on a page that actually
   * serves a challenge.
   */
  peek(): { token: WafToken; generation: number } | null {
    const current = this.cached;
    if (!current) return null;
    if (this.now() - current.mintedAt >= this.ttlMs) return null;
    return { token: current.token, generation: current.generation };
  }

  async acquire(hintUrl?: string): Promise<{ token: WafToken; generation: number }> {
    const fresh = this.peek();
    if (fresh) return fresh;
    const minted = await this.mintOnce(hintUrl);
    return { token: minted.token, generation: minted.generation };
  }

  /**
   * Report that `generation` was rejected and get a replacement.
   *
   * A stale generation number means someone else already re-minted, so the
   * caller simply receives the newer token instead of triggering another launch.
   */
  async refresh(
    generation: number,
    hintUrl?: string,
  ): Promise<{ token: WafToken; generation: number }> {
    const current = this.cached;
    if (current && current.generation > generation) {
      return { token: current.token, generation: current.generation };
    }
    if (current && current.generation === generation) this.cached = null;
    const minted = await this.mintOnce(hintUrl);
    return { token: minted.token, generation: minted.generation };
  }

  private async mintOnce(hintUrl?: string): Promise<CachedToken> {
    if (this.pending) return this.pending;
    const attempt = (async (): Promise<CachedToken> => {
      const token = await this.source.mint(hintUrl);
      this.mints += 1;
      this.generation += 1;
      const entry: CachedToken = { token, mintedAt: this.now(), generation: this.generation };
      this.cached = entry;
      return entry;
    })();
    this.pending = attempt.finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
}
