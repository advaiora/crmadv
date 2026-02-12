DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PipelineStage'
  ) THEN
    ALTER TABLE "public"."PipelineStage"
    ADD COLUMN IF NOT EXISTS "isGated" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "gateChecklistTemplateId" TEXT,
    ADD COLUMN IF NOT EXISTS "autoCreateInstance" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PipelineStage'
  ) THEN
    CREATE INDEX IF NOT EXISTS "PipelineStage_workspaceId_isGated_idx"
    ON "public"."PipelineStage"("workspaceId", "isGated");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PipelineStage'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ChecklistTemplate'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PipelineStage_gateChecklistTemplateId_fkey'
  ) THEN
    ALTER TABLE "public"."PipelineStage"
    ADD CONSTRAINT "PipelineStage_gateChecklistTemplateId_fkey"
    FOREIGN KEY ("gateChecklistTemplateId")
    REFERENCES "public"."ChecklistTemplate"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PipelineStage'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PipelineStage_gated_requires_template_check'
  ) THEN
    ALTER TABLE "public"."PipelineStage"
    ADD CONSTRAINT "PipelineStage_gated_requires_template_check"
    CHECK (NOT "isGated" OR "gateChecklistTemplateId" IS NOT NULL);
  END IF;
END $$;
