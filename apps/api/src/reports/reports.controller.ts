import { Body, Controller, Delete, ForbiddenException, Get, Headers, Inject, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { buildExperienceBundle } from "@six/domain/presentation";
import { HybridContentRepository, reportContentRecommendations } from "@six/domain/content-framework";

import { AiReportService } from "../ai/ai-report.service.js";
import { ReportStoreService } from "./report-store.service.js";
import type { DivinationType, PublicReportRecord } from "./report.types.js";
import { objectValue, publicExperience, publicObservationFocus } from "./public-experience.js";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function bitText(value: unknown): string {
  return String(value ?? "");
}

function reportExperience(report: PublicReportRecord) {
  const experience = objectValue(report.experience);
  if (report.type === "liuyao" && !experience.visualization) {
    return buildExperienceBundle({ result: report.result, type: report.type });
  }
  return report.experience;
}

function publicReportExport(report: PublicReportRecord) {
  const experience = objectValue(reportExperience(report));
  const guided = objectValue(experience.guidedViewModel);
  const professional = objectValue(experience.professionalViewModel);
  return {
    exportVersion: "PUBLIC_REPORT_EXPORT_V1",
    exportedAt: new Date().toISOString(),
    reportId: report.id,
    reportType: report.type,
    question: report.question,
    createdAt: report.createdAt,
    persistence: report.persistence,
    conclusion: {
      overallAssessment: guided.overallAssessment,
      headline: guided.headline,
      summary: guided.summary,
      coreMatter: guided.coreMatter,
      currentSituation: guided.currentSituation,
      changeDirection: guided.changeDirection,
      timingHint: guided.timingHint,
      mainSupports: guided.mainSupports,
      mainRisks: guided.mainRisks,
      recommendedActions: guided.recommendedActions,
      whyThisAssessment: guided.whyThisAssessment
    },
    chartViewModel: publicChartView(report),
    professionalEvidence: {
      method: professional.method,
      chartSummary: professional.chartSummary,
      auditChain: professional.auditChain,
      evidenceGroups: professional.evidenceGroups,
      timingCandidates: professional.timingCandidates,
      knowledgeRefs: professional.knowledgeRefs
    },
    visualization: experience.visualization ?? null,
    aiExpression: report.aiReportBundle ?? null,
    boundary: "本报告仅供传统文化研究与个人参考，不替代医疗、法律、投资等现实专业决策。"
  };
}

function publicChartView(report: PublicReportRecord) {
  const result = objectValue(report.result);
  const chart = objectValue(result.chart);
  const original = objectValue(chart.originalHexagram);
  const changed = objectValue(chart.changedHexagram);

  if (report.type === "meihua") {
    const mutual = objectValue(chart.mutualHexagram);
    const bodyTrigram = objectValue(chart.bodyTrigram);
    const useTrigram = objectValue(chart.useTrigram);
    const relation = objectValue(chart.bodyUseRelation);
    return {
      type: "meihua" as DivinationType,
      methodCode: text(chart.methodCode),
      originalHexagram: text(original.name_zh),
      mutualHexagram: text(mutual.name_zh),
      changedHexagram: text(changed.name_zh),
      movingLine: chart.movingLine,
      bodyTrigram: text(bodyTrigram.name_zh),
      useTrigram: text(useTrigram.name_zh),
      relationship: text(relation.meaning_zh),
      input: chart.input
    };
  }

  const lines = Array.isArray(chart.lines) ? chart.lines.map((item) => {
    const line = objectValue(item);
    return {
      position: line.position,
      value: line.sum,
      yinYang: bitText(line.originalBit) === "1" ? "阳" : "阴",
      moving: Boolean(line.moving),
      stem: text(line.stem),
      sixRelationName: text(line.sixRelationName),
      sixSpiritName: text(line.sixSpiritName),
      branchName: text(line.branchName),
      elementName: text(line.elementName),
      isWorld: Boolean(line.isWorld),
      isResponse: Boolean(line.isResponse),
      isVoid: Boolean(line.isVoid),
      monthInfluence: objectValue(line.monthInfluence).text,
      dayInfluence: objectValue(line.dayInfluence).text,
      changed: {
        stem: text(objectValue(line.changed).stem),
        branchName: text(objectValue(line.changed).branchName),
        elementName: text(objectValue(line.changed).elementName),
        sixRelationName: text(objectValue(line.changed).sixRelationName),
        returnInfluence: text(objectValue(objectValue(line.changed).returnInfluence).text),
        returnInfluenceName: text(objectValue(objectValue(line.changed).returnInfluence).name)
      }
    };
  }) : [];

  return {
    type: "liuyao" as DivinationType,
    methodCode: text(chart.methodCode),
    originalHexagram: text(original.name_zh),
    changedHexagram: text(changed.name_zh),
    movingLines: Array.isArray(chart.movingLines) ? chart.movingLines : [],
    worldLine: objectValue(chart.worldResponse).worldLine,
    responseLine: objectValue(chart.worldResponse).responseLine,
    observationFocus: publicObservationFocus(chart.observationFocus),
    lines
  };
}

function assertInternalAccess(token?: string) {
  const expected = process.env.INTERNAL_PRESENTATION_TOKEN;
  if (expected && token !== expected) {
    throw new ForbiddenException({ code: "INTERNAL_ACCESS_REQUIRED", message: "该报告视图仅限内部访问。" });
  }
  if (process.env.APP_ENV === "production" && !expected) {
    throw new ForbiddenException({ code: "INTERNAL_ACCESS_REQUIRED", message: "生产环境未启用内部访问令牌。" });
  }
}

function contentRepository() {
  return new HybridContentRepository({
    rootDir: process.env.SIX_ROOT ?? process.cwd(),
    includePreview: !["beta", "production"].includes(process.env.APP_ENV ?? "development")
  });
}

@Controller("reports")
export class ReportsController {
  constructor(
    @Inject(ReportStoreService)
    private readonly reportStore: ReportStoreService,
    @Inject(AiReportService)
    private readonly aiReport: AiReportService
  ) {}

  @Get()
  async listReports(@Query("limit") limit?: string) {
    const parsedLimit = Number(limit ?? 20);
    return {
      items: await this.reportStore.list(Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20)
    };
  }

  @Get(":id")
  async getReport(@Param("id") id: string) {
    const report = await this.reportStore.find(id);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });
    return report;
  }

  @Get(":id/export")
  async exportReport(@Param("id") id: string) {
    const report = await this.reportStore.find(id);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });
    return publicReportExport(report);
  }

  @Post(":id/ai")
  async generateAIReport(
    @Param("id") id: string,
    @Body() body: { language?: "zh-CN" | "en-US"; mockMode?: string; deviceId?: string } = {},
    @Headers("x-forwarded-for") forwardedFor?: string,
    @Headers("x-real-ip") realIp?: string
  ) {
    return this.aiReport.generateForReport(id, {
      language: body.language,
      mockMode: body.mockMode,
      deviceId: body.deviceId,
      ip: forwardedFor?.split(",")[0]?.trim() || realIp || "local"
    });
  }

  @Post(":id/ai/jobs")
  async enqueueAIReport(
    @Param("id") id: string,
    @Body() body: { language?: "zh-CN" | "en-US"; mockMode?: string; deviceId?: string } = {}
  ) {
    return this.aiReport.enqueueForReport(id, {
      language: body.language,
      mockMode: body.mockMode,
      deviceId: body.deviceId
    });
  }

  @Get(":id/experience")
  async getExperience(@Param("id") id: string) {
    const report = await this.reportStore.find(id);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });
    return {
      id: report.id,
      type: report.type,
      createdAt: report.createdAt,
      persistence: report.persistence,
      aiReportBundle: report.aiReportBundle,
      chartViewModel: publicChartView(report),
      experience: publicExperience(reportExperience(report)),
      relatedContent: (reportContentRecommendations as any)({ report, repository: contentRepository(), limit: 6 }).items
    };
  }

  @Delete()
  async clearReports() {
    return { deleted: await this.reportStore.clear() };
  }

  @Delete(":id")
  async deleteReport(@Param("id") id: string) {
    const deleted = await this.reportStore.delete(id);
    if (!deleted) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });
    return { deleted: true };
  }

  @Get(":id/internal-presentation")
  async getInternalPresentation(@Param("id") id: string, @Headers("x-internal-admin") token?: string) {
    assertInternalAccess(token);
    const report = await this.reportStore.find(id);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });
    return buildExperienceBundle({ result: report.result, type: report.type, includeAdmin: true });
  }
}
