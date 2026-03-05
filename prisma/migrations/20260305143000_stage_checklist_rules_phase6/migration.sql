-- Add checklist target enum and template applicability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ChecklistTemplateAppliesTo'
  ) THEN
    CREATE TYPE "ChecklistTemplateAppliesTo" AS ENUM ('PROJECT_STAGE', 'WEB_ASSET_STATUS');
  END IF;
END $$;

ALTER TABLE "ChecklistTemplate"
ADD COLUMN IF NOT EXISTS "appliesTo" "ChecklistTemplateAppliesTo" NOT NULL DEFAULT 'PROJECT_STAGE';

-- Keep current checklist instance compatibility while allowing future web-asset binding
ALTER TABLE "ChecklistInstance"
ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ChecklistInstance"
ALTER COLUMN "pipelineStageId" DROP NOT NULL;

ALTER TABLE "ChecklistInstance"
ADD COLUMN IF NOT EXISTS "webAssetId" TEXT;

CREATE INDEX IF NOT EXISTS "ChecklistInstance_workspaceId_webAssetId_idx"
ON "ChecklistInstance"("workspaceId", "webAssetId");

-- Stage checklist rules (category+stage => many templates)
CREATE TABLE IF NOT EXISTS "StageChecklistRule" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectCategoryId" TEXT NOT NULL,
  "pipelineStageId" TEXT NOT NULL,
  "checklistTemplateId" TEXT NOT NULL,
  "gateEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StageChecklistRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StageChecklistRule_workspaceId_projectCategoryId_pipelineStageId_checklistTemplateId_key"
ON "StageChecklistRule"("workspaceId", "projectCategoryId", "pipelineStageId", "checklistTemplateId");

CREATE INDEX IF NOT EXISTS "StageChecklistRule_workspaceId_projectCategoryId_pipelineStageId_gateEnabled_idx"
ON "StageChecklistRule"("workspaceId", "projectCategoryId", "pipelineStageId", "gateEnabled");

CREATE INDEX IF NOT EXISTS "StageChecklistRule_workspaceId_pipelineStageId_idx"
ON "StageChecklistRule"("workspaceId", "pipelineStageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StageChecklistRule_workspaceId_fkey'
  ) THEN
    ALTER TABLE "StageChecklistRule"
    ADD CONSTRAINT "StageChecklistRule_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StageChecklistRule_projectCategoryId_fkey'
  ) THEN
    ALTER TABLE "StageChecklistRule"
    ADD CONSTRAINT "StageChecklistRule_projectCategoryId_fkey"
    FOREIGN KEY ("projectCategoryId") REFERENCES "ProjectCategory"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StageChecklistRule_pipelineStageId_fkey'
  ) THEN
    ALTER TABLE "StageChecklistRule"
    ADD CONSTRAINT "StageChecklistRule_pipelineStageId_fkey"
    FOREIGN KEY ("pipelineStageId") REFERENCES "PipelineStage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StageChecklistRule_checklistTemplateId_fkey'
  ) THEN
    ALTER TABLE "StageChecklistRule"
    ADD CONSTRAINT "StageChecklistRule_checklistTemplateId_fkey"
    FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
