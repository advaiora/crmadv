# Brief integrale — Stato del progetto CRM Advaiora (Agency OS) — *pre-revisione Apple-style*

> ⚠️ **Nota storica:** questo documento fotografa lo stato del progetto **prima** della revisione orientata al Brief Operativo Definitivo ("bibbia") e all'approccio Apple-style. Descrive quindi la base di partenza, non l'architettura target.
>
> Documento di sintesi dello stato attuale del progetto.
> Data brief: **25 giugno 2026** · Branch: `main` · Ultima release taggata nei commit: **v2.0**
> Periodo di sviluppo: 9 febbraio 2026 → 24 giugno 2026 (42 commit, 39 migrazioni DB)

---

## 1. In una riga

Web app SaaS **multi-tenant** per agenzie/freelance che standardizza i processi operativi (clienti, progetti, checklist con gate, preventivi, asset web, vault credenziali) con architettura **modulare a feature-flag** e **RBAC server-side**, più un layer evoluto **"Agency OS"** con diagnosi, opportunità e reportistica per progetto.

---

## 2. Obiettivo del prodotto

Creare una piattaforma modulare e **rivendibile (white-label)** che permetta a un'agenzia di gestire l'intero ciclo operativo cliente in un unico strumento. I principi cardine sono:

- **Workspace-centric**: ogni dato "business" è isolato per `workspaceId`, filtrato obbligatoriamente lato server.
- **Moduli attivabili/disattivabili per workspace** (feature flag): modulo disabilitato ⇒ **API 403 + UI nascosta**.
- **RBAC con permessi `{module}.{action}`** applicati nel backend (la UI nasconde, ma non è il punto di sicurezza).
- **Superadmin** come unico ruolo che governa moduli, ruoli, branding e policy.

Fonte: `UtilityFile/PRODUCT_SPEC.md`, `UtilityFile/ARCHITECTURE.md`.

---

## 3. Stack tecnologico

| Area | Tecnologie |
|------|-----------|
| **Frontend** | React 19, Vite 7, React Router 5, Redux, Bootstrap 5 + tema Jampack, SCSS/Tailwind, ApexCharts/amCharts/Recharts, FullCalendar, TinyMCE, framer-motion |
| **Backend** | Node + **Fastify 5**, TypeScript (eseguito con `tsx`), Zod per validazione |
| **Database** | **PostgreSQL** via **Prisma 6** (39 migrazioni) |
| **Auth** | JWT bearer (`jose`) + **Google Sign-In** (verifica ID token server-side con `google-auth-library`), password con `bcrypt` |
| **Sicurezza dati** | Vault con cifratura a inviluppo (AES-GCM), `ENCRYPTION_KEY` 32 byte, audit log |
| **Email/PDF** | `nodemailer` (preventivi), `pdfkit` per generazione PDF |
| **Build/Deploy** | Vite build, `vercel.json` presente (config deploy Vercel) |

Comandi principali (vedi `installazione-e-avvio.md`): `npm run dev` (frontend Vite :5173), `npm run dev:api` (API Fastify :4000), `npm run db:migrate`, `npm run db:seed`, `npm run test:backend`.

---

## 4. Architettura

### Multi-tenancy
- Modello workspace-centric: ogni record business porta `workspaceId`; le query filtrano sempre per workspace.
- Workspace risolto da header `x-workspace-id` / `x-workspace-slug`.
- Un utente può appartenere a più workspace (`Membership` con stato `ACTIVE/INACTIVE/PENDING`).

### Struttura a moduli (boundary netti)
Ogni modulo backend vive in `server/modules/<name>/` con `service`, `repository`, `policies`, `routes`. Nessuna dipendenza diretta UI→UI tra moduli; orchestrazione via service layer.

Guardie centralizzate (`server/guards/`):
- `requireAuth` → 401
- `requireWorkspace`
- `requireModuleEnabled("<modulo>")` → 403 se modulo disattivo
- `requirePermission("<modulo>.<azione>")` → 403 se permesso mancante

Catalogo RBAC/moduli centralizzato in `server/auth/rbac-catalog.ts` (riusato da bootstrap e seed).

### Convenzioni
- Risposte API standard: 401 / 403 / 400 (Zod) / 404 / 500 / 503 (DB unavailable).
- Audit action in dot-notation `<dominio>.<azione>`; `metadata` mai con segreti o dati vault decifrati.
- CORS gestito manualmente in `server/app.ts` con allow-list origini + loopback dev.

---

## 5. Moduli e stato di implementazione

Moduli registrati nel catalogo RBAC (`rbac-catalog.ts`):

