# p22 测试报告

日期：2026-08-10

- `npm test`：3/3 通过，覆盖 n8n 依赖、Make 嵌套路由、格式输出和无效输入。
- `npm run test:e2e`：通过，CLI 生成 Markdown/HTML/JSON 并检查关键内容。
- `docker build -t workflow-docs-local:dev .`：通过，运行镜像成功生成 Markdown、HTML、JSON 三种格式。

未覆盖：真实 n8n/Make 账号、在线商店发布、生产凭据和生产数据。
