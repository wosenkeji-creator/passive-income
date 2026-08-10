# Documentation QA Checklist

Review every generated bundle before using it as an operational SOP.

- [ ] Workflow name and purpose match the source export.
- [ ] Every expected node appears in the node inventory.
- [ ] Trigger, branch, retry, and error paths are represented.
- [ ] Mermaid dependencies match the workflow canvas.
- [ ] Inputs and outputs do not expose credentials or personal data.
- [ ] Environment variables and external services are named without secret values.
- [ ] Destructive or irreversible steps have an explicit approval checkpoint.
- [ ] Failure handling and recovery instructions match production behavior.
- [ ] Owner, escalation path, and maintenance cadence are added manually.
- [ ] A workflow operator has tested the SOP against a non-production run.

Generated SOPs are drafts. Security, compliance, and business-specific decisions require human review.
