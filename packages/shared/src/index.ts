import { z } from "zod";

export const SIX_PRODUCT_VERSION = "1.3.0";
export const SIX_ARCHITECTURE_TARGET = "PNPM_TURBO_TYPESCRIPT_NEXT_NEST_PRISMA_REDIS_V1";

export const ReportTypeSchema = z.enum(["liuyao", "meihua"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const LiuyaoChartRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  topic: z.string().default("career"),
  subtype: z.string().default("job_search"),
  values: z.array(z.number().int().min(6).max(9)).length(6).optional(),
  coins: z.array(z.array(z.number().int().min(2).max(3)).length(3)).length(6).optional(),
  calendar: z
    .object({
      timezone: z.string().default("Asia/Shanghai"),
      instantUtc: z.string().optional()
    })
    .optional()
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
