-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."ProjectClient" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectClient_projectId_clientId_key"
ON "public"."ProjectClient"("projectId", "clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectClient_projectId_createdAt_idx"
ON "public"."ProjectClient"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectClient_clientId_createdAt_idx"
ON "public"."ProjectClient"("clientId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProjectClient_projectId_fkey'
  ) THEN
    ALTER TABLE "public"."ProjectClient"
    ADD CONSTRAINT "ProjectClient_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "public"."Project"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProjectClient_clientId_fkey'
  ) THEN
    ALTER TABLE "public"."ProjectClient"
    ADD CONSTRAINT "ProjectClient_clientId_fkey"
    FOREIGN KEY ("clientId")
    REFERENCES "public"."Client"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill existing project -> client relations
INSERT INTO "public"."ProjectClient" ("id", "projectId", "clientId", "createdAt")
SELECT
  'pc_' || md5("p"."id" || '_' || "p"."clientId"),
  "p"."id",
  "p"."clientId",
  CURRENT_TIMESTAMP
FROM "public"."Project" "p"
WHERE "p"."clientId" IS NOT NULL
ON CONFLICT ("projectId", "clientId") DO NOTHING;