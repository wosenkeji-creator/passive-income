import type { NormalizedWorkflow, WorkflowEdge, WorkflowNode } from './types.js';
import { asRecord } from './utils.js';

function position(value: unknown): { x: number; y: number } | undefined {
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') return { x: value[0], y: value[1] };
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.x === 'number' && typeof record.y === 'number') return { x: record.x, y: record.y };
  }
  return undefined;
}

function parseN8n(raw: Record<string, unknown>): NormalizedWorkflow {
  if (!Array.isArray(raw.nodes)) throw new Error('Invalid n8n workflow: nodes must be an array');
  const nodes: WorkflowNode[] = raw.nodes.map((item, index) => {
    const node = asRecord(item);
    const name = typeof node.name === 'string' ? node.name : `Node ${index + 1}`;
    return {
      id: typeof node.id === 'string' ? node.id : name,
      name,
      type: typeof node.type === 'string' ? node.type : 'unknown',
      parameters: node.parameters ?? {},
      position: position(node.position),
    };
  });
  const idByName = new Map(nodes.map((node) => [node.name, node.id]));
  const edges: WorkflowEdge[] = [];
  const connections = raw.connections && typeof raw.connections === 'object' ? raw.connections as Record<string, unknown> : {};
  for (const [sourceName, groups] of Object.entries(connections)) {
    if (!groups || typeof groups !== 'object') continue;
    for (const [label, outputs] of Object.entries(groups as Record<string, unknown>)) {
      if (!Array.isArray(outputs)) continue;
      for (const lane of outputs) {
        if (!Array.isArray(lane)) continue;
        for (const connection of lane) {
          if (!connection || typeof connection !== 'object') continue;
          const targetName = (connection as Record<string, unknown>).node;
          if (typeof targetName === 'string') edges.push({ from: idByName.get(sourceName) ?? sourceName, to: idByName.get(targetName) ?? targetName, label });
        }
      }
    }
  }
  return {
    kind: 'n8n',
    name: typeof raw.name === 'string' ? raw.name : 'Untitled n8n workflow',
    nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => `${a.from}:${a.to}:${a.label ?? ''}`.localeCompare(`${b.from}:${b.to}:${b.label ?? ''}`)),
    settings: raw.settings ?? {},
  };
}

function parseMake(raw: Record<string, unknown>): NormalizedWorkflow {
  if (!Array.isArray(raw.flow)) throw new Error('Invalid Make blueprint: flow must be an array');
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const visitFlow = (items: unknown[], upstream?: string, label = 'flow'): void => {
    let previous = upstream;
    items.forEach((item, index) => {
      const module = asRecord(item);
      const metadata = module.metadata && typeof module.metadata === 'object' ? module.metadata as Record<string, unknown> : {};
      const designer = metadata.designer && typeof metadata.designer === 'object' ? metadata.designer : undefined;
      const id = String(module.id ?? `${upstream ?? 'module'}-${index + 1}`);
      nodes.push({
        id,
        name: typeof metadata.name === 'string' ? metadata.name : typeof module.module === 'string' ? module.module : `Module ${id}`,
        type: typeof module.module === 'string' ? module.module : 'unknown',
        parameters: { parameters: module.parameters ?? {}, mapper: module.mapper ?? {} },
        position: position(designer),
      });
      if (previous) edges.push({ from: previous, to: id, label });
      previous = id;
      if (Array.isArray(module.routes)) module.routes.forEach((route, routeIndex) => {
        const routeRecord = asRecord(route);
        if (Array.isArray(routeRecord.flow)) visitFlow(routeRecord.flow, id, `route ${routeIndex + 1}`);
      });
    });
  };
  visitFlow(raw.flow);
  return {
    kind: 'make',
    name: typeof raw.name === 'string' ? raw.name : 'Untitled Make blueprint',
    nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => `${a.from}:${a.to}:${a.label ?? ''}`.localeCompare(`${b.from}:${b.to}:${b.label ?? ''}`)),
    settings: raw.metadata ?? {},
  };
}

export function parseWorkflow(raw: unknown): NormalizedWorkflow {
  const workflow = asRecord(raw);
  if (Array.isArray(workflow.nodes)) return parseN8n(workflow);
  if (Array.isArray(workflow.flow)) return parseMake(workflow);
  throw new Error('Unsupported workflow: expected n8n nodes or Make flow');
}
