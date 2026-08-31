import assert from 'node:assert/strict';
import test from 'node:test';
import type { Browser } from 'playwright';
import { BrowserWafTokenSource } from './waf-browser.js';

/**
 * A fake Playwright browser.
 *
 * `challengeOn` decides which context indices are "challenged" and therefore
 * receive an `aws-waf-token`. This is the behaviour that made the real fix
 * necessary: issuance is per-context and intermittent, so a context that was not
 * challenged never gets a token no matter how long it is polled.
 */
function fakeBrowser(options: {
  challengeOn: (contextIndex: number) => boolean;
  userAgent?: string;
}): { browser: Browser; contexts: () => number; closedContexts: () => number } {
  let created = 0;
  let closed = 0;
  const browser = {
    isConnected: () => true,
    async close(): Promise<void> {},
    async newContext() {
      const index = created++;
      const issues = options.challengeOn(index);
      return {
        async newPage() {
          return {
            async evaluate(): Promise<string> {
              return options.userAgent ?? 'Mozilla/5.0 (fake)';
            },
            async goto(): Promise<null> {
              return null;
            },
            async waitForTimeout(): Promise<void> {},
          };
        },
        async cookies() {
          return issues
            ? [{ name: 'aws-waf-token', value: `tok-${index}` }]
            : [{ name: 'wttj-user-language', value: 'en' }];
        },
        async close(): Promise<void> {
          closed += 1;
        },
      };
    },
  };
  return {
    browser: browser as unknown as Browser,
    contexts: () => created,
    closedContexts: () => closed,
  };
}

test('a token is returned from the first context that is actually challenged', async () => {
  const fake = fakeBrowser({ challengeOn: (i) => i === 0 });
  const source = new BrowserWafTokenSource({
    launcher: async () => fake.browser,
    attemptTimeoutMs: 50,
  });
  const token = await source.mint('https://example.test/job/1');
  assert.equal(token.cookie, 'aws-waf-token=tok-0');
  assert.equal(token.userAgent, 'Mozilla/5.0 (fake)');
  assert.equal(fake.contexts(), 1, 'a hit on the first context must not cycle further');
});

test('an unchallenged context is abandoned and a fresh one is tried', async () => {
  // The regression this pins: the original code polled one context for 45s. A
  // context that was never challenged will not be issued a token in 45s any more
  // than in 8s, so the live run logged 14 challenges and 0 mints. Cycling is what
  // recovers, not waiting.
  const fake = fakeBrowser({ challengeOn: (i) => i === 2 });
  const source = new BrowserWafTokenSource({
    launcher: async () => fake.browser,
    attemptTimeoutMs: 50,
  });
  const token = await source.mint('https://example.test/job/1');
  assert.equal(token.cookie, 'aws-waf-token=tok-2');
  assert.equal(fake.contexts(), 3);
  assert.equal(fake.closedContexts(), 3, 'every attempted context must be closed');
});

test('a host that never challenges fails after the attempt budget, not silently', async () => {
  const fake = fakeBrowser({ challengeOn: () => false });
  const source = new BrowserWafTokenSource({
    launcher: async () => fake.browser,
    attemptTimeoutMs: 20,
    maxAttempts: 3,
  });
  await assert.rejects(
    () => source.mint('https://example.test/job/1'),
    (error: Error) => {
      // The message has to name both budgets: an operator reading it needs to
      // know the host declined to challenge, not that a timeout was too short.
      assert.match(error.message, /after 3 contexts/);
      assert.match(error.message, /20ms each/);
      assert.match(error.message, /example\.test/);
      return true;
    },
  );
  assert.equal(fake.contexts(), 3);
  assert.equal(fake.closedContexts(), 3);
});

test('the browser is launched once and reused across mints', async () => {
  const fake = fakeBrowser({ challengeOn: () => true });
  let launches = 0;
  const source = new BrowserWafTokenSource({
    launcher: async () => {
      launches += 1;
      return fake.browser;
    },
    attemptTimeoutMs: 20,
  });
  await source.mint('https://example.test/job/1');
  await source.mint('https://example.test/job/2');
  assert.equal(launches, 1, 'a browser launch per mint would be the dominant cost');
  assert.equal(fake.contexts(), 2, 'but each mint needs its own context');
});

test('the hint url is used when given and the warmup url otherwise', async () => {
  const visited: string[] = [];
  const browser = {
    isConnected: () => true,
    async close(): Promise<void> {},
    async newContext() {
      return {
        async newPage() {
          return {
            async evaluate(): Promise<string> {
              return 'Mozilla/5.0 (fake)';
            },
            async goto(url: string): Promise<null> {
              visited.push(url);
              return null;
            },
            async waitForTimeout(): Promise<void> {},
          };
        },
        async cookies() {
          return [{ name: 'aws-waf-token', value: 'tok' }];
        },
        async close(): Promise<void> {},
      };
    },
  } as unknown as Browser;
  const source = new BrowserWafTokenSource({
    launcher: async () => browser,
    attemptTimeoutMs: 20,
    warmupUrl: 'https://example.test/fallback',
  });
  await source.mint('https://example.test/job/7');
  await source.mint();
  // Measured 2026-09-01: the site root issues no token at all, so minting must
  // target the page that was actually challenged whenever the caller knows it.
  assert.deepEqual(visited, ['https://example.test/job/7', 'https://example.test/fallback']);
});
