export type WorkflowKind = 'n8n' | 'make';

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  parameters: unknown;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface NormalizedWorkflow {
  kind: WorkflowKind;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings: unknown;
}

export interface HttpTestCase {
  name: string;
  input: unknown;
  endpoint?: string;
  headers?: Record<string, string>;
  expectedStatus?: number;
}

export interface CaseSnapshot {
  name: string;
  status: number;
  body: unknown;
  bodyHash: string;
}

export interface BaselineSnapshot {
  version: 1;
  createdAt: string;
  workflowHash: string;
  workflow: NormalizedWorkflow;
  cases: CaseSnapshot[];
}

export interface CaseExecution extends CaseSnapshot {
  durationMs: number;
  error?: string;
}

export interface WorkflowDifference {
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
}

export interface CaseDifference {
  name: string;
  status: 'passed' | 'changed' | 'added' | 'missing' | 'error';
  expectedStatus?: number;
  actualStatus?: number;
  expectedBodyHash?: string;
  actualBodyHash?: string;
  error?: string;
}

export interface RegressionReport {
  version: 1;
  generatedAt: string;
  passed: boolean;
  baselineWorkflowHash: string;
  currentWorkflowHash: string;
  workflow: WorkflowDifference;
  cases: CaseDifference[];
  summary: {
    totalCases: number;
    passedCases: number;
    changedCases: number;
    workflowChanged: boolean;
  };
}
