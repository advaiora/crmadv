-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "googleSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key"
ON "public"."User"("googleSub");
