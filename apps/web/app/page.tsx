import type { Metadata } from "next";
import { AppNav } from "./AppNav";
import { SixApiDemo } from "./SixApiDemo";
import { ArrowDown, BookOpen, FileCheck2, Route, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "六爻问题分析｜看清方向、阻碍与下一步",
  description: "从一个具体问题出发，得到确定性排盘、场景化判断、现实行动建议与可复核依据。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "六爻问题分析｜把一件难事看清方向与下一步",
    description: "先得到容易理解的判断，再按需查看盘面与依据。",
    images: [{ url: "/liuyao-visual-system/product/home-report-proof.svg", alt: "六爻可复核报告结果预览" }],
  },
};

export default function HomePage() {
  return (
    <main className="shell">
      <AppNav current="workbench" />

      <section className="product-hero">
        <div className="product-hero-copy">
          <p className="eyebrow">六爻问题分析</p>
          <h1>把一件难事，看清方向与下一步</h1>
          <p className="hero-lead">从你真正关心的问题出发，先得到容易理解的判断，再按需查看盘面与依据。</p>
          <div className="hero-actions">
            <a className="primary-link" href="#scenario-step">
              从我的问题开始
              <ArrowDown aria-hidden="true" size={17} />
            </a>
            <a className="secondary-link" href="/content">
              <BookOpen aria-hidden="true" size={17} />
              我想先学习
            </a>
          </div>
          <div className="hero-outcomes" aria-label="你会先得到什么">
            <div>
              <Route aria-hidden="true" size={20} />
              <span><strong>方向</strong>继续、调整，还是先观察</span>
            </div>
            <div>
              <ShieldCheck aria-hidden="true" size={20} />
              <span><strong>关键点</strong>哪里在支持，哪里最容易卡住</span>
            </div>
            <div>
              <FileCheck2 aria-hidden="true" size={20} />
              <span><strong>下一步</strong>现在最值得验证和行动的事</span>
            </div>
          </div>
          <p className="hero-assurance">确定性排盘 · 判断有依据 · AI 只负责解释</p>
        </div>
        <img className="product-hero-mobile-proof" src="/liuyao-visual-system/product/home-report-proof-strip.svg" alt="报告先展示总体判断，再区分支持、阻碍和下一步" />
      </section>

      <SixApiDemo />
    </main>
  );
}
