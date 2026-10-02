import { ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getPrismaClient } from "@six/database";

import type { DivinationType, PublicReportRecord, PublicReportSummary } from "./report.types.js";

const reports = new Map<string, PublicReportRecord>();

function prismaType(type: DivinationType): "LIUYAO" | "MEIHUA" {
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
  async save(record: PublicReportRecord, createOnly = false): Promise<PublicReportRecord> {
    const prisma = getPrismaClient();
    if (!prisma) {
      if (["beta", "production"].includes(process.env.APP_ENV ?? "development")) throw new ServiceUnavailableException({ code: "REPORT_STORAGE_UNAVAILABLE", message: "报告存储暂不可用，原卦仍在浏览器中，请稍后重试。" });
      const existing = reports.get(record.id);
      if (createOnly && existing) {
        if (existing.requestHash !== record.requestHash) throw new ConflictException({ code: "CAST_CONFLICT", message: "这次起卦已提交，请打开原报告。" });
        return existing;
      }
      reports.set(record.id, record);
      return { ...record, persistence: "memory" };
    }

    try {
      const data = {
        id: record.id, ownerId: record.ownerId, requestHash: record.requestHash,
        type: prismaType(record.type), question: record.question, chartHash: record.chartHash,
        result: record.result as object, narrativeReport: record.narrativeReport as object,
        aiReport: (record.aiReportBundle ?? null) as object | null,
        experience: record.experience as object, status: "COMPLETED" as const,
      };
      if (createOnly) await prisma.report.create({ data });
      else await prisma.report.upsert({
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
          ownerId: record.ownerId,
          requestHash: record.requestHash,
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
    } catch (error) {
      if (createOnly && (error as { code?: string }).code === "P2002") {
        const existing = await this.find(record.id);
        if (existing?.ownerId === record.ownerId && existing?.requestHash === record.requestHash) return existing;
        throw new ConflictException({ code: "CAST_CONFLICT", message: "这次起卦已提交，请打开原报告。" });
      }
      throw new ServiceUnavailableException({ code: "REPORT_SAVE_FAILED", message: "报告暂未保存成功。原卦已保留，请稍后重试，不必重新起卦。" });
    }
  }

  async find(id: string): Promise<PublicReportRecord | null> {
    const prisma = getPrismaClient();
    const cached = reports.get(id);
    if (!prisma) return cached ?? null;

    try {
      const row = await prisma.report.findUnique({ where: { id } });
      if (!row) return null;
      const record: PublicReportRecord = {
        id: row.id,
        ownerId: row.ownerId,
        requestHash: row.requestHash,
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
      throw new ServiceUnavailableException({ code: "REPORT_READ_FAILED", message: "报告存储暂时无法读取，请稍后重试。" });
    }
  }

  async list(limit = 20, ownerId?: string): Promise<PublicReportSummary[]> {
    if (!ownerId) return [];
    const memoryRecords = [...reports.values()]
      .filter((record) => record.ownerId === ownerId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit)
      .map(summarize);

    const prisma = getPrismaClient();
    if (!prisma) return memoryRecords;

    try {
      const rows = await prisma.report.findMany({
        where: { ownerId },
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
      return persisted;
    } catch {
      throw new ServiceUnavailableException({ code: "REPORT_READ_FAILED", message: "报告列表暂时无法读取，请稍后重试。" });
    }
  }

  async delete(id: string, ownerId?: string): Promise<boolean> {
    if (!ownerId) return false;
    const cached = reports.get(id);
    const hadMemoryRecord = cached?.ownerId === ownerId;
    const prisma = getPrismaClient();
    if (!prisma) return hadMemoryRecord ? reports.delete(id) : false;

    try {
      const deleted = await prisma.report.deleteMany({ where: { id, ownerId } });
      if (hadMemoryRecord) reports.delete(id);
      return deleted.count > 0 || hadMemoryRecord;
    } catch {
      throw new ServiceUnavailableException({ code: "REPORT_DELETE_FAILED", message: "删除未完成，请稍后重试。" });
    }
  }

  async clear(ownerId?: string): Promise<number> {
    if (!ownerId) return 0;
    const ids = [...reports.values()].filter((record) => record.ownerId === ownerId).map((record) => record.id);
    const prisma = getPrismaClient();
    if (!prisma) { ids.forEach((id) => reports.delete(id)); return ids.length; }

    try {
      const deleted = await prisma.report.deleteMany({ where: { ownerId } });
      ids.forEach((id) => reports.delete(id));
      return Math.max(ids.length, deleted.count);
    } catch {
      throw new ServiceUnavailableException({ code: "REPORT_DELETE_FAILED", message: "清空未完成，请稍后重试。" });
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
    const prisma = getPrismaClient();
    if (!prisma) { reports.set(id, updated); return { ...updated, persistence: "memory" }; }

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
      throw new ServiceUnavailableException({ code: "REPORT_SAVE_FAILED", message: "解读暂未保存成功，请稍后继续原报告。" });
    }
  }
}
