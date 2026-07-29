import { SIX_ARCHITECTURE_TARGET, SIX_PRODUCT_VERSION } from "@six/shared";
import { SixApiDemo } from "./SixApiDemo";

const stack = [
  "pnpm@9.15.4",
  "Turborepo",
  "TypeScript",
  "Next.js 15 + React 19",
  "NestJS 10",
  "PostgreSQL 16 + Prisma",
  "Redis 7 + BullMQ",
  "Zod",
  "Vitest + Playwright"
];

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="top-nav">
        <a href="/">起卦</a>
        <a href="/history">历史</a>
        <a href="/content">内容</a>
        <a href="/settings">设置</a>
      </nav>

      <section className="hero">
        <p className="eyebrow">Six Professional v{SIX_PRODUCT_VERSION}</p>
        <h1>六爻与梅花起卦</h1>
        <p>
          当前 Web 入口已接入 Next.js 与 NestJS，确定性排盘、CORE_V1、AI 事实一致性和 P4-X 体验层由
          workspace packages 承接。
        </p>
      </section>

      <SixApiDemo />

      <section className="grid">
        <article>
          <h2>产品入口</h2>
          <p>前台 Web 负责起卦、报告阅读、内容学习和 Public Beta 体验。</p>
        </article>
        <article>
          <h2>API 服务</h2>
          <p>NestJS API 暴露健康检查、报告生成、报告体验层和后续持久化接口。</p>
        </article>
        <article>
          <h2>共享引擎</h2>
          <p>六爻、梅花、历法、规则、AI、内容和 presentation orchestration 都以 package 方式复用。</p>
        </article>
      </section>

      <section className="panel">
        <h2>目标技术栈</h2>
        <div className="chips">
          {stack.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <p className="architecture">{SIX_ARCHITECTURE_TARGET}</p>
      </section>
    </main>
  );
}
