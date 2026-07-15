-- AlterTable
ALTER TABLE "public"."AiUsageLog" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "AiUsageLog_projectId_createdAt_idx" ON "public"."AiUsageLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_conversationId_createdAt_idx" ON "public"."AiUsageLog"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."AiUsageLog" ADD CONSTRAINT "AiUsageLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiUsageLog" ADD CONSTRAINT "AiUsageLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
