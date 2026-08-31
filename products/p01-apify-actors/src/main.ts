import { Actor, log } from 'apify';
import { normalizeInput } from './input.js';
import { scrape } from './scraper.js';
import { BrowserWafTokenSource } from './waf-browser.js';

/**
 * The token source is always constructed, but it is lazy: no browser launches
 * until a request is actually challenged. Measured 2026-09-01, the sitemap
 * endpoints answer 200 with no token at all, so a run against an unprotected
 * host pays nothing for having this wired in.
 */
await Actor.main(async () => {
  const input = normalizeInput(await Actor.getInput());
  const tokenSource = new BrowserWafTokenSource();
  try {
    const { results, summary } = await scrape(input, {
      tokenSource,
      onWarning: (url, error) => {
        log.warning(
          `Failed to fetch or parse ${url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    });
    for (const result of results) await Actor.pushData(result);
    await Actor.setValue('run-summary', {
      ...summary,
      filters: {
        country: input.country,
        city: input.city,
        contractType: input.contractType,
        company: input.company,
        updatedSince: input.updatedSince?.toISOString(),
      },
    });
    // Browser launches are the cost driver of this Actor, so they are reported
    // next to the result count rather than buried in the key-value store.
    log.info(
      `Completed: ${results.length} matching job postings ` +
        `(wafChallenges=${summary.wafChallenges}, wafTokenMints=${summary.wafTokenMints})`,
    );
  } finally {
    await tokenSource.close();
  }
});
