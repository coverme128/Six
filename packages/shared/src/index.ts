import { z } from "zod";

export const SIX_PRODUCT_VERSION = "1.3.0";
export const SIX_ARCHITECTURE_TARGET = "PNPM_TURBO_TYPESCRIPT_NEXT_NEST_PRISMA_REDIS_V1";

export const ReportTypeSchema = z.enum(["liuyao", "meihua"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const QuestionRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  clarification: z.string().trim().max(500).default(""),
});

export const QuestionUnderstandingSchema = z.object({
  status: z.enum(["RESOLVED", "CLARIFY", "BRANCHED", "SPLIT"]),
  primaryIntent: z.string().trim().min(1).max(160),
  decisionObject: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(300),
  route: z.enum(["career:job_search", "business:partnership", "wealth:income", "relationship:relationship_stability", "study:exam", "property:buy_house", "legal:dispute", "health:self_health", "goods:lost_item", "travel:trip", "general:decision"]),
  joinMode: z.enum(["EMPLOYMENT", "PARTNERSHIP", "PROJECT_COOPERATION", "INVESTMENT", "ADVISORY", "UNCLARIFIED"]),
  secondaryConcerns: z.array(z.string().max(100)).max(6),
  timeHorizon: z.string().max(100),
  clarificationQuestion: z.string().max(200),
  options: z.array(z.string().min(1).max(160)).max(6),
  uncertainty: z.string().max(300),
});
export type QuestionUnderstanding = z.infer<typeof QuestionUnderstandingSchema>;

export const LiuyaoChartRequestSchema = z.object({
  requestId: z.string().uuid(),
  deferUnderstanding: z.boolean().default(false),
  question: z.string().trim().min(1).max(500),
  topic: z.string().optional(),
  subtype: z.string().optional(),
  clarification: z.string().trim().max(500).default(""),
  understandingToken: z.string().max(12000).optional(),
  values: z.array(z.number().int().min(6).max(9)).length(6).optional(),
  coins: z.array(z.array(z.number().int().min(2).max(3)).length(3)).length(6).optional(),
  questionProfile: z
    .object({
      joinMode: z.enum(["EMPLOYMENT", "PARTNERSHIP", "PROJECT_COOPERATION", "INVESTMENT", "ADVISORY"])
    })
    .optional(),
  calendar: z
    .object({
      timezone: z.string().default("Asia/Shanghai"),
      instantUtc: z.string().datetime({ offset: true })
    })
});

export const MeihuaChartRequestSchema = z.object({
  question: z.string().trim().max(500).default(""),
  methodCode: z
    .enum(["MEIHUA_TWO_NUMBER_V1", "MEIHUA_THREE_NUMBER_V1", "MEIHUA_TIME_LUNAR_BRANCH_V1"])
    .default("MEIHUA_TWO_NUMBER_V1"),
  number_a: z.coerce.number().int().positive().optional(),
  number_b: z.coerce.number().int().positive().optional(),
  number_c: z.coerce.number().int().positive().optional(),
  lunar_month: z.coerce.number().int().positive().optional(),
  lunar_day: z.coerce.number().int().positive().optional(),
  year_branch_ordinal: z.coerce.number().int().positive().optional(),
  hour_branch_ordinal: z.coerce.number().int().positive().optional()
});

export const PublicErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  traceId: z.string().optional()
});

export type LiuyaoChartRequest = z.infer<typeof LiuyaoChartRequestSchema>;
export type MeihuaChartRequest = z.infer<typeof MeihuaChartRequestSchema>;
export type PublicError = z.infer<typeof PublicErrorSchema>;
