import type { Metadata } from "next";
import { ArrowRight, Clock3 } from "lucide-react";
import { AppNav } from "../../AppNav";
import { apiBase, type ContentSummary } from "../../lib/api";
import { ContentSectionNav } from "../ContentSectionNav";
import { learningCollections } from "../collectionProfiles";

export const metadata: Metadata = {
  title: "六爻学习合集｜按目标循序学习",
  description: "当前已完成审核的六爻学习合集，按使用目标组织必要内容。",
  alternates: { canonical: "/content/collections" },
};

export const dynamic = "force-dynamic";

const groups = ["开始使用", "理解盘面", "建立判断", "现实应用"] as const;

async function loadAvailableCollections() {
  try {
    const response = await fetch(`${apiBase()}/content`, { cache: "no-store" });
    if (!response.ok) return [];
    const body = await response.json() as { items?: ContentSummary[] };
    const publicIds = new Set((body.items ?? []).map((item) => item.contentId));
    return learningCollections.filter((collection) => collection.recommended_content.every((item) => publicIds.has(item.contentId)));
  } catch {
    return [];
  }
}

export default async function CollectionsPage() {
  const availableCollections = await loadAvailableCollections();
  const availableGroups = groups.filter((group) => availableCollections.some((collection) => collection.group === group));
  return (
    <main className="shell">
      <AppNav current="content" />
      <ContentSectionNav current="collections" />
      <header className="collection-index-hero">
        <p className="eyebrow">{availableCollections.length} 套当前可学合集</p>
        <h1>围绕一个目标，按顺序学完三篇</h1>
        <p>不用在完整资料库里挑选。选择当前目标，每套合集只保留三篇必要内容和明确学习结果。</p>
      </header>
      <nav className="collection-group-nav" aria-label="合集阶段">{availableGroups.map((group) => <a href={`#collection-${group}`} key={group}>{group}</a>)}</nav>
      {availableGroups.map((group) => (
        <section className="collection-index-group" id={`collection-${group}`} key={group}>
          <div className="section-heading"><div><p className="eyebrow">{group}</p><h2>{group === "开始使用" ? "先建立正确的使用方式" : group === "理解盘面" ? "看懂盘面中的基本角色" : group === "建立判断" ? "把信息组织成判断" : "回到报告与现实问题"}</h2></div></div>
          <div className="collection-index-grid">
            {availableCollections.filter((collection) => collection.group === group).map((collection) => (
              <a href={`/content/collection/${collection.slug}`} key={collection.collection_id}>
                <img src={collection.cover_path} alt={`${collection.title}学习合集封面`} />
                <span>{collection.collection_id} · {collection.group}</span>
                <strong>{collection.title}</strong>
                <p>{collection.description}</p>
                <em><Clock3 aria-hidden="true" size={15} />{collection.duration}<i>进入合集 <ArrowRight aria-hidden="true" size={15} /></i></em>
              </a>
            ))}
          </div>
        </section>
      ))}
      {!availableCollections.length ? <p className="empty">当前合集仍在内容审核中，请先从知识中心进入已公开内容。</p> : null}
    </main>
  );
}
