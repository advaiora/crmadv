-- Team invites / onboarding foundations (Phase 3)
CREATE TYPE "public"."TeamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "public"."TeamInvite" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "tokenHash" VARCHAR(128) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "public"."TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
  "rolePresetName" VARCHAR(60),
  "invitedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvite_tokenHash_key" ON "public"."TeamInvite"("tokenHash");
CREATE INDEX "TeamInvite_workspaceId_status_createdAt_idx" ON "public"."TeamInvite"("workspaceId", "status", "createdAt" DESC);
CREATE INDEX "TeamInvite_workspaceId_email_status_idx" ON "public"."TeamInvite"("workspaceId", "email", "status");
CREATE INDEX "TeamInvite_workspaceId_expiresAt_idx" ON "public"."TeamInvite"("workspaceId", "expiresAt");

ALTER TABLE "public"."TeamInvite"
  ADD CONSTRAINT "TeamInvite_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."TeamInvite"
  ADD CONSTRAINT "TeamInvite_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."TeamInvite"
  ADD CONSTRAINT "TeamInvite_acceptedByUserId_fkey"
  FOREIGN KEY ("acceptedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
