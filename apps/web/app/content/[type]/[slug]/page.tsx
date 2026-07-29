import { ContentDetailClient } from "./ContentDetailClient";

export default async function ContentDetailPage({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  return <ContentDetailClient type={type} slug={slug} />;
}
