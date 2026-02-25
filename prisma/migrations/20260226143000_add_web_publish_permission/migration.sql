-- Ensure web.publish permission exists
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  CONCAT('perm_', SUBSTRING(md5(random()::text || clock_timestamp()::text || 'web.publish') FROM 1 FOR 24)),
  'web.publish',
  m."id",
  'Publish or unpublish web assets',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Module" m
WHERE m."key" = 'web'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."Permission" p
    WHERE p."key" = 'web.publish'
  );

-- Grant web.publish to Superadmin, Admin and Manager roles
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "public"."Role" r
JOIN "public"."Permission" p ON p."key" = 'web.publish'
WHERE r."name" IN ('Superadmin', 'Admin', 'Manager')
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
