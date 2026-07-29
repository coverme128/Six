import { Controller, Get } from "@nestjs/common";
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
    return {
      status: "ready",
      version: SIX_PRODUCT_VERSION,
      architecture: SIX_ARCHITECTURE_TARGET,
      database: databaseHealth(),
      redis: process.env.REDIS_URL ? "configured" : "unavailable"
    };
  }
}
