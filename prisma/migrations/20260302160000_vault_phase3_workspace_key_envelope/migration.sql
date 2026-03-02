-- AlterTable
ALTER TABLE "public"."WorkspaceVaultKey"
ADD COLUMN "iv" VARCHAR(255),
ADD COLUMN "authTag" VARCHAR(255);
