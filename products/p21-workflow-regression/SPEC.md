# p21 - Workflow Regression Test

Start date: 2026-08-10
Current gate: G0

## One sentence

n8n and Make operators upload a workflow definition, capture a baseline, rerun HTTP test cases, and receive a machine-readable and human-readable difference report with an optional webhook alert.

## Distribution

- Channels: n8n community forum, r/n8n, GitHub README discovery.
- Natural discovery hypothesis: users searching for n8n/Make regression testing find the repository or community examples. This remains unverified, as recorded in D005.
- Price: USD 39/month target from D005.
- Policy risk: community promotion rules and hosted-service payment requirements remain to be verified before G2.

## Unit economics

- Pricing model: subscription.
- Target price: USD 39/month.
- Gross revenue target: 26 active subscriptions produce USD 1,014/month before fees and operating costs.
- Marginal cost: HTTP execution traffic, report storage, and optional model usage; local MVP uses no paid model.
- Payout timing and KYC: not decided in D005; no payment provider is implemented in G0/G1.

## Riskiest assumption

- Assumption: strangers will discover and pay for regression testing despite strong free tiers from promptfoo and Langfuse.
- Cheapest falsification: publish a working G2 version and track stranger payments.
- Deadline: 60 days after G2.
- Kill condition: no stranger payment within 60 days after G2, or an incumbent ships the same n8n/Make workflow feature.

## Maintenance

- Intervention triggers: n8n/Make export format changes, runtime HTTP compatibility, security fixes, and alert delivery failures.
- Target maintenance: at most 2 hours/week before G4; G4 still requires less than 2 hours/month and response obligations that fit a 15-minute intervention.
- Trend: should fall as parsers stabilize; rising maintenance invalidates the product.

## Scope

Build:

- n8n and Make workflow normalization.
- Versioned baseline snapshots.
- HTTP test-case execution.
- Workflow and output difference reports in JSON and Markdown.
- Webhook alert adapter.
- Local API, cost calculator page, Docker image, examples, and tests.

Do not build:

- Workflow orchestration or an internal management dashboard.
- Payment, production accounts, hosted scheduling, or production database writes in the local MVP.
- Prompt injection, log diagnosis, synthetic data, or other candidates that D005 leaves undecided.

## Reuse

- No shared package until p22 proves an identical implementation is needed.
- Normalization and report types may become shared only after real duplication exists.
