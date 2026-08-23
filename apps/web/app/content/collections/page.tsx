import type { Metadata } from "next";
import { ArrowRight, Clock3 } from "lucide-react";
import { AppNav } from "../../AppNav";
import { ContentSectionNav } from "../ContentSectionNav";
import { learningCollections } from "../collectionProfiles";

export const metadata: Metadata = {
  title: "六爻学习合集｜按目标循序学习",
  description: "12 套六爻学习合集，按开始使用、理解盘面、建立判断和现实应用四个阶段组织。",
  alternates: { canonical: "/content/collections" },
};

const groups = ["开始使用", "理解盘面", "建立判断", "现实应用"] as const;

export default function CollectionsPage() {
  return (
    <main className="shell">
      <AppNav current="content" />
      <ContentSectionNav current="collections" />
      <header className="collection-index-hero">
        <p className="eyebrow">12 套学习合集</p>
        <h1>围绕一个目标，按顺序学完三篇</h1>
        <p>不用在完整资料库里挑选。选择当前目标，每套合集只保留三篇必要内容和明确学习结果。</p>
      </header>
      <nav className="collection-group-nav" aria-label="合集阶段">{groups.map((group) => <a href={`#collection-${group}`} key={group}>{group}</a>)}</nav>
      {groups.map((group) => (
        <section className="collection-index-group" id={`collection-${group}`} key={group}>
          <div className="section-heading"><div><p className="eyebrow">{group}</p><h2>{group === "开始使用" ? "先建立正确的使用方式" : group === "理解盘面" ? "看懂盘面中的基本角色" : group === "建立判断" ? "把信息组织成判断" : "回到报告与现实问题"}</h2></div></div>
          <div className="collection-index-grid">
            {learningCollections.filter((collection) => collection.group === group).map((collection) => (
              <a href={`/content/collection/${collection.slug}`} key={collection.collection_id}>
                <img src={collection.cover_path} alt={`${collection.title}学习合集封面`} />
                <span>{collection.collection_id} · {collection.group}</span>
                <strong>{collection.title}</strong>
                <p>{collection.description}</p>
                <em><Clock3 aria-hidden="true" size={15} />{collection.duration}<i>进入合集 <ArrowRight aria-hidden="true" size={15} /></i></em>
              </a>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
