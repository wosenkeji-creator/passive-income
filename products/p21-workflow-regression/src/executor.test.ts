import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { executeCases } from './executor.js';

test('executes JSON HTTP cases and captures status and body', async () => {
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ received: JSON.parse(body) }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const [result] = await executeCases([{ name: 'create', input: { id: 7 }, expectedStatus: 201 }], `http://127.0.0.1:${address.port}`);
    assert.equal(result.status, 201);
    assert.deepEqual(result.body, { received: { id: 7 } });
    assert.equal(result.error, undefined);
  } finally {
    server.close();
  }
});
