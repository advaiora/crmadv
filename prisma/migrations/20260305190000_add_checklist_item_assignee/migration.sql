ALTER TABLE "public"."ChecklistInstanceItem"
ADD COLUMN "assignedToUserId" TEXT;

ALTER TABLE "public"."ChecklistInstanceItem"
ADD CONSTRAINT "ChecklistInstanceItem_assignedToUserId_fkey"
FOREIGN KEY ("assignedToUserId") REFERENCES "public"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ChecklistInstanceItem_workspaceId_assignedToUserId_idx"
ON "public"."ChecklistInstanceItem"("workspaceId", "assignedToUserId");
