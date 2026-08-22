import type { Metadata } from "next";

import collections from "../../../../../data/content-growth/distribution/collections.json";
import social from "../../../../../data/content-growth/distribution/social.json";
import summaries from "../../../../../data/content-growth/distribution/summaries.json";
import videos from "../../../../../data/content-growth/distribution/videos.json";
import { ContentOperationsClient } from "./ContentOperationsClient";

export const metadata: Metadata = {
  title: "内容运营预览｜六爻",
  robots: { index: false, follow: false },
};

export default function ContentDistributionPage() {
  return <ContentOperationsClient collections={collections} social={social} summaries={summaries} videos={videos} />;
}
