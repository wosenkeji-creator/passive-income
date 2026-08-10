import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { normalizeInput } from './input.js';
import { HttpResponseError, scrape } from './scraper.js';

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

test('deduplicates sitemap URLs and strictly caps concurrent results', async () => {
  const posting = JSON.stringify({ '@type': 'JobPosting', title: 'Engineer', jobLocation: [] });
  const fetchedPaths: string[] = [];
  const server = createServer((request, response) => {
    const port = (server.address() as { port: number }).port;
    if (request.url === '/jobs.xml') {
      response.setHeader('content-type', 'application/xml');
      response.end(`<urlset>${[1, 1, 2, 3, 4].map((id) => `<url><loc>http://127.0.0.1:${port}/job/${id}</loc></url>`).join('')}</urlset>`);
      return;
    }
    fetchedPaths.push(request.url ?? '');
    setTimeout(() => response.end(`<script type="application/ld+json">${posting}</script>`), 10);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const input = normalizeInput({
      sitemapUrl: `http://127.0.0.1:${address.port}/jobs.xml`,
      maxResults: 2,
      maxPages: 10,
      concurrency: 4,
    });
    const { results, summary } = await scrape(input);
    assert.equal(results.length, 2);
    assert.equal(summary.matchedResults, 2);
    assert.equal(summary.candidatePages, 4);
    assert.equal(new Set(fetchedPaths).size, fetchedPaths.length);
  } finally {
    server.close();
  }
});

test('separates blocked responses from structural parse failures', async () => {
  const warnings: unknown[] = [];
  const server = createServer((request, response) => {
    const port = (server.address() as { port: number }).port;
    if (request.url === '/jobs.xml') {
      response.setHeader('content-type', 'application/xml');
      response.end(`<urlset>${['valid', 'accepted', 'forbidden', 'invalid'].map((name) => `<url><loc>http://127.0.0.1:${port}/${name}</loc></url>`).join('')}</urlset>`);
      return;
    }
    if (request.url === '/accepted') { response.statusCode = 202; response.end(); return; }
    if (request.url === '/forbidden') { response.statusCode = 403; response.end(); return; }
    if (request.url === '/invalid') { response.end('<html>No structured job data</html>'); return; }
    response.end('<script type="application/ld+json">{"@type":"JobPosting","title":"Valid","jobLocation":[]}</script>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const input = normalizeInput({ sitemapUrl: `http://127.0.0.1:${address.port}/jobs.xml`, maxPages: 4, concurrency: 1 });
    const { summary } = await scrape(input, (_url, error) => warnings.push(error));
    assert.equal(summary.blockedResponses, 2);
    assert.equal(summary.requestFailures, 2);
    assert.equal(summary.invalidPages, 1);
    assert.equal(summary.parsedPostings, 1);
    assert.ok(warnings.every((error) => error instanceof HttpResponseError));
  } finally {
    server.close();
  }
});

test('retains entries with malformed lastmod because freshness is unknown', async () => {
  const posting = JSON.stringify({ '@type': 'JobPosting', title: 'Engineer', jobLocation: [] });
  const server = createServer((request, response) => {
    const port = (server.address() as { port: number }).port;
    if (request.url === '/jobs.xml') {
      response.end(`<urlset><url><loc>http://127.0.0.1:${port}/job</loc><lastmod>not-a-date</lastmod></url></urlset>`);
      return;
    }
    response.end(`<script type="application/ld+json">${posting}</script>`);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const input = normalizeInput({ sitemapUrl: `http://127.0.0.1:${address.port}/jobs.xml`, updatedSince: '2026-08-01' });
    const { results } = await scrape(input);
    assert.equal(results.length, 1);
  } finally {
    server.close();
  }
});
