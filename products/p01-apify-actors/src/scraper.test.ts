import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { normalizeInput } from './input.js';
import { scrape } from './scraper.js';
import type { WafToken, WafTokenSource } from './types.js';

const POSTING = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Data Engineer',
  hiringOrganization: { '@type': 'Organization', name: 'Example Co' },
  employmentType: 'FULL_TIME',
  jobLocation: { address: { addressLocality: 'Paris', addressCountry: 'FR' } },
};

/** Byte-for-byte shape of the interstitial WTTJ returns: 202 plus a challenge script. */
const CHALLENGE_BODY =
  '<html><head><script src="https://x.us-east-1.token.awswaf.com/challenge.js"></script>' +
  '</head><body><script>window.awsWafCookieDomainList=[];</script></body></html>';

async function listen(server: Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

test('scrapes a sitemap index and detail pages end to end', async () => {
  const posting = POSTING;
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
  const port = await listen(server);
  const input = normalizeInput({ sitemapUrl: `http://127.0.0.1:${port}/index.xml`, maxResults: 1 });
  try {
    const { results, summary } = await scrape(input);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.company, 'Example Co');
    assert.equal(summary.parsedPostings, 1);
    assert.equal(summary.matchedResults, 1);
    // No token source was supplied, so the browser-free path must stay untouched.
    assert.equal(summary.wafTokenMints, 0);
    assert.equal(summary.wafChallenges, 0);
  } finally {
    server.close();
  }
});

/**
 * A server that challenges any request whose cookie is not the currently valid
 * token — the session-scoped behaviour measured on WTTJ, where slowing down does
 * not help and only a freshly minted token does.
 */
function challengingServer(
  validToken: () => string,
  options: { sendActionHeader?: boolean } = {},
): {
  server: Server;
  challenged: () => number;
} {
  const sendActionHeader = options.sendActionHeader ?? true;
  let challenged = 0;
  const server = createServer((request, response) => {
    const port = (server.address() as { port: number }).port;
    const isXml = request.url?.endsWith('.xml');
    const cookie = request.headers.cookie ?? '';
    if (!isXml && cookie !== validToken()) {
      challenged += 1;
      response.statusCode = 202;
      response.setHeader('content-type', 'text/html');
      // Optional on purpose: WTTJ was measured sending this header, but detection
      // must not depend on it — the status-plus-body path is the fallback and needs
      // its own end-to-end coverage.
      if (sendActionHeader) response.setHeader('x-amzn-waf-action', 'challenge');
      response.end(CHALLENGE_BODY);
      return;
    }
    response.setHeader('content-type', isXml ? 'application/xml' : 'text/html');
    if (request.url === '/index.xml') {
      response.end(
        `<sitemapindex><sitemap><loc>http://127.0.0.1:${port}/jobs.xml</loc></sitemap></sitemapindex>`,
      );
      return;
    }
    if (request.url === '/jobs.xml') {
      response.end(
        `<urlset><url><loc>http://127.0.0.1:${port}/job/1</loc></url>` +
          `<url><loc>http://127.0.0.1:${port}/job/2</loc></url></urlset>`,
      );
      return;
    }
    response.end(`<script type="application/ld+json">${JSON.stringify(POSTING)}</script>`);
  });
  return { server, challenged: () => challenged };
}

test('a challenged page is recovered by minting a token, not counted as unparseable', async () => {
  // The regression this pins: before the token path, the 202 interstitial reached
  // the JSON-LD parser, produced no JobPosting, and was tallied as invalidPages —
  // which is how a network block was read as "WTTJ changed its page structure".
  let issued = 0;
  // Non-empty on purpose: a token-less request sends no cookie header at all, so
  // an empty "currently valid" value would be matched by it and the server would
  // never challenge anything.
  const state = { token: 'aws-waf-token=not-yet-minted' };
  const source: WafTokenSource = {
    async mint(): Promise<WafToken> {
      issued += 1;
      state.token = `aws-waf-token=mint${issued}`;
      return { cookie: state.token, userAgent: 'Mozilla/5.0 (minted)' };
    },
  };
  const { server, challenged } = challengingServer(() => state.token);
  const port = await listen(server);
  const input = normalizeInput({
    sitemapUrl: `http://127.0.0.1:${port}/index.xml`,
    maxResults: 2,
    concurrency: 1,
  });
  try {
    const { results, summary } = await scrape(input, { tokenSource: source });
    assert.equal(results.length, 2);
    assert.equal(summary.parsedPostings, 2);
    assert.equal(summary.invalidPages, 0, 'a WAF block must not be filed as a parse failure');
    assert.equal(summary.requestFailures, 0);
    // Minting is lazy on purpose: the first detail request goes out token-less
    // and is challenged, which is what pays for the mint. The measured reason is
    // that the sitemap endpoints answer 200 with no token, so an eager mint would
    // send the browser to a page that never issues one.
    assert.equal(challenged(), 1, 'exactly the first detail request should be challenged');
    assert.equal(summary.wafChallenges, 1);
    assert.equal(summary.wafTokenMints, 1);
  } finally {
    server.close();
  }
});

