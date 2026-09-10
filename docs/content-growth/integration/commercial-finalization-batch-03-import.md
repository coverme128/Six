# Batch 03 FAQ 商业最终化集成记录

## 范围

- 输入包：`liuyao-content-commercial-finalization-batch-03-faq-v1.0.zip`
- 源 FAQ：170 条，Stable ID 全部保留
- 重写：161 条
- 合并：8 条
- 仅内部：1 条
- 案例、文章、知识卡和专业规则不在本批修改范围

## 产品处理

- 重写 FAQ 写入 `content/content-growth/content-entries.json`，保留原路径和 Stable ID。
- 8 个同义问题退出独立公开页面，并作为 canonical FAQ 的搜索问法保留。
- `B04-FAQ-40` 属于内部实现问题，退出普通内容列表、搜索和 SEO。
- FAQ 详情页按“直接回答、展开理解、相近问法、使用边界、延伸内容”呈现。
- 所有重写内容保持 `REVIEW_REQUIRED`，SEO 关闭，不执行生产发布升级。

## 独立审计

数据包自带 QA 声明通过，但仓库独立审计发现 3 条源答案仍含英文工程词，并识别出 36 组重复长句，最高一组复用于 19 条 FAQ；梅花串域为 0。导入层已把公开答案中的工程词清为 0，但未把模板复用误报为商业完成，因此本批仓库 Release Gate 保持 `BLOCKED_PENDING_EDITORIAL_AND_DOMAIN_REVIEW`。完整结果位于 `reports/content/faq-commercial-finalization-batch-03-import.json`。

## 重放

```bash
pnpm content:import-faq -- /absolute/path/to/liuyao-content-commercial-finalization-batch-03-faq-v1.0.zip
node --import tsx --test tests/content-commercial-faq.test.ts
pnpm content:qa
```

运行导入不会将内容自动升级为 `PUBLICATION_READY`。Runtime 数据库是否公开仍由数据库内容状态控制。
