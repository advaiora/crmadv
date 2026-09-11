-- Permesso dedicato per gli allegati ai messaggi interni: messages.attach (CRMA-30).
--
-- Perche' una migrazione e non solo il catalogo: il bootstrap (ensureWorkspaceSystemRoles,
-- eseguito a ogni login) risincronizza SOLO i ruoli di sistema. I ruoli PERSONALIZZATI
-- (Role.isSystem = false) non li tocca nessuno: senza questo passaggio, chi oggi scrive
-- messaggi con un ruolo su misura si troverebbe a non poter allegare, in silenzio.
--
-- Idempotente: ON CONFLICT DO NOTHING ovunque, cosi' convive con il bootstrap che fa
-- upsert degli stessi permessi.
--
-- Il DOWNLOAD non compare qui di proposito: scaricare e' leggere, e resta su
-- messages.view (che chi vede la conversazione ha gia'). La barriera vera non e' una
-- terza chiave ma il filtro per workspace + mittente/destinatario applicato nel service.

-- 1) La riga Permission. Il bootstrap la creerebbe al primo login, ma qui serve subito
--    per potervi agganciare i ruoli. moduleId = modulo 'messages', come da catalogo.
INSERT INTO "public"."Permission" ("id", "key", "moduleId", "description", "createdAt", "updatedAt")
SELECT
  'seed_messages_attach',
  'messages.attach',
  (SELECT "id" FROM "public"."Module" WHERE "key" = 'messages'),
  'Attach files to internal messages',
  NOW(),
  NOW()
ON CONFLICT ("key") DO NOTHING;

-- 2) EREDITA' - chi puo' gia' scrivere un messaggio puo' anche allegarci un file.
--    Vale per i ruoli di SISTEMA (Manager, Operativo) e soprattutto per quelli
--    PERSONALIZZATI, che nessun bootstrap risincronizza. Il Viewer non ha
--    messages.send, quindi da qui non prende niente: resta in sola lettura, e per
--    SCARICARE gli basta messages.view, che ha gia'.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT rp."roleId", p."id", NOW()
FROM "public"."RolePermission" rp
JOIN "public"."Permission" ps ON ps."id" = rp."permissionId" AND ps."key" = 'messages.send'
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'messages.attach'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 3) Admin e Superadmin di sistema: il bootstrap glielo darebbe comunque da
--    'all'/'all_except', ma cosi' vale subito, senza aspettare il primo login.
INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", NOW()
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE p."key" = 'messages.attach'
  AND r."isSystem" = TRUE
  AND r."name" IN ('Admin', 'Superadmin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
