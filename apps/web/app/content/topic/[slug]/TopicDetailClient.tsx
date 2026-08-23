"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ShieldCheck } from "lucide-react";
import { AppNav } from "../../../AppNav";
import { apiBase, type ContentSummary } from "../../../lib/api";
import { ContentSectionNav } from "../../ContentSectionNav";
import type { TopicProfile } from "../../topicProfiles";

function contentHref(item: ContentSummary) {
  return `/content/${item.contentType.toLowerCase().replaceAll("_", "-")}/${encodeURIComponent(item.slug)}`;
}

export function TopicDetailClient({ profile }: { profile: TopicProfile }) {
  const [items, setItems] = useState<ContentSummary[]>([]);

  useEffect(() => {
    fetch(`${apiBase()}/content`)
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((body: { items?: ContentSummary[] }) => setItems(body.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const recommendations = profile.recommendedContentIds.map((id) => items.find((item) => item.contentId === id)).filter((item): item is ContentSummary => Boolean(item));

  return (
    <main className="shell">
      <AppNav current="content" />
      <ContentSectionNav current="detail" />
      <article className="topic-detail-page">
        <header className="topic-detail-hero">
          <div>
            <p className="eyebrow">{profile.category} · 六爻现实专题</p>
            <h1>{profile.name}</h1>
            <p>{profile.intro}</p>
            <div className="topic-detail-actions">
              <a className="primary-link" href={`/?scenario=${profile.scenario}#liuyao-workbench`}>带着这个问题开始 <ArrowRight aria-hidden="true" size={17} /></a>
              <a className="secondary-link" href="#topic-reading">先看怎样分析 <BookOpen aria-hidden="true" size={17} /></a>
            </div>
          </div>
          <img src={profile.visual} alt={profile.visualAlt} />
        </header>

        <section className="topic-question-examples">
          <div className="section-heading"><div><p className="eyebrow">问题写法</p><h2>把犹豫写成一件可以分析的事</h2><p>写清对象、正在发生的事情，以及你需要决定的下一步。</p></div></div>
          <div>{profile.examples.map((example) => <a href={`/?scenario=${profile.scenario}&question=${encodeURIComponent(example)}#liuyao-workbench`} key={example}><span>{example}</span><ArrowRight aria-hidden="true" size={16} /></a>)}</div>
        </section>

        <section className="topic-reading-lenses" id="topic-reading">
          <div className="section-heading"><div><p className="eyebrow">报告会重点看</p><h2>四个观察面，最后落到现实行动</h2></div></div>
          <ol>{profile.lenses.map((lens, index) => <li key={lens.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{lens.title}</strong><p>{lens.detail}</p></div><CheckCircle2 aria-hidden="true" size={20} /></li>)}</ol>
        </section>

        <aside className="topic-safety-boundary"><ShieldCheck aria-hidden="true" size={24} /><div><strong>使用边界</strong><p>{profile.boundary}</p></div></aside>

        <section className="topic-recommended-reading">
          <div className="section-heading"><div><p className="eyebrow">继续理解</p><h2>三篇内容，按顺序建立判断框架</h2><p>先学提问或基础框架，再理解证据，最后转成行动。</p></div><a className="text-link" href="/content/library">查看全部资料</a></div>
          {recommendations.length ? <ol>{recommendations.map((item, index) => <li key={item.contentId}><a href={contentHref(item)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><p>{item.summary}</p></div><ArrowRight aria-hidden="true" size={17} /></a></li>)}</ol> : <p className="empty">正在整理本专题的推荐阅读。</p>}
        </section>
      </article>
    </main>
  );
}
