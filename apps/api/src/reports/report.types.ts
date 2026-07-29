export type DivinationType = "liuyao" | "meihua";

export type PublicReportRecord = {
  id: string;
  type: DivinationType;
  question: string;
  chartHash: string;
  createdAt: string;
  result: unknown;
  narrativeReport: unknown;
  aiReportBundle?: unknown;
  experience: unknown;
  persistence: "memory" | "prisma" | "memory-fallback";
};

export type PublicReportSummary = Pick<
  PublicReportRecord,
  "id" | "type" | "question" | "chartHash" | "createdAt" | "persistence"
>;
