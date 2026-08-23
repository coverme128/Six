import type { Metadata } from "next";
import visualAudit from "../../../../data/liuyao/visual-system/integration/content-growth-68-svg-production-audit.json";
import { ContentListClient } from "./ContentListClient";

export const metadata: Metadata = {
  title: "六爻知识中心｜专题、学习合集与报告阅读",
  description: "面向所有用户的六爻知识中心，从现实问题、学习合集、报告阅读、图解知识和完整资料库进入。",
  alternates: { canonical: "/content" },
  openGraph: {
    title: "六爻知识中心",
    description: "先找到你要解决的事，再进入对应知识。",
    images: [{ url: "/content-growth/visuals/B07-VIS-01.svg", alt: "六爻知识体系与学习入口总地图" }],
  },
};

export default function ContentPage() {
  return <ContentListClient visualAssets={visualAudit.assets} />;
}
