import type { BaselineSnapshot, CaseDifference, CaseExecution, NormalizedWorkflow, RegressionReport, WorkflowDifference } from './types.js';
import { hashValue, stableJson } from './utils.js';

function edgeKey(edge: { from: string; to: string; label?: string }): string {
  return `${edge.from}->${edge.to}${edge.label ? `:${edge.label}` : ''}`;
}

export function createBaseline(workflow: NormalizedWorkflow, cases: CaseExecution[]): BaselineSnapshot {
  const failed = cases.find((testCase) => testCase.error);
  if (failed) throw new Error(`Cannot create baseline from failed case "${failed.name}": ${failed.error}`);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    workflowHash: hashValue(workflow),
    workflow,
    cases: cases.map(({ name, status, body, bodyHash }) => ({ name, status, body, bodyHash })),
  };
}

export function diffWorkflow(baseline: NormalizedWorkflow, current: NormalizedWorkflow): WorkflowDifference {
  const oldNodes = new Map(baseline.nodes.map((node) => [node.id, node]));
  const newNodes = new Map(current.nodes.map((node) => [node.id, node]));
  const oldEdges = new Set(baseline.edges.map(edgeKey));
  const newEdges = new Set(current.edges.map(edgeKey));
  return {
    addedNodes: [...newNodes.keys()].filter((id) => !oldNodes.has(id)).sort(),
    removedNodes: [...oldNodes.keys()].filter((id) => !newNodes.has(id)).sort(),
    changedNodes: [...newNodes.keys()].filter((id) => oldNodes.has(id) && stableJson(oldNodes.get(id)) !== stableJson(newNodes.get(id))).sort(),
    addedEdges: [...newEdges].filter((edge) => !oldEdges.has(edge)).sort(),
    removedEdges: [...oldEdges].filter((edge) => !newEdges.has(edge)).sort(),
  };
}

export function createReport(baseline: BaselineSnapshot, currentWorkflow: NormalizedWorkflow, executions: CaseExecution[]): RegressionReport {
  const workflow = diffWorkflow(baseline.workflow, currentWorkflow);
  const currentByName = new Map(executions.map((item) => [item.name, item]));
  const baselineByName = new Map(baseline.cases.map((item) => [item.name, item]));
  const names = [...new Set([...baselineByName.keys(), ...currentByName.keys()])].sort();
  const cases: CaseDifference[] = names.map((name) => {
    const expected = baselineByName.get(name);
    const actual = currentByName.get(name);
    if (!expected) return { name, status: 'added', actualStatus: actual?.status, actualBodyHash: actual?.bodyHash, error: actual?.error };
    if (!actual) return { name, status: 'missing', expectedStatus: expected.status, expectedBodyHash: expected.bodyHash };
    if (actual.error) return { name, status: 'error', expectedStatus: expected.status, actualStatus: actual.status, expectedBodyHash: expected.bodyHash, actualBodyHash: actual.bodyHash, error: actual.error };
    const passed = expected.status === actual.status && expected.bodyHash === actual.bodyHash;
    return { name, status: passed ? 'passed' : 'changed', expectedStatus: expected.status, actualStatus: actual.status, expectedBodyHash: expected.bodyHash, actualBodyHash: actual.bodyHash };
  });
  const workflowChanged = Object.values(workflow).some((items) => items.length > 0);
  const passedCases = cases.filter((item) => item.status === 'passed').length;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    passed: !workflowChanged && passedCases === cases.length,
    baselineWorkflowHash: baseline.workflowHash,
    currentWorkflowHash: hashValue(currentWorkflow),
    workflow,
    cases,
    summary: { totalCases: cases.length, passedCases, changedCases: cases.length - passedCases, workflowChanged },
  };
}

export function reportMarkdown(report: RegressionReport): string {
  const lines = [
    '# Workflow regression report',
    '',
    `Result: ${report.passed ? 'PASS' : 'FAIL'}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Cases: ${report.summary.passedCases}/${report.summary.totalCases} passed`,
    `- Workflow changed: ${report.summary.workflowChanged ? 'yes' : 'no'}`,
    '',
    '## Workflow differences',
    '',
    `- Added nodes: ${report.workflow.addedNodes.join(', ') || 'none'}`,
    `- Removed nodes: ${report.workflow.removedNodes.join(', ') || 'none'}`,
    `- Changed nodes: ${report.workflow.changedNodes.join(', ') || 'none'}`,
    `- Added edges: ${report.workflow.addedEdges.join(', ') || 'none'}`,
    `- Removed edges: ${report.workflow.removedEdges.join(', ') || 'none'}`,
    '',
    '## Test cases',
    '',
    '| Case | Status | Expected HTTP | Actual HTTP |',
    '|---|---|---:|---:|',
    ...report.cases.map((item) => `| ${item.name} | ${item.status} | ${item.expectedStatus ?? '-'} | ${item.actualStatus ?? '-'} |`),
    '',
  ];
  return lines.join('\n');
}
