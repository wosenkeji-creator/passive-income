# 被动收入项目群

Top20 候选项的统一开发仓。多个互不依赖的独立产品，一个仓库。

开发规约看 `CLAUDE.md`（含 WIP 限制和阶段闸门）。
当前进度看 `STATUS.md`（客观事实，无判断）。
开发决策看 `DECISION_LOG.md`（本仓库内，只管本项目怎么开发）。
候选证据覆盖看 `TOP20_EVIDENCE.md`（不排序、不替代决策）。

## 结构
```
products/pNN-slug/   独立产品，NN 锁定 Top20 编号
shared/              跨产品复用代码（第 2 个用到时才抽）
_templates/          SPEC.md / LOG.md 模板
STATUS.md            事实台账
```

## 新产品开工流程
1. 确认 G0–G3 的 WIP 名额有空位（`STATUS.md`）。没空位就等，不许并开。
2. `products/pNN-slug/` 建目录，拷 `_templates/` 里的两个模板。
3. 填完 `SPEC.md`——**渠道、单位经济、放弃条件三项缺一不可**，缺了就是没过 G0。
4. 更新 `STATUS.md` 的 WIP 表。
5. 开始写代码。

## 环境
Node 24.15 · Python 3.14.3 · git 2.53 · Docker 29.2
