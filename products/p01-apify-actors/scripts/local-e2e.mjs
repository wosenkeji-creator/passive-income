import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const posting = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Data Engineer',
  datePosted: '2026-08-09',
  employmentType: 'FULL_TIME',
  hiringOrganization: { '@type': 'Organization', name: 'Example Co' },
  jobLocation: { address: { addressLocality: 'Paris', addressCountry: 'FR' } },
};

const server = createServer((request, response) => {
  const port = server.address().port;
  if (request.url === '/index.xml') {
    response.setHeader('content-type', 'application/xml');
    response.end(`<sitemapindex><sitemap><loc>http://127.0.0.1:${port}/jobs.xml</loc></sitemap></sitemapindex>`);
    return;
  }
  if (request.url === '/jobs.xml') {
    response.setHeader('content-type', 'application/xml');
    response.end(`<urlset><url><loc>http://127.0.0.1:${port}/job/1</loc><lastmod>2026-08-09</lastmod></url></urlset>`);
    return;
  }
  response.setHeader('content-type', 'text/html');
  response.end(`<script type="application/ld+json">${JSON.stringify(posting)}</script>`);
});

const storageDir = await mkdtemp(join(tmpdir(), 'wttj-actor-e2e-'));
server.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  const port = server.address().port;
  const inputDir = join(storageDir, 'key_value_stores', 'default');
  await mkdir(inputDir, { recursive: true });
  await writeFile(join(inputDir, 'INPUT.json'), JSON.stringify({
    sitemapUrl: `http://127.0.0.1:${port}/index.xml`,
    maxResults: 1,
    maxPages: 1,
    concurrency: 1,
  }));

  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APIFY_LOCAL_STORAGE_DIR: storageDir,
      CRAWLEE_STORAGE_DIR: storageDir,
      CRAWLEE_PURGE_ON_START: '0',
      CRAWLEE_PERSIST_STORAGE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const [exitCode] = await once(child, 'exit');
  assert.equal(exitCode, 0, `Actor failed. stdout=${stdout} stderr=${stderr}`);

  const datasetDir = join(storageDir, 'datasets', 'default');
  const datasetFiles = (await readdir(datasetDir)).filter((name) => name.endsWith('.json'));
  assert.equal(datasetFiles.length, 1);
  const result = JSON.parse(await readFile(join(datasetDir, datasetFiles[0]), 'utf8'));
  assert.equal(result.title, 'Data Engineer');
  assert.equal(result.company, 'Example Co');

  const summary = JSON.parse(await readFile(join(inputDir, 'run-summary.json'), 'utf8'));
  assert.equal(summary.matchedResults, 1);
  assert.equal(summary.requestFailures, 0);
  console.log('LOCAL_ACTOR_E2E_OK');
} finally {
  server.close();
  await rm(storageDir, { recursive: true, force: true });
}
