-- Modulo "Produzione AI" (ai_production) e i suoi cinque permessi, piu' l'aggancio
-- dei permessi SEO alle rotte che finalmente li controllano.
--
-- Perche' una migrazione e non solo il catalogo: il bootstrap (ensureWorkspaceSystemRoles,
-- eseguito a ogni login) risincronizza SOLO i ruoli di sistema. I ruoli PERSONALIZZATI
-- (Role.isSystem = false) non li tocca nessuno: senza questo passaggio, chi usa un ruolo
-- personalizzato perderebbe l'intera area Produzione AI in silenzio, nel momento in cui
-- le rotte iniziano a chiedere ai_production.view invece di projects.view.
--
-- Stesso schema del precedente 20260715141500_chat_permissions, che risolveva lo stesso
-- problema per la chat. Idempotente: ON CONFLICT DO NOTHING ovunque, cosi' convive con
-- il bootstrap che fa upsert delle stesse righe.

-- 1) Il modulo. Il bootstrap lo creerebbe al primo login, ma qui serve subito per
--    potervi agganciare i permessi.
INSERT INTO "public"."Module" ("id", "key", "name", "description", "isCore", "createdAt", "updatedAt")
VALUES (
  'seed_module_ai_production',
  'ai_production',
  'Produzione AI',
  'Area di produzione assistita dall''AI: Brief, Fonti, Contenuti Web, Ads, Report, Performance e chat AI',
  FALSE,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

-- 2) I cinque permessi.
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  v."id",
  v."key",
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'ai_production'),
  v."description",
  NOW(),
  NOW()
FROM (VALUES
  ('seed_ai_prod_view', 'ai_production.view', 'Vedere i progetti di Produzione AI e i loro contenuti'),
  ('seed_ai_prod_edit', 'ai_production.edit', 'Creare e modificare progetti, contenuti, report e dati di performance'),
  ('seed_ai_prod_generate', 'ai_production.generate', 'Far generare contenuti all''AI: consuma il budget AI dell''agenzia'),
  ('seed_ai_prod_settings', 'ai_production.manage_settings', 'Gestire le impostazioni AI: provider, chiavi, modelli e tipi di progetto'),
  ('seed_ai_prod_budget', 'ai_production.manage_budget', 'Gestire i budget AI e consultare il rendiconto dei consumi')
) AS v("id", "key", "description")
ON CONFLICT ("key") DO NOTHING;

-- 3) I permessi della chat passano sotto il modulo nuovo. Stavano sotto 'projects'
--    per ripiego dichiarato ("l'area Agency non ha un modulo suo"): ora ce l'ha.
--    Cambia solo il raggruppamento nella pagina Ruoli e permessi; le assegnazioni
--    ai ruoli restano dove sono, perche' il legame passa dalla chiave.
UPDATE "public"."Permission"
SET "moduleId" = (SELECT "id" FROM "public"."Module" WHERE "key" = 'ai_production'),
    "updatedAt" = NOW()
WHERE "key" IN ('chat.view', 'chat.use', 'chat.moderate');

-- 4) Il modulo acceso su tutti i workspace gia' esistenti. Senza questa riga l'area
--    sparirebbe dal menu di chi ce l'ha oggi: requireModuleEnabled non troverebbe
--    nessuna riga WorkspaceModule per la chiave nuova.
--    (L'id va costruito a mano: WorkspaceModule.id e' un cuid generato da Prisma lato
--    applicazione, non ha un default in SQL.)
INSERT INTO "public"."WorkspaceModule" ("id", "workspaceId", "moduleId", "enabled", "createdAt", "updatedAt")
SELECT 'wm_aiprod_' || w."id", w."id", m."id", TRUE, NOW(), NOW()
FROM "public"."Workspace" w
CROSS JOIN "public"."Module" m
WHERE m."key" = 'ai_production'
ON CONFLICT ("workspaceId", "moduleId") DO NOTHING;

-- 5) EREDITA' — nessuno perde quello che poteva fare ieri.
--    Finora l'area girava sui permessi della Pipeline: chi ha 'projects.view' la
--    vedeva, chi ha 'projects.edit' ci lavorava e poteva far generare (le rotte di
--    generazione chiedevano proprio 'edit'). Si ricalca esattamente quella mappa.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" src ON src."id" = rp."permissionId" AND src."key" = 'projects.view'
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'ai_production.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" src ON src."id" = rp."permissionId" AND src."key" = 'projects.edit'
CROSS JOIN "public"."Permission" p
WHERE p."key" IN ('ai_production.edit', 'ai_production.generate')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

--    Anche 'projects.create' e 'projects.delete' vanno ereditati, ed e' facile
--    dimenticarsene: nell'area c'erano otto rotte che li chiedevano invece di 'edit'
--    (creazione progetto, snapshot e set di metriche delle Performance, import Excel,
--    e le due cancellazioni). Con i cinque permessi decisi, tutte e otto ricadono su
--    'ai_production.edit': senza queste due righe, un ruolo personalizzato che avesse
--    'create' o 'delete' SENZA 'edit' perderebbe quelle azioni.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" src
  ON src."id" = rp."permissionId" AND src."key" IN ('projects.create', 'projects.delete')
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'ai_production.edit'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 6) Impostazioni AI e budget: prima non erano permessi ma un controllo sul NOME del
--    ruolo ('superadmin'), quindi l'unico erede possibile e' il Superadmin di sistema.
--    L'Admin ne e' escluso apposta nel catalogo: dargli qui cio' che non aveva sarebbe
--    un allargamento silenzioso di privilegi.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", NOW()
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE p."key" IN ('ai_production.manage_settings', 'ai_production.manage_budget')
  AND r."isSystem" = TRUE
  AND r."name" = 'Superadmin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 7) SEO — il modulo e i suoi quattro permessi esistevano dal principio, ma nessuna
--    rotta li controllava: report e scansione giravano su web.view / web.edit. Ora le
--    rotte chiedono i permessi veri, quindi vanno dati a chi di fatto li esercitava.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" src ON src."id" = rp."permissionId" AND src."key" = 'web.view'
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'seo.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" src ON src."id" = rp."permissionId" AND src."key" = 'web.edit'
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'seo.run_scan'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 8) Il modulo 'seo' acceso ovunque. Nasceva spento ("finche' non e' configurato"),
--    ma non c'era niente da configurare e l'interruttore non spegneva nulla, dato che
--    nessuna rotta lo controllava. Ora che lo controlla, lasciarlo spento farebbe
--    sparire la scheda SEO da tutti i siti in gestione. Chi non la vuole la spegne.
UPDATE "public"."WorkspaceModule" wm
SET "enabled" = TRUE, "updatedAt" = NOW()
FROM "public"."Module" m
WHERE m."id" = wm."moduleId"
  AND m."key" = 'seo'
  AND wm."enabled" = FALSE;
