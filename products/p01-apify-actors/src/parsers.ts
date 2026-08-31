import { load } from 'cheerio';
import { gunzipSync } from 'node:zlib';
import type { JobLocation, JobPostingRecord, SitemapEntry } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  const values = Array.isArray(value) ? value : [value];
  const result = values.flatMap((item) => typeof item === 'string' ? [item.trim()] : []).filter(Boolean);
  return result.length ? result : undefined;
}

function hasType(value: Record<string, unknown>, expected: string): boolean {
  const type = value['@type'];
  return Array.isArray(type) ? type.includes(expected) : type === expected;
}

function findJobPosting(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findJobPosting(item);
      if (result) return result;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  if (hasType(value, 'JobPosting')) return value;
  return findJobPosting(value['@graph']);
}

function parseJsonLd(value: string): Record<string, unknown> | undefined {
  try {
    const normalized = value.trim()
      .replace(/^<!--/, '')
      .replace(/-->$/, '')
      .replace(/;\s*$/, '')
      .trim();
    return findJobPosting(JSON.parse(normalized));
  } catch {
    return undefined;
  }
}

function parseLocation(value: unknown): JobLocation | undefined {
  if (!isRecord(value)) return undefined;
  const address = isRecord(value.address) ? value.address : value;
  const result: JobLocation = {
    addressLocality: textValue(address.addressLocality),
    postalCode: textValue(address.postalCode),
    streetAddress: textValue(address.streetAddress),
    addressRegion: textValue(address.addressRegion),
    addressCountry: textValue(address.addressCountry),
  };
  return Object.values(result).some(Boolean) ? result : undefined;
}

export function decodeSitemapBody(body: Uint8Array): string {
  const bytes = Buffer.from(body);
  const decoded = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  return decoded.toString('utf8');
}

export function parseSitemapXml(xml: string): SitemapEntry[] {
  const $ = load(xml, { xmlMode: true });
  const entries: SitemapEntry[] = [];
  $('url, sitemap').each((_, element) => {
    const loc = $(element).children('loc').first().text().trim();
    if (!loc) return;
    const lastmod = $(element).children('lastmod').first().text().trim() || undefined;
    entries.push(lastmod ? { loc, lastmod } : { loc });
  });
  return entries;
}

export function parseJobPostingHtml(html: string, url: string, includeDescription = true): JobPostingRecord | undefined {
  const $ = load(html);
  let posting: Record<string, unknown> | undefined;
  $('script').each((_, element) => {
    const type = ($(element).attr('type') ?? '').toLowerCase();
    if (!posting && type === 'application/ld+json') {
      posting = parseJsonLd($(element).html() ?? $(element).text());
    }
  });
  if (!posting) return undefined;

  const locations = (Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation])
    .map(parseLocation)
    .filter((location): location is JobLocation => Boolean(location));
  const organization = isRecord(posting.hiringOrganization) ? posting.hiringOrganization : {};
  return {
    url,
    title: textValue(posting.title) ?? 'Untitled job',
    company: textValue(organization.name),
    companyUrl: textValue(organization.sameAs),
    employmentType: stringArray(posting.employmentType),
    datePosted: textValue(posting.datePosted),
    validThrough: textValue(posting.validThrough),
    industry: textValue(posting.industry),
    experienceRequirements: posting.experienceRequirements,
    qualifications: textValue(posting.qualifications),
    description: includeDescription ? textValue(posting.description) : undefined,
    jobLocation: locations,
  };
}
