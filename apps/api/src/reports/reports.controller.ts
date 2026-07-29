import { Body, Controller, Get, Headers, NotFoundException, Param, Post, Query } from "@nestjs/common";

import { AiReportService } from "../ai/ai-report.service.js";
import { ReportStoreService } from "./report-store.service.js";

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportStore: ReportStoreService,
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
    return {
      exportVersion: "2.0.0",
      exportedAt: new Date().toISOString(),
      reportId: report.id,
      reportType: report.type,
      question: report.question,
      chartHash: report.chartHash,
      createdAt: report.createdAt,
      persistence: report.persistence,
      result: report.result,
      narrativeReport: report.narrativeReport,
      aiReportBundle: report.aiReportBundle,
      experience: report.experience
    };
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
      experience: report.experience
    };
  }
}
