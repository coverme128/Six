export type DivinationMode = "liuyao" | "meihua";

export type GuidedViewModel = {
  headline?: string;
  summary?: string;
  currentSituation?: string;
  coreMatter?: {
    topic?: string;
    summary?: string;
    roles?: Array<{ label?: string; practicalMeaning?: string; importance?: string }>;
    clarificationTriggers?: string[];
    safetyNotes?: string[];
  } | null;
  observationFocus?: ObservationFocus | null;
  changeDirection?: string;
  timingHint?: string;
  recommendedActions?: string[];
  mainSupports?: Array<{ title?: string; text?: string }>;
  mainRisks?: Array<{ title?: string; text?: string }>;
};

export type ObservationFocus = {
  summary?: string;
  selectionSource?: string;
  userEditable?: string;
  roles?: Array<{
    label?: string;
    meaning?: string;
    importance?: string;
    lines?: Array<{
      position?: number;
      branchName?: string;
      sixRelationName?: string;
      moving?: boolean;
      isWorld?: boolean;
      isResponse?: boolean;
      isVoid?: boolean;
      monthText?: string;
      dayText?: string;
      changedText?: string;
    }>;
  }>;
};

export type ProfessionalViewModel = {
  method?: string;
  chartSummary?: {
    title?: string;
    originalHexagram?: string;
    changedHexagram?: string;
    mutualHexagram?: string | null;
    movingLines?: number[];
    worldLine?: number | null;
    responseLine?: number | null;
    bodyTrigram?: string | null;
    useTrigram?: string | null;
    relationship?: string | null;
  };
  topicRoleContext?: GuidedViewModel["coreMatter"];
  observationFocus?: ObservationFocus | null;
  relationships?: Array<{ title?: string; text?: string }>;
  evidenceGroups?: {
    supports?: Array<{ title?: string; text?: string }>;
    risks?: Array<{ title?: string; text?: string }>;
    other?: Array<{ title?: string; text?: string }>;
  };
  timingCandidates?: Array<{ title?: string; text?: string }>;
  knowledgeRefs?: Array<{ id?: string; title?: string }>;
};

export type LiuyaoChartViewModel = {
  type: "liuyao";
  methodCode?: string;
  originalHexagram?: string;
  changedHexagram?: string;
  movingLines?: number[];
  worldLine?: number | null;
  responseLine?: number | null;
  observationFocus?: ObservationFocus | null;
  lines?: Array<{
    position?: number;
    value?: number;
    yinYang?: string;
    moving?: boolean;
    stem?: string;
    sixRelationName?: string;
    sixSpiritName?: string;
    branchName?: string;
    elementName?: string;
    isWorld?: boolean;
    isResponse?: boolean;
    isVoid?: boolean;
    monthInfluence?: string;
    dayInfluence?: string;
    changed?: {
      stem?: string;
      branchName?: string;
      elementName?: string;
      sixRelationName?: string;
      returnInfluence?: string;
      returnInfluenceName?: string;
    };
  }>;
};

export type MeihuaChartViewModel = {
  type: "meihua";
  methodCode?: string;
  originalHexagram?: string;
  mutualHexagram?: string;
  changedHexagram?: string;
  movingLine?: number;
  bodyTrigram?: string;
  useTrigram?: string;
  relationship?: string;
  input?: unknown;
};

export type ChartViewModel = LiuyaoChartViewModel | MeihuaChartViewModel;

export type ExperienceResponse = {
  id: string;
  type: DivinationMode;
  createdAt?: string;
  persistence?: string;
  chartViewModel?: ChartViewModel;
  aiReportBundle?: {
    reportSource?: string;
    validationStatus?: string;
    fallbackUsed?: boolean;
    generatedAt?: string;
    latencyMs?: number;
    aiReport?: {
      summary?: string;
      currentSituation?: string;
      changeDirection?: string;
      actionSuggestions?: string[];
      disclaimer?: string;
    } | null;
  } | null;
  experience?: {
    guidedViewModel?: GuidedViewModel;
    professionalViewModel?: ProfessionalViewModel;
  };
};

export type ReportSummary = {
  id: string;
  type: DivinationMode;
  question: string;
  chartHash: string;
  createdAt: string;
  persistence?: string;
};

export type ContentSummary = {
  contentId: string;
  contentType: string;
  title: string;
  slug: string;
  canonicalPath?: string;
  summary?: string;
  domain?: string;
  category?: string;
  difficulty?: string;
  reviewStatus?: string;
};

export type ContentDetail = ContentSummary & {
  body?: unknown;
  tags?: string[];
  sourceRefs?: Array<{ title?: string; url?: string }>;
  knownLimitations?: string[];
  relatedContentIds?: string[];
  relatedKnowledgeIds?: string[];
};

export type PublicSettings = {
  timezone: string;
  defaultCastMethod: "liuyao_manual" | "meihua_two_number";
  terminology: "beginner" | "professional";
  reportLanguage: "zh-CN" | "en-US";
};

export type ApiErrorResponse = {
  message?: string | string[];
  code?: string;
  error?: string;
};

export function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
}

export async function readError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    return message ?? body.error ?? "请求失败";
  } catch {
    return "请求失败";
  }
}
