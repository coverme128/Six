import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AIReportValidationError,
  createAnonymousAILimiter,
  generateGroundedAIReport,
  providerFromEnv
} from "@six/domain/ai-report";
import { buildExperienceBundle } from "@six/domain/presentation";
import { enqueueAIReportJob } from "@six/queue";

import { ReportStoreService } from "../reports/report-store.service.js";

type GenerateAIOptions = {
  language?: "zh-CN" | "en-US";
  mockMode?: string;
  ip?: string;
  deviceId?: string;
};

const limiter = createAnonymousAILimiter({
  maxPerIp: Number(process.env.AI_RATE_LIMIT_MAX ?? 100),
  maxPerDevice: Number(process.env.AI_DEVICE_RATE_LIMIT_MAX ?? 20),
  windowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000)
});

function rootDir() {
  return process.env.SIX_ROOT ?? process.cwd();
}

function allowMockMode() {
  return !["beta", "production"].includes(process.env.APP_ENV ?? "development");
}

function attachAiReportBundle(result: unknown, aiReportBundle: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  return { ...result, aiReportBundle };
}

@Injectable()
export class AiReportService {
  constructor(@Inject(ReportStoreService) private readonly reportStore: ReportStoreService) {}

  async enqueueForReport(reportId: string, options: GenerateAIOptions = {}) {
    const report = await this.reportStore.find(reportId);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });
    if (options.language && !["zh-CN", "en-US"].includes(options.language)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Unsupported AI report language." });
    }
    if (options.mockMode && !allowMockMode()) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "mockMode is unavailable in beta/production." });
    }
    try {
      const job = await enqueueAIReportJob({
        reportId,
        language: options.language,
        mockMode: allowMockMode() ? options.mockMode : undefined,
        deviceId: options.deviceId
      });
      return {
        reportId,
        queued: true,
        jobId: job.id,
        queue: job.queueName
      };
    } catch (error) {
      return {
        reportId,
        queued: false,
        fallback: await this.generateForReport(reportId, options),
        error: error instanceof Error ? error.message : "queue unavailable"
      };
    }
  }

  async generateForReport(reportId: string, options: GenerateAIOptions = {}) {
    const report = await this.reportStore.find(reportId);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });

    if (options.language && !["zh-CN", "en-US"].includes(options.language)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Unsupported AI report language." });
    }

    if (options.mockMode && !allowMockMode()) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "mockMode is unavailable in beta/production." });
    }

    try {
      limiter.assertAllowed({ ip: options.ip, deviceId: options.deviceId });
    } catch (error) {
      if (error instanceof AIReportValidationError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }

    const result = attachAiReportBundle(report.result, report.aiReportBundle);
    const provider = providerFromEnv({ rootDir: rootDir(), mockMode: allowMockMode() ? options.mockMode : undefined });
    const aiReportBundle = await generateGroundedAIReport({
      result,
      type: report.type,
      provider,
      language: options.language ?? "zh-CN"
    });
    const updatedResult = attachAiReportBundle(result, aiReportBundle);
    const experience = buildExperienceBundle({ result: updatedResult, type: report.type });
    const updated = await this.reportStore.updateAiReport(report.id, aiReportBundle, updatedResult, experience);
    if (!updated) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });

    return {
      reportId: updated.id,
      reportType: updated.type,
      persistence: updated.persistence,
      aiReportBundle,
      experience: updated.experience
    };
  }
}
