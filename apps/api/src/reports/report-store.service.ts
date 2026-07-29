import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@six/database";

import type { DivinationType, PublicReportRecord, PublicReportSummary } from "./report.types.js";

const reports = new Map<string, PublicReportRecord>();

function prismaType(type: DivinationType) {
  return type === "liuyao" ? "LIUYAO" : "MEIHUA";
}

function publicType(type: string): DivinationType {
  return type === "MEIHUA" ? "meihua" : "liuyao";
}

function summarize(record: PublicReportRecord): PublicReportSummary {
  return {
    id: record.id,
    type: record.type,
    question: record.question,
    chartHash: record.chartHash,
    createdAt: record.createdAt,
    persistence: record.persistence
  };
}

function attachAiReportBundle(result: unknown, aiReportBundle: unknown) {
  if (!aiReportBundle || !result || typeof result !== "object" || Array.isArray(result)) return result;
  return { ...result, aiReportBundle };
}

@Injectable()
export class ReportStoreService {
  async save(record: PublicReportRecord): Promise<PublicReportRecord> {
    reports.set(record.id, record);
    const prisma = getPrismaClient();
    if (!prisma) return { ...record, persistence: "memory" };

    try {
      await prisma.report.upsert({
        where: { id: record.id },
        update: {
          question: record.question,
          chartHash: record.chartHash,
          result: record.result as object,
          narrativeReport: record.narrativeReport as object,
          aiReport: (record.aiReportBundle ?? null) as object | null,
          experience: record.experience as object,
          status: "COMPLETED"
        },
        create: {
          id: record.id,
          type: prismaType(record.type),
          question: record.question,
          chartHash: record.chartHash,
          result: record.result as object,
          narrativeReport: record.narrativeReport as object,
          aiReport: (record.aiReportBundle ?? null) as object | null,
          experience: record.experience as object,
          status: "COMPLETED"
        }
      });
      const persisted = { ...record, persistence: "prisma" as const };
      reports.set(record.id, persisted);
      return persisted;
    } catch {
      const fallback = { ...record, persistence: "memory-fallback" as const };
      reports.set(record.id, fallback);
      return fallback;
    }
  }

  async find(id: string): Promise<PublicReportRecord | null> {
    const prisma = getPrismaClient();
    const cached = reports.get(id);
    if (!prisma) return cached ?? null;

    try {
      const row = await prisma.report.findUnique({ where: { id } });
      if (!row) return cached ?? null;
      const record: PublicReportRecord = {
        id: row.id,
        type: publicType(row.type),
        question: row.question,
        chartHash: row.chartHash,
        createdAt: row.createdAt.toISOString(),
        result: attachAiReportBundle(row.result, row.aiReport),
        narrativeReport: row.narrativeReport,
        aiReportBundle: row.aiReport,
        experience: row.experience,
        persistence: "prisma"
      };
      reports.set(id, record);
      return record;
    } catch {
      return cached ?? null;
    }
  }

  async list(limit = 20): Promise<PublicReportSummary[]> {
    const memoryRecords = [...reports.values()]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit)
      .map(summarize);

    const prisma = getPrismaClient();
    if (!prisma) return memoryRecords;

    try {
      const rows = await prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          question: true,
          chartHash: true,
          createdAt: true
        }
      });
      const persisted = rows.map((row) => ({
        id: row.id,
        type: publicType(row.type),
        question: row.question,
        chartHash: row.chartHash,
        createdAt: row.createdAt.toISOString(),
        persistence: "prisma" as const
      }));
      const merged = new Map<string, PublicReportSummary>();
      for (const record of [...memoryRecords, ...persisted]) merged.set(record.id, record);
      return [...merged.values()]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit);
    } catch {
      return memoryRecords;
    }
  }

  async updateAiReport(id: string, aiReportBundle: unknown, result: unknown, experience: unknown): Promise<PublicReportRecord | null> {
    const current = await this.find(id);
    if (!current) return null;
    const updated: PublicReportRecord = {
      ...current,
      result,
      aiReportBundle,
      experience
    };
    reports.set(id, updated);

    const prisma = getPrismaClient();
    if (!prisma) return { ...updated, persistence: "memory" };

    try {
      await prisma.report.update({
        where: { id },
        data: {
          result: result as object,
          aiReport: aiReportBundle as object,
          experience: experience as object
        }
      });
      const persisted = { ...updated, persistence: "prisma" as const };
      reports.set(id, persisted);
      return persisted;
    } catch {
      const fallback = { ...updated, persistence: "memory-fallback" as const };
      reports.set(id, fallback);
      return fallback;
    }
  }
}
