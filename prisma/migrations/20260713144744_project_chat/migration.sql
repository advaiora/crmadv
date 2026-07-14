-- CreateTable
CREATE TABLE "public"."ProjectChatMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "citationsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectChatMessage_workspaceId_projectId_userId_createdAt_idx" ON "public"."ProjectChatMessage"("workspaceId", "projectId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectChatMessage_projectId_createdAt_idx" ON "public"."ProjectChatMessage"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
