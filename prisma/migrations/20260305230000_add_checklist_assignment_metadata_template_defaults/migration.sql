ALTER TABLE "public"."ChecklistTemplateItem"
ADD COLUMN "defaultAssignedToUserId" TEXT;

ALTER TABLE "public"."ChecklistTemplateItem"
ADD CONSTRAINT "ChecklistTemplateItem_defaultAssignedToUserId_fkey"
FOREIGN KEY ("defaultAssignedToUserId") REFERENCES "public"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ChecklistTemplateItem_workspaceId_defaultAssignedToUserId_idx"
ON "public"."ChecklistTemplateItem"("workspaceId", "defaultAssignedToUserId");

ALTER TABLE "public"."ChecklistInstanceItem"
ADD COLUMN "assignedByUserId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3);

ALTER TABLE "public"."ChecklistInstanceItem"
ADD CONSTRAINT "ChecklistInstanceItem_assignedByUserId_fkey"
FOREIGN KEY ("assignedByUserId") REFERENCES "public"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ChecklistInstanceItem_workspaceId_state_idx"
ON "public"."ChecklistInstanceItem"("workspaceId", "state");
