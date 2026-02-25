-- CreateTable
CREATE TABLE "public"."CalendarEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "category" VARCHAR(60),
    "color" VARCHAR(20),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_workspaceId_startAt_idx" ON "public"."CalendarEvent"("workspaceId", "startAt");
CREATE INDEX "CalendarEvent_workspaceId_updatedAt_idx" ON "public"."CalendarEvent"("workspaceId", "updatedAt");

-- AddForeignKey
ALTER TABLE "public"."CalendarEvent"
ADD CONSTRAINT "CalendarEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CalendarEvent"
ADD CONSTRAINT "CalendarEvent_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."CalendarEvent"
ADD CONSTRAINT "CalendarEvent_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure calendar module exists
INSERT INTO "public"."Module" ("id", "key", "name", "description", "isCore", "createdAt", "updatedAt")
SELECT
  CONCAT('mod_', SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 24)),
  'calendar',
  'Calendar',
  'Calendar module',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."Module" WHERE "key" = 'calendar'
);

-- Ensure calendar permissions exist
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'calendar.view') FROM 1 FOR 24)),
  'calendar.view',
  m."id",
  'View calendar events',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'calendar'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'calendar.view');

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'calendar.create') FROM 1 FOR 24)),
  'calendar.create',
  m."id",
  'Create calendar events',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'calendar'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'calendar.create');

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'calendar.edit') FROM 1 FOR 24)),
  'calendar.edit',
  m."id",
  'Edit calendar events',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'calendar'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'calendar.edit');

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'calendar.delete') FROM 1 FOR 24)),
  'calendar.delete',
  m."id",
  'Delete calendar events',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'calendar'
  AND NOT EXISTS (SELECT 1 FROM "public"."Permission" p WHERE p."key" = 'calendar.delete');

-- Enable calendar module for all workspaces
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
WHERE m."key" = 'calendar'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."WorkspaceModule" wm
    WHERE wm."workspaceId" = w."id" AND wm."moduleId" = m."id"
  );

-- Sync role permissions for calendar module
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "public"."Role" r
JOIN "public"."Permission" p ON p."key" IN ('calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete')
WHERE r."name" IN ('Superadmin', 'Admin', 'Manager')
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "public"."Role" r
JOIN "public"."Permission" p ON p."key" IN ('calendar.view', 'calendar.create', 'calendar.edit')
WHERE r."name" = 'Operativo'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "public"."Role" r
JOIN "public"."Permission" p ON p."key" = 'calendar.view'
WHERE r."name" = 'Viewer'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );