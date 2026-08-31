export interface ActorInput {
  sitemapUrl?: string;
  maxResults?: number;
  maxPages?: number;
  concurrency?: number;
  requestTimeoutMs?: number;
  country?: string;
  city?: string;
  contractType?: string;
  company?: string;
  updatedSince?: string;
  includeDescription?: boolean;
}

export interface NormalizedInput {
  sitemapUrl: string;
  maxResults: number;
  maxPages: number;
  concurrency: number;
  requestTimeoutMs: number;
  country?: string;
  city?: string;
  contractType?: string;
  company?: string;
  updatedSince?: Date;
  includeDescription: boolean;
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

/**
 * An AWS WAF token and the User-Agent it was minted under.
 *
 * These travel together because replaying the cookie under a different
 * User-Agent is challenged again — the token is bound to the browser identity
 * that solved the challenge.
 */
export interface WafToken {
  cookie: string;
  userAgent: string;
}

/** Anything that can produce a fresh token; the real one drives a browser. */
export interface WafTokenSource {
  /**
   * `hintUrl` is a page in the protected space the token is needed for.
   *
   * This is not decoration: measured 2026-09-01, the WTTJ home page issues no
   * `aws-waf-token` at all (12s of polling, 11 other cookies, no token), while a
   * job detail page issues one within 1s. A token can only be minted where a
   * challenge is actually served.
   */
  mint(hintUrl?: string): Promise<WafToken>;
  close?(): Promise<void>;
}

export interface JobLocation {
  addressLocality?: string;
  postalCode?: string;
  streetAddress?: string;
  addressRegion?: string;
  addressCountry?: string;
}

export interface JobPostingRecord {
  url: string;
  title: string;
  company?: string;
  companyUrl?: string;
  employmentType?: string[];
  datePosted?: string;
  validThrough?: string;
  industry?: string;
  experienceRequirements?: unknown;
  qualifications?: string;
  description?: string;
  jobLocation: JobLocation[];
  sourceLastModified?: string;
}
