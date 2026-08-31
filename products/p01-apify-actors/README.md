# Welcome to the Jungle Job Scraper

Unofficial Apify Actor for public Welcome to the Jungle job pages.

The Actor enumerates the public sitemap, reads `JobPosting` JSON-LD from detail pages, and pushes structured job records to the dataset. It does not request cookies, login credentials, or other authenticated session data.

Input supports optional `country`, `city`, `contractType`, `company`, and `updatedSince` filters, plus explicit `maxResults` and `maxPages` limits. A run summary is written to the key-value store so a structurally empty run is distinguishable from a valid zero-match query.
