-- CreateTable
CREATE TABLE "public"."AiBudget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLimitUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiBudget_workspaceId_idx" ON "public"."AiBudget"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AiBudget_workspaceId_userId_key" ON "public"."AiBudget"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "public"."AiBudget" ADD CONSTRAINT "AiBudget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
