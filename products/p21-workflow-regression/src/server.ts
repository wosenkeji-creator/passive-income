import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { calculateCost, type CostInput } from './cost.js';
import { parseWorkflow } from './parser.js';
import { hashValue } from './utils.js';

const port = Number(process.env.PORT ?? 3000);
const publicDir = join(process.cwd(), 'public');
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function jsonBody(request: IncomingMessage, maxBytes = 1_000_000): Promise<unknown> {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) throw new Error('Request body exceeds 1 MB');
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function staticFile(pathname: string, response: ServerResponse): Promise<void> {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(publicDir, safePath);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: 'Not found' });
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') return sendJson(response, 200, { status: 'ok' });
    if (request.method === 'POST' && url.pathname === '/api/parse') {
      const workflow = parseWorkflow(await jsonBody(request));
      return sendJson(response, 200, { workflow, workflowHash: hashValue(workflow) });
    }
    if (request.method === 'POST' && url.pathname === '/api/calculate') {
      return sendJson(response, 200, calculateCost(await jsonBody(request) as CostInput));
    }
    if (request.method === 'GET') return staticFile(url.pathname, response);
    return sendJson(response, 405, { error: 'Method not allowed' });
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Workflow regression local server listening on http://localhost:${port}`));
