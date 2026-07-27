import { loadDomainData } from "./dataStore.mjs";

function textOf(node) {
  return [
    node.id,
    node.slug,
    node.title_zh,
    node.name_zh,
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
