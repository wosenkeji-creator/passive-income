import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkflow } from './parser.js';
import { createBaseline, createReport } from './regression.js';
import { hashValue } from './utils.js';

const baseWorkflow = parseWorkflow({ name: 'Test', nodes: [{ id: '1', name: 'Start', type: 'trigger', parameters: {} }], connections: {} });
const execution = { name: 'happy path', status: 200, body: { ok: true }, bodyHash: hashValue({ ok: true }), durationMs: 5 };

test('passes an unchanged workflow and output', () => {
  const baseline = createBaseline(baseWorkflow, [execution]);
  const report = createReport(baseline, baseWorkflow, [execution]);
  assert.equal(report.passed, true);
  assert.equal(report.summary.passedCases, 1);
});

test('reports node and response changes', () => {
  const baseline = createBaseline(baseWorkflow, [execution]);
  const changedWorkflow = parseWorkflow({ name: 'Test', nodes: [{ id: '1', name: 'Start', type: 'trigger', parameters: { path: '/new' } }], connections: {} });
  const changedExecution = { ...execution, body: { ok: false }, bodyHash: hashValue({ ok: false }) };
  const report = createReport(baseline, changedWorkflow, [changedExecution]);
  assert.equal(report.passed, false);
  assert.deepEqual(report.workflow.changedNodes, ['1']);
  assert.equal(report.cases[0]?.status, 'changed');
});
