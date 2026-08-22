import { BookOpen, FileSearch, FileText, Images, Route, Target, TestTube2 } from "lucide-react";

const contentSections = [
  { key: "home", label: "知识首页", href: "/content", icon: BookOpen },
  { key: "path", label: "学习路径", href: "/content#learning-path", icon: Route },
  { key: "topics", label: "现实专题", href: "/content#topics", icon: Target },
  { key: "report", label: "报告阅读", href: "/content#report-guide", icon: FileText },
  { key: "cases", label: "案例练习", href: "/content#case-lab", icon: TestTube2 },
  { key: "visuals", label: "图解知识", href: "/content#visual-atlas", icon: Images },
  { key: "library", label: "全部资料", href: "/content/library", icon: FileSearch },
] as const;

export function ContentSectionNav({ current = "home" }: { current?: "home" | "library" | "detail" }) {
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
