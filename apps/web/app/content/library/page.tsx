import type { Metadata } from "next";

import { ContentLibraryClient } from "./ContentLibraryClient";

export const metadata: Metadata = {
  title: "六爻完整资料库",
  description: "按学习主题、内容形式和难度筛选六爻教程、知识卡、问答、术语与卦象资料。",
};

export default function ContentLibraryPage() {
  return <ContentLibraryClient />;
}
