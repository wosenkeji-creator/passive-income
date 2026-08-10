import type { ActorInput, NormalizedInput } from './types.js';

const DEFAULT_SITEMAP_URL = 'https://www.welcometothejungle.com/sitemaps/index.xml.gz';
const DEFAULT_MAX_RESULTS = 100;
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 30_000;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeInput(raw: unknown): NormalizedInput {
  const input = asRecord(raw);
  const sitemapUrl = stringValue(input.sitemapUrl) ?? DEFAULT_SITEMAP_URL;
  try {
    const parsed = new URL(sitemapUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('sitemapUrl must use HTTP(S)');
  } catch {
    throw new Error(`Invalid sitemapUrl: ${sitemapUrl}`);
  }

  let updatedSince: Date | undefined;
  const updatedSinceText = stringValue(input.updatedSince);
  if (updatedSinceText) {
    const parsed = new Date(updatedSinceText);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid updatedSince: ${updatedSinceText}`);
    updatedSince = parsed;
  }

  return {
    sitemapUrl,
    maxResults: boundedInteger(input.maxResults, DEFAULT_MAX_RESULTS, 1, 1_000),
    maxPages: boundedInteger(input.maxPages, DEFAULT_MAX_PAGES, 1, 10_000),
    concurrency: boundedInteger(input.concurrency, DEFAULT_CONCURRENCY, 1, 20),
    requestTimeoutMs: boundedInteger(input.requestTimeoutMs, DEFAULT_TIMEOUT_MS, 1_000, 120_000),
    country: stringValue(input.country),
    city: stringValue(input.city),
    contractType: stringValue(input.contractType),
    company: stringValue(input.company),
    updatedSince,
    includeDescription: input.includeDescription !== false,
  };
}
