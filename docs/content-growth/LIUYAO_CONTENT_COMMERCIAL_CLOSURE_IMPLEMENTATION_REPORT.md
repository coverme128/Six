# 六爻内容商业闭环实施报告

## 结论

Batch 01–04 已完成仓库导入、统一治理、Runtime 映射、信息架构、搜索、SEO 与本地产品验收。本轮没有执行生产发布，也没有把“编辑完成”冒充为“专业审核通过”。

当前状态：`LIUYAO_CONTENT_COMMERCIAL_READY_WITH_BLOCKERS`

## Batch 04 覆盖

| 验收项 | 结果 |
| --- | --- |
| 统一决策映射 | 536 / 536 |
| Canonical 内容 | 457 / 457 |
| REWRITE | 457 |
| MERGE / alias | 57 |
| REMOVE | 15 |
| INTERNAL_ONLY | 7 |
| 内容关系 | 1193 条 |
| Learn Hub 错位引用迁移 | 67 条 |
| 未解析引用 | 0 |

## Runtime 与发布边界

本地数据库共 603 条内容：

| 状态 | 数量 | 本地预览 | 生产可见 |
| --- | ---: | --- | --- |
| REVIEW_REQUIRED / IN_REVIEW | 493 | 是 | 否 |
| PUBLICATION_READY / PUBLISHED | 7 | 是 | 是 |
| INTERNAL_ONLY | 88 | 否 | 否 |
| DEFERRED / ARCHIVED | 15 | 否 | 否 |

当前 7 条生产可见内容仅为 6 个专题入口和 1 条学习路径。Batch 01–03 的文章、知识卡和 FAQ 生产可见数均为 0；它们在本地审核环境可完整查看。

包内 240 条 `READY_FOR_RUNTIME_RELEASE_GATE` 只表示商业编辑层完成，不代表六爻专业审核通过。仓库独立审核通过数仍为 0，另有 217 条由包明确标记为需要专业审核。

独立审计还发现 36 篇旧 B01/B02 教程含 `CORE_V1`、`ProductResultFacts` 等工程语言，已统一降级到 `REVIEW_REQUIRED`。生产 API 搜索 `CORE_V1`、梅花、`REVIEW_REQUIRED` 和批次内部编号的结果均为 0。

## 产品闭环

1. Learn Hub 一级路径固定为“从这里开始、按现实问题、深入理解”，资料库作为直接查阅入口。
2. 12 套合集保留为二级连续学习路径，不占用一级导航。
3. 一级现实专题只展示感情、合作、事业、财务、考试求职、出行 6 类；房产、纠纷、健康、寻物保持隐藏和 noindex。
4. 搜索按标题、FAQ 问法、alias、摘要、正文分级排序，支持正文检索。
5. 57 个合并源不形成重复搜索结果；访问旧路由时解析到 canonical 内容。
6. Learn Hub、Library、Topic、Collection、Public API 和 sitemap 共用 Runtime 发布状态。
7. 生产 sitemap 只有 7 个 URL；审核中、内部、移除、alias 与梅花内容均不进入索引。
8. 桌面端完成信息层级验收；390 x 844 移动端无横向溢出，三个学习目标和五个知识入口均可直接看到。
9. 68 个既有 SVG 和 Batch 07 非视频视觉资产回归测试通过；Batch 04 不新增视觉正文资产。

## 质量结果

- `pnpm content:qa`：603 条，0 errors，0 warnings，0 isolated content。
- Batch 02–04 内容契约测试：13 / 13 通过。
- 视觉资产回归：6 / 6 通过。
- 全仓领域测试：69 / 69 通过；全仓测试任务通过。
- `pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过。Lint 保留 11 个既有 unused 警告，无 error。
- 生产 API：7 条公开内容；内部术语、梅花和审核内容均为 0。
- 本地预览 API：500 条可审内容；alias 搜索与 MERGE 路由解析通过。

## 仍需解除的发布阻塞

1. Batch 01 文章独立编辑审核尚未通过。
2. Batch 02 知识内容仍需独立编辑与六爻专业审核。
3. Batch 03 FAQ 仍有 36 组长句重复，需要逐组去模板化。
4. 240 条编辑完成候选尚未由确定性的专业审核流程批准。

解除上述阻塞后，应逐条更新 Runtime 发布状态，再重新执行内容 QA、生产 API 隔离测试、sitemap 和移动端回归；不能通过批量脚本直接晋升全部内容。

## 重放命令

```bash
pnpm content:import-closure -- /absolute/path/to/liuyao-content-commercial-finalization-batch-04-release-closure-v1.0.zip
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/six_professional' pnpm db:seed
pnpm content:qa
pnpm content:test-assets
pnpm typecheck
pnpm test
pnpm build
pnpm content:seo
```

