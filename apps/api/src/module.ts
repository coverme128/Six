import { Module } from "@nestjs/common";

import { HealthController } from "./services/health.controller.js";
import { MetadataController } from "./services/metadata.controller.js";
import { DivinationController } from "./divination/divination.controller.js";
import { DivinationService } from "./divination/divination.service.js";
import { ReportsController } from "./reports/reports.controller.js";
import { ReportStoreService } from "./reports/report-store.service.js";
import { AiReportService } from "./ai/ai-report.service.js";
import { ContentController } from "./content/content.controller.js";
import { SettingsController } from "./settings/settings.controller.js";
import { QuestionUnderstandingService } from "./ai/question-understanding.service.js";

@Module({
  controllers: [HealthController, MetadataController, DivinationController, ReportsController, ContentController, SettingsController],
  providers: [DivinationService, ReportStoreService, AiReportService, QuestionUnderstandingService]
})
export class ApiModule {}
