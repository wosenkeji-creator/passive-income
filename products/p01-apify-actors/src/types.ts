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
