import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const cache = new Map();

export function readJson(relPath, rootDir = process.cwd()) {
  const path = resolve(rootDir, relPath);
  if (!cache.has(path)) {
    cache.set(path, JSON.parse(readFileSync(path, "utf8")));
  }
  return cache.get(path);
}

export function loadDomainData(rootDir = process.cwd()) {
  const trigrams = readJson("data/core/trigrams.json", rootDir).items;
  const hexagrams = readJson("data/core/hexagrams-64.json", rootDir).items;
  const branches = readJson("data/core/earthly-branches.json", rootDir).items;
  const stems = readJson("data/core/heavenly-stems.json", rootDir).items;
  const elements = readJson("data/core/five-elements.json", rootDir).items;
  const sexagenary = readJson("data/core/sexagenary-cycle.json", rootDir).items;

  const knowledgeNodes = readJson("data/content/knowledge-nodes-v1.2.json", rootDir);
  const knowledgeEdges = readJson("data/content/knowledge-edges-v1.2.json", rootDir);

  return {
    trigrams,
    hexagrams,
    branches,
    stems,
    elements,
    sexagenary,
    xunKong: readJson("data/core/xun-kong.json", rootDir).items,
    najia: readJson("data/liuyao/najia-rules.json", rootDir),
    eightPalaces: readJson("data/liuyao/eight-palaces.json", rootDir).items,
    sixSpirits: readJson("data/liuyao/six-spirits.json", rootDir),
    meihuaBodyUse: readJson("data/meihua/body-use-rules.json", rootDir),
    meihuaSymbolism: readJson("data/meihua/symbolism.json", rootDir).items,
    knowledgeNodes: Array.isArray(knowledgeNodes) ? knowledgeNodes : knowledgeNodes.items,
    knowledgeEdges: Array.isArray(knowledgeEdges) ? knowledgeEdges : knowledgeEdges.items,
    blogTaxonomy: readJson("data/content/blog-taxonomy.json", rootDir),
    glossary: readJson("data/content/glossary.json", rootDir).items,
  };
}

export function indexes(data) {
  return {
    trigramByBits: new Map(data.trigrams.map((item) => [item.bits_bottom_up, item])),
    trigramByCode: new Map(data.trigrams.map((item) => [item.code, item])),
    hexagramByBits: new Map(data.hexagrams.map((item) => [item.bits_bottom_up, item])),
    hexagramByCode: new Map(data.hexagrams.map((item) => [item.code, item])),
    branchByCode: new Map(data.branches.map((item) => [item.code, item])),
    stemByCode: new Map(data.stems.map((item) => [item.code, item])),
    elementByCode: new Map(data.elements.map((item) => [item.code, item])),
    palaceByHexagram: new Map(data.eightPalaces.map((item) => [item.hexagram_code, item])),
    sexagenaryByName: new Map(data.sexagenary.map((item) => [item.name_zh, item])),
  };
}

export function dataFileUrl(relPath) {
  return join(process.cwd(), relPath);
}
