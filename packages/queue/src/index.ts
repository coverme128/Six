import { Queue } from "bullmq";

export const SIX_REPORT_QUEUE = "six-report-jobs";
export const GENERATE_AI_REPORT_JOB = "generate-ai-report";

export type GenerateAIReportJobData = {
  reportId: string;
  language?: "zh-CN" | "en-US";
  deviceId?: string;
};

export function createReportQueue(connectionUrl = process.env.REDIS_URL ?? "redis://localhost:6381") {
  return new Queue(SIX_REPORT_QUEUE, {
    connection: { url: connectionUrl }
  });
}

export async function enqueueAIReportJob(data: GenerateAIReportJobData, connectionUrl = process.env.REDIS_URL ?? "redis://localhost:6381") {
  const queue = createReportQueue(connectionUrl);
  try {
    return await queue.add(GENERATE_AI_REPORT_JOB, data, {
      attempts: 2,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100
    });
  } finally {
    await queue.close();
  }
}
