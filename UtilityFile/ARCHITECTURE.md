# Architecture – Agency OS

## 1) Multi-tenancy
Modello: workspace-centric.
- Ogni record “business” ha `workspaceId`.
- Tutte le query devono filtrare per workspace in modo obbligatorio (server-side).
- Un utente può appartenere a più workspace (future-proof), ma MVP può partire con 1 workspace per user.

## 2) Module Registry (Feature Flags)
### DB
- `modules`: registry globale
- `workspaceModules`: abilitazioni per workspace

### Enforcement
- UI: menu e route visibility basati sui moduli attivi.
- API: middleware/guard che blocca route se modulo disabilitato (403).

Pattern:
- ogni route handler dichiara il modulo richiesto, es:
  - `requireModule("clients")`
  - `requirePermission("clients.view")`

## 3) RBAC
### Concetti
- role: insieme di permessi
- permission: stringa `{module}.{action}`
- user-role: assegnazione per workspace

### Enforcement
- API: guard centralizzato (prima di eseguire business logic)
- UI: hiding non basta; serve enforcement server-side.

## 4) Superadmin
- Ruolo con tutti i permessi per workspace.
- Unico autorizzato a:
  - gestire moduli
  - gestire branding
  - gestire ruoli/permessi

## 5) Branding
- Config per workspace con logo + colori.
- Implementazione consigliata: CSS variables.
- Recupero branding per workspace all’avvio sessione o al load layout.

## 6) Moduli – Boundaries
Ogni modulo è una cartella in `/modules/<name>` con:
- `service.ts` (business logic)
- `repository.ts` (accesso dati/Prisma)
- `policies.ts` (permessi/guards specifiche)
- `routes/*` (API handlers)
- `ui/*` (pagine/components)

Nessuna dipendenza diretta tra moduli:
- comunicazione tramite service layer o eventi (in futuro).
- nel MVP, accettabile chiamare service di un altro modulo solo da “core orchestrator”, non da UI.

## 7) Data Model (alto livello)
Core:
- Workspace, User, Membership
- Modules, WorkspaceModules
- Roles, Permissions, UserRoles
- WorkspaceBranding
- AuditLog

Business (MVP 1):
- Clients
- Projects, ProjectCategories, PipelineStages, StageHistory
- ChecklistTemplates, ChecklistInstances, StageChecklistRules
- Quotes, QuoteTemplates

## 8) Error handling
- Risposte API standard:
  - 401 (non autenticato)
  - 403 (modulo disabilitato o permesso mancante)
  - 400 (validazione input)
  - 500 (errore interno)
- Validazione input: Zod (consigliata) o equivalente.
- Logging: evitare dati sensibili (specie per vault).

## 9) Testing minimo (solo ciò che serve)
- Unit test su:
  - requireModule
  - requirePermission
  - enforcement workspace scope
- Test per Vault solo quando introdotto (MVP 2).

## 10) Clients MVP decisions (2026-02-11)
- `clients` module implemented with standard structure:
  - `server/modules/clients/repository.ts`
  - `server/modules/clients/service.ts`
  - `server/modules/clients/policies.ts`
  - `server/modules/clients/routes.ts`
  - `src/modules/clients/ui/*`
- Address is stored as flat nullable columns on `Client` (`street`, `city`, `zip`, `province`, `country`) and mapped as nested `address` DTO in API responses.
- Tags are stored as `String[]` (`TEXT[]` in PostgreSQL) to keep MVP simple and avoid extra relations.
- API path is `/clients` (workspace resolved from `x-workspace-id` or `x-workspace-slug`) to stay coherent with current Fastify routes.
- UI module gating uses data from `/me`: menu item is hidden if module `clients` is disabled; route pages show "Modulo non attivo" instead of failing.

## 11) Web Assets Security & Audit (Phase 5, 2026-02-26)
- All `web-assets` API handlers pass through centralized policy `ensureWebAssetsAccess`:
  - `requireAuth`
  - `requireWorkspace`
  - `requireModuleEnabled("web")`
  - `requirePermission("web.*")` per action
- Feature-flag rule is strict: if module `web` is disabled for the workspace, API responds `403`.
- Repository hardening: web-assets repository uses a centralized `whereWorkspace(workspaceId, where)` helper to prevent tenant scope omissions on Prisma queries.
- RBAC enforcement is server-side; UI visibility is only a UX layer.
- Critical audit actions for Web Asset Management:
  - `web.asset.create`
  - `web.asset.update`
  - `web.asset.delete`
  - `web.asset.publish`
  - `web.asset.unpublish`
  - `web.version.create`
  - `web.version.rollback`
  - `web.asset.link_client`
  - `web.asset.link_project`
