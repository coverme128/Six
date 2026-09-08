import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Target, UserRound } from "lucide-react";
import { AppNav } from "../../../AppNav";
import { apiBase, type ContentSummary } from "../../../lib/api";
import { ContentSectionNav } from "../../ContentSectionNav";
import { collectionForSlug, learningCollections } from "../../collectionProfiles";

export const dynamic = "force-dynamic";

async function publicContentIds() {
  try {
    const response = await fetch(`${apiBase()}/content`, { cache: "no-store" });
    if (!response.ok) return new Set<string>();
    const body = await response.json() as { items?: ContentSummary[] };
    return new Set((body.items ?? []).map((item) => item.contentId));
  } catch {
    return new Set<string>();
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = collectionForSlug(slug);
  if (!collection) return {};
  return {
    title: `${collection.title}｜六爻学习合集`,
    description: collection.description,
    alternates: { canonical: `/content/collection/${collection.slug}` },
    openGraph: { title: `${collection.title}｜六爻学习合集`, description: collection.description, type: "article", images: [{ url: collection.cover_path, alt: `${collection.title}学习合集封面` }] },
  };
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = collectionForSlug(slug);
  if (!collection) notFound();
  const publicIds = await publicContentIds();
  const availableCollections = learningCollections.filter((item) => item.recommended_content.every((entry) => publicIds.has(entry.contentId)));
  if (!availableCollections.some((item) => item.slug === collection.slug)) notFound();
  const index = availableCollections.findIndex((item) => item.slug === collection.slug);
  const previous = index > 0 ? availableCollections[index - 1] : undefined;
  const next = index < availableCollections.length - 1 ? availableCollections[index + 1] : undefined;

  return (
    <main className="shell">
      <AppNav current="content" />
      <ContentSectionNav current="collections" />
      <article className="collection-detail-page">
        <header className="collection-detail-hero">
          <div>
            <p className="eyebrow">{collection.group} · {collection.collection_id}</p>
            <h1>{collection.title}</h1>
            <p>{collection.description}</p>
            <div className="collection-detail-facts"><span><Clock3 aria-hidden="true" size={17} />{collection.duration}</span><span><CheckCircle2 aria-hidden="true" size={17} />3 篇核心内容</span></div>
            <a className="primary-link" href={collection.recommended_content[0]?.route}>从第一篇开始 <ArrowRight aria-hidden="true" size={17} /></a>
          </div>
          <img src={collection.cover_path} alt={`${collection.title}学习合集封面`} />
        </header>

        <section className="collection-fit-band">
          <div><UserRound aria-hidden="true" size={22} /><span><strong>适合谁</strong>{collection.audience}</span></div>
          <div><Target aria-hidden="true" size={22} /><span><strong>学完能做到</strong>{collection.outcome}</span></div>
        </section>

        <section className="collection-reading-order">
          <div className="section-heading"><div><p className="eyebrow">推荐顺序</p><h2>三步完成，不需要额外筛选</h2><p>每一步都建立在前一步之上；读完后可直接进入下一篇。</p></div></div>
          <ol>{collection.recommended_content.map((item, itemIndex) => <li key={item.contentId}><a href={item.route}><span>{String(itemIndex + 1).padStart(2, "0")}</span><div><em>{itemIndex === 0 ? "建立基础" : itemIndex === 1 ? "理解关键结构" : "转成阅读与行动"}</em><strong>{item.title}</strong></div><ArrowRight aria-hidden="true" size={19} /></a></li>)}</ol>
        </section>

        <section className="collection-tool-cta"><div><p className="eyebrow">学完就去实践</p><h2>带着一个具体问题，开始一次完整分析</h2><p>报告会保留问题、排盘事实、判断依据和行动建议，方便之后复盘。</p></div><a className="primary-link" href="/#question-step">{collection.tool_cta} <ArrowRight aria-hidden="true" size={17} /></a></section>

        <nav className="collection-pagination" aria-label="其他学习合集">
          {previous ? <a href={`/content/collection/${previous.slug}`}><ArrowLeft aria-hidden="true" size={17} /><span><small>上一套</small><strong>{previous.title}</strong></span></a> : <span />}
          {next ? <a href={`/content/collection/${next.slug}`}><span><small>下一套</small><strong>{next.title}</strong></span><ArrowRight aria-hidden="true" size={17} /></a> : <span />}
        </nav>
      </article>
    </main>
  );
}
