-- Add snapshot fields required for checklist runtime stability.
ALTER TABLE "public"."ChecklistInstanceItem"
ADD COLUMN "titleSnapshot" VARCHAR(120),
ADD COLUMN "isRequiredSnapshot" BOOLEAN,
ADD COLUMN "requiresEvidenceSnapshot" BOOLEAN,
ADD COLUMN "isCriticalSnapshot" BOOLEAN,
ADD COLUMN "sortOrderSnapshot" INTEGER;

-- Backfill existing rows from current template item definition.
UPDATE "public"."ChecklistInstanceItem" AS cii
SET
  "titleSnapshot" = COALESCE(cti."title", 'Snapshot item'),
  "isRequiredSnapshot" = COALESCE(cti."isRequired", true),
  "requiresEvidenceSnapshot" = COALESCE(cti."requiresEvidenceSnapshot", false),
  "isCriticalSnapshot" = COALESCE(cti."isCriticalSnapshot", false),
  "sortOrderSnapshot" = COALESCE(cti."sortOrder", 0)
FROM "public"."ChecklistTemplateItem" AS cti
WHERE cii."templateItemId" = cti."id";

UPDATE "public"."ChecklistInstanceItem"
SET
  "titleSnapshot" = COALESCE("titleSnapshot", 'Snapshot item'),
  "isRequiredSnapshot" = COALESCE("isRequiredSnapshot", true),
  "requiresEvidenceSnapshot" = COALESCE("requiresEvidenceSnapshot", false),
  "isCriticalSnapshot" = COALESCE("isCriticalSnapshot", false),
  "sortOrderSnapshot" = COALESCE("sortOrderSnapshot", 0)
WHERE
  "titleSnapshot" IS NULL
  OR "isRequiredSnapshot" IS NULL
  OR "requiresEvidenceSnapshot" IS NULL
  OR "isCriticalSnapshot" IS NULL
  OR "sortOrderSnapshot" IS NULL;

-- Ensure non-null runtime snapshot columns.
ALTER TABLE "public"."ChecklistInstanceItem"
ALTER COLUMN "titleSnapshot" SET NOT NULL,
ALTER COLUMN "isRequiredSnapshot" SET NOT NULL,
ALTER COLUMN "requiresEvidenceSnapshot" SET NOT NULL,
ALTER COLUMN "isCriticalSnapshot" SET NOT NULL,
ALTER COLUMN "sortOrderSnapshot" SET NOT NULL,
ALTER COLUMN "sortOrderSnapshot" SET DEFAULT 0;

-- Basic data guards for snapshot integrity.
ALTER TABLE "public"."ChecklistInstanceItem"
ADD CONSTRAINT "ChecklistInstanceItem_titleSnapshot_length_check"
CHECK (char_length("titleSnapshot") BETWEEN 2 AND 120);

ALTER TABLE "public"."ChecklistInstanceItem"
ADD CONSTRAINT "ChecklistInstanceItem_sortOrderSnapshot_non_negative_check"
CHECK ("sortOrderSnapshot" >= 0);

-- Read optimization for ordered instance item retrieval.
CREATE INDEX "ChecklistInstanceItem_workspaceId_instanceId_sortOrderSnapshot_idx"
ON "public"."ChecklistInstanceItem"("workspaceId", "instanceId", "sortOrderSnapshot");
