type AppNavProps = {
  current?: "workbench" | "history" | "content" | "settings" | "report";
};

const links = [
  { key: "workbench", href: "/", label: "工作台" },
  { key: "history", href: "/history", label: "历史报告" },
  { key: "content", href: "/content", label: "知识" }
] as const;

export function AppNav({ current = "workbench" }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="主导航">
      <a className="brand" href="/">
        <span className="brand-mark">六</span>
        <span>
          <strong>六爻</strong>
          <small>专业分析与可复核报告</small>
        </span>
      </a>
      <div className="nav-links">
        {links.map((link) => (
          <a aria-current={current === link.key ? "page" : undefined} href={link.href} key={link.key}>
            {link.label}
          </a>
        ))}
      </div>
      <a aria-current={current === "settings" ? "page" : undefined} className="nav-utility" href="/settings">
        设置
      </a>
    </nav>
  );
}
