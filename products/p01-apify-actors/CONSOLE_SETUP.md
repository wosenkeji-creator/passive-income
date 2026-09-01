# Apify Console 手工操作清单

Actor 已部署到 Apify 平台，ID: `rg7Qez15cuAtZdZ2b`

代码层面完整，剩余两个步骤需要在 Console 手工完成，之后平台自动结算收入。

## 1. 定价 (Monetization)

URL: https://console.apify.com/actors/rg7Qez15cuAtZdZ2b/monetization

**设置:**
- Pricing model: **Pay per event**
- Event name: `job-result` (必须与 `.actor/pricing.json` 一致)
- Event title: Job posting delivered
- Event description: One job posting that matched the requested filters and was written to the dataset. Pages fetched but filtered out, and pages that failed to parse, are not charged.
- Price per event: **$0.003 USD** (= $3/1,000 results)

**依据:**
- 边际成本 ~$0.00001/条 (纯 HTTP + 数据中心代理，无住宅代理，无浏览器渲染除 WAF token)
- 市场领先者 clearpath/welcome-to-the-jungle-jobs-api 定价 $0.00299/条
- 与领先者持平，靠 "免登录 + 无 cookie + 静默失败检测" 区分

**验证:**
定价应用后，建议跑一个 5 结果的测试 run (maxResults=5)，检查:
- run-summary 里 `billing.chargedEvents === 5`
- run-summary 里 `billing.deliveredResults === 5`
- Console 显示实际扣费 5 × $0.003 = $0.015

## 2. 发布到 Store (Publication)

URL: https://console.apify.com/actors/rg7Qez15cuAtZdZ2b/publication

**必填字段:**
- **Categories**: Data extraction, Jobs
- **SEO title**: Welcome to the Jungle Job Scraper - Unofficial
- **Short description**: Unofficial Actor for public Welcome to the Jungle job pages. No login or cookies required. Pay per result delivered.
- **README**: 已经完整 (包含 Pricing 说明)

**Store Publishing Terms 合规要点 (§2.1):**
- Title 必须含 "Unofficial" (已包含)
- README 不得含第三方商标/logo (已避免)
- 不得声称与 WTTJ 有隶属关系 (已声明 Unofficial)
- README 不得推广站外产品 (§4.2) (已遵守)

**发布后:**
- Store listing 自动生成: `https://apify.com/sociable_scissors/wttj-job-scraper`
- 平台按 20% 抽成自动结算: `profit = (0.8 × revenue) − platform_costs`
- 收入累计到 $20 可提现至 PayPal (最低提现额，§11)
- 需完成 KYC 才能提现 (政府身份证 + 地址证明 + 税务文件，§11)

## 3. 后续监控

**G2 判定:**
- 定价应用 + Store 发布完成 → G2 通过

**G3 等待 (陌生人首笔付款):**
- 时限: G2 后 90 天
- 证伪: G2 后 30 天内 0 个陌生人 run → 最危险假设被证伪
- 路径: Console → Actors → wttj-job-scraper → Analytics → Runs (查看 user 分布)

**维护触发:**
- 平台自动测试失败 → 标记 "under maintenance" → 30 天未修 → 下架 (§8.1)
- 用户报告问题 → 14 天内处理；标 "urgent" → 3 个工作日内回复 (§9.1/9.2)
- 故障期间不累计收入 (§11.3)

## 注意事项

**不可在代码里做的事:**
- ❌ 定价只能在 Console 应用，`.actor/pricing.json` 只是本地验证的单一事实源
- ❌ Store listing 只能在 Console 编辑，代码 README 会同步但不能推送定价信息

**KYC 建议:**
- 现在就做，不要等到有收入才做 (收入产生后 12 个月未完成 KYC → 作废，§11)
- 提现门槛: PayPal $20, 其他方式 $100

**收入形状预期 (基于调研):**
- 首周可能 0 run (正常，不是失败信号)
- 1-2 月周 run 个位数
- 3-4 月首次出现两位数用户
- 整个 WTTJ 赛道 30 天用户合计 ~182，即使做到第一也大概率到不了 $500/月

此 Actor 的真实作用是验证「平台带买家、无需自我营销」这一条 20 个候选共享的前提。
