-- Extend workspace branding with PDF/footer fields
ALTER TABLE "public"."WorkspaceBranding"
  ADD COLUMN IF NOT EXISTS "supportPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "supportAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfSignatureUrl" TEXT;

-- Create quote notification settings per workspace
CREATE TABLE IF NOT EXISTS "public"."QuoteNotificationSettings" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sentSubject" TEXT,
  "sentBody" TEXT,
  "acceptedSubject" TEXT,
  "acceptedBody" TEXT,
  "rejectedSubject" TEXT,
  "rejectedBody" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteNotificationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuoteNotificationSettings_workspaceId_key"
  ON "public"."QuoteNotificationSettings"("workspaceId");

ALTER TABLE "public"."QuoteNotificationSettings"
  ADD CONSTRAINT "QuoteNotificationSettings_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