- Audit metadata must never include secrets; only operational non-sensitive fields are allowed (status transitions, linked entity IDs, version transitions).

## 12) Internal Messaging (2026-03-02)
- La vecchia UI "Email" e stata convertita in messaggistica interna 1:1 tra utenti dello stesso workspace.
- Non viene usato un provider email esterno: nessun invio SMTP, solo persistenza su DB (`WorkspaceMessage`).
- Scope multi-tenant obbligatorio: ogni messaggio e legato a `workspaceId`, e le conversazioni sono consentite solo tra membri attivi dello stesso workspace.
- API esposte:
  - `GET /messages/users`
  - `GET /messages/conversations/:userId`
  - `POST /messages/conversations/:userId/messages`
  - `POST /messages/conversations/:userId/read`
- Enforcement RBAC: riuso del modulo/permesso `team.view` (modulo `team`) per accesso lettura/scrittura messaggi nel MVP.

## 13) Team Phase 1 (2026-03-04)
- TEAM permissions base introdotte: `team.view`, `team.invite`, `team.edit`, `team.deactivate`, `team.roles_assign`.
- Membership status passa a enum `MembershipStatus` (`ACTIVE`, `INACTIVE`, `PENDING`) per supportare lifecycle workspace.
- Catalogo RBAC/moduli centralizzato in `server/auth/rbac-catalog.ts` e riusato da bootstrap auth + seed.
- Scelta di sicurezza: solo `Superadmin` puo gestire moduli e assegnazioni ruoli/permessi.
- `Admin` mantiene privilegi operativi elevati, ma senza `modules.manage`, `roles.*`, `team.roles_assign`.

## 14) Team Phase 3 Invites (2026-03-04)
- Duplicate invite policy: per stessa `workspaceId + email`, se esiste un invito `PENDING` viene rigenerato token/hash e aggiornata scadenza (no nuovo record).
- Token persistence: il token plain non viene mai salvato; in DB si salva solo `tokenHash` (HMAC-SHA256 con `TEAM_INVITE_TOKEN_SECRET`, fallback `AUTH_JWT_SECRET`).
- Default expiry: 7 giorni (`expiresInDays` override consentito fino a 30).
- Accept endpoint usa il workspace dal record invito (no workspace param), quindi il token determina sempre il tenant corretto.
- Se modulo `team` e disabilitato per il workspace dell'invito, `accept` risponde `403`.
- In assenza di SMTP, l'invito viene comunque creato e la risposta lo dichiara (`delivery: {emailSent, reason}`, dal 17/8/2026: prima l'interfaccia diceva "successo" a prescindere).
- Quando l'email NON parte, `inviteLink` viene restituito **anche in produzione** (non piu' solo in dev): senza, chi invita non avrebbe modo di far entrare la persona. Va a chi ha gia' `team.invite` ed e' autenticato.
- `POST /api/team/invites/:inviteId/link` rigenera il link di un invito PENDING (il token in chiaro non e' conservato, quindi non si puo' rileggere: si conia di nuovo, e il precedente decade). Scadenza invariata; audit `team.invite_link_regenerated`.
- Il preset `Superadmin` non e' assegnabile per invito (allineato a `REGISTRABLE_WORKSPACE_ROLE_NAMES` e alla registrazione): si concede solo a un membro esistente, da un altro Superadmin.

## 15) Checklist MVP decisions (2026-03-05)
- `StageChecklistRule` is the primary gate model (`workspaceId + projectCategoryId + pipelineStageId + checklistTemplateId` unique).
- Gate evaluation on `projects.move_stage` resolves all `gateEnabled=true` rules for target `(categoryId, stageId)`.
- For every required rule, missing checklist instances are auto-created when allowed and then validated.
- Blocking response for missing required items is `403` with code `GATE_BLOCKED` and `missingItems` details.
- Legacy stage-level gate fields (`PipelineStage.isGated + gateChecklistTemplateId`) are kept as fallback when no stage rules are configured.
- Override endpoint `POST /projects/:projectId/stages/:stageId/override-gate` requires `checklists.override_gate` and logs a dedicated audit action.

## 16) Audit naming conventions (2026-03-05)
- Use action strings in dot notation: `<domain>.<action>` (examples: `modules.manage`, `branding.manage`, `checklists.override_gate`).
- Team critical actions are normalized to:
  - `team.invite`
  - `team.deactivate`
  - `team.roles_assign`
- Web asset audit actions remain explicit (`web.asset.*`, `web.version.*`) and must not include secret values in metadata.
- `metadata` must contain only operational fields (IDs, status transitions, reasons), never secrets or decrypted vault data.
