import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

import { createLiuyaoChart } from "./domain/liuyaoEngine.mjs";
import { createMeihuaChart } from "./domain/meihuaEngine.mjs";
import { indexes, loadDomainData } from "./domain/dataStore.mjs";
import { getBlogPost, getKnowledgeItem, getKnowledgeOverview, listBlogPosts, searchKnowledge } from "./domain/knowledge.mjs";
import { buildLiuyaoReport, buildMeihuaReport } from "./domain/reportBuilder.mjs";
import { createAnonymousAILimiter, generateGroundedAIReport, providerFromEnv, questionDigest } from "./domain/aiReport.mjs";
import { loadRuleProfile, resolveFeatureFlags } from "./production/index.mjs";

const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, "public");
const RUNTIME_DIR = resolve(ROOT, "data/runtime");
const HISTORY_FILE = join(RUNTIME_DIR, "history.json");
const SETTINGS_FILE = join(RUNTIME_DIR, "settings.json");
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const history = [];
const records = new Map();
const aiLimiter = createAnonymousAILimiter();

const DEFAULT_SETTINGS = Object.freeze({
  version: "1.0.0",
  timezone: "",
  defaultCastMethod: "liuyao_manual",
  terminology: "beginner",
  reportLanguage: "zh-CN",
});

const ERROR_CODE_BY_PATTERN = [
  [/not found|resource/i, "REPORT_NOT_FOUND"],
  [/timezone|instantUtc|date/i, "CALENDAR_CALCULATION_FAILED"],
  [/values|coins|line|number|method/i, "VALIDATION_ERROR"],
  [/rule|profile|finding/i, "RULE_ANALYSIS_FAILED"],
  [/history|storage|persist|file/i, "STORAGE_WRITE_FAILED"],
  [/AI_RATE_LIMITED|rate limit/i, "AI_RATE_LIMITED"],
];

function buildNarrative(type, result) {
  return type === "liuyao" ? buildLiuyaoReport(result) : buildMeihuaReport(result);
}

function loadPersistedRecords() {
  if (!existsSync(HISTORY_FILE)) return;
  try {
    const data = JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
    for (const record of data.items ?? []) {
      if (!record?.id || !record?.result) continue;
      records.set(record.id, record);
      history.push(record);
    }
  } catch (err) {
    console.error("Failed to load runtime history.", err);
  }
}

function savePersistedRecords() {
  try {
    mkdirSync(RUNTIME_DIR, { recursive: true });
    writeFileSync(HISTORY_FILE, `${JSON.stringify({ version: "1.0.0", items: history.slice(0, 200) }, null, 2)}\n`);
  } catch (err) {
    err.publicCode = "STORAGE_WRITE_FAILED";
    throw err;
  }
}

function loadSettings() {
  if (!existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) };
  } catch (err) {
    err.publicCode = "STORAGE_READ_FAILED";
    throw err;
  }
}

