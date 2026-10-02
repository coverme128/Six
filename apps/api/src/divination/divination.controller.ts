import { BadRequestException, Body, Controller, Inject, Post, Req, GoneException } from "@nestjs/common";
import { workspaceOwner } from "../reports/workspace-access.js";
import { LiuyaoChartRequestSchema } from "@six/shared";
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
  async understand(@Body() body: unknown, @Req() request: any) {
    const owner = workspaceOwner(request.headers["x-six-workspace"]);
    return this.questions.understand(parseRequest(QuestionRequestSchema, body), owner);
  }

  @Post("liuyao/charts")
  async createLiuyao(@Body() body: unknown, @Req() request: any) {
    const input = parseRequest(LiuyaoChartRequestSchema, body);
    return this.divinationService.createLiuyao(input, workspaceOwner(request.headers["x-six-workspace"]));
  }

  @Post("meihua/charts")
  async createMeihua() {
    throw new GoneException("当前仅支持六爻。");
  }

  @Post("reports/demo")
  async demoReport() {
    throw new GoneException("请使用首页的静态报告示例。");
  }
}
