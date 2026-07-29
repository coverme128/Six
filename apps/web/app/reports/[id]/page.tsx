import { ReportDetailClient } from "./ReportDetailClient";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetailClient reportId={id} />;
}
