-- AlterTable
ALTER TABLE "public"."AiConversation" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "AiConversation_workspaceId_clientId_idx" ON "public"."AiConversation"("workspaceId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AiConversation_clientId_key" ON "public"."AiConversation"("clientId");

-- AddForeignKey
ALTER TABLE "public"."AiConversation" ADD CONSTRAINT "AiConversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
