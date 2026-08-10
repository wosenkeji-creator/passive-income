import type { DependencyRecord, NormalizedWorkflow, SopStep, WorkflowDocument, WorkflowEdge, WorkflowNode } from './types.js';
import { asRecord, escapeHtml, escapeMarkdown, jsonPreview } from './utils.js';

function nodePosition(value: unknown): { x: number; y: number } | undefined {
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
    return { id: typeof node.id === 'string' ? node.id : name, name, type: typeof node.type === 'string' ? node.type : 'unknown', parameters: node.parameters ?? {}, position: nodePosition(node.position) };
  });
  const idByName = new Map(nodes.map((node) => [node.name, node.id]));
  const edges: WorkflowEdge[] = [];
  const connections = raw.connections && typeof raw.connections === 'object' ? raw.connections as Record<string, unknown> : {};
  for (const [sourceName, groups] of Object.entries(connections)) {
    if (!groups || typeof groups !== 'object') continue;
    for (const [label, outputs] of Object.entries(groups as Record<string, unknown>)) {
      if (!Array.isArray(outputs)) continue;
      for (const lane of outputs) if (Array.isArray(lane)) for (const connection of lane) {
        if (!connection || typeof connection !== 'object') continue;
        const target = (connection as Record<string, unknown>).node;
        if (typeof target === 'string') edges.push({ from: idByName.get(sourceName) ?? sourceName, to: idByName.get(target) ?? target, label });
      }
    }
  }
  return { kind: 'n8n', name: typeof raw.name === 'string' ? raw.name : 'Untitled n8n workflow', nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)), edges: edges.sort(edgeSort), settings: raw.settings ?? {} };
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
      const id = String(module.id ?? `${upstream ?? 'module'}-${index + 1}`);
      const node: WorkflowNode = { id, name: typeof metadata.name === 'string' ? metadata.name : typeof module.module === 'string' ? module.module : `Module ${id}`, type: typeof module.module === 'string' ? module.module : 'unknown', parameters: { parameters: module.parameters ?? {}, mapper: module.mapper ?? {} }, position: nodePosition(metadata.designer) };
      nodes.push(node);
      if (previous) edges.push({ from: previous, to: id, label });
      previous = id;
      if (Array.isArray(module.routes)) module.routes.forEach((route, routeIndex) => {
        const routeRecord = asRecord(route);
        if (Array.isArray(routeRecord.flow)) visitFlow(routeRecord.flow, id, `route ${routeIndex + 1}`);
      });
    });
  };
  visitFlow(raw.flow);
  return { kind: 'make', name: typeof raw.name === 'string' ? raw.name : 'Untitled Make blueprint', nodes, edges: edges.sort(edgeSort), settings: raw.metadata ?? {} };
}

function edgeSort(a: WorkflowEdge, b: WorkflowEdge): number { return `${a.from}:${a.to}:${a.label ?? ''}`.localeCompare(`${b.from}:${b.to}:${b.label ?? ''}`); }

export function normalizeWorkflow(raw: unknown): NormalizedWorkflow {
  const workflow = asRecord(raw);
  if (Array.isArray(workflow.nodes)) return parseN8n(workflow);
  if (Array.isArray(workflow.flow)) return parseMake(workflow);
  throw new Error('Unsupported workflow: expected n8n nodes or Make flow');
}

function dependencyRecords(workflow: NormalizedWorkflow): DependencyRecord[] {
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]));
  return workflow.nodes.map((node) => ({ id: node.id, node: node.name, type: node.type, dependsOn: workflow.edges.filter((edge) => edge.to === node.id).map((edge) => byId.get(edge.from)?.name ?? edge.from), unblocks: workflow.edges.filter((edge) => edge.from === node.id).map((edge) => byId.get(edge.to)?.name ?? edge.to) }));
}

function sopSteps(workflow: NormalizedWorkflow): SopStep[] {
  const dependencies = dependencyRecords(workflow);
  return workflow.nodes.map((node, index) => {
    const dependency = dependencies[index];
    const trigger = index === 0 ? '启动触发器或上游事件' : dependency.dependsOn.length ? dependency.dependsOn.join('、') : '无显式上游依赖';
    const output = dependency.unblocks.length ? `将结果交给：${dependency.unblocks.join('、')}` : '输出最终结果或响应';
    return { order: index + 1, nodeId: node.id, title: node.name, action: `执行 ${node.type} 节点，按导入定义中的参数运行。`, input: `${trigger}；参数摘要：${jsonPreview(node.parameters)}`, output, failureModes: ['凭据或权限失效', '上游数据为空或格式变化', '第三方接口超时或限流'] };
  });
}

