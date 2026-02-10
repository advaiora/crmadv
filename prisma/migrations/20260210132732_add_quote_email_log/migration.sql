-- CreateEnum
CREATE TYPE "public"."QuoteEmailLogType" AS ENUM ('send', 'resend');

-- CreateEnum
CREATE TYPE "public"."EmailSendStatus" AS ENUM ('success', 'fail');

-- CreateTable
CREATE TABLE "public"."QuoteEmailLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" "public"."QuoteEmailLogType" NOT NULL,
    "toMasked" TEXT NOT NULL,
    "ccCount" INTEGER NOT NULL DEFAULT 0,
    "bccCount" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT,
    "downloadName" TEXT,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "public"."EmailSendStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteEmailLog_workspaceId_quoteId_createdAt_idx" ON "public"."QuoteEmailLog"("workspaceId", "quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteEmailLog_quoteId_idx" ON "public"."QuoteEmailLog"("quoteId");

-- AddForeignKey
ALTER TABLE "public"."QuoteEmailLog" ADD CONSTRAINT "QuoteEmailLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteEmailLog" ADD CONSTRAINT "QuoteEmailLog_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
