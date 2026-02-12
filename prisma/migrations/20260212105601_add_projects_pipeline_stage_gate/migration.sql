-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pipelineStageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PipelineStage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isGated" BOOLEAN NOT NULL DEFAULT false,
    "gateChecklistTemplateId" TEXT,
    "autoCreateInstance" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_workspaceId_name_idx" ON "public"."Project"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Project_workspaceId_pipelineStageId_idx" ON "public"."Project"("workspaceId", "pipelineStageId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_updatedAt_idx" ON "public"."Project"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "PipelineStage_workspaceId_name_idx" ON "public"."PipelineStage"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "PipelineStage_workspaceId_sortOrder_idx" ON "public"."PipelineStage"("workspaceId", "sortOrder");

-- CreateIndex
CREATE INDEX "PipelineStage_workspaceId_isGated_idx" ON "public"."PipelineStage"("workspaceId", "isGated");

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "public"."PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PipelineStage" ADD CONSTRAINT "PipelineStage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PipelineStage" ADD CONSTRAINT "PipelineStage_gateChecklistTemplateId_fkey" FOREIGN KEY ("gateChecklistTemplateId") REFERENCES "public"."ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."ChecklistInstanceItem_workspaceId_instanceId_sortOrderSnapshot_" RENAME TO "ChecklistInstanceItem_workspaceId_instanceId_sortOrderSnaps_idx";
