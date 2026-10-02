import { parseArgs } from "node:util";
import { getPrismaClient } from "../../packages/database/src/index.js";

const { values } = parseArgs({ options: { "owner-id": { type: "string" }, "report-id": { type: "string", multiple: true }, apply: { type: "boolean", default: false } } });
const ownerId = values["owner-id"];
const ids = values["report-id"] ?? [];
if (!ownerId || !/^[a-f0-9]{64}$/.test(ownerId) || !ids.length) throw new Error("Provide --owner-id (from My Reports) and explicit --report-id values. Default is read-only; --apply performs assignment.");
const prisma = getPrismaClient();
if (!prisma) throw new Error("DATABASE_URL must be configured.");
try {
  const rows = await prisma.report.findMany({ where: { id: { in: ids } }, select: { id: true, ownerId: true } });
  if (rows.length !== new Set(ids).size || rows.some((row) => row.ownerId !== null)) throw new Error("A report is missing or already owned. No changes made.");
  if (!values.apply) console.log(JSON.stringify({ dryRun: true, ownerId, reportIds: rows.map((row) => row.id) }));
  else {
    await prisma.$transaction(async (tx) => {
      const result = await tx.report.updateMany({ where: { id: { in: ids }, ownerId: null }, data: { ownerId } });
      if (result.count !== rows.length) throw new Error("Ownership changed concurrently; assignment rolled back.");
    });
    console.log(JSON.stringify({ assigned: rows.length, ownerId }));
  }
} finally { await prisma.$disconnect(); }
