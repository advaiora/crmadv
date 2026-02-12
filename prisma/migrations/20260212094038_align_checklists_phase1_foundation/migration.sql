-- DropForeignKey
ALTER TABLE "public"."StageChecklistRule" DROP CONSTRAINT "StageChecklistRule_checklistTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StageChecklistRule" DROP CONSTRAINT "StageChecklistRule_workspaceId_fkey";

-- DropIndex
DROP INDEX "public"."ChecklistInstanceItem_instanceId_sortOrderSnapshot_idx";

-- DropIndex
DROP INDEX "public"."ChecklistInstanceItem_workspaceId_idx";

-- DropIndex
DROP INDEX "public"."ChecklistTemplate_workspaceId_name_idx";

-- DropIndex
DROP INDEX "public"."ChecklistTemplateItem_templateId_sortOrder_idx";

-- DropIndex
DROP INDEX "public"."ChecklistTemplateItem_workspaceId_idx";

-- AlterTable
ALTER TABLE "public"."ChecklistInstance" ALTER COLUMN "pipelineStageId" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "public"."ChecklistInstanceItem" DROP COLUMN "isCriticalSnapshot",
DROP COLUMN "isRequiredSnapshot",
DROP COLUMN "requiresEvidenceSnapshot",
DROP COLUMN "sortOrderSnapshot",
DROP COLUMN "titleSnapshot",
DROP COLUMN "state",
ADD COLUMN     "state" VARCHAR(20) NOT NULL DEFAULT 'pending',
ALTER COLUMN "evidenceNote" SET DATA TYPE VARCHAR(1000),
ALTER COLUMN "evidenceUrl" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "notApplicableReason" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "public"."ChecklistTemplate" ALTER COLUMN "name" SET DATA TYPE VARCHAR(80),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "public"."ChecklistTemplateItem" DROP COLUMN "isCritical",
DROP COLUMN "requiresEvidence",
ADD COLUMN     "isCriticalSnapshot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresEvidenceSnapshot" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "title" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(500);

-- Keep runtime status/state constrained to the phase-1 contract values.
ALTER TABLE "public"."ChecklistInstance"
ADD CONSTRAINT "ChecklistInstance_status_check"
CHECK ("status" IN ('active', 'completed'));

ALTER TABLE "public"."ChecklistInstanceItem"
ADD CONSTRAINT "ChecklistInstanceItem_state_check"
CHECK ("state" IN ('pending', 'completed', 'not_applicable'));

-- Enforce requested minimum title/name lengths at DB level.
ALTER TABLE "public"."ChecklistTemplate"
ADD CONSTRAINT "ChecklistTemplate_name_length_check"
CHECK (char_length("name") BETWEEN 2 AND 80);

ALTER TABLE "public"."ChecklistTemplateItem"
ADD CONSTRAINT "ChecklistTemplateItem_title_length_check"
CHECK (char_length("title") BETWEEN 2 AND 120);

ALTER TABLE "public"."ChecklistTemplateItem"
ADD CONSTRAINT "ChecklistTemplateItem_sortOrder_non_negative_check"
CHECK ("sortOrder" >= 0);

-- DropTable
DROP TABLE "public"."StageChecklistRule";

-- DropEnum
DROP TYPE "public"."ChecklistInstanceStatus";

-- DropEnum
DROP TYPE "public"."ChecklistItemState";

-- CreateIndex
CREATE INDEX "ChecklistInstance_workspaceId_pipelineStageId_idx" ON "public"."ChecklistInstance"("workspaceId", "pipelineStageId");

-- CreateIndex
CREATE INDEX "ChecklistInstanceItem_workspaceId_instanceId_idx" ON "public"."ChecklistInstanceItem"("workspaceId", "instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistInstanceItem_workspaceId_instanceId_templateItemId_key" ON "public"."ChecklistInstanceItem"("workspaceId", "instanceId", "templateItemId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_workspaceId_idx" ON "public"."ChecklistTemplate"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_workspaceId_name_key" ON "public"."ChecklistTemplate"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_workspaceId_templateId_idx" ON "public"."ChecklistTemplateItem"("workspaceId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateItem_workspaceId_templateId_sortOrder_key" ON "public"."ChecklistTemplateItem"("workspaceId", "templateId", "sortOrder");

-- Add the project FK when the projects table is available in the target DB.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'Project'
    ) THEN
        ALTER TABLE "public"."ChecklistInstance"
        ADD CONSTRAINT "ChecklistInstance_projectId_fkey"
        FOREIGN KEY ("projectId")
        REFERENCES "public"."Project"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
    END IF;
END $$;


