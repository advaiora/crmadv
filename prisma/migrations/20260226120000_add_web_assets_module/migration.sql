-- CreateEnum
CREATE TYPE "public"."WebAssetStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'PAUSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "public"."WebsiteAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "status" "public"."WebAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebAppAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "status" "public"."WebAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAppAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EcommerceAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "status" "public"."WebAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAsset_workspaceId_url_key" ON "public"."WebsiteAsset"("workspaceId", "url");
CREATE INDEX "WebsiteAsset_workspaceId_updatedAt_idx" ON "public"."WebsiteAsset"("workspaceId", "updatedAt");
CREATE INDEX "WebsiteAsset_workspaceId_status_idx" ON "public"."WebsiteAsset"("workspaceId", "status");
CREATE INDEX "WebsiteAsset_workspaceId_clientId_idx" ON "public"."WebsiteAsset"("workspaceId", "clientId");
CREATE INDEX "WebsiteAsset_workspaceId_projectId_idx" ON "public"."WebsiteAsset"("workspaceId", "projectId");

CREATE UNIQUE INDEX "WebAppAsset_workspaceId_url_key" ON "public"."WebAppAsset"("workspaceId", "url");
CREATE INDEX "WebAppAsset_workspaceId_updatedAt_idx" ON "public"."WebAppAsset"("workspaceId", "updatedAt");
CREATE INDEX "WebAppAsset_workspaceId_status_idx" ON "public"."WebAppAsset"("workspaceId", "status");
CREATE INDEX "WebAppAsset_workspaceId_clientId_idx" ON "public"."WebAppAsset"("workspaceId", "clientId");
CREATE INDEX "WebAppAsset_workspaceId_projectId_idx" ON "public"."WebAppAsset"("workspaceId", "projectId");

CREATE UNIQUE INDEX "EcommerceAsset_workspaceId_url_key" ON "public"."EcommerceAsset"("workspaceId", "url");
CREATE INDEX "EcommerceAsset_workspaceId_updatedAt_idx" ON "public"."EcommerceAsset"("workspaceId", "updatedAt");
CREATE INDEX "EcommerceAsset_workspaceId_status_idx" ON "public"."EcommerceAsset"("workspaceId", "status");
CREATE INDEX "EcommerceAsset_workspaceId_clientId_idx" ON "public"."EcommerceAsset"("workspaceId", "clientId");
CREATE INDEX "EcommerceAsset_workspaceId_projectId_idx" ON "public"."EcommerceAsset"("workspaceId", "projectId");

-- AddForeignKey
ALTER TABLE "public"."WebsiteAsset"
ADD CONSTRAINT "WebsiteAsset_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebsiteAsset"
ADD CONSTRAINT "WebsiteAsset_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebsiteAsset"
ADD CONSTRAINT "WebsiteAsset_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebsiteAsset"
ADD CONSTRAINT "WebsiteAsset_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAppAsset"
ADD CONSTRAINT "WebAppAsset_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WebAppAsset"
ADD CONSTRAINT "WebAppAsset_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAppAsset"
ADD CONSTRAINT "WebAppAsset_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WebAppAsset"
ADD CONSTRAINT "WebAppAsset_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."EcommerceAsset"
ADD CONSTRAINT "EcommerceAsset_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."EcommerceAsset"
ADD CONSTRAINT "EcommerceAsset_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."EcommerceAsset"
ADD CONSTRAINT "EcommerceAsset_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."EcommerceAsset"
ADD CONSTRAINT "EcommerceAsset_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure web module exists
INSERT INTO "public"."Module" ("id", "key", "name", "description", "isCore", "createdAt", "updatedAt")
SELECT
  CONCAT('mod_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'web') FROM 1 FOR 24)),
  'web',
  'Web',
  'Web module',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."Module" WHERE "key" = 'web'
);

-- Ensure web permissions exist
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'web.view') FROM 1 FOR 24)),
  'web.view',
  m."id",
  'View web assets',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'web'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'web.view');

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'web.create') FROM 1 FOR 24)),
  'web.create',
  m."id",
  'Create web assets',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'web'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'web.create');

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'web.edit') FROM 1 FOR 24)),
  'web.edit',
  m."id",
  'Edit web assets',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'web'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'web.edit');

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'web.delete') FROM 1 FOR 24)),
  'web.delete',
  m."id",
  'Delete web assets',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'web'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'web.delete');

-- Enable web module for all workspaces
INSERT INTO "public"."WorkspaceModule" ("id", "workspaceId", "moduleId", "enabled", "createdAt", "updatedAt")
SELECT
  CONCAT('wmod_', SUBSTRING(md5(random()::text || clock_timestamp()::text || w."id" || m."id") FROM 1 FOR 24)),
  w."id",
  m."id",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Workspace" w
CROSS JOIN "public"."Module" m
WHERE m."key" = 'web'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."WorkspaceModule" wm
    WHERE wm."workspaceId" = w."id" AND wm."moduleId" = m."id"
  );

-- Sync role permissions for web module
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "public"."Role" r
JOIN "public"."Permission" p ON p."key" IN ('web.view', 'web.create', 'web.edit', 'web.delete')
WHERE r."name" IN ('Superadmin', 'Admin', 'Manager')
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "public"."Role" r
JOIN "public"."Permission" p ON p."key" = 'web.view'
WHERE r."name" IN ('Operativo', 'Viewer')
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
