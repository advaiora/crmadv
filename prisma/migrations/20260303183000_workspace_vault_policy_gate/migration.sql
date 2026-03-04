CREATE TABLE "public"."WorkspaceVaultPolicy" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "masterPasswordHash" VARCHAR(255) NOT NULL,
  "passwordVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceVaultPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceVaultPolicy_workspaceId_key"
ON "public"."WorkspaceVaultPolicy"("workspaceId");

CREATE INDEX "WorkspaceVaultPolicy_workspaceId_updatedAt_idx"
ON "public"."WorkspaceVaultPolicy"("workspaceId", "updatedAt" DESC);

ALTER TABLE "public"."WorkspaceVaultPolicy"
ADD CONSTRAINT "WorkspaceVaultPolicy_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;