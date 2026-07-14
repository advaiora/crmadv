/*
  Warnings:

  - You are about to drop the `ProjectChatMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ProjectChatMessage" DROP CONSTRAINT "ProjectChatMessage_projectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProjectChatMessage" DROP CONSTRAINT "ProjectChatMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProjectChatMessage" DROP CONSTRAINT "ProjectChatMessage_workspaceId_fkey";

-- DropTable
DROP TABLE "public"."ProjectChatMessage";

-- CreateTable
CREATE TABLE "public"."AiConversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scope" VARCHAR(16) NOT NULL DEFAULT 'project',
    "projectId" TEXT,
    "title" VARCHAR(200),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiConversationParticipant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" VARCHAR(16) NOT NULL DEFAULT 'member',
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiConversationMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "citationsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConversation_workspaceId_scope_idx" ON "public"."AiConversation"("workspaceId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "AiConversation_projectId_key" ON "public"."AiConversation"("projectId");

-- CreateIndex
CREATE INDEX "AiConversationParticipant_workspaceId_userId_idx" ON "public"."AiConversationParticipant"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "AiConversationParticipant_userId_idx" ON "public"."AiConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiConversationParticipant_conversationId_userId_key" ON "public"."AiConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "AiConversationMessage_conversationId_createdAt_idx" ON "public"."AiConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiConversationMessage_workspaceId_idx" ON "public"."AiConversationMessage"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."AiConversation" ADD CONSTRAINT "AiConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversation" ADD CONSTRAINT "AiConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversation" ADD CONSTRAINT "AiConversation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationParticipant" ADD CONSTRAINT "AiConversationParticipant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationParticipant" ADD CONSTRAINT "AiConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationParticipant" ADD CONSTRAINT "AiConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationParticipant" ADD CONSTRAINT "AiConversationParticipant_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationMessage" ADD CONSTRAINT "AiConversationMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationMessage" ADD CONSTRAINT "AiConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversationMessage" ADD CONSTRAINT "AiConversationMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
