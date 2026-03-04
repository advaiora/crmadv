-- Add client association to vault items
ALTER TABLE "public"."VaultItem"
ADD COLUMN IF NOT EXISTS "clientId" TEXT;

CREATE INDEX IF NOT EXISTS "VaultItem_workspaceId_clientId_idx"
ON "public"."VaultItem"("workspaceId", "clientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VaultItem_clientId_fkey'
  ) THEN
    ALTER TABLE "public"."VaultItem"
    ADD CONSTRAINT "VaultItem_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