| Modulo | Core | Stato | Note |
|--------|:---:|-------|------|
| **auth / modules / branding / audit** | ✅ | Implementato | Registry feature-flag, branding white-label (logo, colori, supporto, firma PDF), audit log |
| **clients** | | Implementato | CRM leggero: anagrafica persona/azienda, indirizzo flat, tag `String[]`, VAT/CF |
| **projects** | | Implementato | Pipeline per categoria, stage con colore, gate, tipi progetto |
| **checklists** | | Implementato | Template + istanze, **gate sugli stage** (`StageChecklistRule`), evidenza, assegnatari, override-gate |
| **quotes** | | Implementato | Preventivi con righe, template, sconti, stati (DRAFT→SENT→ACCEPTED/REJECTED/EXPIRED), invio email + log, PDF |
| **calendar** | | Implementato | Eventi workspace (FullCalendar) |
| **team** | | Implementato | Membership lifecycle, inviti con token hash (HMAC), assegnazione ruoli |
| **messaging** | | Implementato | Messaggistica interna 1:1 tra membri (no SMTP, persistenza `WorkspaceMessage`) |
| **vault** | | Implementato | Credenziali cifrate (envelope key per workspace), master password, reveal con audit, threat model documentato |
| **web (web-assets)** | | Implementato | Siti / Web App / Ecommerce + versioning, deployment env, health check, analytics, finestre di manutenzione, alert |
| **dashboard** | | Implementato | Dashboard workspace |
| **agency-os** | | Implementato (avanzato) | Layer "intelligente": diagnosi, opportunità, report cliente, memoria progetto, task, alert |
| **seo** | | **Pianificato (MVP 3)** | Presente nel catalogo e nello schema (`WebAssetSeoReport`), analyzer/IA/export non ancora completi |

### Modulo Agency OS (il più recente e distintivo)
Estende `projects` con capacità data-driven per progetto:
- **Engine backend** (`server/modules/agency-os/`): `diagnosis-engine`, `opportunity-engine`, `reporting-engine`, `client-report-engine`.
- **Modelli DB**: `ProjectType`, `ProjectActiveModule`, `ProjectMemory` (brief/sources/web/ads/diagnosis/reports JSON), `ProjectAlert`, `ProjectOpportunity` (con scoring, dedup, impatto), `ProjectTask` (con dipendenze), `AgencyRuntimeSetting` (config anche cifrata).
- **UI** (`src/views/Agency/`): pagine per progetto — Overview, Discovery, Brain, Diagnosis, Web, Ads, Opportunities, Reports, Client Report, Tasks, Alerts, Memory, Assets — più liste, settings e badge data-source. Presente layer mock (`src/modules/agency-os/mock/`) per sviluppo UI senza dati reali.

---

## 6. Modello dati (sintesi)

Schema Prisma: **~50 modelli**, PostgreSQL. Aree principali:

- **Core/tenant**: `Workspace`, `User`, `Membership`, `TeamInvite`, `Module`, `WorkspaceModule`, `Role`, `Permission`, `RolePermission`, `UserRole`, `WorkspaceBranding`, `AuditLog`.
- **Business MVP1**: `Client`, `Project`, `ProjectClient`, `ProjectCategory`, `PipelineStage`, `ChecklistTemplate(+Item)`, `ChecklistInstance(+Item)`, `StageChecklistRule`, `Quote(+Item)`, `QuoteTemplate(+Item)`, `QuoteEmailLog`, `QuoteNotificationSettings`, `CalendarEvent`.
- **Web assets**: `WebsiteAsset`, `WebAppAsset`, `EcommerceAsset`, `WebAssetVersion`, `WebAssetHealthCheck`, `WebAssetSeoReport`, `WebAssetAnalyticsSnapshot/Event`, `WebAssetMaintenanceWindow`, `WebAssetAlert`.
- **Vault**: `VaultItem`, `WorkspaceVaultKey`, `WorkspaceVaultPolicy`.
- **Messaging**: `WorkspaceMessage`.
- **Agency OS**: `ProjectType`, `ProjectActiveModule`, `ProjectMemory`, `ProjectAlert`, `ProjectOpportunity`, `ProjectTask`, `AgencyRuntimeSetting`.

Tutti i modelli business indicizzati per `workspaceId` + colonne di accesso frequente.

---

## 7. Sicurezza

- **RBAC server-side** su ogni route via guardie centralizzate; UI è solo layer UX.
- **Feature-flag stretto**: modulo disabilitato ⇒ 403 garantito a livello API.
- **Vault**: cifratura envelope (chiave workspace `WorkspaceVaultKey` wrappata), AES-GCM (`iv` + `authTag`), master password (`WorkspaceVaultPolicy`), reveal tracciato in audit, threat model in `server/modules/vault/THREAT_MODEL.md`. Script di igiene: `npm run security:vault-hygiene`.
- **Inviti team**: solo `tokenHash` (HMAC-SHA256) salvato, mai il token in chiaro; scadenza default 7gg.
- **Audit log** per azioni critiche (web asset, checklist override, vault, team) senza dati sensibili in `metadata`.
- **Google auth**: ID token verificato lato server prima di qualsiasi scrittura DB.
- Documentazione: `UtilityFile/SECURITY.md`.

