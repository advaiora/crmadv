-- Permessi della Chat AI (chat.view / chat.use / chat.moderate).
--
-- Perche' una migrazione e non solo il catalogo: il bootstrap (ensureWorkspaceSystemRoles,
-- eseguito a ogni login) risincronizza SOLO i ruoli di sistema. I ruoli PERSONALIZZATI
-- (Role.isSystem = false) non li tocca nessuno: senza questo passaggio, chi usa un ruolo
-- personalizzato perderebbe la chat in silenzio nel momento in cui le rotte iniziano a
-- chiedere chat.use invece di projects.view.
--
-- Idempotente: ON CONFLICT DO NOTHING ovunque, cosi' convive con il bootstrap che fa
-- upsert degli stessi permessi.

-- 1) Le righe Permission (il bootstrap le creerebbe al primo login, ma qui servono
--    subito per potervi agganciare i ruoli). moduleId = modulo 'projects', come da
--    catalogo: e' il modulo che le rotte della chat gia' richiedono.
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  'seed_chat_view',
  'chat.view',
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'projects'),
  'View AI chat sessions and their history',
  NOW(),
  NOW()
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  'seed_chat_use',
  'chat.use',
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'projects'),
  'Write in the AI chat: send messages (spends AI budget), invite, attach, clear',
  NOW(),
  NOW()
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  'seed_chat_moderate',
  'chat.moderate',
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'projects'),
  'Moderate AI chat groups: remove members, take over and disband, without reading the messages',
  NOW(),
  NOW()
ON CONFLICT ("key") DO NOTHING;

-- 2) EREDITA' — chi poteva usare la chat continua a poterlo fare.
--    Finora la chat girava su 'projects.view': ogni ruolo che ce l'ha, oggi puo'
--    leggere E scrivere. Quindi gli si danno entrambi, per non togliere nulla a
--    nessuno con questo rilascio. La distinzione lettura/scrittura vale da qui in
--    avanti: il Viewer di sistema viene riportato alla sola lettura dal punto 3.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" pv ON pv."id" = rp."permissionId" AND pv."key" = 'projects.view'
CROSS JOIN "public"."Permission" p
WHERE p."key" IN ('chat.view', 'chat.use')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 3) Il Viewer di sistema torna in sola lettura: gli si toglie chat.use appena
--    concesso dal punto 2. Solo per il ruolo di SISTEMA chiamato 'Viewer' — i ruoli
--    personalizzati restano come sono, sono scelte di chi li ha creati.
DELETE FROM "public"."RolePermission" rp
USING "public"."Permission" p, "public"."Role" r
WHERE p."id" = rp."permissionId"
  AND r."id" = rp."roleId"
  AND p."key" = 'chat.use'
  AND r."isSystem" = TRUE
  AND r."name" = 'Viewer';

-- 4) Moderazione a chi amministra il workspace: ruoli di sistema Admin e Superadmin.
--    (Il bootstrap glielo darebbe comunque da 'all'/'all_except', ma cosi' vale
--    subito, senza aspettare il primo login.)
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", NOW()
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'chat.moderate'
  AND r."isSystem" = TRUE
  AND r."name" IN ('Admin', 'Superadmin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
