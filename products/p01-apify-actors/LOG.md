# p01 — 日志

> 只追加，不改写。一行一个已发生的事实。

2026-08-09 | 立项，进入 G0。SPEC.md 骨架就位，「一句话」与单位经济待填，未过 G0。
2026-08-09 | 核实 [A]：平台抽成公式 `profit = (0.8 × revenue) − costs`，平台成本由开发者承担。
2026-08-09 | 核实 [A]：Creator Plan $500 用量额度仅限前 6 个月，非长期。
2026-08-09 | 核实 [A]：平台代理 Starter $8/GB。据此排除「住宅代理 + 完整浏览器渲染」类目标。
2026-08-09 | 撤回「维护量是护城河」的判断，改为低维护优先。理由见 SPEC.md 维护面。
2026-08-09 | 「Store 是否有自然搜索流量」仍未核实，为 p01 最危险假设。
2026-08-09 | 核实 [A]：PAY_PER_RESULT 已不存在。全站 API 普查 44,676 个 Actor，PPR 计数为 0。官方博客 2026-04-14 称已迁移 2,000 个 Actor 到 PPE。
2026-08-09 | 核实 [A]：RENTAL 退役时间表 —— 4/1 起不接受新 rental Actor，10/1 全面退役强制迁移。新人现在只有 PPE 一个选项。
2026-08-09 | 核实 [A]：市场价格锚 $1–10 / 1,000 results（Apify Academy 原话）。即 $0.001–0.01/条，代理成本表的亏损端就是市场价下沿 → 成本必须转嫁给用户。
2026-08-09 | 核实 [A]：提现需先过 KYC；最低提现 PayPal $20 / 其他 $100；12 个月未达标收入没收。G3「收到付款」被拆成「产生收入」与「钱到账」两件事。
2026-08-09 | 核实 [A]：平台强制义务 —— 自动化测试失败进 under maintenance，超 30 天下架；用户报问题 14 天内响应；紧急邮件 3 工作日内响应。与 G4「月维护 < 2 小时」的精神冲突，待在 DECISION_LOG 定性。
2026-08-09 | 核实 [A]：Store Publishing Terms 约束 —— 命名与 README 必须标 unofficial（§2.1）；禁止在 Actor 或 README 推广/链接任何站外产品（§4.2）；被用户举报可无通知无理由下架（Actor Terms §9.5）。
2026-08-09 | 核实 [A]：三份法律文件（AUP / Publishing Terms / Actor Terms）均无禁抓站点清单，也无明文禁止登录抓取。真实约束是 AUP §2.1.10 兜底条款 + §2.1.12 平台自由裁量。
2026-08-09 | 判定「Store 有自然发现流量」= [B] 强间接证据，非 [A]。据此 p01 排位维持，D-001 不作废。理由与反证动作见 SPEC.md 最危险假设。
2026-08-09 | 撤回「新 Actor 三个月 64 用户 / $200 月收」作为规划基线：无独立可核实来源，原标注「独立可验证」是错的。改用收入形状而非收入数额做预期管理。
2026-08-09 | 候选目标清单已产出（Handelsregister / Welcome to the Jungle / mobile.de / BizBuySell / Storeleads / Capterra-Clutch 修复位）。竞品数与 30 日活跃用户数为 [A] API 实测，反爬强度与改版频率为估计值，每个需约 1 小时手动核实。
2026-08-09 | D002 已入档：G4 加「响应义务能在单次 15 分钟内履行」；G3 判定时点定为平台侧记录到收入，不等钱到账；WIP=2 维持第 2 格关闭；监控层/飞书层延后到 3 产品跨 2 平台。D001 保持 ACTIVE。
2026-08-09 | 技术选型定：TS+Node（与规约一致，有官方 SDK）。省算力主因是「不开无头浏览器」而非换语言，这条采纳。Go 的代价（无官方 SDK、需自行处理 Actor 生命周期与数据集推送）未核实，暂不采用。
2026-08-09 | 待办确认：Apify 原生失败通知需打开；KYC 现在就做，不等有收入（PayPal 提现门槛 $20，12 个月不达标作废）。
- 2026-08-09 实测反爬（明文HTTP/登出/无代理）：mobile.de 403 AkamaiGHost；bizbuysell 403 AkamaiGHost；WTTJ 200；storeleads 200；handelsregister 两次失败（超时+curl 35 SSL），本网络不可达，属本地限制不算站点属性。
- 2026-08-09 WTTJ 列表页是 Next.js App Router 客户端渲染，服务端无职位数据（124个script/0 ld+json/0 JobPosting）。
- 2026-08-09 WTTJ 语义锚点已验证存在两处：详情页 ld+json 内 JobPosting（title/datePosted/validThrough/employmentType/hiringOrganization/jobLocation/industry 均在），以及 sitemap 全量枚举 12 张 job-listings 图 x 约1万条 ≈ 12万职位URL 且全部带 lastmod。
- 2026-08-09 WTTJ /api/env 公开返回 Algolia appId CSEKHVMS53 与 public search key，但该 key 对 indexes 列举和已知 index 查询均 403，列表层不走 Algolia，改用 sitemap+lastmod 枚举。
- 2026-08-09 WTTJ 竞品 PPE 实价：clearpath 每条 /usr/bin/bash.00299（u30d=117，含 Job 事件）；shahidirfan 每条 /usr/bin/bash.00099（u30d=37）；logiover 未设 result 价（u30d=28）。四家 30 天用户合计约 182。
- 2026-08-09 p01 目标定 WTTJ，单价 /usr/bin/bash.003/条，边际成本约 /usr/bin/bash.00001/条（数据中心代理+无浏览器），毛利率约 99%。
- 2026-08-09 到 500 美元/月需约 20.8 万条/月，等于要做到该垂类第一（现第一名 30 天用户 117）。
- 2026-08-09 Apify 账号为 FREE：月上限 、625 CU、RESIDENTIAL availableCount=0（仅 BUYPROXIES94952 数据中心 5 个）。WTTJ 不需住宅代理，该限制对本目标不成立；48 小时 soak 用 256MB 约 .40， 内可行。
- 2026-08-09 坑：Windows Python 读写文件与 print 非 ASCII 默认 GBK，必须 encoding=utf-8 且设 PYTHONIOENCODING=utf-8。minified 单行 HTML 用 grep -c 恒为 0/1，计数要用 Python。
- 2026-08-09 收款通道定 PayPal（D004）。理由是门槛不是费率：Apify 最低提现 PayPal $20 / 其他 $100，叠加 12 个月未达门槛收入作废，$100 档在首年量级上等于拿不到。
- 2026-08-09 切换触发条件写死：月收入连续 3 个月 >= $100 时改用 Wise。香港汇丰定位为终点账户，不作为提现通道（SWIFT 单笔 $15-30，占 $100 提现的 15-30%）。
- 2026-08-09 未核实项：Apify 后台提现方式清单是否明确列出 Wise。设置提现方式时顺手确认，同时确认 $100 那一档具体指哪几种通道。
- 2026-08-09 收款账号标识写入 .env（PAYOUT_PAYPAL / PAYOUT_WISE），不进任何被提交的文件——邮箱不是密钥，但进了 git 历史就永久留存。
- 2026-08-09 待办：第一笔提现实际到账当天，在本文件单独记一行。D002 把 G3 定为平台侧记录到收入，所以 G3 不证明钱拿得到手，这个缺口只能靠真实到账补。
