# 六爻内容系统文档索引

最后核对：2026-09-10

## 当前事实源

阅读和执行时按以下优先级使用文档：

1. [商业闭环实施报告](LIUYAO_CONTENT_COMMERCIAL_CLOSURE_IMPLEMENTATION_REPORT.md)：当前总量、审核状态、生产可见性、搜索/SEO 验收和剩余阻塞。
2. [Batch 04 商业闭环集成记录](integration/commercial-finalization-batch-04-closure.md)：536 条统一决策、Runtime 映射和重放命令。
3. [全量内容集成报告](integration/full-content-growth-integration-report.md)：原始 Batch 00–07 与商业最终化叠加后的整体关系。
4. [知识中心信息架构](../design/knowledge-hub-information-architecture-v2.md)：Learn Hub、学习阶段、专题、合集和资料库的当前产品规则。
5. [本地启动指南](../development/local-startup.md)：本地预览、数据库刷新及开发/生产可见性差异。
6. [备份与迁移指南](../development/backup-and-migration.md)：603 条内容及报告数据的迁移、恢复和回滚。

## 商业最终化批次

| 批次 | 范围 | 集成记录 |
| --- | --- | --- |
| Batch 01 | 长文章 | [记录](integration/commercial-finalization-batch-01-import.md) |
| Batch 02 | 知识卡与基础知识 | [记录](integration/commercial-finalization-batch-02-import.md) |
| Batch 03 | FAQ | [记录](integration/commercial-finalization-batch-03-import.md) |
| Batch 04 | 统一治理与发布闭环 | [记录](integration/commercial-finalization-batch-04-closure.md) |

原始 `batch-00` 至 `batch-07` 集成报告用于追溯第一次导入过程、素材数量和包级问题，不再作为当前发布数量或 Runtime 状态的事实源。

## 当前状态摘要

- Runtime 总量：603。
- 本地开发可见：500，包括审核中内容。
- Beta/production 可见：7，仅 6 个专题入口和 1 条学习路径。
- 文章、知识卡、FAQ 当前生产可见：0。
- 内容 QA：0 errors、0 warnings、0 isolated content。
- 状态：`LIUYAO_CONTENT_COMMERCIAL_READY_WITH_BLOCKERS`。

## 变更规则

- 内容正文与治理决策先进入文件源，再通过 `pnpm db:seed` 有意同步 Runtime 数据库。
- 不在日常启动时重复执行 ZIP 导入脚本。
- 不把 `COMMERCIAL_EDITORIAL_COMPLETE` 或 `READY_FOR_RUNTIME_RELEASE_GATE` 直接等同于 `PUBLICATION_READY`。
- MERGE 源只能作为 alias 或旧路由解析，不能生成独立搜索结果。
- `REVIEW_REQUIRED`、`INTERNAL_ONLY`、`DEFERRED`、REMOVE 和梅花内容不得进入生产 API 或 sitemap。
- 通过审核后逐条晋升，不允许批量自动晋升 240 个候选内容。

