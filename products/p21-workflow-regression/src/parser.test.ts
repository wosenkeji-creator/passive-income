import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkflow } from './parser.js';

test('normalizes n8n nodes and connections', () => {
  const workflow = parseWorkflow({
    name: 'Lead intake',
    nodes: [
      { id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
      { id: '2', name: 'Respond', type: 'n8n-nodes-base.respondToWebhook', position: [200, 0], parameters: { statusCode: 200 } },
    ],
    connections: { Webhook: { main: [[{ node: 'Respond', type: 'main', index: 0 }]] } },
  });
  assert.equal(workflow.kind, 'n8n');
  assert.equal(workflow.nodes.length, 2);
  assert.deepEqual(workflow.edges, [{ from: '1', to: '2', label: 'main' }]);
});

test('normalizes a sequential Make blueprint', () => {
  const workflow = parseWorkflow({
    name: 'Make lead intake',
    flow: [
      { id: 10, module: 'webhooks:CustomWebhook', mapper: {}, metadata: { designer: { x: 0, y: 0 } } },
      { id: 20, module: 'http:ActionSendData', mapper: { url: 'https://example.test' }, metadata: { designer: { x: 200, y: 0 } } },
    ],
  });
  assert.equal(workflow.kind, 'make');
  assert.deepEqual(workflow.edges, [{ from: '10', to: '20', label: 'flow' }]);
});

test('normalizes Make router branches', () => {
  const workflow = parseWorkflow({
    name: 'Make router',
    flow: [
      { id: 10, module: 'webhooks:CustomWebhook', metadata: { name: 'Trigger' } },
      { id: 20, module: 'builtin:BasicRouter', metadata: { name: 'Router' }, routes: [
        { flow: [{ id: 30, module: 'http:ActionSendData', metadata: { name: 'Call API' } }] },
        { flow: [{ id: 40, module: 'email:ActionSendEmail', metadata: { name: 'Send email' } }] },
      ] },
    ],
  });
  assert.deepEqual(workflow.edges, [
    { from: '10', to: '20', label: 'flow' },
    { from: '20', to: '30', label: 'route 1' },
    { from: '20', to: '40', label: 'route 2' },
  ]);
});
