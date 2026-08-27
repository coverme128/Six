import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { databaseHealth } from "@six/database";
import { providerFromEnv } from "@six/domain/ai-report";
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
    const aiRuntime = providerFromEnv();
    const aiConfigured = Boolean(aiRuntime.apiKey);
    const ai = {
      provider: aiRuntime.provider,
      model: aiConfigured ? aiRuntime.model : null,
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
