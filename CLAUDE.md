# 被动收入项目指令

## 战略定位
- **主线**：L1 被动收入矩阵（自动销售 + 长尾收入）
- **战略唯一来源**：`E:\360MoveData\Users\Administrator\Desktop\DECISION_LOG.md`
- **本项目日志**：`./DECISION_LOG.md`（执行记录，不作战略依据）

## 项目约束
- **周维护预算**：≤ 3 小时（硬上限）
- **立项门槛**：必须通过 DECISION_LOG.md 中定义的管线（100 机会 → AI 筛 10 → 看 3 → 实测 1）
- **停止规则**：6 个月未达 $500/月持续收入 → 整线关停

## 当前子方向与预算分配

| 子方向 | 周预算 | 关键 KPI | 状态 |
|--------|--------|----------|------|
| 美股程序化 | 0.5h | 回测夏普 > 1.0；实盘 6 月 P&L > SPY | 主线 |
| 小工具/小软件 | 1.5h | 30 天首单；API 成本 ≤ $3/单 | 主线 |
| 汉化开源 | 0.5h | 30 天 5 单 | 副线 |
| 网页小游戏 | 0h | 自然月销 > $50 才升级 | 观察池 |

## 红线（禁止进入机会池）
- 通用 Prompt Pack / n8n Workflow / AI Agent Template
- 高接触 AI Agency / 英语会议型销售
- 一次性付费服务（不走订阅、不走长尾）
- 需要高频人工交付
- 占用周维护 > 3 小时

## 外部依赖
- 战略决策：`E:\360MoveData\Users\Administrator\Desktop\DECISION_LOG.md`
- 机会评估参考：`E:\360MoveData\Users\Administrator\Desktop\gpt5.6 top20- v1版.md`
- Top20 证据包：`E:\360MoveData\Users\Administrator\Desktop\01_AI与研发文件\01_商业研究\gpt5.6-top20-v2-evidence`

## 可用工具与调度权限
- Git 操作：允许 commit / push（新分支）
- 外部 API：Gumroad / Etsy / Creative Market（仅读取，写入需确认）
- 支付/上架：必须人工确认
- 数据分析：允许本地 Python / Node 脚本
