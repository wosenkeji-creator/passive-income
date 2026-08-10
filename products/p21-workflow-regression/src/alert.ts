import type { RegressionReport } from './types.js';

export async function sendWebhookAlert(url: string, report: RegressionReport, timeoutMs = 10_000): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'workflow_regression_completed', passed: report.passed, summary: report.summary, report }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Alert webhook returned HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}
