import { Worker } from "bullmq";
import { getPrismaClient } from "@six/database";
import { generateGroundedAIReport, providerFromEnv } from "@six/domain/ai-report";
import { buildExperienceBundle } from "@six/domain/presentation";
import { GENERATE_AI_REPORT_JOB, SIX_REPORT_QUEUE, type GenerateAIReportJobData } from "@six/queue";

const connectionUrl = process.env.REDIS_URL ?? "redis://localhost:6381";

function publicType(type: string) {
  return type === "MEIHUA" ? "meihua" : "liuyao";
}

function attachAiReportBundle(result: unknown, aiReportBundle: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  return { ...result, aiReportBundle };
}

async function generateAIReport(data: GenerateAIReportJobData) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("DATABASE_URL is required for worker AI report jobs.");
  const row = await prisma.report.findUnique({ where: { id: data.reportId } });
  if (!row) throw new Error(`Report not found: ${data.reportId}`);
  const type = publicType(row.type);
  const result = attachAiReportBundle(row.result, row.aiReport);
  const provider = providerFromEnv({ rootDir: process.env.SIX_ROOT ?? process.cwd(), mockMode: data.mockMode });
  const aiReportBundle = await generateGroundedAIReport({
    result,
    type,
    provider,
    language: data.language ?? "zh-CN"
  });
  const updatedResult = attachAiReportBundle(result, aiReportBundle);
  const experience = buildExperienceBundle({ result: updatedResult, type });

  await prisma.report.update({
    where: { id: data.reportId },
    data: {
      result: updatedResult as object,
      aiReport: aiReportBundle as object,
      experience: experience as object
    }
  });

  return {
    ok: true,
    reportId: data.reportId,
    reportSource: aiReportBundle.reportSource,
    validationStatus: aiReportBundle.validationStatus,
    fallbackUsed: aiReportBundle.fallbackUsed
  };
}

const worker = new Worker(
  SIX_REPORT_QUEUE,
  async (job) => {
    if (job.name === GENERATE_AI_REPORT_JOB) return generateAIReport(job.data as GenerateAIReportJobData);
    return {
      ok: true,
      jobId: job.id,
      name: job.name,
      receivedAt: new Date().toISOString()
    };
  },
  { connection: { url: connectionUrl } }
);

worker.on("ready", () => {
  console.log(JSON.stringify({ status: "ready", worker: "@six/worker", queue: SIX_REPORT_QUEUE }));
});

worker.on("failed", (job, error) => {
  console.error(JSON.stringify({ status: "failed", jobId: job?.id, message: error.message }));
});
