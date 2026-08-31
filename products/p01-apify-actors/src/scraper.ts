import type { JobPostingRecord, NormalizedInput, SitemapEntry } from './types.js';
import { decodeSitemapBody, parseJobPostingHtml, parseSitemapXml } from './parsers.js';
import { matchesFilters } from './filters.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';

export interface ScrapeSummary {
  sitemapEntries: number;
  candidatePages: number;
  fetchedPages: number;
  parsedPostings: number;
  matchedResults: number;
  requestFailures: number;
  invalidPages: number;
}

async function fetchBody(url: string, timeoutMs: number, retries = 2): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
        signal: controller.signal,
      });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === retries) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
}

async function loadSitemapEntries(sitemapUrl: string, timeoutMs: number): Promise<SitemapEntry[]> {
  const indexXml = decodeSitemapBody(await fetchBody(sitemapUrl, timeoutMs));
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
    const xml = decodeSitemapBody(await fetchBody(child.loc, timeoutMs));
    allEntries.push(...parseSitemapXml(xml));
  }
  return allEntries;
}

export async function scrape(
  input: NormalizedInput,
  onWarning: (url: string, error: unknown) => void = () => undefined,
): Promise<{ results: JobPostingRecord[]; summary: ScrapeSummary }> {
  const sitemapEntries = await loadSitemapEntries(input.sitemapUrl, input.requestTimeoutMs);
  const candidates = sitemapEntries
    .filter((entry) => entry.loc.startsWith('https://') || entry.loc.startsWith('http://'))
    .filter((entry) => !input.updatedSince || !entry.lastmod || new Date(entry.lastmod) >= input.updatedSince)
    .slice(0, input.maxPages);
  if (!candidates.length) throw new Error('No sitemap URLs matched the input constraints');

  const results: JobPostingRecord[] = [];
  let cursor = 0;
  let fetchedPages = 0;
  let parsedPostings = 0;
  let requestFailures = 0;
  let invalidPages = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= candidates.length || results.length >= input.maxResults) return;
      const candidate = candidates[index];
      try {
        const html = new TextDecoder().decode(await fetchBody(candidate.loc, input.requestTimeoutMs));
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
  };
  if (parsedPostings === 0) {
    throw new Error(`No JobPosting records parsed (fetched=${fetchedPages}, invalid=${invalidPages}, requestFailures=${requestFailures})`);
  }
  return { results: results.slice(0, input.maxResults), summary };
}
