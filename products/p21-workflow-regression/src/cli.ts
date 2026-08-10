import { readFile, writeFile } from 'node:fs/promises';
import { parseWorkflow } from './parser.js';
import { executeCases } from './executor.js';
import { createBaseline, createReport, reportMarkdown } from './regression.js';
import { sendWebhookAlert } from './alert.js';
import type { BaselineSnapshot, HttpTestCase } from './types.js';

function args(argv: string[]): { command: string; values: Map<string, string> } {
  const [command = '', ...rest] = argv;
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    values.set(key.slice(2), value);
  }
  return { command, values };
}

async function jsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function required(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

const { command, values } = args(process.argv.slice(2));
const workflow = parseWorkflow(await jsonFile(required(values, 'workflow')));
const cases = await jsonFile<HttpTestCase[]>(required(values, 'cases'));
const executions = await executeCases(cases, values.get('endpoint'), Number(values.get('timeout-ms') ?? 30_000));

if (command === 'baseline') {
  const baseline = createBaseline(workflow, executions);
  await writeFile(required(values, 'out'), `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written with ${baseline.cases.length} cases`);
} else if (command === 'run') {
  const baseline = await jsonFile<BaselineSnapshot>(required(values, 'baseline'));
  const report = createReport(baseline, workflow, executions);
  await writeFile(required(values, 'out'), `${JSON.stringify(report, null, 2)}\n`);
  const markdownPath = values.get('markdown');
  if (markdownPath) await writeFile(markdownPath, reportMarkdown(report));
  const alertUrl = values.get('alert-url');
  if (alertUrl && !report.passed) await sendWebhookAlert(alertUrl, report);
  console.log(report.passed ? 'REGRESSION_PASS' : 'REGRESSION_FAIL');
  if (!report.passed) process.exitCode = 2;
} else {
  throw new Error('Command must be baseline or run');
}
