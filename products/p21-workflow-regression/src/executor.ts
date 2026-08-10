import type { CaseExecution, HttpTestCase } from './types.js';
import { hashValue } from './utils.js';

async function bodyValue(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function executeCases(cases: HttpTestCase[], defaultEndpoint?: string, timeoutMs = 30_000): Promise<CaseExecution[]> {
  const results: CaseExecution[] = [];
  for (const testCase of cases) {
    const endpoint = testCase.endpoint ?? defaultEndpoint;
    if (!endpoint) throw new Error(`No endpoint configured for test case: ${testCase.name}`);
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...testCase.headers },
        body: JSON.stringify(testCase.input),
        signal: controller.signal,
      });
      const body = await bodyValue(response);
      const error = testCase.expectedStatus !== undefined && response.status !== testCase.expectedStatus
        ? `Expected HTTP ${testCase.expectedStatus}, received ${response.status}`
        : undefined;
      results.push({ name: testCase.name, status: response.status, body, bodyHash: hashValue(body), durationMs: Date.now() - startedAt, error });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name: testCase.name, status: 0, body: null, bodyHash: hashValue(null), durationMs: Date.now() - startedAt, error: message });
    } finally {
      clearTimeout(timeout);
    }
  }
  return results;
}
