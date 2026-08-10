import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDocument, toHtml, toMarkdown } from './generator.js';

const n8n = { name: 'Lead intake', nodes: [{ id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: { path: 'lead' } }, { id: '2', name: 'Notify', type: 'n8n-nodes-base.emailSend', parameters: {} }], connections: { Webhook: { main: [[{ node: 'Notify', type: 'main', index: 0 }]] } } };

test('builds dependencies and SOP from n8n', () => {
  const document = buildDocument(n8n, '2026-08-10T00:00:00.000Z');
  assert.equal(document.workflow.nodes.length, 2);
  assert.deepEqual(document.dependencies[1].dependsOn, ['Webhook']);
  assert.match(document.dependencyGraph, /Webhook/);
  assert.equal(document.sop.length, 2);
});

test('supports nested Make routes and all output formats', () => {
  const document = buildDocument({ name: 'Make route', flow: [{ id: 1, module: 'webhook', metadata: { name: 'Trigger' } }, { id: 2, module: 'builtin:BasicRouter', metadata: { name: 'Router' }, routes: [{ flow: [{ id: 3, module: 'http', metadata: { name: 'Call API' } }] }, { flow: [{ id: 4, module: 'email', metadata: { name: 'Send email' } }] }] }] });
  assert.equal(document.workflow.kind, 'make');
  assert.equal(document.workflow.nodes.length, 4);
  assert.deepEqual(document.workflow.edges.map((edge) => `${edge.from}->${edge.to}`), ['1->2', '2->3', '2->4']);
  assert.match(toMarkdown(document), /操作手册/);
  assert.match(toHtml(document), /Dependency graph/);
});

test('rejects unsupported input', () => { assert.throws(() => buildDocument({ nope: true }), /Unsupported workflow/); });
