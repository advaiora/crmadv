-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_workspaceId_name_idx" ON "public"."Client"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Client_workspaceId_email_idx" ON "public"."Client"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Client_workspaceId_phone_idx" ON "public"."Client"("workspaceId", "phone");

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
