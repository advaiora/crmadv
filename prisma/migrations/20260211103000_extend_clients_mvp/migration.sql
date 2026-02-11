-- CreateEnum
CREATE TYPE "public"."ClientType" AS ENUM ('person', 'company');

-- AlterTable
ALTER TABLE "public"."Client"
ADD COLUMN "type" "public"."ClientType" NOT NULL DEFAULT 'person',
ADD COLUMN "vatNumber" TEXT,
ADD COLUMN "taxCode" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "zip" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Client_workspaceId_updatedAt_idx" ON "public"."Client"("workspaceId", "updatedAt");
