# Codex 执行提示词｜v1.3 CORE_V1 规则范围收敛

你正在继续开发六爻与梅花 Web 项目。请先完整读取 v1.2 母包，再读取 v1.3 新增文件。

## 本轮唯一目标
把现有“候选规则总库”改造成“生产白名单加载模式”，首版只启用 `LIUYAO_CORE_V1` 的 148 个生产单元。不要新增更多传统规则，不要开发高级规则 UI。

## 必须读取
- `START-HERE-V1.3.md`
- `data/production/core-v1-rule-profile.json`
- 所有 `data/production/core-v1-*.json`
- `data/production/all-rule-release-matrix-v1.3.json`
- `data/production/core-v1-report-policy.json`
- `data/production/rule-feature-flags-v1.3.json`
- `fixtures/production/core-v1-scope-contract-fixtures.json`
- `docs/production/61-65`

## 实现要求
1. 建立显式 RuleProfile loader，只允许通过 profile 文件加载规则；禁止生产代码直接加载整个 `*-pro.json`。
2. 默认 profile 为 `LIUYAO_CORE_V1`。
3. 生产环境必须拒绝任何 `REVIEW_REQUIRED` 条目；启动时发现即 fail fast。
4. 支持 `CORE_V1 / ADVANCED_BETA / REVIEW_REQUIRED / DEPRECATED` 四级 release tier。
5. 规则 finding 区分 `FACT / SIGNAL / CANDIDATE_OR_GUARDRAIL`，不得把信号直接当最终吉凶。
6. 把命中结果聚合到六个维度：主体、目标、支持、阻碍、变化、时间。
7. 用户报告展示 6–12 条关键证据，硬上限 15；必须去重和合并重复证据。
8. 应期只输出排序后的候选窗口，不输出保证发生的具体日期。
9. 健康和法律问题必须加入非诊断、非法律意见边界。
10. AI 只能总结已存在的 chart facts 和 rule findings，不能补造规则。

## 禁止事项
- 不得启用 `REVIEW_REQUIRED`。
- 不得因为原候选规则数量更多而全量加载。
- 不得开发三合化局、复杂墓绝、飞伏神、高级进退神或精确应期。
- 不得引入独立规则微服务、事件总线、图数据库或复杂工作流。
- 不得修改白名单数量来迎合当前代码。

## 测试
运行 v1.2 原有测试，并新增：
- 148 个白名单 scope fixture 全部通过；
- 所有白名单 status 均不为 `REVIEW_REQUIRED`；
- 任意审核中规则注入生产 profile 时启动失败；
- 报告 evidence hard max=15；
- AI 输入中不存在未命中 rule code；
- timing 最多公开 5 个候选且包含依据。

## 本轮执行范围
只执行：
A. Profile loader；B. 白名单导入；C. Feature flags；D. 聚合与 evidence budget；E. 测试与文档。
不要继续开发高级规则、完整 AI 文案或新页面。

## 完成反馈
请输出：
1. 修改文件清单；
2. 实际加载数量（必须为 45/24/14/47/18）；
3. 测试命令与结果；
4. 是否存在 REVIEW_REQUIRED 泄漏；
5. 报告聚合与去重实现；
6. 风险和偏离；
7. 是否达到 `CORE_V1_SCOPE_IMPLEMENTED`。
