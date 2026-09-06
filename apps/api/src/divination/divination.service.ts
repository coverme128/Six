import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
  constructor(
    @Inject(ReportStoreService) private readonly reportStore: ReportStoreService,
    @Inject(QuestionUnderstandingService) private readonly questions: QuestionUnderstandingService,
  ) {}

  async createLiuyao(input: LiuyaoChartRequest) {
    const understood = await this.questions.resolve(input);
    const result = createLiuyaoChart({ ...input, ...understood }, process.env.SIX_ROOT);
    return publicCreatedReport(await this.storeReport("liuyao", result));
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

  private async storeReport(type: DivinationType, result: any): Promise<PublicReportRecord> {
    const narrativeReport = type === "liuyao" ? buildLiuyaoReport(result) : buildMeihuaReport(result);
    result.narrativeReport = narrativeReport;
    const record: PublicReportRecord = {
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
    return this.reportStore.save(record);
  }
}
