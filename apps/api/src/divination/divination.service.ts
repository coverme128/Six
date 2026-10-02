import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { createLiuyaoChart } from "@six/domain/liuyao";
import { createMeihuaChart } from "@six/domain/meihua";
import { buildLiuyaoReport, buildMeihuaReport } from "@six/domain/report-builder";
import { buildExperienceBundle } from "@six/domain/presentation";
import type { LiuyaoChartRequest, MeihuaChartRequest } from "@six/shared";

import { ReportStoreService } from "../reports/report-store.service.js";
import type { DivinationType, PublicReportRecord } from "../reports/report.types.js";
import { QuestionUnderstandingService } from "../ai/question-understanding.service.js";

function chartHashOf(result: any): string {
  return result?.chart?.chartHash ?? "";
}

function publicCreatedReport(record: PublicReportRecord) {
  return {
    id: record.id,
    type: record.type,
    question: record.question,
    chartHash: record.chartHash,
    createdAt: record.createdAt,
    persistence: record.persistence
  };
}

@Injectable()
export class DivinationService {
  private readonly pending = new Map<string, Promise<ReturnType<typeof publicCreatedReport>>>();
  constructor(
    @Inject(ReportStoreService) private readonly reportStore: ReportStoreService,
    @Inject(QuestionUnderstandingService) private readonly questions: QuestionUnderstandingService,
  ) {}

  async createLiuyao(input: LiuyaoChartRequest, ownerId: string) {
    if (Boolean(input.values) === Boolean(input.coins)) throw new BadRequestException("请提供一组完整的六爻记录。");
    const id = `ly_${createHash("sha256").update(`${ownerId}:${input.requestId}`).digest("hex").slice(0, 40)}`;
    // Tokens and provider availability can change on retry; the original question and cast cannot.
    const requestHash = createHash("sha256").update(JSON.stringify({ question: input.question, clarification: input.clarification,
      values: input.values, coins: input.coins, calendar: input.calendar })).digest("hex");
    const existingTask = this.pending.get(id);
    if (existingTask) { await existingTask; return this.createLiuyao(input, ownerId); }
    const task = (async () => {
      const existing = await this.reportStore.find(id);
      if (existing) {
        if (existing.ownerId !== ownerId || existing.requestHash !== requestHash) throw new ConflictException({ code: "CAST_CONFLICT", message: "这次起卦已保存，不能用同一记录提交不同的盘面。请打开原报告。" });
        return publicCreatedReport(existing);
      }
      const understood = input.deferUnderstanding ? { topic: "general", subtype: "decision" } : await this.questions.resolve(input, ownerId);
      const result: any = createLiuyaoChart({ question: input.question, values: input.values, coins: input.coins, calendar: input.calendar, ...understood }, process.env.SIX_ROOT);
      result.chart.id = id;
      if (input.deferUnderstanding) result.pendingQuestion = { clarification: input.clarification, status: "PENDING" };
      return publicCreatedReport(await this.storeReport("liuyao", result, { ownerId, requestHash }, true));
    })();
    this.pending.set(id, task);
    try { return await task; } finally { this.pending.delete(id); }
  }

  async createMeihua(input: MeihuaChartRequest) {
    const result = createMeihuaChart(input, process.env.SIX_ROOT);
    return publicCreatedReport(await this.storeReport("meihua", result));
  }

  async createDemo() {
    const result = createLiuyaoChart(
      {
        question: "新的 Nest API 是否能承接旧事实链？",
        topic: "career",
        subtype: "job_search",
        values: [7, 8, 9, 7, 8, 6],
        calendar: { timezone: "Asia/Shanghai" }
      },
      process.env.SIX_ROOT
    );
    const record = await this.storeReport("liuyao", result);
    return { ...publicCreatedReport(record), requestId: randomUUID() };
  }

  private async storeReport(type: DivinationType, result: any, ownership: Pick<PublicReportRecord, "ownerId" | "requestHash"> = {}, createOnly = false): Promise<PublicReportRecord> {
    const narrativeReport = type === "liuyao" ? buildLiuyaoReport(result) : buildMeihuaReport(result);
    result.narrativeReport = narrativeReport;
    const record: PublicReportRecord = {
      ...ownership,
      id: result.chart.id,
      type,
      question: result.chart.question ?? "",
      chartHash: chartHashOf(result),
      createdAt: new Date().toISOString(),
      result,
      narrativeReport,
      experience: buildExperienceBundle({ result, type }),
      persistence: "memory"
    };
    return this.reportStore.save(record, createOnly);
  }
}
