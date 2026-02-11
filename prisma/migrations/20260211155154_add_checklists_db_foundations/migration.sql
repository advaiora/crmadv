-- CreateEnum
CREATE TYPE "public"."ChecklistInstanceStatus" AS ENUM ('active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "public"."ChecklistItemState" AS ENUM ('pending', 'completed', 'not_applicable');

-- CreateTable
CREATE TABLE "public"."ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StageChecklistRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pipelineStageId" TEXT NOT NULL,
    "checklistTemplateId" TEXT NOT NULL,
    "isBlocking" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateInstance" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageChecklistRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistInstance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pipelineStageId" TEXT,
    "checklistTemplateId" TEXT NOT NULL,
    "status" "public"."ChecklistInstanceStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistInstanceItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "isRequiredSnapshot" BOOLEAN NOT NULL,
    "requiresEvidenceSnapshot" BOOLEAN NOT NULL,
    "isCriticalSnapshot" BOOLEAN NOT NULL,
    "sortOrderSnapshot" INTEGER NOT NULL,
    "state" "public"."ChecklistItemState" NOT NULL DEFAULT 'pending',
    "evidenceNote" TEXT,
    "evidenceUrl" TEXT,
    "notApplicableReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistInstanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTemplate_workspaceId_name_idx" ON "public"."ChecklistTemplate"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_sortOrder_idx" ON "public"."ChecklistTemplateItem"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_workspaceId_idx" ON "public"."ChecklistTemplateItem"("workspaceId");

-- CreateIndex
CREATE INDEX "StageChecklistRule_workspaceId_idx" ON "public"."StageChecklistRule"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StageChecklistRule_workspaceId_pipelineStageId_key" ON "public"."StageChecklistRule"("workspaceId", "pipelineStageId");

-- CreateIndex
CREATE INDEX "ChecklistInstance_workspaceId_projectId_idx" ON "public"."ChecklistInstance"("workspaceId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistInstance_workspaceId_projectId_pipelineStageId_che_key" ON "public"."ChecklistInstance"("workspaceId", "projectId", "pipelineStageId", "checklistTemplateId");

-- CreateIndex
CREATE INDEX "ChecklistInstanceItem_instanceId_sortOrderSnapshot_idx" ON "public"."ChecklistInstanceItem"("instanceId", "sortOrderSnapshot");

-- CreateIndex
CREATE INDEX "ChecklistInstanceItem_workspaceId_idx" ON "public"."ChecklistInstanceItem"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StageChecklistRule" ADD CONSTRAINT "StageChecklistRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StageChecklistRule" ADD CONSTRAINT "StageChecklistRule_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "public"."ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "public"."ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistInstanceItem" ADD CONSTRAINT "ChecklistInstanceItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistInstanceItem" ADD CONSTRAINT "ChecklistInstanceItem_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."ChecklistInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistInstanceItem" ADD CONSTRAINT "ChecklistInstanceItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "public"."ChecklistTemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistInstanceItem" ADD CONSTRAINT "ChecklistInstanceItem_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
