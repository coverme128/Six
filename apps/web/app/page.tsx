import { AppNav } from "./AppNav";
import { SixApiDemo } from "./SixApiDemo";

export default function HomePage() {
  return (
    <main className="shell">
      <AppNav current="workbench" />

      <section className="product-hero">
        <div className="product-hero-copy">
          <p className="eyebrow">Liuyao</p>
          <h1>把关系、事业与现实难题，看得更清楚</h1>
          <p>围绕一个具体问题完成六爻分析。先看方向、支持、阻碍和下一步，再按需核对盘面与专业依据。</p>
          <div className="hero-actions">
            <a className="primary-link" href="#liuyao-workbench">开始六爻分析</a>
            <a className="secondary-link" href="/content">进入学习中心</a>
          </div>
          <div className="hero-scenarios" aria-label="常用问题场景">
            <a href="/?scenario=relationship#liuyao-workbench">感情关系</a>
            <a href="/?scenario=career#liuyao-workbench">事业工作</a>
            <a href="/?scenario=wealth#liuyao-workbench">收入财务</a>
            <a href="/?scenario=business#liuyao-workbench">合作项目</a>
          </div>
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
