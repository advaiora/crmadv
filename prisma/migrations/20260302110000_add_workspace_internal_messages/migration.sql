-- CreateTable
CREATE TABLE "WorkspaceMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceMessage_workspaceId_senderUserId_recipientUserId_createdAt_idx"
ON "WorkspaceMessage"("workspaceId", "senderUserId", "recipientUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WorkspaceMessage_workspaceId_recipientUserId_readAt_createdAt_idx"
ON "WorkspaceMessage"("workspaceId", "recipientUserId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WorkspaceMessage_workspaceId_createdAt_idx"
ON "WorkspaceMessage"("workspaceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "WorkspaceMessage"
ADD CONSTRAINT "WorkspaceMessage_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessage"
ADD CONSTRAINT "WorkspaceMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessage"
ADD CONSTRAINT "WorkspaceMessage_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;