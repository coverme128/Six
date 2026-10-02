ALTER TABLE "reports" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "reports" ADD COLUMN "requestHash" TEXT;
CREATE INDEX "reports_ownerId_createdAt_idx" ON "reports"("ownerId", "createdAt");
