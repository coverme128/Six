CREATE TYPE "ReportType" AS ENUM ('LIUYAO', 'MEIHUA');

CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "anonymous_devices" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "anonymous_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reports" (
  "id" TEXT NOT NULL,
  "type" "ReportType" NOT NULL,
  "question" TEXT NOT NULL,
  "chartHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "narrative_report" JSONB,
  "aiReport" JSONB,
  "experience" JSONB,
  "status" "AnalysisStatus" NOT NULL DEFAULT 'COMPLETED',
  "deviceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_entries" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "payload" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_events" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subjectId" TEXT,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_settings" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "anonymous_devices_deviceId_key" ON "anonymous_devices"("deviceId");

CREATE INDEX "reports_type_createdAt_idx" ON "reports"("type", "createdAt");

CREATE UNIQUE INDEX "content_entries_type_slug_key" ON "content_entries"("type", "slug");

CREATE INDEX "usage_events_eventType_createdAt_idx" ON "usage_events"("eventType", "createdAt");

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "anonymous_devices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
