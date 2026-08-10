import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const output = await mkdtemp(join(tmpdir(), 'workflow-docs-'));
try {
  await run(process.execPath, ['dist/cli.js', '--input', 'examples/n8n-workflow.json', '--out', output]);
  const markdown = await readFile(join(output, 'n8n-workflow.md'), 'utf8');
  const html = await readFile(join(output, 'n8n-workflow.html'), 'utf8');
  const json = JSON.parse(await readFile(join(output, 'n8n-workflow.json'), 'utf8'));
  if (!markdown.includes('操作手册') || !html.includes('Dependency graph') || json.sop.length !== 3) throw new Error('Generated output failed assertions');
  console.log('WORKFLOW_DOCS_E2E_OK');
} finally { await rm(output, { recursive: true, force: true }); }
