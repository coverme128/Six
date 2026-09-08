# 六爻内容商业最终化快照 v1

## 目的

本阶段不重写正文。它先固定真实内容边界，并导出 ChatGPT 后续商业最终化所需的唯一主输入：

`artifacts/liuyao-current-content-repository-snapshot-v1.0.zip`

## 公开规则

运行时 PostgreSQL `content_entries.status` 是唯一发布真源。普通用户界面、搜索、合集、推荐和 Content API 只允许同时满足以下条件的记录：

- 数据库状态为 `PUBLISHED`
- `domain` 严格等于 `liuyao`
- 不包含梅花专属语义

数据包、历史 QA 文档、静态合集状态和前端预计数量不能覆盖运行时状态。旧的本地 finalizer 只执行检查，不再自动把内容提升为 `PUBLICATION_READY`。

## 案例处置

`B05-CASE-*` 和 `B06-CASE-*` 共 24 条保留在仓库及数据库中，统一标记为 `INTERNAL_ONLY`。它们不进入普通用户内容链路，也不进入下一轮商业正文主内容；快照将其单独放入 `internal-cases/`。

## 生成快照

先确保本项目 PostgreSQL 已启动并应用迁移，然后执行：

```bash
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/six_professional' pnpm content:export-snapshot
```

脚本从运行时数据库读取全部内容，并附加仓库来源、合集、专题、关联关系、视觉资产审计和五类内容审计。脚本会同时生成目录与 ZIP，并在控制台输出 ZIP 的 SHA-256。

## 快照范围

- B03/B04/B05 文章：68 篇
- Knowledge 与参考资料：全部实际记录，并按 `KNOWLEDGE`、`GLOSSARY`、`TRIGRAM`、`HEXAGRAM` 分型
- FAQ：170 条
- 内部案例：24 条
- Collections、Topic Landings、Learn Hub、Related、Recommendation、Search、Sitemap
- Publication、内部语言、重复候选、梅花串域、完整度审计

缺失字段保留为 `null` 或空值，脚本不会补造正文、专业事实或关系。
