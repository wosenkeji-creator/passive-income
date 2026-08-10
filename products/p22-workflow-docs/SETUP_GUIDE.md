# Setup Guide

## Option A: Node.js

Requirements: Node.js 20 or newer.

```powershell
npm ci
npm run build
node dist/cli.js --input examples/n8n-workflow.json --out output
```

The output directory will contain `workflow.md`, `workflow.html`, and `workflow.json`. Use `--formats markdown,html,json` to select formats.

## Option B: Docker

```powershell
docker build -t workflow-docs-local:0.1.0 .
docker run --rm -v "${PWD}/examples:/app/examples:ro" -v "${PWD}/output:/app/output" workflow-docs-local:0.1.0 --input /app/examples/n8n-workflow.json --out /app/output
```

## Use Your Own Export

1. Export a workflow as JSON from n8n or a blueprint from Make.
2. Place the file in a local directory. Do not include credential exports.
3. Pass the file path to `--input` and choose a new output directory.
4. Review the generated dependency graph and SOP before sharing them.

## Troubleshooting

- `Unsupported workflow format`: confirm the file is an n8n workflow export or Make blueprint, not an execution log.
- Missing connections: confirm the export contains n8n `connections` or Make `flow`/`routes[].flow`.
- Mermaid does not render: view the Markdown in a Mermaid-compatible editor or use the standalone HTML output.
- Permission error: choose an output directory where the current user has write access.

The generator runs locally and does not execute nodes, connect to services, or read workflow credentials.
