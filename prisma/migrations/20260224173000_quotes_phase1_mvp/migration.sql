-- CreateEnum
CREATE TYPE "public"."QuoteDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- Redefine QuoteStatus enum to uppercase values and extended states
CREATE TYPE "public"."QuoteStatus_new" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

ALTER TABLE "public"."Quote" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Quote"
ALTER COLUMN "status" TYPE "public"."QuoteStatus_new"
USING (
  CASE "status"::text
    WHEN 'draft' THEN 'DRAFT'
    WHEN 'sent' THEN 'SENT'
    WHEN 'accepted' THEN 'ACCEPTED'
    WHEN 'rejected' THEN 'REJECTED'
    WHEN 'expired' THEN 'EXPIRED'
    ELSE 'DRAFT'
  END
)::"public"."QuoteStatus_new";

DROP TYPE "public"."QuoteStatus";
ALTER TYPE "public"."QuoteStatus_new" RENAME TO "QuoteStatus";
ALTER TABLE "public"."Quote" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Quote table extensions
ALTER TABLE "public"."Quote"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  ADD COLUMN "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(5,2),
  ADD COLUMN "issueDate" TIMESTAMP(3),
  ADD COLUMN "validUntil" TIMESTAMP(3),
  ADD COLUMN "internalNotes" TEXT;

UPDATE "public"."Quote"
SET
  "subtotal" = COALESCE("total", 0),
  "taxTotal" = 0;

-- Enforce mandatory quote->client relation
DELETE FROM "public"."Quote" WHERE "clientId" IS NULL;
ALTER TABLE "public"."Quote" ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "public"."Quote"
  DROP COLUMN "clientName",
  DROP COLUMN "clientEmail",
  DROP COLUMN "clientPhone";

ALTER TABLE "public"."Quote" ALTER COLUMN "subtotal" DROP DEFAULT;
ALTER TABLE "public"."Quote" ALTER COLUMN "taxTotal" DROP DEFAULT;

-- Rename QuoteLine to QuoteItem and reshape columns
ALTER TABLE "public"."QuoteLine" RENAME TO "QuoteItem";
ALTER INDEX "public"."QuoteLine_pkey" RENAME TO "QuoteItem_pkey";

ALTER TABLE "public"."QuoteItem"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "position" INTEGER,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "quantity" DECIMAL(12,2),
  ADD COLUMN "discountType" "public"."QuoteDiscountType",
  ADD COLUMN "discountValue" DECIMAL(12,2),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "public"."QuoteItem" qi
SET
  "workspaceId" = q."workspaceId",
  "quantity" = qi."qty"::DECIMAL(12,2),
  "lineTotal" = COALESCE(qi."lineTotal", (qi."qty"::DECIMAL(12,2) * qi."unitPrice"))
FROM "public"."Quote" q
WHERE qi."quoteId" = q."id";

WITH ranked_items AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "quoteId"
      ORDER BY COALESCE("order", 2147483647), "id"
    ) AS "nextPosition"
  FROM "public"."QuoteItem"
)
UPDATE "public"."QuoteItem" qi
SET "position" = ranked_items."nextPosition"
FROM ranked_items
WHERE qi."id" = ranked_items."id";

ALTER TABLE "public"."QuoteItem" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "public"."QuoteItem" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "public"."QuoteItem" ALTER COLUMN "quantity" SET NOT NULL;
ALTER TABLE "public"."QuoteItem" ALTER COLUMN "lineTotal" SET NOT NULL;
ALTER TABLE "public"."QuoteItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "public"."QuoteItem"
  DROP COLUMN "qty",
  DROP COLUMN "order";

DROP INDEX IF EXISTS "public"."QuoteLine_quoteId_idx";
DROP INDEX IF EXISTS "public"."QuoteItem_quoteId_idx";

-- Create QuoteTemplate tables
CREATE TABLE "public"."QuoteTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "defaultNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."QuoteTemplateItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "discountType" "public"."QuoteDiscountType",
  "discountValue" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteTemplateItem_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Quote_workspaceId_clientId_idx" ON "public"."Quote"("workspaceId", "clientId");
CREATE INDEX IF NOT EXISTS "Quote_workspaceId_projectId_idx" ON "public"."Quote"("workspaceId", "projectId");
CREATE INDEX IF NOT EXISTS "Quote_workspaceId_templateId_idx" ON "public"."Quote"("workspaceId", "templateId");

CREATE INDEX "QuoteItem_workspaceId_quoteId_idx" ON "public"."QuoteItem"("workspaceId", "quoteId");
CREATE INDEX "QuoteItem_quoteId_position_idx" ON "public"."QuoteItem"("quoteId", "position");

CREATE UNIQUE INDEX "QuoteTemplate_workspaceId_name_key" ON "public"."QuoteTemplate"("workspaceId", "name");
CREATE INDEX "QuoteTemplate_workspaceId_updatedAt_idx" ON "public"."QuoteTemplate"("workspaceId", "updatedAt");

CREATE INDEX "QuoteTemplateItem_workspaceId_templateId_idx" ON "public"."QuoteTemplateItem"("workspaceId", "templateId");
CREATE INDEX "QuoteTemplateItem_templateId_position_idx" ON "public"."QuoteTemplateItem"("templateId", "position");

-- Foreign keys
ALTER TABLE "public"."Quote" DROP CONSTRAINT IF EXISTS "Quote_clientId_fkey";
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "public"."QuoteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."QuoteItem" DROP CONSTRAINT IF EXISTS "QuoteLine_quoteId_fkey";
ALTER TABLE "public"."QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."QuoteItem" ADD CONSTRAINT "QuoteItem_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."QuoteTemplateItem" ADD CONSTRAINT "QuoteTemplateItem_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."QuoteTemplateItem" ADD CONSTRAINT "QuoteTemplateItem_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "public"."QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
