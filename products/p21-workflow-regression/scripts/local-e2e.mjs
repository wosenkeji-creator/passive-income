import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { executeCases } from '../dist/executor.js';
import { parseWorkflow } from '../dist/parser.js';
import { createBaseline, createReport } from '../dist/regression.js';

let revision = 1;
const fixture = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ revision }));
});
fixture.listen(0, '127.0.0.1');
await once(fixture, 'listening');
const address = fixture.address();
assert.ok(address && typeof address === 'object');

try {
  const endpoint = `http://127.0.0.1:${address.port}`;
  const workflow = parseWorkflow({ name: 'Fixture', nodes: [{ id: '1', name: 'Webhook', type: 'webhook', parameters: {} }], connections: {} });
  const testCases = [{ name: 'fixture response', input: { ping: true } }];
  const firstRun = await executeCases(testCases, endpoint);
  const baseline = createBaseline(workflow, firstRun);
  revision = 2;
  const secondRun = await executeCases(testCases, endpoint);
  const report = createReport(baseline, workflow, secondRun);
  assert.equal(report.passed, false);
  assert.equal(report.cases[0].status, 'changed');
  console.log('WORKFLOW_REGRESSION_E2E_OK');
} finally {
  fixture.close();
}
