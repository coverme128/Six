import { readJson, loadDomainData } from "./dataStore.mjs";

function textOf(node) {
  return [
    node.id,
    node.code,
    node.slug,
    node.title_zh,
    node.name_zh,
    node.domain,
    node.summary,
    node.summary_zh,
    node.category,
    ...(node.keywords ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function getKnowledgeOverview(rootDir = process.cwd()) {
  const data = loadDomainData(rootDir);
  const categories = data.blogTaxonomy.categories ?? [];
  const nodes = data.knowledgeNodes.slice(0, 36);
  return {
    categories,
    routes: data.blogTaxonomy.routes ?? [],
    featuredNodes: nodes,
    counts: {
      nodes: data.knowledgeNodes.length,
      edges: data.knowledgeEdges.length,
    },
  };
}

export function searchKnowledge(query = "", rootDir = process.cwd()) {
  const data = loadDomainData(rootDir);
  const q = String(query).trim().toLowerCase();
  const nodes = q
    ? data.knowledgeNodes.filter((node) => textOf(node).includes(q))
    : data.knowledgeNodes;
  return {
    query: q,
    items: nodes.slice(0, 30),
    total: nodes.length,
  };
}

export function getKnowledgeItem(slug = "", rootDir = process.cwd()) {
  const data = loadDomainData(rootDir);
  const key = String(slug).trim().toLowerCase();
  const item = data.knowledgeNodes.find((node) => [
    node.slug,
    node.code,
    node.id,
    node.title_zh,
  ].filter(Boolean).map((value) => String(value).toLowerCase()).includes(key));
  return item ?? null;
}

export function listBlogPosts(rootDir = process.cwd()) {
  const nodes = loadDomainData(rootDir).knowledgeNodes;
  const seeds = readJson("data/content/knowledge-page-seeds.json", rootDir).items ?? [];
  const seedByTitle = new Map(seeds.map((seed) => [seed.title_zh, seed]));
  return {
    items: nodes
      .filter((node) => (node.recommended_surfaces ?? []).includes("blog"))
      .slice(0, 50)
      .map((node) => {
        const seed = seedByTitle.get(node.title_zh);
        return {
          slug: seed?.slug ?? node.slug ?? node.code,
          title_zh: node.title_zh,
          category: seed?.category ?? node.category,
          summary: node.summary,
          code: node.code,
          version: node.version,
        };
      }),
  };
}

export function getBlogPost(slug = "", rootDir = process.cwd()) {
  const posts = listBlogPosts(rootDir).items;
  const key = String(slug).trim().toLowerCase();
  return posts.find((post) => [post.slug, post.code].map((value) => String(value).toLowerCase()).includes(key)) ?? null;
}
