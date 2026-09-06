import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { LiuyaoChartRequestSchema, MeihuaChartRequestSchema } from "@six/shared";
import type { z, ZodTypeAny } from "zod";

import { DivinationService } from "./divination.service.js";
import { QuestionUnderstandingService } from "../ai/question-understanding.service.js";
import { QuestionRequestSchema } from "@six/shared";

function parseRequest<TSchema extends ZodTypeAny>(schema: TSchema, body: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;

  const firstIssue = parsed.error.issues[0];
  const path = firstIssue?.path.length ? `${firstIssue.path.join(".")}: ` : "";
  throw new BadRequestException({
    code: "VALIDATION_ERROR",
    message: `${path}${firstIssue?.message ?? "Invalid request body"}`
  });
}

@Controller()
export class DivinationController {
  constructor(
    @Inject(DivinationService) private readonly divinationService: DivinationService,
    @Inject(QuestionUnderstandingService) private readonly questions: QuestionUnderstandingService,
  ) {}

  @Post("liuyao/questions/understand")
  async understand(@Body() body: unknown) {
    return this.questions.understand(parseRequest(QuestionRequestSchema, body));
  }

  @Post("liuyao/charts")
  async createLiuyao(@Body() body: unknown) {
    const input = parseRequest(LiuyaoChartRequestSchema, body);
    return this.divinationService.createLiuyao(input);
  }

  @Post("meihua/charts")
  async createMeihua(@Body() body: unknown) {
    const input = parseRequest(MeihuaChartRequestSchema, body);
    return this.divinationService.createMeihua(input);
  }

  @Post("reports/demo")
  async demoReport() {
    return this.divinationService.createDemo();
  }
}
