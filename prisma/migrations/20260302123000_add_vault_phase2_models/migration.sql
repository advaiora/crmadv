-- CreateTable
CREATE TABLE "public"."VaultItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255),
    "url" VARCHAR(2048),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ciphertext" TEXT NOT NULL,
    "iv" VARCHAR(255) NOT NULL,
    "authTag" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkspaceVaultKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceVaultKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultItem_workspaceId_idx"
ON "public"."VaultItem"("workspaceId");

CREATE INDEX "VaultItem_workspaceId_name_idx"
ON "public"."VaultItem"("workspaceId", "name");

CREATE INDEX "VaultItem_workspaceId_updatedAt_idx"
ON "public"."VaultItem"("workspaceId", "updatedAt" DESC);

CREATE INDEX "VaultItem_createdByUserId_idx"
ON "public"."VaultItem"("createdByUserId");

CREATE INDEX "VaultItem_updatedByUserId_idx"
ON "public"."VaultItem"("updatedByUserId");

CREATE UNIQUE INDEX "WorkspaceVaultKey_workspaceId_key"
ON "public"."WorkspaceVaultKey"("workspaceId");

-- AddForeignKey
ALTER TABLE "public"."VaultItem"
ADD CONSTRAINT "VaultItem_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."VaultItem"
ADD CONSTRAINT "VaultItem_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."VaultItem"
ADD CONSTRAINT "VaultItem_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WorkspaceVaultKey"
ADD CONSTRAINT "WorkspaceVaultKey_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

