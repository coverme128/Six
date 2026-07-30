import { AppNav } from "./AppNav";
import { SixApiDemo } from "./SixApiDemo";

export default function HomePage() {
  return (
    <main className="shell">
      <AppNav current="workbench" />

      <section className="product-hero">
        <p className="eyebrow">Liuyao & Meihua</p>
        <h1>为一个明确问题起卦</h1>
        <p>选择六爻或梅花，按步骤完成起卦。报告会先给出结论，再提供可复核的盘面与依据。</p>
      </section>

      <SixApiDemo />
    </main>
  );
}
