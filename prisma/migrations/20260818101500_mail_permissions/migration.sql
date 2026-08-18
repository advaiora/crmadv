-- Permesso e modulo di "Server di posta" (mail.manage / modulo 'mail').
--
-- Perche' una migrazione e non solo il catalogo: il bootstrap
-- (ensureWorkspaceSystemRoles, eseguito a ogni login) risincronizza SOLO i ruoli
-- di SISTEMA. I ruoli PERSONALIZZATI (Role.isSystem = false) non li tocca
-- nessuno.
--
-- ⚠️ Qui c'e' un passaggio in piu' rispetto al modello 20260715141500_chat_permissions:
-- quella agganciava un permesso a un modulo ESISTENTE ('projects'), mentre questo
-- modulo nasce adesso. Senza la riga in "Module" e senza le righe in
-- "WorkspaceModule", requireModuleEnabled tornerebbe false e la pagina darebbe 403
-- a tutti — Superadmin compreso — fino a che ogni singola persona non avesse
-- rifatto il login. Il modulo e' isCore, quindi nasce acceso ovunque.
--
-- EREDITA': nessuna, di proposito. La domanda della regola ①-bis di CLAUDE.md e'
-- "chi esercitava gia' questa facolta' con un altro permesso": qui nessuno, perche'
-- prima del 18/8/2026 il server di posta si configurava solo nel file .env, fuori
-- dal CRM. Non si toglie niente a nessuno e non si allarga niente in silenzio.
--
-- Idempotente: ON CONFLICT DO NOTHING ovunque, cosi' convive col bootstrap che fa
-- upsert delle stesse righe.

-- 1) Il modulo.
INSERT INTO "public"."Module" ("id", "key", "name", "description", "isCore", "createdAt", "updatedAt")
VALUES (
  'seed_module_mail',
  'mail',
  'Server di posta',
  'Parametri del server usato dal CRM per spedire le email',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

-- 2) Il modulo acceso su ogni workspace gia' esistente. E' isCore, quindi acceso
--    ovunque: senza queste righe la pagina risponderebbe 403 fino al prossimo login.
INSERT INTO "public"."WorkspaceModule" ("id", "workspaceId", "moduleId", "enabled", "createdAt", "updatedAt")
SELECT
  'wm_mail_' || w."id",
  w."id",
  m."id",
  TRUE,
  NOW(),
  NOW()
FROM "public"."Workspace" w
CROSS JOIN "public"."Module" m
WHERE m."key" = 'mail'
ON CONFLICT ("workspaceId", "moduleId") DO NOTHING;

-- 3) Il permesso.
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  'seed_mail_manage',
  'mail.manage',
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'mail'),
  'Configurare il server di posta da cui il CRM spedisce le email (inviti compresi)',
  NOW(),
  NOW()
ON CONFLICT ("key") DO NOTHING;

-- 4) Il permesso ai ruoli di sistema che devono averlo: Superadmin e Admin.
--    Decisione registrata il 17/8/2026 (decisioni-cliente-e-menu-2026-08-07.md):
--    la maschera e' accessibile a Superadmin e Admin. Manager, Operativo e Viewer
--    hanno liste esplicite nel catalogo e restano fuori.
--    (Il bootstrap lo darebbe comunque ad Admin da 'all_except' e a Superadmin da
--    'all', ma cosi' vale subito, senza aspettare il primo login.)
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", NOW()
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'mail.manage'
  AND r."isSystem" = TRUE
  AND r."name" IN ('Admin', 'Superadmin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
