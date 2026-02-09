# Agency OS (SaaS Modulare per Agenzie/Freelance)

Agency OS è una web app multi-tenant e white-label per agenzie digitali e freelance.
Focus: CRM leggero, progetti con pipeline, checklist operative, preventivi, asset WEB (app/siti/ecommerce), vault credenziali, SEO analyzer.

## Stack (vincolato)
- Base: ixartz / SaaS-Boilerplate
- Frontend: Next.js (App Router) + React + TypeScript
- Backend: Next.js Route Handlers (API)
- DB: PostgreSQL
- ORM: Prisma
- Auth: NextAuth / Auth.js (dal boilerplate)
- UI: Tailwind + shadcn/ui

## Struttura progetto
/core
/auth
/rbac
/modules # module registry + feature flags
/branding
/audit
/modules
/clients
/team
/projects
/checklists
/quotes
/web
/vault
/seo

## Requisiti chiave
- Moduli attivabili/disattivabili per workspace (feature flags REALI: API + UI).
- RBAC modulare (permessi granulari per modulo/azione).
- Ruolo Superadmin con controllo totale sul workspace.
- Branding per workspace (logo + colori) applicato a UI e PDF preventivi.
- Audit log per azioni critiche.

## Avvio in locale
1. Copiare `.env.example` in `.env` e compilare.
2. Avviare Postgres (Docker o locale).
3. Installare dipendenze:
   - `pnpm install` (o npm/yarn coerente con boilerplate)
4. Prisma:
   - `pnpm prisma migrate dev`
   - `pnpm prisma db seed` (se presente)
5. Avvio:
   - `pnpm dev`

## Ordine di sviluppo (non cambiare)
Vedi `PRODUCT_SPEC.md`.

## Out of scope
Niente contabilità/fatture, ticketing, time tracking, chat, HR (ferie/stipendi), project management “tipo Jira”.
