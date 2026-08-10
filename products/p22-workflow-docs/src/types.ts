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

export interface DependencyRecord {
  id: string;
  node: string;
  type: string;
  dependsOn: string[];
  unblocks: string[];
}

export interface SopStep {
  order: number;
  nodeId: string;
  title: string;
  action: string;
  input: string;
  output: string;
  failureModes: string[];
}

export interface WorkflowDocument {
  schemaVersion: 1;
  generatedAt: string;
  workflow: NormalizedWorkflow;
  overview: {
    trigger: string;
    nodeCount: number;
    edgeCount: number;
    description: string;
  };
  dependencies: DependencyRecord[];
  dependencyGraph: string;
  sop: SopStep[];
}
