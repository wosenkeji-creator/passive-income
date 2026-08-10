# p22 工作流文档与 SOP 生成器

将 n8n 导出 JSON 或 Make blueprint 转换为可审阅的 Markdown、HTML 和 JSON 文档。输出包含工作流概览、节点职责、上下游依赖、Mermaid 依赖图、逐步 SOP、输入输出摘要和常见失败排查项。

## 本地运行

```powershell
npm ci
npm run verify
npm run build
node dist/cli.js --input examples/n8n-workflow.json --out output
```

可用 `--formats markdown,html,json` 选择输出格式。工具只处理本地 JSON，不执行节点、不读取凭据、不连接生产数据。

## Docker

```powershell
docker build -t workflow-docs-local:dev .
docker run --rm -v "${PWD}/examples:/app/examples:ro" -v "${PWD}/output:/app/output" workflow-docs-local:dev --input /app/examples/n8n-workflow.json --out /app/output
```

当前限制：Make 的路由通过 `routes` 嵌套结构生成依赖；平台导出结构变更需要新增适配测试。SOP 是基于节点类型和参数摘要的草稿，不能替代人工安全审阅。
