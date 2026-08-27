import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { databaseHealth } from "@six/database";
import { SIX_ARCHITECTURE_TARGET, SIX_PRODUCT_VERSION } from "@six/shared";

@Controller()
export class HealthController {
  @Get("/health")
  health() {
    return { status: "ok" };
  }

  @Get("/ready")
  ready() {
    const database = databaseHealth();
    const redis = process.env.REDIS_URL ? "configured" : "unavailable";
    const aiProvider = process.env.AI_PROVIDER ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : process.env.OPENAI_API_KEY ? "openai" : "disabled");
    const aiConfigured = aiProvider === "deepseek"
      ? Boolean(process.env.DEEPSEEK_API_KEY)
      : aiProvider === "openai" && Boolean(process.env.OPENAI_API_KEY);
    const ai = {
      provider: aiProvider,
      model: process.env.AI_MODEL ?? (aiProvider === "deepseek" ? "deepseek-v4-flash" : aiProvider === "openai" ? "gpt-4.1-mini" : null),
      status: aiConfigured ? "configured" : "unavailable"
    };
    const production = ["beta", "production"].includes(process.env.APP_ENV ?? "development");
    if (production && (database.status !== "configured" || redis !== "configured" || !aiConfigured)) {
      throw new ServiceUnavailableException({
        code: "DEPENDENCIES_NOT_READY",
        message: "Production dependencies are not configured.",
        database,
        redis,
        ai,
      });
    }
    return {
      status: "ready",
      version: SIX_PRODUCT_VERSION,
      architecture: SIX_ARCHITECTURE_TARGET,
      database,
      redis,
      ai
    };
  }
}
