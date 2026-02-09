# Product Spec – Agency OS

## 1) Obiettivo
Creare una web app SaaS modulare e rivendibile per agenzie/freelance che standardizzi processi operativi:
- Clienti (CRM leggero)
- Progetti con pipeline personalizzabile per categoria
- Checklist operative con gate sugli stati
- Preventivi con template
- WEB asset management (App / Siti / Ecommerce)
- Vault credenziali con controllo reveal + audit log
- SEO analyzer con suggerimenti + titoli IA

## 2) Moduli (attivabili/disattivabili per Workspace)
### Core (sempre attivi)
- Auth & Workspace
- Module Registry (feature flags)
- RBAC + Superadmin
- Branding
- Audit log
- Dashboard (minima)

### Moduli business (feature flags)
- team
- clients
- projects
- checklists
- quotes
- web
- vault
- seo

Regola: modulo disabilitato => **API 403 + UI nascosta**.

## 3) Ruoli
Ruoli base:
- Superadmin (decide tutto nel workspace)
- Admin
- Manager
- Operativo
- Viewer
- Cliente (opzionale, non MVP)

Superadmin può:
- attivare/disattivare moduli
- creare/modificare ruoli e permessi
- configurare branding (logo/colori/nome)
- configurare pipeline per categoria
- creare template checklist e preventivi
- vedere audit log
- gestire policy Vault

## 4) Permessi (RBAC) – Convenzione
Formato: `{module}.{action}` (stringhe stabili)
Esempi:
- `modules.manage`
- `branding.manage`
- `clients.view|create|edit|delete`
- `projects.view|create|edit|delete|move_stage`
- `checklists.view|manage_templates|complete_item|override_gate`
- `quotes.view|create|send|accept|manage_templates`
- `web.view|create|edit|delete`
- `vault.view_list|create|edit|reveal|delete`
- `seo.view|run_scan|export|manage_settings`
- `audit.view`

## 5) Branding (white-label)
Configurabile dal Superadmin per workspace:
- logo
- primary_color
- secondary_color
- nome workspace

Applicazione: UI + PDF preventivi.

## 6) Checklist & Gate (cuore operativo)
- Esistono Checklist Template e Checklist Instance.
- Le checklist possono essere agganciate a:
  - stage della pipeline (projects)
  - stato asset WEB (web)
- Gate: uno stage “chiave” non è completabile se gli item obbligatori non sono completati.
- Item supportano:
  - obbligatorio sì/no
  - evidenza richiesta (note/link)
  - non applicabile (con motivazione)
- Audit completamenti: user + timestamp + item.

## 7) Ordine obbligatorio di implementazione
### MVP 1 (vendibile)
1. Bootstrap boilerplate + env + prisma migrate/seed
2. Module registry + middleware + menu dinamico
3. RBAC + Superadmin + permission checks API
4. Branding (workspace)
5. clients
6. projects + pipeline
7. checklists (gate)
8. quotes (base)

### MVP 2
9. web (almeno “Siti Web”)
10. vault (cifratura + reveal + audit)
11. scadenziario WEB

### MVP 3
12. seo analyzer + IA + export
13. report cliente (se serve)

## 8) Vincoli
- Non aggiungere funzionalità non richieste.
- Se manca un dettaglio: scegliere la soluzione più semplice e documentarla in `ARCHITECTURE.md`.
