-- Cestino: cancellazione morbida sulle entita' della release di settembre (CRMA-29).
--
-- Due parti: le colonne di stato (1) e i permessi del nuovo modulo (2).
--
-- ⚠️ Nessuna cascata viene toccata, ed e' il cuore della scelta di disegno.
-- Cestinare NON cancella niente: le righe figlie restano dove sono, quindi un
-- elemento ripristinato torna completo per costruzione, senza dover ricucire a
-- mano le ~50 relazioni che puntano al perimetro. Le cascate del database
-- restano quelle di sempre e sparano solo sull'eliminazione definitiva
-- (trash.purge), che e' esattamente il momento in cui devono sparare.

-- ============================================================
-- 1) Le colonne di stato
-- ============================================================

-- AlterTable
ALTER TABLE "public"."Membership" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT;

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT;

-- AlterTable
ALTER TABLE "public"."Role" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT;

-- AlterTable
ALTER TABLE "public"."WorkspaceMessage" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Membership_workspaceId_deletedAt_idx" ON "public"."Membership"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Client_workspaceId_deletedAt_idx" ON "public"."Client"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Role_workspaceId_deletedAt_idx" ON "public"."Role"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkspaceMessage_workspaceId_deletedAt_idx" ON "public"."WorkspaceMessage"("workspaceId", "deletedAt");


-- ============================================================
-- 2) Il modulo Cestino e i suoi tre permessi
-- ============================================================
--
-- Perche' una migrazione e non solo il catalogo: il bootstrap
-- (ensureWorkspaceSystemRoles, a ogni login) risincronizza SOLO i ruoli di
-- sistema. I ruoli PERSONALIZZATI non li tocca nessuno — senza questo passaggio
-- chi amministra il CRM con un ruolo personalizzato si troverebbe, dal
-- rilascio, senza piu' nessun modo di eliminare davvero un cliente: la
-- cancellazione diventa reversibile e il cestino gli resta invisibile.
--
-- Idempotente: ON CONFLICT DO NOTHING ovunque, cosi' convive col bootstrap.

-- 2.1) Il modulo. isCore = true: e' una funzione di servizio trasversale, come
--      Audit; non si accende e spegne per workspace.
INSERT INTO "public"."Module" ("id", "key", "name", "description", "isCore", "createdAt", "updatedAt")
VALUES (
  'seed_module_trash',
  'trash',
  'Cestino',
  'Le cose cancellate: si riportano indietro, o si eliminano per davvero',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

-- 2.2) Le tre righe Permission.
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  v."id", v."key",
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'trash'),
  v."description", NOW(), NOW()
FROM (VALUES
  ('seed_trash_view',    'trash.view',    'Vedere il Cestino e cosa contiene'),
  ('seed_trash_restore', 'trash.restore', 'Riportare indietro dal Cestino quello che era stato cancellato'),
  ('seed_trash_purge',   'trash.purge',   'Eliminare PER DAVVERO dal Cestino: non si torna piu indietro')
) AS v("id", "key", "description")
ON CONFLICT ("key") DO NOTHING;

-- 2.3) EREDITA' — chi poteva gia' distruggere continua a poterlo fare.
--      Il criterio e' meccanico: ogni ruolo che ha almeno un permesso di
--      cancellazione sul perimetro riceve tutti e tre. Non e' un allargamento:
--      quei ruoli oggi cancellano in modo definitivo, e senza trash.purge dopo
--      questo rilascio potrebbero solo cestinare.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT DISTINCT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" pd ON pd."id" = rp."permissionId"
CROSS JOIN "public"."Permission" p
WHERE pd."key" IN ('clients.delete', 'team.deactivate', 'roles.manage')
  AND p."key" IN ('trash.view', 'trash.restore', 'trash.purge')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 2.4) I ruoli di sistema Admin e Superadmin, subito e senza aspettare il primo
--      login (il bootstrap glieli darebbe comunque da 'all'/'all_except').
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", NOW()
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE p."key" IN ('trash.view', 'trash.restore', 'trash.purge')
  AND r."isSystem" = TRUE
  AND r."name" IN ('Admin', 'Superadmin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 2.5) Il modulo acceso su ogni workspace esistente. E' isCore, quindi non si
--      spegne: senza questa riga i workspace gia' creati non lo vedrebbero
--      finche' qualcuno non tocca la pagina Moduli.
INSERT INTO "public"."WorkspaceModule" ("id", "workspaceId", "moduleId", "enabled", "createdAt", "updatedAt")
SELECT
  'wsmod_trash_' || w."id",
  w."id",
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'trash'),
  TRUE,
  NOW(),
  NOW()
FROM "public"."Workspace" w
ON CONFLICT ("workspaceId", "moduleId") DO NOTHING;
