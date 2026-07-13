-- Estensione pgvector: necessaria per il tipo `vector`. Idempotente.
-- Va installata a livello di cluster (vedi scripts/install-pgvector-win.ps1).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "public"."ProjectSourceChunk" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSourceChunk_sourceId_chunkIndex_idx" ON "public"."ProjectSourceChunk"("sourceId", "chunkIndex");

-- CreateIndex
CREATE INDEX "ProjectSourceChunk_workspaceId_projectId_idx" ON "public"."ProjectSourceChunk"("workspaceId", "projectId");

-- AddForeignKey
ALTER TABLE "public"."ProjectSourceChunk" ADD CONSTRAINT "ProjectSourceChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."ProjectSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
