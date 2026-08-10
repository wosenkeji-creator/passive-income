# Store listing draft

## Title

Unofficial Public Job JSON-LD Scraper

## Short description

Extract structured public job listings from Welcome to the Jungle sitemaps and schema.org `JobPosting` data. No login, cookies, or browser automation required.

## Highlights

- Filters by country, city, contract type, company, and sitemap update time.
- Returns normalized job, company, location, contract, and date fields.
- Reads semantic JSON-LD fields instead of fragile CSS selectors.
- Separates blocked HTTP responses from page-structure failures in the run summary.
- Applies explicit page, result, concurrency, and timeout limits.

## Usage

Use the defaults for a small public crawl, or provide filters such as the example in `examples/input.json`. Results are written to the default dataset. Diagnostics are written to the `run-summary` key in the default key-value store.

## Output

Each dataset item can contain `url`, `title`, `company`, `companyUrl`, `employmentType`, `datePosted`, `validThrough`, `industry`, `experienceRequirements`, `qualifications`, `description`, `jobLocation`, and `sourceLastModified`.

## Limitations

- This is an unofficial tool and is not affiliated with or endorsed by Welcome to the Jungle.
- It reads public pages only and never accepts account credentials or session cookies.
- Target-site throttling or blocking can reduce output; inspect `blockedResponses` and `requestFailures` in the run summary.
- Verify that your use of the data complies with applicable law and the source website's terms.

## Suggested screenshots

1. Input form with country, city, contract type, and result limit populated.
2. Dataset table showing title, company, location, contract type, and date.
3. Key-value store view showing a successful `run-summary`.
