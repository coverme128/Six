# Batch 04 内容商业闭环集成记录

最后核对：2026-09-10

当前总览与文档入口见 [六爻内容系统文档索引](../README.md)，完整验收见 [商业闭环实施报告](../LIUYAO_CONTENT_COMMERCIAL_CLOSURE_IMPLEMENTATION_REPORT.md)。

## 已集成

- 536 条统一内容决策全部映射到仓库和 Runtime 内容模型。
- 457 个 canonical 资产、57 个 alias 源、15 个移出六爻项和 7 个 internal-only 项均有唯一治理结果。
- 1193 条 canonical 内容关系已进入内容对象；67 个误作 Content ID 的 Learn Hub 引用已迁移为导航引用。
- Learn Hub 一级信息架构收敛为“从这里开始、按现实问题、深入理解”。
- 12 个合集保留为二级学习路径，不进入一级导航；每个合集至少需要 3 个 Runtime 可见条目。
- 现实专题一级展示收敛为 6 个有内容纵深的入口；房产、纠纷、健康、寻物暂不进入主导航并保持 NOINDEX。
- 搜索支持标题、FAQ 问法、alias、摘要和正文分级匹配；合并源解析到 canonical 内容。
- Public API、Library、Learn Hub、Topic 和 Collection 均以 Runtime 内容查询为可见性来源。
- 独立 Runtime 审计发现 36 篇早期 B01/B02 教程仍公开包含 `CORE_V1` 等内部词；这些页面已降为 `REVIEW_REQUIRED`，本地可继续预览，生产不可见。

## 发布状态

本次没有修改任何内容为 `PUBLICATION_READY`。包内 240 条 `READY_FOR_RUNTIME_RELEASE_GATE` 只表示编辑层可以进入后续审核，其中不包含仓库独立领域审核结论；217 条仍明确要求专业审核。

Batch 01–03 的独立审计仍存在模板复用、产品化语言和专业复核项，因此当前结论为：

`LIUYAO_CONTENT_COMMERCIAL_READY_WITH_BLOCKERS`

## 重放

```bash
pnpm content:import-closure -- /absolute/path/to/liuyao-content-commercial-finalization-batch-04-release-closure-v1.0.zip
node --import tsx --test tests/content-commercial-closure.test.ts
pnpm content:qa
```

最终实现报告见 `docs/content-growth/LIUYAO_CONTENT_COMMERCIAL_CLOSURE_IMPLEMENTATION_REPORT.md`。
