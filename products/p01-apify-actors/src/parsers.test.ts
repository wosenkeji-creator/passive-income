import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { decodeSitemapBody, parseJobPostingHtml, parseSitemapXml } from './parsers.js';

test('decodes plain and gzipped sitemaps', () => {
  const xml = '<urlset><url><loc>https://example.com/job/1</loc><lastmod>2026-08-09</lastmod></url></urlset>';
  assert.equal(decodeSitemapBody(Buffer.from(xml)), xml);
  assert.equal(decodeSitemapBody(gzipSync(xml)), xml);
});

test('parses sitemap entries', () => {
  const xml = '<sitemapindex><sitemap><loc>https://example.com/jobs.xml.gz</loc></sitemap></sitemapindex>';
  assert.deepEqual(parseSitemapXml(xml), [{ loc: 'https://example.com/jobs.xml.gz' }]);
});

test('parses JobPosting JSON-LD without CSS selectors', () => {
  const posting = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Data Engineer',
    datePosted: '2026-08-09',
    employmentType: 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: 'Example Co', sameAs: 'https://example.com' },
    jobLocation: { address: { addressLocality: 'Paris', addressCountry: 'FR', postalCode: '75001' } },
    description: '<p>Build data products.</p>',
  };
  const record = parseJobPostingHtml(`<html><script type="application/ld+json">${JSON.stringify(posting)}</script></html>`, 'https://example.com/job/1');
  assert.equal(record?.title, 'Data Engineer');
  assert.deepEqual(record?.employmentType, ['FULL_TIME']);
  assert.equal(record?.company, 'Example Co');
  assert.equal(record?.jobLocation[0]?.addressCountry, 'FR');
  assert.equal(record?.description, '<p>Build data products.</p>');
});

test('accepts JSON-LD wrapped in an HTML comment or trailing semicolon', () => {
  const posting = { '@type': 'JobPosting', title: 'QA Engineer', jobLocation: [] };
  const html = `<script TYPE="application/ld+json"><!--${JSON.stringify(posting)};--></script>`;
  assert.equal(parseJobPostingHtml(html, 'https://example.com/job/2')?.title, 'QA Engineer');
});
