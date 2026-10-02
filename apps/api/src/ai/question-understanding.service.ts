import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { providerFromEnv, redactQuestionForAI, createAnonymousAILimiter } from "@six/domain/ai-report";
import { QuestionRequestSchema, QuestionUnderstandingSchema, type QuestionUnderstanding } from "@six/shared";

type QuestionInput = { question: string; clarification?: string; understandingToken?: string };
type UnderstandingResult = { understanding: QuestionUnderstanding; understandingToken: string };

const understandingFormat = {
  type: "json_schema", name: "liuyao_question_understanding", strict: true,
  schema: {
    type: "object", additionalProperties: false,
    required: Object.keys(QuestionUnderstandingSchema.shape),
    properties: {
      ...Object.fromEntries(["primaryIntent", "decisionObject", "summary", "timeHorizon", "clarificationQuestion", "uncertainty"].map((key) => [key, { type: "string" }])),
      status: { type: "string", enum: QuestionUnderstandingSchema.shape.status.options },
      route: { type: "string", enum: QuestionUnderstandingSchema.shape.route.options },
      joinMode: { type: "string", enum: QuestionUnderstandingSchema.shape.joinMode.options },
      secondaryConcerns: { type: "array", maxItems: 6, items: { type: "string" } },
      options: { type: "array", maxItems: 6, items: { type: "string" } },
    },
  },
};

@Injectable()
export class QuestionUnderstandingService {
  private readonly signingKey = randomBytes(32);
  private readonly limiter = createAnonymousAILimiter({ maxPerIp: 120, maxPerDevice: 120, windowMs: 3600000 });
  private readonly pending = new Map<string, Promise<UnderstandingResult>>();

  async understand(input: QuestionInput, ownerId = "internal"): Promise<UnderstandingResult> {
    const parsed = QuestionRequestSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "请填写不超过 500 字的问题或补充信息。" });
    const source = parsed.data;
    const cached = this.verify(input.understandingToken, source);
    if (cached) return cached;
    const key = this.digest(ownerId + JSON.stringify(source));
    const existing = this.pending.get(key);
    if (existing) return existing;
    const task = this.classify(source, ownerId);
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }

  async resolve(input: QuestionInput, ownerId = "internal") {
    const result = await this.understand(input, ownerId);
    if (["CLARIFY", "SPLIT"].includes(result.understanding.status)) {
      throw new BadRequestException({ code: "QUESTION_CLARIFICATION_REQUIRED", message: result.understanding.clarificationQuestion, ...result });
    }
    const [topic, subtype] = result.understanding.route.split(":");
    return {
      topic, subtype,
      questionProfile: {
        ...result.understanding,
        profileVersion: "LIUYAO_QUESTION_PROFILE_V2",
        source: "LIVE_AI_UNDERSTANDING",
        clarification: input.clarification ?? "",
      },
    };
  }

  private digest(value: string) { return createHmac("sha256", this.signingKey).update(value).digest("base64url"); }

  private verify(token: string | undefined, source: { question: string; clarification: string }): UnderstandingResult | null {
    if (!token) return null;
    try {
      const [payload, signature] = token.split(".");
      const expected = Buffer.from(this.digest(payload));
      const supplied = Buffer.from(signature ?? "");
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (decoded.expires < Date.now() || decoded.sourceHash !== this.digest(JSON.stringify(source))) return null;
      return { understanding: QuestionUnderstandingSchema.parse(decoded.understanding), understandingToken: token };
    } catch { return null; }
  }

  private async classify(source: { question: string; clarification: string }, ownerId: string): Promise<UnderstandingResult> {
    try { this.limiter.assertAllowed({ ip: ownerId, deviceId: ownerId }); }
    catch { throw new BadRequestException({ code: "AI_RATE_LIMITED", message: "问题理解请求较多，请稍后重试。" }); }
    const provider = providerFromEnv({ rootDir: process.env.SIX_ROOT ?? process.cwd() });
    if (typeof provider.generateQuestionUnderstanding !== "function") {
      throw new ServiceUnavailableException({ code: "QUESTION_PROVIDER_UNAVAILABLE", message: "暂时无法理解问题，请稍后重试。你的问题会保留。" });
    }
    let correctionRequest = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = await provider.generateQuestionUnderstanding({
          question: redactQuestionForAI(source.question),
          clarification: redactQuestionForAI(source.clarification),
          ...(correctionRequest ? { correctionRequest } : {}),
        }, understandingFormat);
        const understanding = QuestionUnderstandingSchema.parse(JSON.parse(raw.content));
        // Respect an explicit "not decided" answer even if the model repeats its question.
        if (understanding.status === "CLARIFY" && /还没确定|尚未确定|还未确定|暂未确定|没有确定|不知道|不确定/u.test(source.clarification)) {
          understanding.status = "BRANCHED";
          understanding.route = "general:decision";
          understanding.joinMode = "UNCLARIFIED";
          understanding.uncertainty = understanding.clarificationQuestion;
          understanding.clarificationQuestion = "";
          understanding.options = [];
        }
        if (understanding.status === "SPLIT" && /只问|只关注|先问|只考虑|只处理|这次选择/u.test(source.clarification)) {
          throw new Error("Recheck explicit focus selection in clarification before returning SPLIT. Do not ask the user to select an already selected matter.");
        }
        if (["CLARIFY", "SPLIT"].includes(understanding.status) && (!understanding.clarificationQuestion || understanding.options.length < 2)) throw new Error("Incomplete clarification");
        if (understanding.status === "BRANCHED" && !source.clarification) throw new Error("Unconfirmed ambiguity");
        const payload = Buffer.from(JSON.stringify({
          understanding, sourceHash: this.digest(JSON.stringify(source)), expires: Date.now() + 30 * 60 * 1000,
        })).toString("base64url");
        return { understanding, understandingToken: `${payload}.${this.digest(payload)}` };
      } catch (error) {
        correctionRequest = "The prior response failed validation. Return the full required JSON shape, applying clarification BEFORE selecting status, intent and route. An explicit correction or selection supersedes the original ambiguity. Do not repeat a question already answered; do not fabricate a choice if it remains unclear.";
        console.warn(JSON.stringify({ stage: "question-understanding", attempt: attempt + 1, code: (error as any)?.code ?? "INVALID_QUESTION_RESPONSE", fields: (error as any)?.issues?.map((item: any) => ({ path: item.path, code: item.code })) }));
      }
    }
    throw new ServiceUnavailableException({ code: "QUESTION_UNDERSTANDING_FAILED", message: "这次未能完成问题理解，请重试。已填写的问题和卦爻会保留。" });
  }
}
