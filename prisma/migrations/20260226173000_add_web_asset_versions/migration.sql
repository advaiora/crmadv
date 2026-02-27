-- CreateEnum
CREATE TYPE "public"."WebAssetVersionStatus" AS ENUM ('DRAFT', 'STAGED', 'LIVE');

-- CreateTable
CREATE TABLE "public"."WebAssetVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "assetId" TEXT NOT NULL,
    "versionNumber" VARCHAR(64),
    "versionStatus" "public"."WebAssetVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "changelog" VARCHAR(2000),
    "sourceAction" VARCHAR(60) NOT NULL,
    "isRollback" BOOLEAN NOT NULL DEFAULT false,
    "sourceVersionId" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebAssetVersion_workspaceId_assetType_assetId_createdAt_idx"
ON "public"."WebAssetVersion"("workspaceId", "assetType", "assetId", "createdAt" DESC);

CREATE INDEX "WebAssetVersion_workspaceId_createdAt_idx"
ON "public"."WebAssetVersion"("workspaceId", "createdAt" DESC);

CREATE INDEX "WebAssetVersion_createdByUserId_idx"
ON "public"."WebAssetVersion"("createdByUserId");

-- AddForeignKey
ALTER TABLE "public"."WebAssetVersion"
ADD CONSTRAINT "WebAssetVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAssetVersion"
ADD CONSTRAINT "WebAssetVersion_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
