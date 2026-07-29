import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../web-style.css";

export const metadata: Metadata = {
  title: "Six Admin",
  description: "六爻与梅花内部管理台"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