---

## 8. Testing

- Test backend: `npm run test:backend` (unit `*.test.ts` + integration/smoke `*.smoke.ts`) via `node --test` + `tsx`.
- Presenti test su route critiche: `dashboard`, `team`, `vault`, `web-assets`.
- Focus dichiarato: enforcement di `requireModule`, `requirePermission`, scope workspace e Vault.
- Test manuali documentati: `UtilityFile/CLIENTS_MANUAL_TESTS.md`, `docs/google-auth-test-plan.md`, collezione Postman (`UtilityFile/postman/`).

---

## 9. Documentazione esistente

| File | Contenuto |
|------|-----------|
| `installazione-e-avvio.md` | Guida setup locale (nuovo, non ancora committato) |
| `UtilityFile/PRODUCT_SPEC.md` | Spec prodotto, moduli, ruoli, permessi, ordine MVP |
| `UtilityFile/ARCHITECTURE.md` | Decisioni architetturali datate (multi-tenancy, RBAC, moduli, checklist, web, messaging, team) |
| `UtilityFile/SECURITY.md` | Linee guida sicurezza |
| `docs/google-auth-*.md` | Setup, test plan, checklist release per Google auth |
| `docs/quotes-phase4-release.md` | Release preventivi fase 4 |
| `docs/mobile-first-audit.md` | Audit responsive mobile |
| `server/modules/vault/THREAT_MODEL.md`, `vault/README.md`, `team/README.md` | Documentazione moduli |

---

## 10. Roadmap (da PRODUCT_SPEC) vs realtà

- **MVP 1** (bootstrap, registry, RBAC, branding, clients, projects+pipeline, checklists+gate, quotes) → **completato**.
- **MVP 2** (web asset management, vault, scadenziario web) → **completato**, con web-assets esteso ben oltre lo spec base (versioning, monitoring, analytics, alert).
- **MVP 3** (SEO analyzer + IA + export, report cliente) → **parziale**: report cliente presente nell'Agency OS; **SEO analyzer ancora da completare** (modello DB e modulo registrato, logica analyzer/IA non finita).
- **Extra non in spec originale**: tutto il layer **Agency OS** (diagnosi/opportunità/memoria/task) e la **messaggistica interna** sono aggiunte evolutive successive.

---

## 11. Punti aperti / note per chi prende in mano il progetto

1. **SEO module**: presente come placeholder (catalogo + tabella `WebAssetSeoReport`) ma analyzer/IA/export non completati → principale gap funzionale rispetto allo spec.
2. **Agency OS**: usa ancora dati **mock** in alcune UI (`src/modules/agency-os/mock/`); verificare quali pagine sono già collegate a dati reali via `agency.api.js` vs mock.
3. **File non versionati / di servizio nella root**: `backup.sql`, `api-debug.err`, `note.md` (placeholder), `installazione-e-avvio.md` (nuovo, da committare) — valutare pulizia/`.gitignore`.
4. **Email reale**: la messaggistica interna **non** invia SMTP; gli inviti team in assenza di SMTP restituiscono `inviteLink` solo in dev.
5. **Branding del path nel setup**: `installazione-e-avvio.md` riporta un path d'esempio di un'altra macchina (`C:\Users\claud\...`) — da adattare.
6. **Deploy**: presente `vercel.json`; confermare strategia per il backend Fastify (Vercel è orientato al frontend/serverless).
7. **Versionamento**: i tag versione vivono come messaggi di commit (`v1.5`, `v2.0`), non come git tag formali; `package.json` è ancora a `1.2.1`.

---

## 12. Come avviare in locale (estratto)

```powershell
npm ci
createdb crm_advaiora           # o CREATE DATABASE da psql
# configurare .env (DATABASE_URL, AUTH_JWT_SECRET >=16 char, ENCRYPTION_KEY 32 byte, VITE_API_URL...)
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api                 # API → http://localhost:4000
npm run dev                     # Frontend → http://localhost:5173
```

Dettaglio completo e troubleshooting: [installazione-e-avvio.md](../installazione-e-avvio.md).

---

*Brief generato analizzando: `package.json`, `prisma/schema.prisma` (+39 migrazioni), `server/app.ts`, struttura `server/modules/` e `src/`, catalogo RBAC, e la documentazione in `UtilityFile/` e `docs/`.*
