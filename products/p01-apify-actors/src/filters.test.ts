import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesFilters } from './filters.js';
import type { JobPostingRecord, NormalizedInput } from './types.js';

const record: JobPostingRecord = {
  url: 'https://example.com/job/1',
  title: 'Data Engineer',
  company: 'Example Co',
  employmentType: ['FULL_TIME'],
  jobLocation: [{ addressLocality: 'Paris', addressCountry: 'FR' }],
};

const baseInput: NormalizedInput = {
  sitemapUrl: 'https://example.com/sitemap.xml',
  maxResults: 10,
  maxPages: 10,
  concurrency: 1,
  requestTimeoutMs: 30_000,
  includeDescription: true,
};

test('matches optional country, city, contract and company filters', () => {
  assert.equal(matchesFilters(record, { ...baseInput, country: 'fr', city: 'par', contractType: 'full-time', company: 'example' }), true);
  assert.equal(matchesFilters(record, { ...baseInput, city: 'Lyon' }), false);
  assert.equal(matchesFilters(record, { ...baseInput, contractType: 'part-time' }), false);
});

test('does not require a location when no location filter is set', () => {
  assert.equal(matchesFilters({ ...record, jobLocation: [] }, baseInput), true);
  assert.equal(matchesFilters({ ...record, jobLocation: [] }, { ...baseInput, country: 'FR' }), false);
});
