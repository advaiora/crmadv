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
    ADD COLUMN IF NOT EXISTS "description" TEXT,
    ADD COLUMN IF NOT EXISTS "value" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
  END IF;
END $$;
