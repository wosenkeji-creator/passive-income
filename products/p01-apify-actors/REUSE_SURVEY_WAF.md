# reuse_survey — AWS WAF challenge on welcometothejungle.com

Date: 2026-09-01. Trigger: new capability domain (anti-bot token management) and
>80 new lines, so P-0 requires a recorded survey before any from-scratch code.

## What the requirement actually is

Measured, not assumed:

- WTTJ detail pages return `HTTP 202`, exactly `2452` bytes, `Server: CloudFront`,
  body containing `window.awsWafCookie` after a handful of plain HTTP requests.
  `parseJobPostingHtml` finds no `application/ld+json` there, returns `undefined`,
  and `scraper.ts` counted it as `invalidPages` — a network-identity block that
  presented as a parser failure. That is the real G1 blocker.
- The block is session-scoped, not rate-scoped: 18 requests at 4s spacing → 18/18
  challenged; 20 requests at 8s spacing → 20/20 challenged. Slowing down does not help.
- A real browser passes, because the challenge self-solves in JS and reloads.
- The resulting `aws-waf-token` cookie (~362-370 bytes) can be lifted out of the
  browser and replayed over plain HTTP: serial 15/15 OK, concurrency 5 → 40/40 in
  9.3s = 4.28 pages/s.
- The token's usable window is **~5 minutes of steady traffic**
  (`FIRST_SUSTAINED_BLOCK_AT_MIN=5.77`), not the 96h its cookie expiry advertises.

So the capability needed is narrow: *mint a token in a real browser occasionally,
and let a browser-free HTTP fetcher use it until it stops working.*

## Candidates evaluated

| Candidate | Ladder level | Verdict |
| --- | --- | --- |
| `playwright` 1.62.1 | L1 use as-is | **ACCEPTED** for minting. Already resolvable on this host; `chromium-1234` is installed and `chromium.launch()` succeeds in 742ms with no `executablePath` override. |
| `apify/actor-node-playwright-chrome:20` | L1 use as-is | **ACCEPTED** for the Actor runtime, replacing `apify/actor-node:20`. Apify's own image already ships Chromium and its dependencies; installing browsers in a custom image would be reimplementing it. |
| `crawlee` / `@crawlee/playwright` `PlaywrightCrawler` | L1 use as-is | **Rejected as the scrape driver.** It runs a browser per page (measured 2.0-4.1s/page here) which destroys the $0.00001/result marginal-cost model that the whole product line depends on. The measured HTTP path is ~4.28 pages/s. |
| `@crawlee/http` + `SessionPool`/`Session` cookie jar | L4 compose | **Rejected.** `@crawlee/core` 3.18.0 is already present transitively and does expose `session_pool`, but a `SessionPool` manages *rotation of many sessions*, not *minting an AWS WAF token*. It would still need the browser step written by hand, so it adds a crawler framework's control flow without removing the part that is actually missing. Pulling `@crawlee/http` + `@crawlee/playwright` to reuse a cookie jar is the "large dependency to avoid five trivial lines" anti-pattern P-0 warns about. |
| `got-scraping` 4.2.1 (already installed) | L1 use as-is | **Rejected as sufficient.** TLS + header generation is not the discriminator: measured 6 requests → 1 success, 5 challenged. Once a token exists, plain `fetch` works, so no HTTP client swap is needed. |
| `xKiian/awswaf`, `jonathanyly/awswaf-solver-api`, `kareeen133/AWS-WAF-Solver` | L3 fork | **Rejected.** These reverse-engineer the challenge crypto and extract encryption params from `challenge.js` at runtime. That is a maintenance liability that breaks whenever AWS rotates the challenge, to save a browser launch we already have working. |
| CapSolver / commercial captcha APIs | L1 use as-is | **Rejected.** Paid per solve. Conflicts with the "no purchased quota" constraint and with the retained hard boundary on real payments, and is unnecessary because the challenge self-solves without a captcha here. |
| Residential proxies | — | **Rejected earlier and still rejected.** The block is session-scoped; a new IP buys the same ~5 minutes at a recurring cost. |

## What is left to build

Only the glue the survey found no owner for, kept deliberately small:

1. **Challenge detection** — recognise `202` + `awsWafCookie`/`x-amzn-waf-action`
   as a block rather than a success. `scraper.ts:fetchBody` currently treats `202`
   as `response.ok` and hands the interstitial to the parser.
2. **Token cache with single-flight re-mint** — one browser launch at a time, a
   generation counter so N concurrent workers hitting a dead token cause one
   re-mint rather than N, and a proactive TTL below the measured 5-minute window.

Everything else (browser, HTTP, parsing, sitemap) is existing code or an
existing package.

## Post-implementation measurement (2026-09-01, later the same day)

Two survey premises turned out to be wrong about *how* the token behaves, and the
corrections are recorded here rather than left as folklore:

- **Token issuance is per-context and intermittent, not "visit a protected page and
  wait".** A fresh Chromium context received `aws-waf-token` in 0.8-1.0s on some
  attempts and never within 15s on others, because a token is only issued when the
  WAF actually decides to challenge that context. The original single-context 45s
  wait therefore produced a live run with **14 challenges and 0 mints**. The fix is
  to cycle fresh contexts on a short (8s) per-attempt deadline; a context that was
  not challenged will not yield a token no matter how long it is polled.
- **A misleading intermediate result nearly changed the architecture.** Replaying a
  browser cookie jar over plain HTTP appeared to stay challenged (202/2452), which
  would have meant the block was fingerprint-gated and the HTTP fetcher unusable.
  That measurement was invalid: the context being copied held no `aws-waf-token` at
  all. With a genuinely minted token, plain `fetch` lands **8/8 serially** and
  **40/40 at concurrency 5 in 9.8s (4.09 pages/s, 0 challenges)**. Token alone and
  full jar perform identically, so only the WAF cookie matters.

End-to-end against the live site, browser-mints-once + HTTP-does-the-volume:

| Run | Pages | Result |
| --- | --- | --- |
| 25 pages, concurrency 5 | 25/25 parsed | 16.6s, 1 mint, 5 challenges, 0 failures |
| 220 candidates, concurrency 5 | 204/204 parsed | 61.6s, **3.31 pages/s**, 1 mint, 5 challenges, 0 failures |

The cost model in the survey survives: one browser launch amortised over 200+
pages, not one per page. `PlaywrightCrawler` remains correctly rejected — it would
have cost ~200 page loads for the same work.

