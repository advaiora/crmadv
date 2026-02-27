-- CreateEnum
CREATE TYPE "public"."WebAssetDeploymentEnvironment" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "public"."WebAssetHealthStatus" AS ENUM ('UP', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "public"."WebAssetMaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."WebAssetAlertType" AS ENUM ('DOWNTIME', 'PERFORMANCE', 'ERROR_RATE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."WebAssetAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."WebAssetAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterTable
ALTER TABLE "public"."WebsiteAsset"
ADD COLUMN "deploymentEnvironment" "public"."WebAssetDeploymentEnvironment" NOT NULL DEFAULT 'DEVELOPMENT';

ALTER TABLE "public"."WebAppAsset"
ADD COLUMN "deploymentEnvironment" "public"."WebAssetDeploymentEnvironment" NOT NULL DEFAULT 'DEVELOPMENT';

ALTER TABLE "public"."EcommerceAsset"
ADD COLUMN "deploymentEnvironment" "public"."WebAssetDeploymentEnvironment" NOT NULL DEFAULT 'DEVELOPMENT';

ALTER TABLE "public"."WebAssetVersion"
ADD COLUMN "releaseNotes" VARCHAR(4000);

-- CreateTable
CREATE TABLE "public"."WebAssetHealthCheck" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "assetId" TEXT NOT NULL,
    "environment" "public"."WebAssetDeploymentEnvironment" NOT NULL,
    "status" "public"."WebAssetHealthStatus" NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "httpStatus" INTEGER,
    "responseTimeMs" INTEGER,
    "errorCode" VARCHAR(120),
    "errorMessage" VARCHAR(1000),
    "createdByUserId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAssetHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebAssetSeoReport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "assetId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "public"."WebAssetVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "metaTitle" VARCHAR(255),
    "metaDescription" VARCHAR(512),
    "h1Count" INTEGER NOT NULL DEFAULT 0,
    "keywordList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "issues" JSONB,
    "suggestions" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAssetSeoReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebAssetAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "assetId" TEXT NOT NULL,
    "environment" "public"."WebAssetDeploymentEnvironment" NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "sourceLabel" VARCHAR(160),
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "users" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DECIMAL(5,2),
    "avgLoadTimeMs" INTEGER,
    "uptimePercent" DECIMAL(5,2),
    "errorRate" DECIMAL(5,2),
    "topPages" JSONB,
    "customEvents" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAssetAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebAssetAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "assetId" TEXT NOT NULL,
    "environment" "public"."WebAssetDeploymentEnvironment" NOT NULL,
    "eventName" VARCHAR(120) NOT NULL,
    "eventLabel" VARCHAR(255),
    "count" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAssetAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebAssetMaintenanceWindow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "assetId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(120),
    "reason" VARCHAR(1000),
    "status" "public"."WebAssetMaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notifyEmail" VARCHAR(255),
    "notifySms" VARCHAR(60),
    "lastNotifiedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAssetMaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebAssetAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "public"."WebAssetAlertType" NOT NULL,
    "severity" "public"."WebAssetAlertSeverity" NOT NULL,
    "status" "public"."WebAssetAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "metadata" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "emailNotifiedAt" TIMESTAMP(3),
    "smsNotifiedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAssetAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteAsset_workspaceId_deploymentEnvironment_idx"
ON "public"."WebsiteAsset"("workspaceId", "deploymentEnvironment");

CREATE INDEX "WebAppAsset_workspaceId_deploymentEnvironment_idx"
ON "public"."WebAppAsset"("workspaceId", "deploymentEnvironment");

CREATE INDEX "EcommerceAsset_workspaceId_deploymentEnvironment_idx"
ON "public"."EcommerceAsset"("workspaceId", "deploymentEnvironment");

CREATE INDEX "WebAssetHealthCheck_workspaceId_assetType_assetId_checkedAt_idx"
ON "public"."WebAssetHealthCheck"("workspaceId", "assetType", "assetId", "checkedAt" DESC);

CREATE INDEX "WebAssetHealthCheck_workspaceId_status_checkedAt_idx"
ON "public"."WebAssetHealthCheck"("workspaceId", "status", "checkedAt" DESC);

CREATE INDEX "WebAssetHealthCheck_createdByUserId_idx"
ON "public"."WebAssetHealthCheck"("createdByUserId");

CREATE INDEX "WebAssetSeoReport_workspaceId_assetType_assetId_createdAt_idx"
ON "public"."WebAssetSeoReport"("workspaceId", "assetType", "assetId", "createdAt" DESC);

CREATE INDEX "WebAssetSeoReport_workspaceId_score_createdAt_idx"
ON "public"."WebAssetSeoReport"("workspaceId", "score", "createdAt" DESC);

CREATE INDEX "WebAssetSeoReport_createdByUserId_idx"
ON "public"."WebAssetSeoReport"("createdByUserId");

CREATE INDEX "WebAssetAnalyticsSnapshot_workspaceId_assetType_assetId_periodEnd_idx"
ON "public"."WebAssetAnalyticsSnapshot"("workspaceId", "assetType", "assetId", "periodEnd" DESC);

CREATE INDEX "WebAssetAnalyticsSnapshot_workspaceId_provider_periodEnd_idx"
ON "public"."WebAssetAnalyticsSnapshot"("workspaceId", "provider", "periodEnd" DESC);

CREATE INDEX "WebAssetAnalyticsSnapshot_createdByUserId_idx"
ON "public"."WebAssetAnalyticsSnapshot"("createdByUserId");

CREATE INDEX "WebAssetAnalyticsEvent_workspaceId_assetType_assetId_occurredAt_idx"
ON "public"."WebAssetAnalyticsEvent"("workspaceId", "assetType", "assetId", "occurredAt" DESC);

CREATE INDEX "WebAssetAnalyticsEvent_workspaceId_eventName_occurredAt_idx"
ON "public"."WebAssetAnalyticsEvent"("workspaceId", "eventName", "occurredAt" DESC);

CREATE INDEX "WebAssetAnalyticsEvent_createdByUserId_idx"
ON "public"."WebAssetAnalyticsEvent"("createdByUserId");

CREATE INDEX "WebAssetMaintenanceWindow_workspaceId_assetType_assetId_startsAt_idx"
ON "public"."WebAssetMaintenanceWindow"("workspaceId", "assetType", "assetId", "startsAt" DESC);

CREATE INDEX "WebAssetMaintenanceWindow_workspaceId_status_startsAt_idx"
ON "public"."WebAssetMaintenanceWindow"("workspaceId", "status", "startsAt" DESC);

CREATE INDEX "WebAssetMaintenanceWindow_createdByUserId_idx"
ON "public"."WebAssetMaintenanceWindow"("createdByUserId");

CREATE INDEX "WebAssetMaintenanceWindow_updatedByUserId_idx"
ON "public"."WebAssetMaintenanceWindow"("updatedByUserId");

CREATE INDEX "WebAssetAlert_workspaceId_assetType_assetId_createdAt_idx"
ON "public"."WebAssetAlert"("workspaceId", "assetType", "assetId", "createdAt" DESC);

CREATE INDEX "WebAssetAlert_workspaceId_type_status_createdAt_idx"
ON "public"."WebAssetAlert"("workspaceId", "type", "status", "createdAt" DESC);

CREATE INDEX "WebAssetAlert_createdByUserId_idx"
ON "public"."WebAssetAlert"("createdByUserId");

-- AddForeignKey
ALTER TABLE "public"."WebAssetHealthCheck"
ADD CONSTRAINT "WebAssetHealthCheck_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetHealthCheck"
ADD CONSTRAINT "WebAssetHealthCheck_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetSeoReport"
ADD CONSTRAINT "WebAssetSeoReport_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetSeoReport"
ADD CONSTRAINT "WebAssetSeoReport_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetAnalyticsSnapshot"
ADD CONSTRAINT "WebAssetAnalyticsSnapshot_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetAnalyticsSnapshot"
ADD CONSTRAINT "WebAssetAnalyticsSnapshot_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetAnalyticsEvent"
ADD CONSTRAINT "WebAssetAnalyticsEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetAnalyticsEvent"
ADD CONSTRAINT "WebAssetAnalyticsEvent_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetMaintenanceWindow"
ADD CONSTRAINT "WebAssetMaintenanceWindow_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetMaintenanceWindow"
ADD CONSTRAINT "WebAssetMaintenanceWindow_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetMaintenanceWindow"
ADD CONSTRAINT "WebAssetMaintenanceWindow_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetAlert"
ADD CONSTRAINT "WebAssetAlert_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetAlert"
ADD CONSTRAINT "WebAssetAlert_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
