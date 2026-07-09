-- AlterTable
ALTER TABLE "public"."AiUsageLog" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "public"."AiUsageLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
