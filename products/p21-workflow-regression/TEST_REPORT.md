# p21 Test Report

Date: 2026-08-10

## Results

- `npm test`: 8/8 passed, including n8n connections, sequential Make flow, Make router branches, HTTP execution, regression differences, and cost validation.
- `npm run test:e2e`: passed with `WORKFLOW_REGRESSION_E2E_OK`; a local HTTP fixture changed from revision 1 to revision 2 and the report classified the case as changed.
- `docker build -t workflow-regression-local:dev .`: passed on Node 20 Alpine.
- Container runtime: `/health` returned 200; valid cost input returned USD 16 / CNY 115.20; missing fields returned 400; n8n parsing returned a normalized workflow and hash.
- Browser: 1440x900 and 390x844 rendered meaningful content, eight inputs, and the recalculate control; no horizontal overflow or console errors.

## Limits

- Execution targets HTTP JSON endpoints and does not embed arbitrary n8n/Make nodes.
- No hosted scheduler, authentication, payment, production database, public deployment, or stranger payment was tested.
