import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "六爻专业分析与可复核报告",
  description: "围绕具体问题生成确定性六爻排盘、场景化结论、现实行动建议与可追溯专业依据。"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
