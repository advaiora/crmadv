-- CreateEnum
CREATE TYPE "public"."AgencyProjectStatus" AS ENUM ('DISCOVERY', 'PLANNING', 'PRODUCTION', 'REVIEW', 'LIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."AgencyPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."ProjectAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."ProjectAlertStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'SUGGESTED');

-- CreateEnum
CREATE TYPE "public"."ProjectOpportunityStatus" AS ENUM ('OPEN', 'PROPOSED', 'WON', 'LOST', 'SUGGESTED');

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "priorityAgency" "public"."AgencyPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "projectTypeId" TEXT,
ADD COLUMN     "scopePurchased" JSONB,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "statusAgency" "public"."AgencyProjectStatus" NOT NULL DEFAULT 'DISCOVERY';

-- AlterTable
ALTER TABLE "public"."TeamInvite" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "themePreference" VARCHAR(10),
ALTER COLUMN "vaultPasswordHash" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."WorkspaceVaultPolicy" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."ProjectType" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectActiveModule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "moduleLabel" TEXT,
    "included" BOOLEAN NOT NULL DEFAULT false,
    "suggested" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectActiveModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectMemory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "briefJson" JSONB,
    "sourcesJson" JSONB,
    "webJson" JSONB,
    "adsJson" JSONB,
    "diagnosisJson" JSONB,
    "reportsJson" JSONB,
    "contextSummary" TEXT,
    "memorySummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "severity" "public"."ProjectAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "public"."AgencyPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."ProjectAlertStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectOpportunity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT,
    "estimatedValue" DECIMAL(12,2),
    "status" "public"."ProjectOpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "category" TEXT,
    "type" TEXT,
    "rationale" TEXT,
    "priority" "public"."AgencyPriority",
    "score" INTEGER,
    "impactLevel" "public"."AgencyPriority",
    "sourceModule" TEXT,
    "sourceSignalKey" TEXT,
    "dedupKey" TEXT,
    "suggestedService" TEXT,
    "lastEvaluatedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProjectTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "teamRole" TEXT NOT NULL,
    "priority" "public"."AgencyPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "dependsOnTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgencyRuntimeSetting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "valueJson" JSONB,
    "ciphertext" TEXT,
    "iv" VARCHAR(255),
    "authTag" VARCHAR(255),
    "keyVersion" INTEGER,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyRuntimeSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectType_workspaceId_label_idx" ON "public"."ProjectType"("workspaceId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectType_workspaceId_key_key" ON "public"."ProjectType"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "ProjectActiveModule_workspaceId_projectId_idx" ON "public"."ProjectActiveModule"("workspaceId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectActiveModule_projectId_moduleKey_key" ON "public"."ProjectActiveModule"("projectId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMemory_projectId_key" ON "public"."ProjectMemory"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMemory_workspaceId_projectId_idx" ON "public"."ProjectMemory"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectAlert_workspaceId_projectId_status_idx" ON "public"."ProjectAlert"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectOpportunity_workspaceId_projectId_status_idx" ON "public"."ProjectOpportunity"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectTask_workspaceId_projectId_status_idx" ON "public"."ProjectTask"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectTask_workspaceId_teamRole_status_idx" ON "public"."ProjectTask"("workspaceId", "teamRole", "status");

-- CreateIndex
CREATE INDEX "AgencyRuntimeSetting_workspaceId_idx" ON "public"."AgencyRuntimeSetting"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyRuntimeSetting_workspaceId_key_key" ON "public"."AgencyRuntimeSetting"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "Project_workspaceId_projectTypeId_idx" ON "public"."Project"("workspaceId", "projectTypeId");

-- CreateIndex
CREATE INDEX "StageChecklistRule_workspaceId_projectCategoryId_pipelineSt_idx" ON "public"."StageChecklistRule"("workspaceId", "projectCategoryId", "pipelineStageId", "gateEnabled");

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "public"."ProjectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectType" ADD CONSTRAINT "ProjectType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectActiveModule" ADD CONSTRAINT "ProjectActiveModule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectActiveModule" ADD CONSTRAINT "ProjectActiveModule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectMemory" ADD CONSTRAINT "ProjectMemory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectMemory" ADD CONSTRAINT "ProjectMemory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectAlert" ADD CONSTRAINT "ProjectAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectAlert" ADD CONSTRAINT "ProjectAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectOpportunity" ADD CONSTRAINT "ProjectOpportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectOpportunity" ADD CONSTRAINT "ProjectOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectTask" ADD CONSTRAINT "ProjectTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectTask" ADD CONSTRAINT "ProjectTask_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "public"."ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgencyRuntimeSetting" ADD CONSTRAINT "AgencyRuntimeSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."StageChecklistRule_workspaceId_projectCategoryId_pipelineStageI" RENAME TO "StageChecklistRule_workspaceId_projectCategoryId_pipelineSt_key";

-- RenameIndex
ALTER INDEX "public"."WebAssetAnalyticsEvent_workspaceId_assetType_assetId_occurredAt" RENAME TO "WebAssetAnalyticsEvent_workspaceId_assetType_assetId_occurr_idx";

-- RenameIndex
ALTER INDEX "public"."WebAssetAnalyticsSnapshot_workspaceId_assetType_assetId_periodE" RENAME TO "WebAssetAnalyticsSnapshot_workspaceId_assetType_assetId_per_idx";

-- RenameIndex
ALTER INDEX "public"."WebAssetMaintenanceWindow_workspaceId_assetType_assetId_startsA" RENAME TO "WebAssetMaintenanceWindow_workspaceId_assetType_assetId_sta_idx";

-- RenameIndex
ALTER INDEX "public"."WorkspaceMessage_workspaceId_recipientUserId_readAt_createdAt_i" RENAME TO "WorkspaceMessage_workspaceId_recipientUserId_readAt_created_idx";

-- RenameIndex
ALTER INDEX "public"."WorkspaceMessage_workspaceId_senderUserId_recipientUserId_creat" RENAME TO "WorkspaceMessage_workspaceId_senderUserId_recipientUserId_c_idx";
