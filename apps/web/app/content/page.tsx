import visualAudit from "../../../../data/liuyao/visual-system/integration/content-growth-68-svg-production-audit.json";
import { ContentListClient } from "./ContentListClient";

export default function ContentPage() {
  return <ContentListClient visualAssets={visualAudit.assets} />;
}
