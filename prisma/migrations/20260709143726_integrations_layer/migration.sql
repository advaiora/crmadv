-- CreateTable
CREATE TABLE "public"."Integration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB,
    "ciphertext" TEXT,
    "iv" VARCHAR(255),
    "authTag" VARCHAR(255),
    "keyVersion" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" VARCHAR(30),
    "lastSyncMessage" TEXT,
    "lastSyncStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Integration_workspaceId_idx" ON "public"."Integration"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_workspaceId_provider_key" ON "public"."Integration"("workspaceId", "provider");

-- AddForeignKey
ALTER TABLE "public"."Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
