import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"),
  title: "六爻专业分析与可复核报告",
  description: "围绕具体问题生成确定性六爻排盘、场景化结论、现实行动建议与可追溯专业依据。",
  openGraph: {
    title: "六爻专业分析与可复核报告",
    description: "从一个具体问题出发，看清方向、阻碍、依据与下一步。",
    type: "website",
    images: [{ url: "/liuyao-visual-system/editorial/final/social/ED-LY-005-og-1200x630.svg", alt: "六爻专业分析与可复核报告" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
