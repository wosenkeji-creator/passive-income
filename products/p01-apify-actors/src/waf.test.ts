import assert from 'node:assert/strict';
import test from 'node:test';
import type { WafToken, WafTokenSource } from './types.js';
import { WafTokenCache, isWafChallenge } from './waf.js';

function headers(entries: Record<string, string> = {}): Headers {
  return new Headers(entries);
}

/** The interstitial body observed on WTTJ: 2452 bytes with an awsWafCookie call. */
const CHALLENGE_BODY =
  '<html><head><script src="https://de5282c3ca0c.us-east-1.token.awswaf.com/challenge.js">' +
  '</script></head><body><script>window.awsWafCookieDomainList=[];</script></body></html>';

test('a 202 carrying the challenge script is recognised as a block', () => {
  assert.equal(isWafChallenge(202, headers(), CHALLENGE_BODY), true);
});

test('a 200 JobPosting page is not a block', () => {
  const body = '<html><script type="application/ld+json">{"@type":"JobPosting"}</script></html>';
  assert.equal(isWafChallenge(200, headers(), body), false);
});

test('a 202 without any challenge marker is not a block', () => {
  // Guards against classifying every 202 as a WAF page: the discriminator has to
  // be the body or the header, not the status alone.
  assert.equal(isWafChallenge(202, headers(), '<html>accepted</html>'), false);
});

test('the x-amzn-waf-action header alone is sufficient', () => {
  // Documented by AWS as the authoritative signal; it must win even on a 200
  // with an otherwise innocent body.
  assert.equal(isWafChallenge(200, headers({ 'x-amzn-waf-action': 'challenge' }), 'ok'), true);
});

test('a marker beyond the inspected prefix does not produce a false positive', () => {
  // isWafChallenge only reads the first 4096 bytes, matching the fetcher, which
  // decodes just that prefix. A page merely mentioning the string far down the
  // document must not be misread as an interstitial.
  const body = `${'x'.repeat(5000)}awsWafCookie`;
  assert.equal(isWafChallenge(202, headers(), body), false);
});

class CountingSource implements WafTokenSource {
  calls = 0;
  private readonly delayMs: number;

  constructor(delayMs = 0) {
    this.delayMs = delayMs;
  }

  async mint(): Promise<WafToken> {
    this.calls += 1;
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return { cookie: `aws-waf-token=t${this.calls}`, userAgent: `UA-${this.calls}` };
  }
}

test('a token is minted once and then reused', async () => {
  const source = new CountingSource();
  const cache = new WafTokenCache(source, { ttlMs: 60_000, now: () => 0 });
  const first = await cache.acquire();
  const second = await cache.acquire();
  assert.equal(source.calls, 1);
  assert.equal(first.token.cookie, second.token.cookie);
  assert.equal(first.generation, second.generation);
});

test('concurrent acquisitions collapse into a single browser launch', async () => {
  // This is the property that keeps the cost model intact: N workers sharing a
  // dead token must not mean N browser launches.
  const source = new CountingSource(25);
  const cache = new WafTokenCache(source, { ttlMs: 60_000, now: () => 0 });
  const held = await Promise.all([cache.acquire(), cache.acquire(), cache.acquire()]);
  assert.equal(source.calls, 1);
  assert.equal(new Set(held.map((item) => item.generation)).size, 1);
});

test('a token past its ttl is re-minted', async () => {
  // The ttl must be honoured because the measured usable window is ~5 minutes of
  // steady traffic, not the 96h the cookie's own expiry advertises.
  let clock = 0;
  const source = new CountingSource();
  const cache = new WafTokenCache(source, { ttlMs: 1_000, now: () => clock });
  const first = await cache.acquire();
  clock = 1_001;
  const second = await cache.acquire();
  assert.equal(source.calls, 2);
  assert.notEqual(first.token.cookie, second.token.cookie);
  assert.equal(second.generation, first.generation + 1);
});

test('refresh replaces the generation that was rejected', async () => {
  const source = new CountingSource();
  const cache = new WafTokenCache(source, { ttlMs: 60_000, now: () => 0 });
  const first = await cache.acquire();
  const replaced = await cache.refresh(first.generation);
  assert.equal(source.calls, 2);
  assert.equal(replaced.token.cookie, 'aws-waf-token=t2');
  assert.equal(replaced.generation, first.generation + 1);
});

test('refreshing an already-superseded generation does not mint again', async () => {
  // Two workers failing on the same dead token must cost one re-mint, not two.
  // Without the generation check the second worker would discard the token the
  // first one just minted.
  const source = new CountingSource();
  const cache = new WafTokenCache(source, { ttlMs: 60_000, now: () => 0 });
  const stale = await cache.acquire();
  const fresh = await cache.refresh(stale.generation);
  const late = await cache.refresh(stale.generation);
  assert.equal(source.calls, 2);
  assert.equal(late.token.cookie, fresh.token.cookie);
  assert.equal(late.generation, fresh.generation);
});

test('mintCount reports the number of browser launches', async () => {
  const source = new CountingSource();
  const cache = new WafTokenCache(source, { ttlMs: 60_000, now: () => 0 });
  assert.equal(cache.mintCount, 0);
  const held = await cache.acquire();
  assert.equal(cache.mintCount, 1);
  await cache.refresh(held.generation);
  assert.equal(cache.mintCount, 2);
});

test('a failed mint does not latch and the next attempt can succeed', async () => {
  // A transient launch failure must not leave the single-flight promise pinned,
  // which would make every later request inherit the same rejection.
  let attempt = 0;
  const source: WafTokenSource = {
    async mint(): Promise<WafToken> {
      attempt += 1;
      if (attempt === 1) throw new Error('browser launch failed');
      return { cookie: 'aws-waf-token=ok', userAgent: 'UA' };
    },
  };
  const cache = new WafTokenCache(source, { ttlMs: 60_000, now: () => 0 });
  await assert.rejects(() => cache.acquire(), /browser launch failed/);
  const recovered = await cache.acquire();
  assert.equal(recovered.token.cookie, 'aws-waf-token=ok');
  assert.equal(cache.mintCount, 1);
});
