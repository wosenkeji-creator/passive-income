# Welcome to the Jungle Job Scraper

Unofficial Apify Actor for public Welcome to the Jungle job pages.

The Actor enumerates the public sitemap, reads `JobPosting` JSON-LD from detail pages, and pushes structured job records to the dataset. It does not request cookies, login credentials, or other authenticated session data.

Input supports optional `country`, `city`, `contractType`, `company`, and `updatedSince` filters, plus explicit `maxResults` and `maxPages` limits. A run summary is written to the key-value store so a structurally empty run is distinguishable from a valid zero-match query.

## Local verification

```bash
npm ci
npm run verify
docker build -t wttj-job-scraper:local .
```

`npm run verify` runs unit/integration tests, a full local Actor lifecycle test, the TypeScript build, and an npm package dry run. The lifecycle test uses a temporary local HTTP fixture and temporary Apify storage; it does not contact the live target website.

## Input and output

See `examples/input.json`, `examples/output.json`, and `examples/run-summary.json`. Dataset items contain normalized public job fields. The `run-summary` key separates blocked HTTP responses, retryable failures, other request failures, and pages with no parseable `JobPosting`.

## Live-site status

Local fixtures and the parser contract are covered by automated tests. A live run can still be limited by target-site HTTP 202/403 responses. Treat a nonzero `blockedResponses` value as access blocking, and `invalidPages` as a possible page-structure change.
