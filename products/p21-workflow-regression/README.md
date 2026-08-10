# Workflow Regression Local MVP

Local-first n8n and Make workflow regression testing. The project normalizes workflow exports, captures versioned baselines, runs JSON HTTP test cases, reports workflow/output differences, and can post a webhook alert when a regression is detected.

## Verify

```bash
npm ci
npm run verify
docker build -t workflow-regression-local:dev .
```

## CLI

Create a baseline against a local or test webhook:

```bash
npm run build
node dist/cli.js baseline --workflow examples/n8n-workflow.json --cases examples/test-cases.json --endpoint http://localhost:5678/webhook-test/lead --out baseline.json
```

Run regression checks:

```bash
node dist/cli.js run --workflow examples/n8n-workflow.json --cases examples/test-cases.json --endpoint http://localhost:5678/webhook-test/lead --baseline baseline.json --out report.json --markdown report.md
```

Add `--alert-url https://...` to the run command to post a JSON alert only when the report fails. No credentials are stored by the application.

## Local API and calculator

```bash
npm run build
npm start
```

Open `http://localhost:3000`. Health is available at `/health`, workflow parsing at `POST /api/parse`, and cost calculation at `POST /api/calculate`.

## Current limits

- The n8n parser handles exported nodes, connections, settings, and positions.
- The Make parser handles sequential blueprint flows and nested `routes[].flow` router branches. Unsupported future export variants must be added with fixture tests.
- Test execution targets HTTP endpoints. Embedded execution of arbitrary n8n/Make nodes is deliberately out of scope for the local MVP.
- No scheduling, hosted persistence, accounts, payment, or production database is included.
