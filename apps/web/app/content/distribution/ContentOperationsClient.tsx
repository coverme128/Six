"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink, FileText, Layers3, Play, Share2 } from "lucide-react";

import { AppNav } from "../../AppNav";

type ContentLink = { contentId: string; title: string; route: string; reviewStatus?: string };
type SocialAsset = { social_id: string; content_type: string; hook: string; body: string; cta: string; source_content?: ContentLink[] };
type SummaryAsset = { summary_card_id: string; headline: string; one_line_summary: string; learning_stage: string; route: string; source_article_id: string };
type VideoAsset = { video_id: string; title: string; hook: string; duration: string; source_batch: string; article_content?: ContentLink[]; product_cta?: { label: string; route: string } };
type CollectionAsset = { collection_id: string; title: string; description: string; seo_status: string; cover_path: string; recommended_content?: ContentLink[] };

const assetTabs = [
  { key: "social", label: "社交素材", count: 72, icon: Share2 },
  { key: "summary", label: "摘要卡", count: 24, icon: FileText },
  { key: "video", label: "视频资产", count: 50, icon: Play },
  { key: "collection", label: "学习合集", count: 12, icon: Layers3 },
] as const;

const socialLabels: Record<string, string> = {
  KNOWLEDGE_EXPLANATION: "知识解释",
  REAL_WORLD_DECISION: "现实问题",
  TRUST_AI: "可信与 AI",
  REPORT_READING: "报告阅读",
  TEACHING_CASE: "教学案例",
};

export function ContentOperationsClient({ social, summaries, videos, collections }: { social: SocialAsset[]; summaries: SummaryAsset[]; videos: VideoAsset[]; collections: CollectionAsset[] }) {
  const [activeTab, setActiveTab] = useState<(typeof assetTabs)[number]["key"]>("social");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(12);

  const filterOptions = useMemo(() => {
    if (activeTab === "social") return [...new Set(social.map((item) => item.content_type))].map((value) => ({ value, label: socialLabels[value] ?? value }));
    if (activeTab === "summary") return [...new Set(summaries.map((item) => item.learning_stage))].map((value) => ({ value, label: value }));
    if (activeTab === "video") return [...new Set(videos.map((item) => item.source_batch))].map((value) => ({ value, label: value === "BATCH_07" ? "Batch 07 新增" : value.replace("BATCH_", "Batch ") }));
    return [...new Set(collections.map((item) => item.seo_status))].map((value) => ({ value, label: value === "PUBLIC_PAGE" ? "公开合集" : "内部合集" }));
  }, [activeTab, collections, social, summaries, videos]);

  const filteredSocial = filter === "all" ? social : social.filter((item) => item.content_type === filter);
  const filteredSummaries = filter === "all" ? summaries : summaries.filter((item) => item.learning_stage === filter);
  const filteredVideos = filter === "all" ? videos : videos.filter((item) => item.source_batch === filter);
  const filteredCollections = filter === "all" ? collections : collections.filter((item) => item.seo_status === filter);
  const total = activeTab === "social" ? filteredSocial.length : activeTab === "summary" ? filteredSummaries.length : activeTab === "video" ? filteredVideos.length : filteredCollections.length;

  function switchTab(key: (typeof assetTabs)[number]["key"]) {
    setActiveTab(key);
    setFilter(key === "video" ? "BATCH_07" : "all");
    setLimit(12);
  }

  return (
    <main className="shell content-operations">
      <AppNav current="content" />

      <header className="operations-hero">
        <div><p className="eyebrow">内容运营</p><h1>Batch 07 分发资产</h1><p>发布前集中核对视觉、文案、来源、边界和跳转目标。</p></div>
        <dl>
          <div><dt>新增视觉</dt><dd>16</dd></div>
          <div><dt>新增视频</dt><dd>6</dd></div>
          <div><dt>分发资产</dt><dd>158</dd></div>
        </dl>
      </header>

      <div className="operations-tabs" role="tablist" aria-label="选择资产类型">
        {assetTabs.map(({ key, label, count, icon: Icon }) => (
          <button aria-selected={activeTab === key} className={activeTab === key ? "active" : ""} key={key} onClick={() => switchTab(key)} role="tab" type="button">
            <Icon aria-hidden="true" size={18} /><span>{label}</span><strong>{count}</strong>
          </button>
        ))}
      </div>

      <div className="operations-toolbar">
        <label><span>内容分组</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(12); }}><option value="all">全部</option>{filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <span>当前 {total} 项</span>
      </div>

      {activeTab === "social" ? (
        <div className="operations-grid social-assets">
          {filteredSocial.slice(0, limit).map((item) => (
            <article className="operations-asset" key={item.social_id}>
              <img alt={`${item.hook}社交卡`} loading="lazy" src={`/content-growth/distribution/social/${item.social_id}.svg`} />
              <div><span>{socialLabels[item.content_type] ?? item.content_type}</span><strong>{item.hook}</strong><p>{item.body}</p>{item.source_content?.[0]?.route ? <a href={item.source_content[0].route}>打开源内容 <ArrowRight aria-hidden="true" size={15} /></a> : null}</div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "summary" ? (
        <div className="operations-grid summary-assets">
          {filteredSummaries.slice(0, limit).map((item) => (
            <article className="operations-asset" key={item.summary_card_id}>
              <img alt={`${item.headline}摘要卡`} loading="lazy" src={`/content-growth/distribution/summary/${item.summary_card_id}.svg`} />
              <div><span>{item.learning_stage}</span><strong>{item.headline}</strong><p>{item.one_line_summary}</p><a href={item.route}>打开源文章 <ArrowRight aria-hidden="true" size={15} /></a></div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "video" ? (
        <div className="operations-grid video-assets">
          {filteredVideos.slice(0, limit).map((item) => (
            <article className="operations-asset" key={item.video_id}>
              <img alt={`${item.title}视频封面`} loading="lazy" src={`/content-growth/distribution/video-cover/${item.video_id}.svg`} />
              <div><span>{item.source_batch.replace("BATCH_", "Batch ")} · {item.duration}</span><strong>{item.title}</strong><p>{item.hook}</p><nav><a href={`/content-growth/distribution/video-storyboard/${item.video_id}.html`} target="_blank">查看分镜 <ExternalLink aria-hidden="true" size={14} /></a>{item.article_content?.[0]?.route ? <a href={item.article_content[0].route}>源内容 <ArrowRight aria-hidden="true" size={14} /></a> : null}</nav></div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "collection" ? (
        <div className="collection-assets">
          {filteredCollections.slice(0, limit).map((item) => (
            <article className="collection-asset" key={item.collection_id}>
              <img alt={`${item.title}学习合集封面`} loading="lazy" src={item.cover_path} />
              <div className="collection-copy">
                <header><span>{item.collection_id}</span><em>{item.seo_status === "PUBLIC_PAGE" ? "公开合集" : "内部学习路径"}</em></header>
                <h2>{item.title}</h2><p>{item.description}</p>
                <ol>{item.recommended_content?.map((content) => <li key={content.contentId}><a href={content.route}>{content.title}<ArrowRight aria-hidden="true" size={14} /></a></li>)}</ol>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {total > limit ? <button className="secondary operations-more" onClick={() => setLimit((value) => value + 12)} type="button">显示下一组</button> : null}
    </main>
  );
}
