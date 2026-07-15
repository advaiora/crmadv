-- CreateTable
CREATE TABLE "public"."AiConversationAttachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "createdByUserId" TEXT,
    "kind" VARCHAR(16) NOT NULL,
    "entityType" VARCHAR(24),
    "entityId" TEXT,
    "label" VARCHAR(200) NOT NULL,
    "mimeType" VARCHAR(120),
    "fileSize" INTEGER,
    "content" TEXT NOT NULL,
    "contentChars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConversationAttachment_messageId_idx" ON "public"."AiConversationAttachment"("messageId");

-- CreateIndex
CREATE INDEX "AiConversationAttachment_conversationId_createdByUserId_mes_idx" ON "public"."AiConversationAttachment"("conversationId", "createdByUserId", "messageId");

-- CreateIndex
CREATE INDEX "AiConversationAttachment_workspaceId_idx" ON "public"."AiConversationAttachment"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."AiConversationAttachment" ADD CONSTRAINT "AiConversationAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationAttachment" ADD CONSTRAINT "AiConversationAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationAttachment" ADD CONSTRAINT "AiConversationAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."AiConversationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationAttachment" ADD CONSTRAINT "AiConversationAttachment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
