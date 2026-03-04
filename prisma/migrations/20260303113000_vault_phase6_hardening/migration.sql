-- VaultItem key-version binding for DEK selection during decrypt
ALTER TABLE "public"."VaultItem"
ADD COLUMN "keyVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "VaultItem_workspaceId_keyVersion_idx"
ON "public"."VaultItem"("workspaceId", "keyVersion");

-- WorkspaceVaultKey supports version history for key rotation without immediate re-encryption
ALTER TABLE "public"."WorkspaceVaultKey"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "WorkspaceVaultKey_workspaceId_key";

CREATE UNIQUE INDEX "WorkspaceVaultKey_workspaceId_keyVersion_key"
ON "public"."WorkspaceVaultKey"("workspaceId", "keyVersion");

CREATE INDEX "WorkspaceVaultKey_workspaceId_isActive_idx"
ON "public"."WorkspaceVaultKey"("workspaceId", "isActive");

