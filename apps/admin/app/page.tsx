import { SIX_ARCHITECTURE_TARGET } from "@six/shared";

export default function AdminPage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Internal Admin</p>
        <h1>Six 管理台架构壳</h1>
        <p>当前只提供内部状态、内容治理、报告审计和未来 CMS 的承载入口，不包含付费或复杂 RBAC 实现。</p>
      </section>
      <section className="grid">
        <article>
          <h2>报告审计</h2>
          <p>后续接入 AdminViewModel、AI fact validation 和 provider smoke 状态。</p>
        </article>
        <article>
          <h2>内容治理</h2>
          <p>后续接入 P4-B production content import、review status 和 SEO QA。</p>
        </article>
        <article>
          <h2>数据运行</h2>
          <p>后续接入 Prisma 数据健康、队列健康和匿名使用指标。</p>
        </article>
      </section>
      <p className="architecture">{SIX_ARCHITECTURE_TARGET}</p>
    </main>
  );
}
