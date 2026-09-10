import { BookOpen, FileSearch, GraduationCap, Route, Target } from "lucide-react";

const contentSections = [
  { key: "home", label: "知识首页", href: "/content", icon: BookOpen },
  { key: "start", label: "从这里开始", href: "/content#learning-path", icon: Route },
  { key: "topics", label: "按现实问题", href: "/content#topics", icon: Target },
  { key: "deep", label: "深入理解", href: "/content#visual-atlas", icon: GraduationCap },
  { key: "library", label: "全部资料", href: "/content/library", icon: FileSearch },
] as const;

export function ContentSectionNav({ current = "home" }: { current?: "home" | "library" | "collections" | "detail" }) {
  return (
    <nav aria-label="知识中心" className="content-section-nav">
      <div>
        {contentSections.map(({ key, label, href, icon: Icon }) => {
          const selected = (current === "home" && key === "home") || (current === "library" && key === "library");
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
