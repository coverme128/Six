import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

import { createLiuyaoChart } from "./domain/liuyaoEngine.mjs";
import { createMeihuaChart } from "./domain/meihuaEngine.mjs";
import { getKnowledgeOverview, searchKnowledge } from "./domain/knowledge.mjs";
import { loadRuleProfile, resolveFeatureFlags } from "./production/index.mjs";

const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, "public");
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const history = [];

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

function error(res, status, code, message, details) {
  json(res, status, { code, message, traceId: randomUUID(), details });
}

async function parseJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function staticPath(pathname) {
  const safe = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = pathname === "/" ? "index.html" : safe.slice(1);
  return resolve(PUBLIC_DIR, file);
}

function serveStatic(req, res, pathname) {
  let path = staticPath(pathname);
  if (!path.startsWith(PUBLIC_DIR)) {
    error(res, 403, "FORBIDDEN", "Invalid path.");
    return;
  }
  try {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      path = join(path, "index.html");
    }
    const ext = extname(path);
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(readFileSync(path));
  } catch {
    res.writeHead(200, {
      "content-type": MIME[".html"],
      "cache-control": "no-store",
    });
    res.end(readFileSync(join(PUBLIC_DIR, "index.html")));
  }
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/metadata") {
      const bundle = loadRuleProfile({ rootDir: ROOT });
      json(res, 200, {
        app: "SIX",
        profile: bundle.profile.profile_code,
        counts: bundle.counts,
        flags: resolveFeatureFlags({ rootDir: ROOT, environment: process.env.NODE_ENV === "production" ? "production" : "development" }),
        knowledge: getKnowledgeOverview(ROOT).counts,
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/liuyao/chart") {
      const body = await parseJson(req);
      const result = createLiuyaoChart(body, ROOT);
      history.unshift({ id: result.chart.id, type: "liuyao", question: result.chart.question, createdAt: new Date().toISOString(), result });
      json(res, 200, result);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/meihua/chart") {
      const body = await parseJson(req);
      const result = createMeihuaChart(body, ROOT);
      history.unshift({ id: result.chart.id, type: "meihua", question: result.chart.question, createdAt: new Date().toISOString(), result });
      json(res, 200, result);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/history") {
      json(res, 200, { items: history.slice(0, 50) });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/knowledge") {
      json(res, 200, getKnowledgeOverview(ROOT));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/knowledge/search") {
      json(res, 200, searchKnowledge(url.searchParams.get("q") ?? "", ROOT));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      error(res, 404, "NOT_FOUND", "API route not found.");
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (err) {
    error(res, 400, "BAD_REQUEST", err.message, process.env.NODE_ENV === "production" ? undefined : err.details);
  }
}

createServer(route).listen(PORT, () => {
  console.log(`SIX running at http://localhost:${PORT}`);
});
