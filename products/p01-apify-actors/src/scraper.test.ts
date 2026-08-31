import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { normalizeInput } from './input.js';
import { scrape } from './scraper.js';

test('scrapes a sitemap index and detail pages end to end', async () => {
  const posting = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Data Engineer',
    hiringOrganization: { '@type': 'Organization', name: 'Example Co' },
    employmentType: 'FULL_TIME',
    jobLocation: { address: { addressLocality: 'Paris', addressCountry: 'FR' } },
  };
  const server = createServer((request, response) => {
    response.setHeader('content-type', request.url?.endsWith('.xml') ? 'application/xml' : 'text/html');
    if (request.url === '/index.xml') {
      const port = (server.address() as { port: number }).port;
      response.end(`<sitemapindex><sitemap><loc>http://127.0.0.1:${port}/jobs.xml</loc></sitemap></sitemapindex>`);
      return;
    }
    if (request.url === '/jobs.xml') {
      const port = (server.address() as { port: number }).port;
      response.end(`<urlset><url><loc>http://127.0.0.1:${port}/job/1</loc><lastmod>2026-08-09</lastmod></url></urlset>`);
      return;
    }
    response.end(`<script type="application/ld+json">${JSON.stringify(posting)}</script>`);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const input = normalizeInput({ sitemapUrl: `http://127.0.0.1:${address.port}/index.xml`, maxResults: 1 });
  try {
    const { results, summary } = await scrape(input);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.company, 'Example Co');
    assert.equal(summary.parsedPostings, 1);
    assert.equal(summary.matchedResults, 1);
  } finally {
    server.close();
  }
});
