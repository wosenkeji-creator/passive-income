import type { Browser, BrowserContext } from 'playwright';
import type { WafToken, WafTokenSource } from './types.js';

/**
 * Mint an `aws-waf-token` by letting a real browser solve the challenge.
 *
 * The browser is used *only* as a token mint. The scrape body stays browser-free
 * plain HTTP, which is what keeps the marginal cost model intact: a browser page
 * load measured 2.0-4.1s here, while token-carrying HTTP measured 4.28 pages/s
 * at concurrency 5.
 *
 * The challenge self-solves in JavaScript and reloads the page, so the mint must
 * wait for the *real* document rather than reading the interstitial. Waiting for
 * the cookie itself is the tightest signal available: it appears exactly when the
 * challenge has been accepted.
 */
export interface BrowserWafTokenSourceOptions {
  /**
   * Page to visit when no caller hint is available.
   *
   * Defaults to a protected path rather than the site root: measured 2026-09-01,
   * `/en` served no challenge and issued no `aws-waf-token` in 12s of polling,
   * while a job detail page issued one in ~1s. The mint has to happen where the
   * challenge is actually served.
   */
  warmupUrl?: string;
  /**
   * Budget for one context's attempt, not for the whole mint.
   *
   * Measured 2026-09-01: issuance is per-context and intermittent — a token
   * arrived in 800ms-1s on some fresh contexts and never within 15s on others.
   * Waiting longer on a context that was not challenged does nothing, so the
   * deadline is short and `maxAttempts` contexts are cycled instead. The 45s
   * single-context wait is precisely what produced a live run with 14 challenges
   * and 0 mints.
   */
  attemptTimeoutMs?: number;
  /** Fresh contexts to cycle before declaring the host unwilling to issue a token. */
  maxAttempts?: number;
  headless?: boolean;
  /** Injected in tests; production resolves `playwright` lazily. */
  launcher?: () => Promise<Browser>;
}

const DEFAULT_WARMUP_URL =
  'https://www.welcometothejungle.com/en/companies/algolia/jobs';
const DEFAULT_ATTEMPT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_ATTEMPTS = 6;
const TOKEN_COOKIE_NAME = 'aws-waf-token';

export class BrowserWafTokenSource implements WafTokenSource {
  private readonly warmupUrl: string;
  private readonly attemptTimeoutMs: number;
  private readonly maxAttempts: number;
  private readonly headless: boolean;
  private readonly launcher: () => Promise<Browser>;
  private browser: Browser | null = null;

  constructor(options: BrowserWafTokenSourceOptions = {}) {
    this.warmupUrl = options.warmupUrl ?? DEFAULT_WARMUP_URL;
    this.attemptTimeoutMs = options.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.headless = options.headless ?? true;
    this.launcher =
      options.launcher ??
      (async () => {
        const { chromium } = await import('playwright');
        return chromium.launch({ headless: this.headless });
      });
  }

  async mint(hintUrl?: string): Promise<WafToken> {
    const target = hintUrl ?? this.warmupUrl;
    const browser = await this.ensureBrowser();
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      // A fresh context per attempt: a context that was not challenged will never
      // be issued a token no matter how long it is polled, and a context holding a
      // rejected token would carry it into the retry.
      const context = await browser.newContext();
      try {
        const token = await this.mintInContext(context, target);
        if (token) return token;
      } finally {
        await context.close();
      }
    }
    throw new Error(
      `WAF token was not issued after ${this.maxAttempts} contexts ` +
        `(${this.attemptTimeoutMs}ms each) at ${target}`,
    );
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser) await browser.close();
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) return this.browser;
    this.browser = await this.launcher();
    return this.browser;
  }

  /** Returns null when this context was never challenged, so the caller can cycle. */
  private async mintInContext(
    context: BrowserContext,
    target: string,
  ): Promise<WafToken | null> {
    const page = await context.newPage();
    // Read the User-Agent *before* navigating: when a challenge is served the page
    // reloads itself, and evaluating against a context that is navigating away
    // throws "Execution context was destroyed".
    const userAgent = await page.evaluate(() => navigator.userAgent);
    // `domcontentloaded` rather than `networkidle`: the WAF page reloads itself,
    // and waiting for an idle network on a page that is about to navigate away
    // is how the first probe ended up reading the interstitial.
    await page
      .goto(target, { waitUntil: 'domcontentloaded', timeout: this.attemptTimeoutMs })
      .catch(() => undefined);
    const deadline = Date.now() + this.attemptTimeoutMs;
    while (Date.now() < deadline) {
      const cookie = await this.readToken(context);
      if (cookie) return { cookie, userAgent };
      await page.waitForTimeout(400).catch(() => undefined);
    }
    return null;
  }

  private async readToken(context: BrowserContext): Promise<string | null> {
    const cookies = await context.cookies();
    const token = cookies.find((cookie) => cookie.name === TOKEN_COOKIE_NAME);
    return token && token.value ? `${TOKEN_COOKIE_NAME}=${token.value}` : null;
  }
}
