-- CreateEnum
CREATE TYPE "public"."PerformanceSource" AS ENUM ('GOOGLE_ADS', 'META_ADS', 'EXCEL');

-- CreateEnum
CREATE TYPE "public"."PerformanceScopeLevel" AS ENUM ('ACCOUNT', 'CAMPAIGN_GROUP', 'CAMPAIGN', 'AD_SET');

-- CreateTable
CREATE TABLE "public"."PerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" "public"."PerformanceSource" NOT NULL,
    "sourceLabel" VARCHAR(160),
    "scopeLevel" "public"."PerformanceScopeLevel" NOT NULL DEFAULT 'ACCOUNT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "campaignRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contextEvent" VARCHAR(200),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PerformanceMetricSet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "icon" VARCHAR(60),
    "metrics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceMetricSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_workspaceId_projectId_periodEnd_idx" ON "public"."PerformanceSnapshot"("workspaceId", "projectId", "periodEnd" DESC);

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_workspaceId_source_periodEnd_idx" ON "public"."PerformanceSnapshot"("workspaceId", "source", "periodEnd" DESC);

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_createdByUserId_idx" ON "public"."PerformanceSnapshot"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceMetricSet_workspaceId_name_key" ON "public"."PerformanceMetricSet"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "public"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PerformanceMetricSet" ADD CONSTRAINT "PerformanceMetricSet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PerformanceMetricSet" ADD CONSTRAINT "PerformanceMetricSet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
