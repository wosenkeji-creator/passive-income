import { Actor, log } from 'apify';
import { normalizeInput } from './input.js';
import { scrape } from './scraper.js';

await Actor.init();
try {
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
  await Actor.exit({ exit: false });
} catch (error) {
  const actorError = error instanceof Error ? error : new Error(String(error));
  log.exception(actorError, actorError.message);
  process.exitCode = 1;
  await Actor.exit({ exit: false, exitCode: 1 });
}