function mermaid(workflow: NormalizedWorkflow): string {
  const labels = new Map(workflow.nodes.map((node) => [node.id, node.name.replace(/[\"\n\r]/g, ' ')]));
  const lines = ['flowchart TD'];
  for (const node of workflow.nodes) lines.push(`  ${safeId(node.id)}["${labels.get(node.id)}"]`);
  for (const edge of workflow.edges) lines.push(`  ${safeId(edge.from)} -->|${(edge.label ?? 'next').replace(/[|\n\r]/g, ' ')}| ${safeId(edge.to)}`);
  return lines.join('\n');
}

function safeId(value: string): string { return `n_${value.replace(/[^A-Za-z0-9_]/g, '_')}`; }

export function buildDocument(raw: unknown, generatedAt = new Date().toISOString()): WorkflowDocument {
  const workflow = normalizeWorkflow(raw);
  const trigger = workflow.nodes[0]?.name ?? '未定义';
  return { schemaVersion: 1, generatedAt, workflow, overview: { trigger, nodeCount: workflow.nodes.length, edgeCount: workflow.edges.length, description: `${workflow.kind} 工作流“${workflow.name}”包含 ${workflow.nodes.length} 个节点和 ${workflow.edges.length} 条依赖边。` }, dependencies: dependencyRecords(workflow), dependencyGraph: mermaid(workflow), sop: sopSteps(workflow) };
}

export function toMarkdown(document: WorkflowDocument): string {
  const { workflow, overview } = document;
  const lines = [`# ${workflow.name}`, '', `> 生成时间：${document.generatedAt} · 来源：${workflow.kind}`, '', '## 概览', '', overview.description, '', `- 入口节点：${overview.trigger}`, `- 节点数：${overview.nodeCount}`, `- 依赖边：${overview.edgeCount}`, '', '## 依赖图', '', '```mermaid', document.dependencyGraph, '```', '', '## 节点与依赖', '', '| 节点 | 类型 | 依赖 | 下游 |', '| --- | --- | --- | --- |'];
  for (const item of document.dependencies) lines.push(`| ${escapeMarkdown(item.node)} | \`${escapeMarkdown(item.type)}\` | ${escapeMarkdown(item.dependsOn.join('、') || '无')} | ${escapeMarkdown(item.unblocks.join('、') || '终点')} |`);
  lines.push('', '## 操作手册（SOP）', '');
  for (const step of document.sop) lines.push(`### ${step.order}. ${escapeMarkdown(step.title)}`, '', `**动作**：${step.action}`, `**输入**：${step.input}`, `**输出**：${step.output}`, '**失败排查**：', ...step.failureModes.map((mode) => `- ${mode}`), '');
  lines.push('## 维护提示', '', '- 工作流定义变化后重新生成文档，并检查依赖图和凭据说明。', '- 本工具不读取或保存账号凭据、运行数据或密钥。', '');
  return lines.join('\n');
}

export function toHtml(document: WorkflowDocument): string {
  const rows = document.dependencies.map((item) => `<tr><td>${escapeHtml(item.node)}</td><td><code>${escapeHtml(item.type)}</code></td><td>${escapeHtml(item.dependsOn.join(', ') || 'None')}</td><td>${escapeHtml(item.unblocks.join(', ') || 'End')}</td></tr>`).join('');
  const steps = document.sop.map((step) => `<section><h3>${step.order}. ${escapeHtml(step.title)}</h3><p><b>Action:</b> ${escapeHtml(step.action)}</p><p><b>Input:</b> ${escapeHtml(step.input)}</p><p><b>Output:</b> ${escapeHtml(step.output)}</p><p><b>Failure checks:</b> ${escapeHtml(step.failureModes.join('; '))}</p></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document.workflow.name)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:960px;margin:40px auto;padding:0 20px;color:#18212b}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd4dc;padding:8px;text-align:left}pre{background:#f2f5f7;padding:16px;overflow:auto}section{border-top:1px solid #d9e0e6;padding:12px 0}</style></head><body><h1>${escapeHtml(document.workflow.name)}</h1><p>${escapeHtml(document.overview.description)}</p><ul><li>Entry: ${escapeHtml(document.overview.trigger)}</li><li>Nodes: ${document.overview.nodeCount}</li><li>Edges: ${document.overview.edgeCount}</li></ul><h2>Dependency graph</h2><pre>${escapeHtml(document.dependencyGraph)}</pre><h2>Nodes and dependencies</h2><table><thead><tr><th>Node</th><th>Type</th><th>Depends on</th><th>Unblocks</th></tr></thead><tbody>${rows}</tbody></table><h2>Operating procedure</h2>${steps}<h2>Maintenance</h2><p>Regenerate after workflow definition changes. Credentials and production data are never stored.</p></body></html>`;
}
