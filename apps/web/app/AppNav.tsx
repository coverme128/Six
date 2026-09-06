import { ArrowRight, Settings } from "lucide-react";

type AppNavProps = {
  current?: "workbench" | "history" | "content" | "settings" | "report";
};

const links = [
  { key: "workbench", href: "/", label: "首页" },
  { key: "history", href: "/history", label: "我的报告" },
  { key: "content", href: "/content", label: "学习中心" }
] as const;

export function AppNav({ current = "workbench" }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="主导航">
      <a className="brand" href="/">
        <span aria-hidden="true" className="brand-mark">六</span>
        <span className="brand-copy">
          <strong>六爻</strong>
          <small>问题分析与复核报告</small>
        </span>
      </a>
      <div className="nav-links">
        {links.map((link) => (
          <a
            aria-current={current === link.key || (link.key === "history" && current === "report") ? "page" : undefined}
            href={link.href}
            key={link.key}
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="nav-actions">
        <a
          aria-current={current === "settings" ? "page" : undefined}
          aria-label="设置"
          className="nav-utility"
          href="/settings"
          title="设置"
        >
          <Settings aria-hidden="true" size={18} />
        </a>
        <a className="nav-primary-action" href="/#question-step">
          开始分析
          <ArrowRight aria-hidden="true" size={17} />
        </a>
      </div>
    </nav>
  );
}
