# Gumroad Listing - Workflow Docs & SOP Generator

## Product name

Workflow Docs & SOP Generator for n8n and Make

## Price

USD 29 one-time payment.

## Short description

Turn exported n8n workflows and Make blueprints into clear Markdown, HTML, and JSON documentation with dependency diagrams and step-by-step SOPs.

## Description

Stop documenting automations by hand. Import an n8n workflow export or Make blueprint and generate a consistent documentation bundle locally.

The download includes:

- Markdown documentation for repositories and knowledge bases.
- Standalone HTML documentation for sharing and review.
- Structured JSON output for downstream tooling.
- Mermaid dependency graph showing workflow relationships.
- Step-by-step SOP with inputs, outputs, and common failure checks.
- Sample n8n workflow and generated output bundle.
- Node.js CLI, TypeScript source, tests, and Dockerfile.
- Windows and cross-platform command examples.

The generator runs locally. It does not upload workflow definitions, execute workflow nodes, read credentials, or connect to production data.

Current compatibility:

- n8n exported workflow JSON, including nodes and connections.
- Make blueprint flow and nested router branches using `routes[].flow`.
- Node.js 20 or newer, or Docker.

Important: generated SOPs are operational drafts. Review security, credentials, compliance, and business-specific instructions before production use.

## Call to action

Download the kit, run one command against your workflow export, and receive a documentation bundle ready for review.

## Tags

n8n, Make, workflow automation, SOP, documentation, developer tools

## Support boundary

The package includes setup instructions and tested examples. It does not include custom workflow development, credential configuration, hosted execution, or production incident support.
