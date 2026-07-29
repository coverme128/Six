import { PrismaClient, type ContentStatus } from "@prisma/client";
import { HybridContentRepository } from "@six/domain/content-framework";
import { existsSync } from "node:fs";
import path from "node:path";

import { databaseHealth } from "./index.js";

const DEFAULT_PUBLIC_SETTINGS = {
  timezone: "Asia/Shanghai",
  defaultCastMethod: "liuyao_manual",
  terminology: "beginner",
  reportLanguage: "zh-CN"
};

function findRootDir() {
  if (process.env.SIX_ROOT) return process.env.SIX_ROOT;
  let current = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    if (existsSync(path.join(current, "data")) && existsSync(path.join(current, "package.json"))) return current;
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../..");
}

function toContentStatus(reviewStatus?: string): ContentStatus {
  if (reviewStatus === "PUBLICATION_READY") return "PUBLISHED";
  if (reviewStatus === "REVIEWED") return "APPROVED";
  if (reviewStatus === "REVIEW_REQUIRED") return "IN_REVIEW";
  if (reviewStatus === "DEFERRED") return "ARCHIVED";
  return "DRAFT";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({ ok: true, database: databaseHealth(), seeded: false }, null, 2));
    return;
  }

  const prisma = new PrismaClient();
  const rootDir = findRootDir();
  const repository = new HybridContentRepository({ rootDir, includePreview: true });
  const entries = repository.list();

  await prisma.appSetting.upsert({
    where: { key: "public" },
    update: {},
    create: {
      key: "public",
      value: DEFAULT_PUBLIC_SETTINGS
    }
  });

  let contentEntries = 0;
  for (const entry of entries) {
    await prisma.contentEntry.upsert({
      where: {
        type_slug: {
          type: entry.contentType,
          slug: entry.slug
        }
      },
      update: {
        title: entry.title,
        summary: entry.summary,
        status: toContentStatus(entry.reviewStatus),
        payload: entry
      },
      create: {
        id: entry.contentId,
        type: entry.contentType,
        slug: entry.slug,
        title: entry.title,
        summary: entry.summary,
        status: toContentStatus(entry.reviewStatus),
        payload: entry,
        publishedAt: entry.reviewStatus === "PUBLICATION_READY" ? new Date() : null
      }
    });
    contentEntries += 1;
  }

  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        ok: true,
        database: databaseHealth(),
        seeded: true,
        rootDir,
        counts: {
          appSettings: 1,
          contentEntries
        }
      },
      null,
      2
    )
  );
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
