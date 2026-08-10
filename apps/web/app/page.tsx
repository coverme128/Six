import { AppNav } from "./AppNav";
import { SixApiDemo } from "./SixApiDemo";

export default function HomePage() {
  return (
    <main className="shell">
      <AppNav current="workbench" />

      <section className="product-hero">
        <div>
          <p className="eyebrow">Liuyao & Meihua</p>
          <h1>为一个具体问题生成可复核报告</h1>
          <p>确定性排盘先完成事实层，AI 只负责把正式结果解释成可读报告。你可以先看结论，也可以继续追溯盘面、证据和知识说明。</p>
        </div>
        <div className="hero-report-preview" aria-label="报告结构预览">
          <span>结论</span>
          <span>支持</span>
          <span>风险</span>
          <span>时间</span>
          <strong>依据可追溯</strong>
        </div>
      </section>

      <section className="value-proof-strip" aria-label="核心价值">
        <div>
          <strong>确定性排盘</strong>
          <span>先生成本卦、变卦、动爻与结构事实。</span>
        </div>
        <div>
          <strong>证据链报告</strong>
          <span>结论、支持、阻碍、时间提示分层呈现。</span>
        </div>
        <div>
          <strong>AI 不改事实</strong>
          <span>不重排盘、不造用神、不反转正式依据。</span>
        </div>
        <div>
          <strong>知识库联动</strong>
          <span>报告术语可继续进入 Learn Hub 验证。</span>
        </div>
      </section>

      <SixApiDemo />
    </main>
  );
}
