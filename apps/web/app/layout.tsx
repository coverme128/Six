import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "六爻与梅花专业排盘",
  description: "确定性排盘、规则依据与 AI 白话解释分层呈现的六爻与梅花 Web 工具"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
