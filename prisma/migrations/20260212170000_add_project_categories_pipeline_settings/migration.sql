-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."ProjectCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCategory_workspaceId_name_key"
ON "public"."ProjectCategory"("workspaceId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectCategory_workspaceId_sortOrder_idx"
ON "public"."ProjectCategory"("workspaceId", "sortOrder");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProjectCategory_workspaceId_fkey'
  ) THEN
    ALTER TABLE "public"."ProjectCategory"
    ADD CONSTRAINT "ProjectCategory_workspaceId_fkey"
    FOREIGN KEY ("workspaceId")
    REFERENCES "public"."Workspace"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PipelineStage'
  ) THEN
    ALTER TABLE "public"."PipelineStage"
    ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
    ADD COLUMN IF NOT EXISTS "isClosed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "color" TEXT;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PipelineStage_workspaceId_categoryId_sortOrder_idx"
ON "public"."PipelineStage"("workspaceId", "categoryId", "sortOrder");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PipelineStage_categoryId_fkey'
  ) THEN
    ALTER TABLE "public"."PipelineStage"
    ADD CONSTRAINT "PipelineStage_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "public"."ProjectCategory"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill one default category per workspace when missing.
INSERT INTO "public"."ProjectCategory" ("id", "workspaceId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
  'pc_' || substr(md5(w."id" || random()::text || clock_timestamp()::text), 1, 24),
  w."id",
  'Pipeline',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Workspace" w
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."ProjectCategory" pc
  WHERE pc."workspaceId" = w."id"
);

-- Backfill categoryId on existing stages.
WITH first_category AS (
  SELECT DISTINCT ON (pc."workspaceId")
    pc."workspaceId",
    pc."id"
  FROM "public"."ProjectCategory" pc
  ORDER BY pc."workspaceId", pc."sortOrder" ASC, pc."name" ASC, pc."createdAt" ASC
)
UPDATE "public"."PipelineStage" ps
SET "categoryId" = fc."id"
FROM first_category fc
WHERE ps."workspaceId" = fc."workspaceId"
  AND ps."categoryId" IS NULL;
