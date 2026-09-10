# Batch 02 Knowledge 商业最终化导入记录

## 导入范围

- 来源包：liuyao-content-commercial-finalization-batch-02-knowledge-v1.0.zip
- 来源快照：298 条知识与基础资料
- 重写并导入：228 条
- 合并为 Canonical 别名：49 条
- 退出六爻公共链路：15 条
- 仅内部保留：6 条
- 稳定内容编号删除：0
- 专业规则修改：0

228 条重写内容包括 140 张 Batch 01-04 知识卡、14 个基础知识节点、2 个独立术语、8 个八卦条目和 64 个六十四卦条目。

## 数据落点

导入器按 Stable ID 将内容写回真实所有者文件，而不是建立第二份运行时内容库：

- content/content-growth/content-entries.json
- data/content/knowledge-nodes-v1.2.json
- data/content/glossary.json
- data/core/trigrams.json
- data/core/hexagrams-64.json

基础排盘字段保持原值。商业正文写入 commercial_content，决策写入 commercial_decision；内容仓库在构造用户条目时合并这两层，不改变六爻引擎读取的卦序、卦位、阴阳、五行或纳甲事实。

## 产品实现

- 知识详情页现在完整呈现定义、实际用途、出现位置、例子、报告阅读方法、常见误区和使用边界。
- 八卦、六十四卦与术语页复用同一套结构化阅读界面。
- 桌面端采用“概念摘要 + 图解 + 阅读目录 + 正文”的层级；移动端改为单列，并保留横向知识导航。
- 49 个合并源的标题加入 Canonical 内容别名，搜索可以命中最终条目。
- MERGE、REMOVE、INTERNAL_ONLY 都保留原 Stable ID 与原因，但不进入生产公共发现链路。

## 发布状态

本批没有执行生产发布，也没有将任何内容自动提升为 PUBLICATION_READY。

源文件中的 228 条重写内容统一保持 REVIEW_REQUIRED。本地数据库 seed 只更新 title、summary 与 payload，不覆盖已存在的 Runtime status，因此当前本地调测可继续看到原先已发布的 70 张 B01/B02 知识卡。

同步后数据库状态保持：

- PUBLISHED: 213
- IN_REVIEW: 208
- DRAFT: 158
- INTERNAL_ONLY: 24

## 独立审计结论

数据包自报 Release Gate 为 PASS，但仓库审计保持 BLOCKED_PENDING_EDITORIAL_AND_DOMAIN_REVIEW。

阻断原因：

- 9 组完全重复的长段落，其中一段在 40 个条目中重复；
- 39 个源条目在正文或 SEO 中仍含工程化词汇；
- 163 个条目存在偏系统/产品说明的表达，用户学习任务不够独立；
- 角色、旺衰、动变和应期内容仍需领域审核；
- 64 卦与八卦只能作为结构和传统语境，不能替代用神、世应、旺衰与动变事实。

详细结果见 reports/content/knowledge-commercial-finalization-batch-02-import.json。

## 验证结果

- Content QA：603 条，0 errors，0 warnings
- Batch 02 回归：3/3 通过
- 内容资产回归：6/6 通过
- 领域测试：69/69 通过
- TypeScript：通过
- ESLint：0 errors
- Production build：通过
- 数据库 payload：228/228
- 数据库决策：MERGE 49 / REMOVE 15 / INTERNAL_ONLY 6
- 桌面与 390px 移动端知识详情页：无页面横向溢出

## 重复执行

1. 运行 pnpm content:import-knowledge 并传入 Batch 02 ZIP 的绝对路径。
2. 设置 SIX 的 DATABASE_URL 后运行 pnpm db:seed。
3. 运行 pnpm content:qa。
4. 运行 node --import tsx --test tests/content-commercial-knowledge.test.ts。

进入生产发布前，必须先完成重复文案拆分、工程语言清理、领域审核和 Runtime Release Gate；不能以正文长度或数据包自报 PASS 代替审核。