test('a token invalidated mid-run is re-minted once and the page still lands', async () => {
  // The server has already rotated past the value the first mint hands back,
  // reproducing the ~5-minute usable window expiring mid-scrape. The run has to
  // survive it: observe the rejection, re-mint, and land the page.
  const state = { token: 'aws-waf-token=rotated' };
  let issued = 0;
  const rotating: WafTokenSource = {
    async mint(): Promise<WafToken> {
      issued += 1;
      const cookie = issued === 1 ? 'aws-waf-token=stale' : state.token;
      return { cookie, userAgent: 'Mozilla/5.0 (minted)' };
    },
  };
  const { server, challenged } = challengingServer(() => state.token);
  const port = await listen(server);
  const input = normalizeInput({
    sitemapUrl: `http://127.0.0.1:${port}/index.xml`,
    maxResults: 1,
    concurrency: 1,
  });
  try {
    const { results, summary } = await scrape(input, { tokenSource: rotating });
    assert.equal(results.length, 1);
    // Two distinct rejections: the token-less first request, then the dead token.
    // Both must be visible as challenges rather than swallowed as retries.
    assert.equal(summary.wafChallenges, 2);
    assert.equal(summary.wafTokenMints, 2);
    assert.equal(summary.invalidPages, 0);
    assert.equal(summary.requestFailures, 0);
    assert.equal(challenged(), 2);
  } finally {
    server.close();
  }
});

test('a challenge with no x-amzn-waf-action header is still recovered', async () => {
  // The three tests above all let the mock send `x-amzn-waf-action`, which means
  // they pass even if the status-plus-body branch of `isWafChallenge` is broken.
  // A CloudFront edge is not contractually obliged to attach that header, so the
  // fallback path gets its own end-to-end run.
  let issued = 0;
  const state = { token: 'aws-waf-token=not-yet-minted' };
  const source: WafTokenSource = {
    async mint(): Promise<WafToken> {
      issued += 1;
      state.token = `aws-waf-token=mint${issued}`;
      return { cookie: state.token, userAgent: 'Mozilla/5.0 (minted)' };
    },
  };
  const { server, challenged } = challengingServer(() => state.token, {
    sendActionHeader: false,
  });
  const port = await listen(server);
  const input = normalizeInput({
    sitemapUrl: `http://127.0.0.1:${port}/index.xml`,
    maxResults: 2,
    concurrency: 1,
  });
  try {
    const { results, summary } = await scrape(input, { tokenSource: source });
    assert.equal(results.length, 2);
    assert.equal(summary.parsedPostings, 2);
    assert.equal(summary.invalidPages, 0, 'the 202 body must not reach the JSON-LD parser');
    assert.equal(summary.requestFailures, 0);
    assert.equal(challenged(), 1);
    assert.equal(summary.wafChallenges, 1);
    assert.equal(summary.wafTokenMints, 1);
  } finally {
    server.close();
  }
});

test('a permanently blocked host fails loudly instead of reporting zero parsed pages', async () => {
  // Without the challenge classification this run would end in
  // "No JobPosting records parsed ... invalid=N", pointing the operator at the
  // parser. The message now has to name the block.
  const source: WafTokenSource = {
    async mint(): Promise<WafToken> {
      return { cookie: 'aws-waf-token=never-accepted', userAgent: 'Mozilla/5.0 (minted)' };
    },
  };
  const { server } = challengingServer(() => 'aws-waf-token=unobtainable');
  const port = await listen(server);
  const input = normalizeInput({
    sitemapUrl: `http://127.0.0.1:${port}/index.xml`,
    maxResults: 1,
    concurrency: 1,
  });
  try {
    await assert.rejects(
      () => scrape(input, { tokenSource: source }),
      (error: Error) => {
        assert.match(error.message, /wafBlocked=[1-9]/);
        assert.match(error.message, /invalid=0/);
        return true;
      },
    );
  } finally {
    server.close();
  }
});

