import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { topicProfileForSlug, topicProfileList } from "../../topicProfiles";
import { TopicDetailClient } from "./TopicDetailClient";

export function generateStaticParams() {
  return topicProfileList.map((profile) => ({ slug: profile.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = topicProfileForSlug(slug);
  if (!profile) return {};
  return {
    title: `${profile.name}六爻专题｜问题、观察重点与行动边界`,
    description: profile.intro,
    alternates: { canonical: `/content/topic/${profile.slug}` },
    openGraph: { title: `${profile.name}六爻专题`, description: profile.intro, type: "article", images: [{ url: profile.visual, alt: profile.visualAlt }] },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = topicProfileForSlug(slug);
  if (!profile) notFound();
  return <TopicDetailClient profile={profile} />;
}
