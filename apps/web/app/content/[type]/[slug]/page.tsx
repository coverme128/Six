import type { Metadata } from "next";
import { ContentDetailClient } from "./ContentDetailClient";
import { apiBase, type ContentDetail } from "../../../lib/api";
import { contentVisualFor } from "../../contentVisuals";

async function loadContent(type: string, slug: string) {
  try {
    const response = await fetch(`${apiBase()}/content/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return undefined;
    return await response.json() as ContentDetail;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ type: string; slug: string }> }): Promise<Metadata> {
  const { type, slug } = await params;
  const item = await loadContent(type, slug);
  if (!item) return { title: "六爻知识内容" };
  const visual = contentVisualFor(item);
  const canonical = item.canonicalPath ?? `/content/${type}/${slug}`;
  return {
    title: `${item.title}｜六爻知识中心`,
    description: item.summary,
    alternates: { canonical },
    robots: item.reviewStatus === "PUBLICATION_READY" ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: item.title, description: item.summary, type: "article", url: canonical, images: [{ url: visual.src, alt: visual.alt }] },
    twitter: { card: "summary_large_image", title: item.title, description: item.summary, images: [visual.src] },
  };
}

export default async function ContentDetailPage({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  return <ContentDetailClient type={type} slug={slug} />;
}
