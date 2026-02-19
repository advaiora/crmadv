-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Project'
  ) THEN
    ALTER TABLE "public"."Project"
    ADD COLUMN IF NOT EXISTS "clientId" TEXT;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_workspaceId_clientId_idx"
ON "public"."Project"("workspaceId", "clientId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Project_clientId_fkey'
  ) THEN
    ALTER TABLE "public"."Project"
    ADD CONSTRAINT "Project_clientId_fkey"
    FOREIGN KEY ("clientId")
    REFERENCES "public"."Client"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
