import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createLiuyaoChart } from "@six/domain/liuyao";
import { buildLiuyaoReport } from "@six/domain/report-builder";
import { QuestionUnderstandingService } from "./question-understanding.service.js";
import { isDeepStrictEqual } from "node:util";
import {
  AIReportValidationError,
  createAnonymousAILimiter,
  generateGroundedAIReport,
  providerFromEnv
} from "@six/domain/ai-report";
import { buildExperienceBundle } from "@six/domain/presentation";
import { enqueueAIReportJob } from "@six/queue";

import { ReportStoreService } from "../reports/report-store.service.js";
import { publicExperience } from "../reports/public-experience.js";

type GenerateAIOptions = {
  language?: "zh-CN" | "en-US";
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

function attachAiReportBundle(result: unknown, aiReportBundle: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  return { ...result, aiReportBundle };
}

function attachProductResultFacts(result: unknown, experience: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  if (!experience || typeof experience !== "object" || Array.isArray(experience)) return result;
  const productResultFacts = (experience as Record<string, unknown>).productResultFacts;
  return productResultFacts ? { ...result, productResultFacts } : result;
}

function withoutStoredProductFacts(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const { productResultFacts: _storedProductFacts, ...currentResult } = result as Record<string, unknown>;
  return currentResult;
}

@Injectable()
export class AiReportService {
  private readonly updating = new Set<string>();
  constructor(
    @Inject(ReportStoreService) private readonly reportStore: ReportStoreService,
    @Inject(QuestionUnderstandingService) private readonly questions: QuestionUnderstandingService,
  ) {}

  private async withReportLock<T>(reportId: string, work: () => Promise<T>) {
    if (this.updating.has(reportId)) throw new ConflictException({ code: "REPORT_BUSY", message: "这份报告正在更新，请稍后重试。" });
    this.updating.add(reportId);
    try { return await work(); } finally { this.updating.delete(reportId); }
  }

  async reviseForReport(reportId: string, input: { clarification: string; understandingToken?: string; revision: number }) {
    return this.withReportLock(reportId, async () => {
      const current = await this.reportStore.find(reportId);
      if (!current || current.type !== "liuyao") throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到六爻报告。" });
      const previous = current.result as any;
      if (Number(previous.interpretationRevision ?? 1) !== input.revision) throw new ConflictException({ code: "REPORT_CHANGED", message: "报告已更新，请刷新后再补充。" });
      const understood = await this.questions.resolve({ question: current.question, ...input });
      const saved = await this.applyUnderstanding(current, understood);
      const result = saved.result as any;
      return { reportId, revision: result.interpretationRevision, persistence: saved.persistence };
    });
  }

  private async applyUnderstanding(current: any, understood: any) {
    const previous = current.result;
    const recalculated = createLiuyaoChart({
      question: current.question,
      ...understood,
      values: previous.chart.rawCast.values,
      calendar: { timezone: previous.chart.calendar.timezone, instantUtc: previous.chart.calendar.instantUtc },
    }, rootDir());
    // A correction changes the interpretation scope, never the recorded cast or calendar.
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(recalculated.chart.lines)), previous.chart.lines)) {
      throw new ConflictException({ code: "CHART_VERSION_CHANGED", message: "当前引擎版本与原盘不同，已保留原报告，暂不能更新解读。" });
    }
    const result: any = {
      ...recalculated,
      chart: { ...previous.chart, topic: understood.topic, subtype: understood.subtype, questionProfile: understood.questionProfile, observationFocus: (recalculated.chart as any).observationFocus },
      interpretationRevision: Number(previous.interpretationRevision ?? 1) + 1,
      interpretationHistory: [...(previous.interpretationHistory ?? []), {
        revision: Number(previous.interpretationRevision ?? 1),
        recordedAt: new Date().toISOString(),
        questionProfile: previous.chart.questionProfile,
        aiReportBundle: current.aiReportBundle ?? null,
        report: previous.report,
        findings: previous.findings,
      }],
    };
    result.narrativeReport = buildLiuyaoReport(result);
    const saved = await this.reportStore.save({ ...current, result, narrativeReport: result.narrativeReport, aiReportBundle: null, experience: buildExperienceBundle({ result, type: "liuyao" }) });
    return saved;
  }

  async enqueueForReport(reportId: string, options: GenerateAIOptions = {}) {
    const report = await this.reportStore.find(reportId);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });
    if (report.type === "liuyao" && (report.result as any)?.chart?.questionProfile?.profileVersion !== "LIUYAO_QUESTION_PROFILE_V2") {
      return { reportId, queued: false, fallback: await this.generateForReport(reportId, options) };
    }
    if (options.language && !["zh-CN", "en-US"].includes(options.language)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Unsupported AI report language." });
    }
    try {
      const job = await enqueueAIReportJob({
        reportId,
        language: options.language,
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
    return this.withReportLock(reportId, () => this.generateUnlocked(reportId, options));
  }

  private async generateUnlocked(reportId: string, options: GenerateAIOptions = {}) {
    let report = await this.reportStore.find(reportId);
    if (!report) throw new NotFoundException({ code: "REPORT_NOT_FOUND", message: "未找到该报告。" });

    if (options.language && !["zh-CN", "en-US"].includes(options.language)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Unsupported AI report language." });
    }

    try {
      limiter.assertAllowed({ ip: options.ip, deviceId: options.deviceId });
    } catch (error) {
      if (error instanceof AIReportValidationError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }

    if (report.type === "liuyao" && (report.result as any)?.chart?.questionProfile?.profileVersion !== "LIUYAO_QUESTION_PROFILE_V2") {
      const understood = await this.questions.resolve({ question: report.question });
      report = await this.applyUnderstanding(report, understood);
    }
    const baseResult = attachAiReportBundle(withoutStoredProductFacts(report.result), report.aiReportBundle);
    const currentExperience = buildExperienceBundle({ result: baseResult, type: report.type });
    const result = attachProductResultFacts(baseResult, currentExperience);
    const provider = providerFromEnv({ rootDir: rootDir() });
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
      experience: publicExperience(updated.experience)
    };
  }
}
