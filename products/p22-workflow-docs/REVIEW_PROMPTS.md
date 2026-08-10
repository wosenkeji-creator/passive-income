# AI Review Prompts

Use these prompts with the generated Markdown document. Remove secrets and sensitive business data before sending content to any hosted AI service.

## Completeness Review

```text
Review this workflow document against its stated purpose. List missing prerequisites, undocumented branches, ambiguous inputs or outputs, and recovery steps. Do not invent facts. Separate evidence from recommendations.
```

## Operations Review

```text
Act as an operations reviewer. Convert the documented workflow into a pre-run checklist, execution checklist, failure triage checklist, and rollback checklist. Flag every point that still requires confirmation from the workflow owner.
```

## Security Review

```text
Review this workflow documentation for credential exposure, excessive permissions, personal data handling, untrusted inputs, destructive actions, and missing approval gates. Do not request or reproduce secret values. Rank findings by impact and cite the relevant workflow step.
```
