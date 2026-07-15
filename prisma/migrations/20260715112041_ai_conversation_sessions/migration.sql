-- DropIndex
DROP INDEX "public"."AiConversation_clientId_key";

-- DropIndex
DROP INDEX "public"."AiConversation_projectId_key";

-- AlterTable
ALTER TABLE "public"."AiConversation" ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "resumedFromConversationId" TEXT;

-- AlterTable
ALTER TABLE "public"."AiConversationParticipant" ADD COLUMN     "frozenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AiConversation_workspaceId_projectId_idx" ON "public"."AiConversation"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "AiConversation_resumedFromConversationId_idx" ON "public"."AiConversation"("resumedFromConversationId");

-- AddForeignKey
ALTER TABLE "public"."AiConversation" ADD CONSTRAINT "AiConversation_resumedFromConversationId_fkey" FOREIGN KEY ("resumedFromConversationId") REFERENCES "public"."AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
