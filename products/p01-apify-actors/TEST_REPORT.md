# Local verification report

Date: 2026-08-10

## Verified

- `npm test`: 10 tests passed.
- `npm run test:e2e`: the compiled Actor read local input, fetched a temporary sitemap and detail page, pushed one dataset item, and wrote `run-summary`.
- `npm pack --dry-run`: the package manifest and included files were generated successfully.
- `docker build -t wttj-job-scraper:local .`: image build completed successfully with Node 20.
- `docker run --rm wttj-job-scraper:local node --version`: the image starts and reports Node `v20.20.2`.

## Covered behavior

- Plain and gzip sitemap decoding.
- Sitemap index and URL-set parsing.
- JSON-LD `JobPosting` extraction, including commented JSON-LD and trailing semicolons.
- Country, city, contract type, and company filters.
- Sitemap URL deduplication and strict `maxResults` enforcement under concurrency.
- Separation of blocked HTTP responses from structurally invalid pages.
- Retention of sitemap entries whose `lastmod` value cannot be parsed.
- Full local Actor storage lifecycle using temporary Apify storage.

## Not verified

- A successful live WTTJ crawl. Direct requests from this machine returned HTTP 403 during this session; previous evidence also records HTTP 202/403 responses. The implementation now reports these as blocked responses instead of misclassifying them as parser failures.
- Apify cloud build, Store publication, pricing events, and production execution. These require an explicit publish/deploy action.
