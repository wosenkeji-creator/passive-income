import { Actor, log } from 'apify';
import { normalizeInput } from './input.js';
import { scrape } from './scraper.js';

await Actor.main(async () => {
  const input = normalizeInput(await Actor.getInput());
  const { results, summary } = await scrape(input, (url, error) => {
    log.warning(`Failed to fetch or parse ${url}: ${error instanceof Error ? error.message : String(error)}`);
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
  log.info(`Completed: ${results.length} matching job postings`);
});
