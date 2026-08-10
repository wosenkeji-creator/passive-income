import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { buildDocument, toHtml, toMarkdown } from './generator.js';

function option(args: string[], name: string): string | undefined { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const input = option(args, '--input');
  const output = option(args, '--out') ?? 'output';
  const formats = (option(args, '--formats') ?? 'markdown,html,json').split(',').map((item) => item.trim().toLowerCase());
  if (!input || args.includes('--help')) { console.log('Usage: node dist/cli.js --input workflow.json [--out output] [--formats markdown,html,json]'); return; }
  const document = buildDocument(JSON.parse(await readFile(input, 'utf8')));
  await mkdir(output, { recursive: true });
  const stem = basename(input).replace(/\.[^.]+$/, '');
  if (formats.includes('markdown') || formats.includes('md')) await writeFile(join(output, `${stem}.md`), toMarkdown(document));
  if (formats.includes('html')) await writeFile(join(output, `${stem}.html`), toHtml(document));
  if (formats.includes('json')) await writeFile(join(output, `${stem}.json`), JSON.stringify(document, null, 2));
  console.log(`WORKFLOW_DOCS_GENERATED ${stem} -> ${output}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
