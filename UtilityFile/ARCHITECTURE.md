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
