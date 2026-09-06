import type { Metadata } from "next";
import { AppNav } from "./AppNav";
import { SixApiDemo } from "./SixApiDemo";
import { ArrowRight, BookOpen } from "lucide-react";
import example from "./example/report.json";

export const metadata: Metadata = {
  title: "六爻问题分析｜从你的问题开始",
  description: "输入你关心的问题，获得六爻排盘与针对问题的 AI 解读。结合卦象依据，梳理需要现实核验的条件。",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const board = example.visualization.viewModels["VIS-LY-001"];
  return (
    <main className="shell home-shell">
      <AppNav current="workbench" />
      <header className="home-intro">
        <h1>六爻问题分析</h1>
        <p>把正在犹豫的事说出来，结合卦象看清依据与下一步。</p>
      </header>
      <SixApiDemo />
      <section className="home-report-sample" aria-labelledby="sample-title">
        <header className="home-section-heading">
          <div><p className="eyebrow">报告示例 · 演示问题，真实模型生成</p><h2 id="sample-title">先看一份完整解读</h2></div>
          <a href="/example">查看完整报告<ArrowRight size={18} aria-hidden="true" /></a>
        </header>
        <div className="home-sample-body">
          <figure className="home-sample-chart">
            <figcaption><strong>{board.originalHexagram}</strong><span>静卦 · 无变卦</span></figcaption>
            <div className="home-chart-lines" aria-label="示例升卦，从上爻到初爻">
              {board.lines.map((line) => <div key={line.position}>
                <span>{line.label}</span><span className={`sample-line ${line.yinYang === "阴" ? "broken" : ""}`} aria-label={line.yinYang}><i />{line.yinYang === "阴" ? <i /> : null}</span>
                <span>{line.sixRelationName}</span><b>{line.isWorld ? "世" : line.isResponse ? "应" : ""}</b>
              </div>)}
            </div>
          </figure>
          <div className="home-sample-answer">
            <p className="sample-question">本次问题：只出资、不参与经营，今年适合入股吗？</p>
            <h3>AI 对这个问题的回答</h3><p>{example.interpretation.questionResponse.directAnswer}</p>
            <a href="/example#example-reasons">查看判断依据与行动建议<ArrowRight size={17} aria-hidden="true" /></a>
            <small>这是演示问题的解读，不是对你的判断。卦象解释不代表已核实现实情况。</small>
          </div>
        </div>
      </section>
      <section className="home-learning" aria-labelledby="home-learn-title">
        <img src="/liuyao-visual-system/editorial/final/lesson-cover/ED-LY-004-learn-lesson-cover-800x1000.png" alt="六爻学习笔记与关系图插画" width={120} height={150} loading="lazy" />
        <div><p className="eyebrow">学习中心</p><h2 id="home-learn-title">从看懂一份卦开始</h2><p>入门教程、术语解释与报告阅读。</p><a href="/content"><BookOpen size={18} aria-hidden="true" />开始学习<ArrowRight size={18} aria-hidden="true" /></a></div>
      </section>
      <footer className="home-boundary">六爻属于传统文化解释，不保证现实结果，也不替代医疗、法律、财务等专业意见。</footer>
    </main>
  );
}
