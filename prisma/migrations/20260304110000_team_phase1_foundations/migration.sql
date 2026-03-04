-- Create membership status enum for workspace-scoped user membership lifecycle.
CREATE TYPE "public"."MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- Migrate legacy text status values to the new enum.
ALTER TABLE "public"."Membership"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "public"."MembershipStatus"
  USING (
    CASE
      WHEN lower(coalesce("status", '')) = 'inactive' THEN 'INACTIVE'
      WHEN lower(coalesce("status", '')) = 'pending' THEN 'PENDING'
      ELSE 'ACTIVE'
    END
  )::"public"."MembershipStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