function saveSettings(settings) {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  const next = {
    ...DEFAULT_SETTINGS,
    timezone: settings.timezone,
    defaultCastMethod: settings.defaultCastMethod,
    terminology: settings.terminology,
    reportLanguage: settings.reportLanguage,
  };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: next.timezone }).format(new Date());
  } catch {
    const err = new Error("timezone must be an IANA timezone.");
    err.publicCode = "VALIDATION_ERROR";
    throw err;
  }
  if (!["liuyao_coin", "liuyao_manual", "meihua_two_number", "meihua_time"].includes(next.defaultCastMethod)) {
    const err = new Error("Unsupported default cast method.");
    err.publicCode = "VALIDATION_ERROR";
    throw err;
  }
  if (!["beginner", "professional"].includes(next.terminology)) {
    const err = new Error("Unsupported terminology mode.");
    err.publicCode = "VALIDATION_ERROR";
    throw err;
  }
  if (!["zh-CN", "en-US"].includes(next.reportLanguage)) {
    const err = new Error("Unsupported report language.");
    err.publicCode = "VALIDATION_ERROR";
    throw err;
  }
  try {
    writeFileSync(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`);
  } catch (err) {
    err.publicCode = "STORAGE_WRITE_FAILED";
    throw err;
  }
  return next;
}

function historySummary(record) {
  return {
    id: record.id,
    type: record.type,
    question: record.question,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    chart: {
      id: record.result.chart.id,
      methodCode: record.result.chart.methodCode,
      originalHexagram: record.result.chart.originalHexagram,
      changedHexagram: record.result.chart.changedHexagram,
      mutualHexagram: record.result.chart.mutualHexagram,
    },
    evidenceCount: record.result.report?.evidenceBudget?.actual ?? record.result.report?.evidence?.length ?? 0,
    reportTemplateVersion: record.result.narrativeReport?.reportTemplateVersion,
    aiStatus: record.result.aiReportBundle?.validationStatus ?? "NOT_GENERATED",
  };
}

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

function publicErrorCode(err) {
  if (err.code === "AI_RATE_LIMITED") return "AI_RATE_LIMITED";
  if (err.publicCode) return err.publicCode;
  const message = String(err.message ?? "");
  return ERROR_CODE_BY_PATTERN.find(([pattern]) => pattern.test(message))?.[1] ?? "UNKNOWN_ERROR";
}

function requestIp(req) {
  return String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
}

function aiMockMode(req) {
  if (process.env.NODE_ENV === "production") return null;
  const mode = req.headers["x-six-ai-mock"];
  if (!mode) return null;
  return ["success", "slow_success", "throw", "empty", "invalid_json", "bad_fact", "bad_ref", "unsafe"].includes(mode) ? mode : null;
}

function notFound(res, message = "Resource not found.") {
  error(res, 404, "REPORT_NOT_FOUND", message);
}

function storeResult(type, result) {
  const narrativeReport = buildNarrative(type, result);
  result.narrativeReport = narrativeReport;
  const record = {
    id: result.chart.id,
    type,
    question: result.chart.question,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    result,
  };
  records.set(record.id, record);
  history.unshift(record);
  savePersistedRecords();
  return record;
}

function getRecord(res, id, type) {
  const record = records.get(id);
  if (!record || record.type !== type) {
    notFound(res);
    return null;
  }
  return record;
}

function validateQuestion(body) {
  const question = String(body.question ?? "").trim();
  if (!question) {
    const err = new Error("Question is required.");
    err.publicCode = "VALIDATION_ERROR";
    throw err;
  }
  if (question.length > 200) {
    const err = new Error("Question must be 200 characters or fewer.");
    err.publicCode = "VALIDATION_ERROR";
    throw err;
  }
}

function normalizeManualCast(body = {}) {
  if (Array.isArray(body.coins) || Array.isArray(body.coinRounds)) {
    const coins = body.coins ?? body.coinRounds;
    if (coins.length !== 6) throw new Error("coins must contain six coin rounds.");
    const normalizedCoins = coins.map((round) => {
      if (!Array.isArray(round) || round.length !== 3) throw new Error("Each coin round must contain three coin values.");
      return round.map((coin) => {
        const value = Number(coin);
        if (![2, 3].includes(value)) throw new Error("Each coin value must be 2 or 3.");
        return value;
      });
    });
    return {
      methodCode: "LIUYAO_THREE_COIN_V1",
      lineOrder: "bottom_up",
      inputMode: "coins",
      coins: normalizedCoins,
      values: normalizedCoins.map((round) => round.reduce((sum, value) => sum + value, 0)),
    };
  }
  if (Array.isArray(body.values)) {
    if (body.values.length !== 6) throw new Error("values must contain six line sums.");
    return {
      methodCode: "LIUYAO_THREE_COIN_V1",
      lineOrder: "bottom_up",
      inputMode: "values",
      coins: null,
      values: body.values.map((value) => {
        const numeric = Number(value);
        if (![6, 7, 8, 9].includes(numeric)) throw new Error("Each line sum must be 6, 7, 8, or 9.");
        return numeric;
      }),
    };
  }
  throw new Error("Manual cast requires values or coins.");
}

function exportRecord(record) {
  const result = record.result;
  return {
    reportId: record.id,
    reportType: record.type,
    question: record.question,
    originalInput: result.chart.rawCast ?? result.chart.input,
    chartFacts: result.chart,
    ruleFindings: result.findings ?? [],
    timingCandidates: result.timingCandidates ?? [],
    templateReport: result.narrativeReport,
    engineVersion: result.engineVersions,
    calendarVersion: result.chart.calendar?.policyVersion,
    calendarProvider: result.chart.calendar?.calendarProvider,
    calendarProviderVersion: result.chart.calendar?.calendarVersion,
    calendarPolicy: result.chart.calendar?.calendarPolicy,
    calculatedFactsSnapshot: result.chart.calendar?.calculatedFactsSnapshot,
    ruleProfileVersion: result.engineVersions?.rules,
    aiReport: result.aiReportBundle ? {
      aiReport: result.aiReportBundle.aiReport,
      aiSchemaVersion: result.aiReportBundle.aiSchemaVersion,
      aiProvider: result.aiReportBundle.aiProvider,
      aiModel: result.aiReportBundle.aiModel,
      promptVersion: result.aiReportBundle.promptVersion,
      generatedAt: result.aiReportBundle.generatedAt,
      validationStatus: result.aiReportBundle.validationStatus,
      fallbackUsed: result.aiReportBundle.fallbackUsed,
      failureCode: result.aiReportBundle.failureCode,
    } : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function clearHistory() {
  history.splice(0, history.length);
  records.clear();
  savePersistedRecords();
}

function hexagramDetail(slug) {
  const data = loadDomainData(ROOT);
  const idx = indexes(data);
  const key = String(slug).toLowerCase();
  const hexagram = idx.hexagramByCode.get(key) ?? data.hexagrams.find((item) => item.name_zh === slug);
  if (!hexagram) return null;
  return {
    ...hexagram,
    upperTrigram: idx.trigramByCode.get(hexagram.upper_trigram),
    lowerTrigram: idx.trigramByCode.get(hexagram.lower_trigram),
    lineStructure: hexagram.bits_bottom_up,
    detailStatus: "详细内容正在整理",
  };
}

function glossaryItem(slug) {
  const key = String(slug).toLowerCase();
  return loadDomainData(ROOT).glossary.find((item) => [item.code, item.name_zh].map((value) => String(value).toLowerCase()).includes(key)) ?? null;
}

function randomCast() {
  const coins = Array.from({ length: 6 }, () => [randomInt(2, 4), randomInt(2, 4), randomInt(2, 4)]);
  return {
    methodCode: "LIUYAO_THREE_COIN_V1",
    lineOrder: "bottom_up",
    inputMode: "random_coins",
    coins,
    values: coins.map((round) => round.reduce((sum, value) => sum + value, 0)),
  };
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
    if (req.method === "GET" && url.pathname === "/api/topics") {
      const bundle = loadRuleProfile({ rootDir: ROOT });
      json(res, 200, { items: bundle.questionTopics.items });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v1/settings") {
      json(res, 200, loadSettings());
      return;
    }
    if (req.method === "PUT" && url.pathname === "/api/v1/settings") {
      json(res, 200, saveSettings(await parseJson(req)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v1/export") {
      json(res, 200, {
        exportVersion: "1.0.0",
        exportedAt: new Date().toISOString(),
        appVersion: "1.3.0",
        reports: history.map(exportRecord),
        settings: loadSettings(),
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/v1/history/clear") {
      clearHistory();
      json(res, 200, { ok: true, items: [] });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/v1/liuyao/casts/random") {
      json(res, 200, randomCast());
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/v1/liuyao/casts/manual") {
      json(res, 200, normalizeManualCast(await parseJson(req)));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/v1/liuyao/charts") {
      const body = await parseJson(req);
      validateQuestion(body);
      const result = createLiuyaoChart(body, ROOT);
      storeResult("liuyao", result);
      json(res, 200, result);
      return;
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/liuyao\/charts\/([^/]+)(?:\/(analyze|yongshen|report))?$/u);
      if (match) {
        const record = getRecord(res, match[1], "liuyao");
        if (!record) return;
        const action = match[2];
        if (req.method === "GET" && !action) {
          json(res, 200, record.result);
          return;
        }
        if (req.method === "POST" && action === "analyze") {
          json(res, 200, {
            chart: record.result.chart,
            findings: record.result.findings,
            timingCandidates: record.result.timingCandidates,
            report: record.result.report,
            engineVersions: record.result.engineVersions,
          });
          return;
        }
        if (req.method === "POST" && action === "yongshen") {
          const finding = record.result.findings.find((item) => item.rule_type === "yongshen");
          json(res, 200, {
            chartId: record.id,
            selected: finding?.summary ?? null,
            finding,
            editable: false,
            policy: "CORE_V1 recommends yongshen from question topic/subtype; manual override is outside this local MVP.",
          });
          return;
        }
        if (req.method === "POST" && action === "report") {
          json(res, 200, {
            chartId: record.id,
            narrativeReport: record.result.narrativeReport ?? buildLiuyaoReport(record.result),
            report: record.result.report,
            evidence: record.result.report.evidence,
            engineVersions: record.result.engineVersions,
          });
          return;
        }
      }
    }
    if (req.method === "POST" && url.pathname === "/api/v1/meihua/charts") {
      const body = await parseJson(req);
      validateQuestion(body);
      const result = createMeihuaChart(body, ROOT);
      storeResult("meihua", result);
      json(res, 200, result);
      return;
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/meihua\/charts\/([^/]+)(?:\/(analyze|report))?$/u);
      if (match) {
        const record = getRecord(res, match[1], "meihua");
        if (!record) return;
        const action = match[2];
        if (req.method === "GET" && !action) {
          json(res, 200, record.result);
          return;
        }
        if (req.method === "POST" && action === "analyze") {
          json(res, 200, {
            chart: record.result.chart,
            report: record.result.report,
            engineVersions: record.result.engineVersions,
          });
          return;
        }
        if (req.method === "POST" && action === "report") {
          json(res, 200, {
            chartId: record.id,
            narrativeReport: record.result.narrativeReport ?? buildMeihuaReport(record.result),
            report: record.result.report,
            evidence: record.result.report.evidence,
            engineVersions: record.result.engineVersions,
          });
          return;
        }
      }
    }
    if (req.method === "GET" && url.pathname === "/api/v1/knowledge/search") {
      json(res, 200, searchKnowledge(url.searchParams.get("q") ?? "", ROOT));
      return;
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/knowledge\/([^/]+)$/u);
      if (req.method === "GET" && match) {
        const item = getKnowledgeItem(match[1], ROOT);
        if (!item) {
          notFound(res);
          return;
        }
        json(res, 200, item);
        return;
      }
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/hexagrams\/([^/]+)$/u);
      if (req.method === "GET" && match) {
        const item = hexagramDetail(decodeURIComponent(match[1]));
        if (!item) {
          notFound(res, "Hexagram not found.");
          return;
        }
        json(res, 200, item);
        return;
      }
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/glossary\/([^/]+)$/u);
      if (req.method === "GET" && match) {
        const item = glossaryItem(decodeURIComponent(match[1]));
        if (!item) {
          notFound(res, "Glossary item not found.");
          return;
        }
        json(res, 200, item);
        return;
      }
    }
    if (req.method === "GET" && url.pathname === "/api/v1/blog/posts") {
      json(res, 200, listBlogPosts(ROOT));
      return;
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/reports\/([^/]+)$/u);
      if (req.method === "GET" && match) {
        const record = records.get(match[1]);
        if (!record) {
          notFound(res);
          return;
        }
        json(res, 200, {
          id: record.id,
          type: record.type,
          createdAt: record.createdAt,
          narrativeReport: record.result.narrativeReport ?? buildNarrative(record.type, record.result),
          result: record.result,
          aiReportBundle: record.result.aiReportBundle ?? null,
        });
        return;
      }
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/reports\/([^/]+)\/ai$/u);
      if (req.method === "POST" && match) {
        const record = records.get(match[1]);
        if (!record) {
          notFound(res);
          return;
        }
        if (record.result.aiReportBundle?.validationStatus === "VALID") {
          json(res, 200, { ...record.result.aiReportBundle, reused: true });
          return;
        }
        aiLimiter.assertAllowed({
          ip: requestIp(req),
          deviceId: String(req.headers["x-six-device-id"] ?? "unknown"),
        });
        const provider = providerFromEnv({ rootDir: ROOT, mockMode: aiMockMode(req) });
        const bundle = await generateGroundedAIReport({
          result: record.result,
          type: record.type,
          provider,
          language: loadSettings().reportLanguage,
        });
        record.result.aiReportBundle = bundle;
        record.updatedAt = new Date().toISOString();
        savePersistedRecords();
        if (bundle.fallbackUsed) {
          console.error("AI report fallback.", {
            reportId: record.id,
            type: record.type,
            provider: bundle.aiProvider,
            model: bundle.aiModel,
            failureCode: bundle.failureCode,
            question: questionDigest(record.question),
          });
        }
        json(res, 200, bundle);
        return;
      }
    }
    {
      const match = url.pathname.match(/^\/api\/v1\/blog\/posts\/([^/]+)$/u);
      if (req.method === "GET" && match) {
        const post = getBlogPost(match[1], ROOT);
        if (!post) {
          notFound(res);
          return;
        }
        json(res, 200, post);
        return;
      }
    }
    if (req.method === "POST" && url.pathname === "/api/liuyao/chart") {
      const body = await parseJson(req);
      validateQuestion(body);
      const result = createLiuyaoChart(body, ROOT);
      storeResult("liuyao", result);
      json(res, 200, result);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/meihua/chart") {
      const body = await parseJson(req);
      validateQuestion(body);
      const result = createMeihuaChart(body, ROOT);
      storeResult("meihua", result);
      json(res, 200, result);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/history") {
      json(res, 200, { items: history.slice(0, 50).map(historySummary) });
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
    const code = publicErrorCode(err);
    const status = code === "REPORT_NOT_FOUND" ? 404 : code === "AI_RATE_LIMITED" ? 429 : 400;
    console.error("Request failed.", { code, message: err.message });
    error(res, status, code, err.message, process.env.NODE_ENV === "production" ? undefined : err.details);
  }
}

loadPersistedRecords();

createServer(route).listen(PORT, () => {
  console.log(`SIX running at http://localhost:${PORT}`);
});
