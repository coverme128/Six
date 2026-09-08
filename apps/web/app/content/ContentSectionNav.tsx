import { BookOpen, FileSearch, FileText, Images, Layers3, Route, Target } from "lucide-react";

const contentSections = [
  { key: "home", label: "知识首页", href: "/content", icon: BookOpen },
  { key: "path", label: "学习路径", href: "/content#learning-path", icon: Route },
  { key: "collections", label: "学习合集", href: "/content/collections", icon: Layers3 },
  { key: "topics", label: "现实专题", href: "/content#topics", icon: Target },
  { key: "report", label: "报告阅读", href: "/content#report-guide", icon: FileText },
  { key: "visuals", label: "图解知识", href: "/content#visual-atlas", icon: Images },
  { key: "library", label: "全部资料", href: "/content/library", icon: FileSearch },
] as const;

export function ContentSectionNav({ current = "home" }: { current?: "home" | "library" | "collections" | "detail" }) {
  return (
    <nav aria-label="知识中心" className="content-section-nav">
      <div>
        {contentSections.map(({ key, label, href, icon: Icon }) => {
          const selected = (current === "home" && key === "home") || (current === "library" && key === "library") || (current === "collections" && key === "collections");
          return (
            <a aria-current={selected ? "page" : undefined} className={selected ? "active" : ""} href={href} key={key}>
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
