# 事实台账

> 只记客观事实。不排优先级、不写判断、不写计划。
> 开发类决策（做哪个、WIP、技术选型、杀掉哪个）去本仓库的 `DECISION_LOG.md`。

最后更新：2026-09-01

## WIP 占用

G0–G3 名额：**1 / 2**

| 名额 | 产品 |
|---|---|
| 1 | p01 Apify Actors |
| 2 | 空 —— p01 拿到 G3 前不开 |

## 全部产品

| ID | 产品 | 渠道 | 阶段 | 上架日 | 累计收入 | 上次维护 |
|---|---|---|---|---|---|---|
| p01 | Apify Actors（WTTJ 职位） | Apify Store | G1 已过，代码完成，待 Console 定价+上架 | — | $0 | 2026-09-01 |

## 未立项的候选（来自 Top20，不占 WIP）

p02 Atlassian Forge · p03 HTML5 小游戏授权 · p04 浏览器扩展 · p05 Fab 3D 素材 ·
p06 Newsletter · p07 AGPL 双许可 · p08 Framer 模板 · p09 量化系统产品化 ·
p10 高客单价 SaaS 联盟 · p11 Shopify/WP 插件 · p12 Workers+x402 · p13 付费 MCP Server ·
p14 白标转售 · p15 Civitai 模型 · p16 pSEO(需独家数据) · p17 YouTube 长视频 · p18 稳定币/国债

p19（AI 内容矩阵）、p20（餐饮建站）已在调研中否掉，编号保留占位，不开发。

## 里程碑

- 2026-08-09 仓库建立，p01 进入 G0
- 2026-08-09 p01 过 G0（目标定 WTTJ 职位，SPEC 的一句话与单位经济已填实）
- 2026-08-10 p01 本地构建与 7 个测试通过；真实 WTTJ 详情页复测未通过，仍处于 G1
- 2026-09-01 p01 的 G1 卡点定性更正：不是 WTTJ 改版导致解析失败，是 AWS WAF 会话级拦截
  （详情页 `202` / 2452 字节 / `Server: CloudFront` / body 含 `window.awsWafCookie`）。
  修法是浏览器只铸 `aws-waf-token`、抓取仍走无浏览器 HTTP（`ebde393`、`e7fbc16`）。
- 2026-09-01 p01 真实 WTTJ 复测通过：204/204 详情页、3.31 pages/s、1 次浏览器启动。G1 已过。
- 2026-09-01 p01 接上按次计费（`85c9503`）：一条结果一个 `job-result` 事件、先扣费再交付，
  `.actor/pricing.json` 声明 $0.003 单价，35 个测试通过，`npm run check:ppe` 走真实
  `Actor.charge` 双 mode 通过。**Console 定价与 Store 上架属人工确认，未代做，故 G2 未过。**
- 2026-09-01 p01 代码全部完成并部署到 Apify 平台（`8a9654e`）：input/dataset schema 补全
  editor 与 description 字段，Actor 构建成功（rg7Qez15cuAtZdZ2b / build 1.0.5）。
  剩余两步：Console 应用 $0.003 定价 + Store 发布，之后平台自动结算。详见 CONSOLE_SETUP.md。
