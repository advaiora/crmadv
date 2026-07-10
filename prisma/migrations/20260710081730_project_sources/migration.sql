-- CreateTable
CREATE TABLE "public"."ProjectSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "url" TEXT,
    "fileName" VARCHAR(255),
    "mimeType" VARCHAR(120),
    "fileSize" INTEGER,
    "content" TEXT,
    "contentChars" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSource_workspaceId_projectId_idx" ON "public"."ProjectSource"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectSource_projectId_createdAt_idx" ON "public"."ProjectSource"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."ProjectSource" ADD CONSTRAINT "ProjectSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectSource" ADD CONSTRAINT "ProjectSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
