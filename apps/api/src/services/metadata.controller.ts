import { Controller, Get } from "@nestjs/common";
import { SIX_ARCHITECTURE_TARGET, SIX_PRODUCT_VERSION } from "@six/shared";

@Controller("metadata")
export class MetadataController {
  @Get()
  metadata() {
    return {
      name: "six-professional-v2",
      version: SIX_PRODUCT_VERSION,
      architecture: SIX_ARCHITECTURE_TARGET,
      stack: {
        packageManager: "pnpm@9.15.4",
        orchestration: "turbo",
        language: "TypeScript",
        web: "Next.js 15 + React 19",
        admin: "Next.js 15 + React 19",
        api: "NestJS 10",
        database: "PostgreSQL 16 + Prisma",
        queue: "Redis 7 + BullMQ",
        validation: "Zod",
        tests: "Vitest + Playwright"
      }
    };
  }
}
