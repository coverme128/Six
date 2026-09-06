import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { AppNav } from "../AppNav";
import { LiuyaoVisualSystemPanel } from "../liuyao-visuals/LiuyaoVisualSystem";
import example from "./report.json";

export const metadata: Metadata = { title: "完整报告示例｜六爻问题分析", robots: { index: false, follow: true } };

export default function ExamplePage() {
  const report = example.interpretation;
  return <main className="shell example-shell">
    <AppNav current="example" />
    <header className="example-heading">
      <p className="eyebrow">演示问题 · 真实模型生成</p>
      <h1>只出资、不参与经营，今年适合入股吗？</h1>
      <p>这是产品测试使用的演示问题，不是真实用户个案，也不是对你的判断。</p>
      <details><summary>原问题与补充</summary><p>{example.question}</p><p>{example.clarification}</p></details>
      <a className="primary-link" href="/#question-step">分析我的问题<ArrowRight size={18} aria-hidden="true" /></a>
      <a className="example-reading-link" href="#ai-plain-language">阅读这份 AI 解读</a>
    </header>
    <LiuyaoVisualSystemPanel visualization={example.visualization} />
    <article className="example-narrative" id="ai-plain-language">
      <header><p className="eyebrow">针对这个问题的 AI 解读</p><h2>当前回答</h2><p className="example-direct-answer">{report.questionResponse.directAnswer}</p></header>
      <section><h2>卦象如何影响判断</h2><p>{report.hexagramReading.original}</p><p>{report.hexagramReading.moving}</p><p>{report.hexagramReading.changed}</p><p>{report.hexagramReading.synthesis}</p></section>
      <section id="example-reasons"><h2>为什么这样判断</h2>{report.keyJudgments.map((item, index) => <section className="example-reason" key={item.title}>
        <h3><span>{index + 1}</span>{item.title}</h3><p>{item.plainInterpretation}</p><p>{item.decisionImpact}</p>
        <details><summary>盘面依据</summary><p>{item.professionalBasis}</p></details>
      </section>)}</section>
      {report.decisionBalance.length ? <section><h2>这次决定中的取舍</h2><div className="example-tradeoffs">{report.decisionBalance.map((item, index) => <div key={index}><p><strong>可能获得</strong>{item.gain}</p><p><strong>可能付出</strong>{item.cost}</p></div>)}</div></section> : null}
      <section><h2>对这个问题的实际建议</h2>{([['now', '现在可以做'], ['beforeDecision', '作决定前确认'], ['avoid', '需要避免']] as const).map(([key, title]) => <div className="example-action" key={key}><h3>{title}</h3><ul>{report.actionPlan[key].map(item => <li key={item.text}>{item.text}</li>)}</ul></div>)}</section>
      <blockquote>{report.finalTakeaway}</blockquote>
      <section><h2>解读边界</h2><ul>{report.limitations.map(item => <li key={item}>{item}</li>)}</ul><p>{report.disclaimer}</p></section>
      <a className="primary-link" href="/#question-step">回到我的问题<ArrowRight size={18} aria-hidden="true" /></a>
    </article>
  </main>;
}
