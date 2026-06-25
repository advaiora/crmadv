# Gap Analysis & Roadmap Versionata — CRM "Agenzia Next-Gen"

> Confronto tra lo **stato attuale del codice** (vedi `01-brief-stato-attuale.md`) e il **Brief Operativo Definitivo** (`02-brief-operativo-definitivo-bibbia.md`, "la bibbia"), seguito dalla roadmap di sviluppo suddivisa in build versionate.
> Data: 25 giugno 2026 · Riferimento target: *Brief Operativo Definitivo — Agenzia Next-Gen*

---

## Parte 0 — Come leggere questo documento

Il Brief Definitivo è la **fonte di verità**: UX Apple-style, moduli, funzioni e integrazioni descritte lì sono l'obiettivo finale. Il codice attuale è la **base di partenza**: un CRM multi-tenant solido e modulare, ma costruito su un template Bootstrap (Jampack) e con un motore AI ancora embrionale.

Legenda stato:
- ✅ **Presente** — esiste e sostanzialmente allineato al target
- 🟡 **Parziale** — esiste uno scaffold/base ma va completato o rifatto per allinearsi
- ❌ **Assente** — da costruire da zero

---

## Parte A — Feature Gap Analysis (sezione per sezione del Brief)

### 1. Filosofia di design — Apple Style (sottrazione)

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| UX minimalista "Apple-style", frictionless | ❌ | Template **Jampack/Bootstrap** generico, con decine di pagine demo (Blog, Gallery, FileManager, Invoices, Scrumboard, Todo…) | Nuovo **design system** (token, tipografia, spacing, motion), pulizia boilerplate, redesign progressivo |
| **Advanced Find** (ricerca globale istantanea) | ❌ | Nessuna ricerca globale | Costruire **Command-K** cross-entità (progetti/clienti/comandi) |
| **Shortcuts** personalizzabili | ❌ | Assenti | Sistema di scorciatoie configurabili per utente |
| Riduzione del carico cognitivo / menu contestuale per ruolo | 🟡 | Esiste il menu dinamico per modulo attivo, ma è verboso | Menu "per task corrente", nascondere complessità |

### 2. Multi-tenant e accessi

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| Architettura multi-tenant pura (workspace isolati) | ✅ | `Workspace` + `workspaceId` ovunque, query workspace-scoped lato server | Mantenere |
| **Super Admin: dashboard globale** per creare/sospendere/configurare workspace | ❌ | "Superadmin" esiste solo **dentro** un workspace; non c'è console cross-workspace; i workspace nascono da seed | Costruire **console Super Admin globale** + provisioning workspace |
| Ruoli custom granulari **"Discord-style"** | 🟡 | RBAC completo (`Role`/`Permission`/`RolePermission`) e catalogo permessi `{module}.{action}` già presente lato backend; manca UI builder e granularità "a spunta" | UI editor ruoli + permessi fine-grained |
| **Vincoli gerarchici** (es. dipendente non fissa appuntamenti al capo reparto — "Source constraint") | ❌ | Nessuna business-logic gerarchica | Modellare gerarchia ruoli + regole di azione |
| Personalizzazione utente (tema, colori, foto profilo) | 🟡 | Pagina `Profiles` ereditata dal template, non cablata ai dati | Wiring preferenze utente persistenti |
| Barra ricerca "Command-K style" | ❌ | Assente | (vedi 1 — Advanced Find) |

### 3. Anagrafica Clienti (B2B & B2C)

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| Anagrafiche B2B/B2C | ✅ | Modulo `clients` con `type person/company`, indirizzo, P.IVA/CF, tag | Mantenere/raffinare |
| **Import/Export massivo** | ❌ | Assente | Importer/exporter CSV/Excel con mapping |
| **Custom Fields** persistenti (parte dello schema workspace) | ❌ | Nessun campo dinamico | Motore **Custom Fields** (definizione + storage + render) |
| Integrazione **Brevo** (sync contatti) | ❌ | Assente | Connettore Brevo bidirezionale |
| Integrazione **Fatture in Cloud** (anagrafiche + storico) | ❌ | Assente | Connettore Fatture in Cloud |
| **API framework a plugin** | 🟡 | C'è `AgencyRuntimeSetting` (config/segreti cifrati per workspace) come base | Formalizzare layer integrazioni a plugin |

### 4. Team e reparti

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| Modulo team / membership / inviti | ✅ | `team` completo: membership lifecycle, inviti con token hash, assegnazione ruoli | Mantenere |
| **Reparti** (Web, Marketing, Social, Grafica, Laboratorio) | ❌ | Nessun concetto di reparto (solo riferimenti sparsi) | Modello **Department** + appartenenza utente/progetto |
| **Visibilità pertinente** (utente vede solo progetti/task in cui è coinvolto) | 🟡 | `ProjectTask` con `teamRole`/assegnatari esiste; manca enforcement di visibilità per reparto/assegnazione | Filtri di visibilità per assegnazione + reparto |

### 5. Progetti e Motore AI Context-Aware ← **il cuore del sistema**

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| **Modulo Fonti**: URL + Word/PDF + asset brand | 🟡 | Ingestione **Word/PDF** via `mammoth` + `pdf-parse` presente; `ProjectMemory` con `sourcesJson/briefJson/webJson…` | Completare ingestione URL/social + asset, normalizzazione |
| **Vettorizzazione** (vector knowledge base, memoria persistente) | ❌ | Nessun embedding/vector store; il contesto viene passato come testo "chunked" nel prompt | Introdurre **embeddings + pgvector** (RAG reale) |
| **Discovery** (Business Recap, Obiettivi/Target, Offerta/Competitor) | 🟡 | Forte scaffolding: pagina Discovery + `diagnosis-engine` + **competitor web search** (OpenAI web search/SerpAPI) | Consolidare su RAG reale, output strutturato |
| **Modelli multipli** (economici per recap, premium per strategia) | 🟡 | Config `aiProvider/aiModel/functionModels` + `gpt-4o-mini` default + mapping per-funzione | Aggiungere **provider Claude/Anthropic** (manca del tutto) accanto a OpenAI |
| **Stima costo/token prima dell'esecuzione** | 🟡 | Logica di stima costi presente (riferimenti "estimate/cost" diffusi) | Esporre stima nella UI di **ogni** pulsante AI |
| **Budget token giornaliero per dipendente** | ❌ | Solo limiti output a livello settings; nessun budget per-utente/die | Sistema di **quota & tracking consumi** per utente |
| **Higgsfield** (visual generation: Contesto → Claude → Higgsfield) | ❌ | Assente | Integrazione Higgsfield + catena prompt-architect |
| **Chat AI di progetto** context-aware | ❌ | Praticamente assente | Costruire chat RAG sul contesto progetto |

> **Nota strategica:** il motore AI è già avviato (chiamate reali a OpenAI Responses API, ingestione documenti, competitor search, config costi). Non si parte da zero, ma **manca lo strato RAG vero (vettorizzazione)**, il **provider Claude**, la **chat di progetto**, **Higgsfield** e il **budgeting per dipendente**.

### 6. Moduli verticali

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| **Web & ADV**: strutture HTML/landing, copy campagne Meta/Google/TikTok per sotto-progetto | 🟡 | `agencyWebRules`/`agencyAdsRules` (regole, non generativo) + pagine Web/Ads | Passare a generazione AI reale, sotto-progetti |
| **Laboratorio/Stampa — Zero Error Protocol** (validazione AI misure/materiali vs Fonti) | ❌ | Inesistente | Nuovo modulo Laboratorio + validazione AI obbligatoria |
| **Audit Engine SEO** (H1, meta tag, mancanze) | 🟡 | `WebAssetSeoReport` modellato, modulo `seo` registrato ma analyzer non completo | Completare analyzer URL + suggerimenti |
| **Report PDF brandizzato** Apple-style | 🟡 | `reporting-engine`/`client-report-engine` + PDF preventivi (`pdfkit`) | Template report Apple-style + import dati (es. Google Ads) |

### 7. Preventivatore

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| Preventivi con template/righe/PDF/email | ✅ | Modulo `quotes` completo (template, sconti, stati, log email, PDF) | Mantenere |
| **Drag-and-drop** su pacchetti predefiniti | 🟡 | Template esistono, ma niente builder DnD a pacchetti | Builder a pacchetti drag-and-drop |
| **Output duale**: Analitico + **Proposta Apple-style** (slide) | 🟡 | Solo PDF analitico | Generatore proposta visuale Apple-style |
| **Validità 72h** + notifica account manager | 🟡 | Campo `validUntil` esiste; nessuna automazione/notifica | Automazione scadenza + notifica |

### 8. Calendario e comunicazione

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| Calendario eventi | ✅ | Modulo `calendar` (FullCalendar) | Mantenere |
| Messaggistica interna asincrona | ✅ | `messaging` 1:1 su DB (no SMTP) | Potenziare a thread di progetto |
| Integrazione **Meet/Zoom** | ❌ | Assente | Connettori videoconferenza |
| Reminder automatici clienti | ❌ | Assente | Engine notifiche/reminders |
| Link personali **Calendly-style** per dipendente | ❌ | Assente | Booking pubblico per disponibilità |

### 9. Contabilità e controllo di gestione

| Requisito Brief | Stato | Realtà nel codice | Intervento |
|---|:---:|---|---|
| **Fatture in Cloud** (fatturati/flussi nel CRM, solo Admin) | ❌ | Assente | Connettore + viste finanziarie |
| **Analisi redditività real-time** (tempo/risorse vs fatturato) | ❌ | Assente; manca anche il **time-tracking** | Time-tracking + motore redditività per cliente/reparto |

### 10. Protocollo di Merge — *questo documento*

La sezione 10 del Brief chiede esattamente l'output che segue: **Feature Gap Analysis** (Parte A), **Schema Mapping** (Parte B) e **Priorità di Rilascio** (Parte C).

---

## Parte B — Schema Mapping: Mantieni / Evolvi / Dismetti

### Da MANTENERE (fondamenta già valide, allineate alla bibbia)
- Multi-tenancy workspace-centric + guardie `requireAuth/Workspace/Module/Permission`.
- RBAC (`Role`/`Permission`/`RolePermission`/`UserRole`) — base perfetta per i ruoli "Discord-style".
- Moduli: `clients`, `projects`+pipeline, `checklists`+gate, `quotes`, `calendar`, `team`, `messaging`, `vault`, `web-assets`, `audit`, `branding`.
- Modelli Agency OS: `ProjectMemory`, `ProjectOpportunity`, `ProjectAlert`, `ProjectTask`, `AgencyRuntimeSetting` (config/segreti cifrati → ottimo per le API key delle integrazioni).
- Ingestione documenti (`mammoth`/`pdf-parse`) e chiamate OpenAI già funzionanti.

### Da EVOLVIRE (esiste ma va rifatto/esteso per il target)
- **Tema/UI**: da Jampack-Bootstrap → design system Apple-style.
- **AI**: da "prompt con testo chunked" → **RAG con embeddings/pgvector**; da OpenAI-only → **multi-provider (OpenAI + Claude)**; aggiungere chat di progetto e budgeting per utente.
- **Clienti**: aggiungere Custom Fields + import/export.
- **Quotes**: aggiungere builder DnD + proposta Apple-style + automazione 72h.
- **SEO/Report**: completare analyzer e template report brandizzati.
- **Messaging/Calendar**: thread di progetto, video, reminder, booking.

### Da DISMETTERE / RIPULIRE (boilerplate non pertinente)
- Pagine demo del template non richieste dalla bibbia: `Blog`, `Gallery`, `FileManager`, `Invoices` (demo), `Scrumboard` (demo), `Todo` (demo), `ChatPopup`, `Contact`, `Profiles` demo non cablate.
- File di servizio in root: `backup.sql`, `api-debug.err`, `note.md`.
- Dipendenze UI ridondanti del template (da valutare in fase di slimming).

### Schema DB — estensioni previste (nuove tabelle/colonne)
- `Department` (+ relazione utente/progetto/reparto) → **V2**
- `CustomFieldDefinition` + `CustomFieldValue` (per workspace) → **V3**
- `ProjectSource` + `SourceChunk`/`Embedding` (pgvector) → **V4**
- `AiUsageLog` + `AiBudget` (per utente/die) → **V4**
- `Integration`/`IntegrationCredential` (Brevo, Fatture in Cloud, Zoom…) → **V3/V9**
- `LabJob` + `LabValidation` → **V6**
- `TimeEntry` (time-tracking) + viste redditività → **V9**
- `BookingLink`/`Availability` (Calendly-style) → **V8**

---

## Parte C — Roadmap operativa in build versionate

Principio di sequenziamento: **prima la shell (UX + accessi) in cui tutto vive, poi il motore AI differenziante, poi i verticali, infine integrazioni e migrazione**. Ogni versione è rilasciabile e non rompe l'operatività (requisito "senza interruzioni" del Brief §10).

> Le versioni sono cumulative: ogni build **contiene tutto il precedente** e aggiunge il nuovo blocco.

---

### 🟦 V1 — Foundation & Apple-Style Shell *(re-baseline)*
**Obiettivo:** trasformare la base attuale nello scheletro Apple-style e ripulire il boilerplate.
**Contenuto (nuovo rispetto ad oggi):**
- Design system Apple-style: token colore/tipografia/spacing/motion, componenti base.
- Pulizia pagine demo non pertinenti e file di servizio in root.
- **Advanced Find / Command-K** (ricerca globale: progetti, clienti, comandi).
- **Shortcuts** personalizzabili + personalizzazione utente (tema, colori, foto profilo) cablata.
- Navigazione "a sottrazione": menu contestuale per modulo/ruolo.
**Si appoggia su:** multi-tenant + RBAC + moduli già esistenti.
**Done quando:** l'app gira nel nuovo look, Command-K naviga ovunque, zero pagine demo.

### 🟦 V2 — Super Admin Console, Ruoli Discord-Style & Reparti
**Obiettivo:** governance multi-tenant completa e organizzazione per reparti.
**Contenuto:**
- **Console Super Admin globale**: creazione/sospensione/configurazione workspace, log costi AI, config API.
- **Editor ruoli "Discord-style"** (UI granulare su permessi già esistenti) + **vincoli gerarchici** (Source constraint sugli appuntamenti).
- Modello **Reparti** (Web, Marketing, Social, Grafica, Laboratorio) + appartenenza.
- **Visibilità pertinente** per assegnazione/reparto (dashboard "pulite").
**Done quando:** un Super Admin crea un workspace, definisce ruoli custom e reparti, e ogni utente vede solo il proprio perimetro.

### 🟦 V3 — Anagrafica Evoluta: Custom Fields, Import/Export & Layer Integrazioni
**Obiettivo:** dato cliente flessibile e pronto alle sincronizzazioni.
**Contenuto:**
- **Custom Fields** persistenti per workspace (definizione + render + storage).
- **Import/Export massivo** clienti (CSV/Excel con mapping).
- **Layer integrazioni a plugin** (su base `AgencyRuntimeSetting`) + primo connettore **Brevo** (sync contatti).
**Done quando:** si importano contatti in massa, si aggiungono campi custom usati in tutto il workspace, Brevo sincronizza.

### 🟦 V4 — Motore AI Context-Aware *(il cuore)*
**Obiettivo:** memoria di progetto vera + AI economicamente controllata.
**Contenuto:**
- **Modulo Fonti** completo: URL/social + Word/PDF + asset brand → **vettorizzazione (embeddings + pgvector)** → memoria persistente.
- **Discovery** consolidata su RAG reale (Business Recap, Obiettivi/Target, Offerta/Competitor).
- **Chat AI di progetto** context-aware.
- **Multi-provider**: aggiunta **Claude/Anthropic** (prompt architect) accanto a OpenAI; mapping modello-per-funzione (economico vs premium).
- **Cost control**: stima costo/token su ogni pulsante AI + **budget giornaliero per dipendente** con tracking consumi.
**Done quando:** si interroga in chat il brief di un progetto, la Discovery gira su fonti vettorizzate, e i consumi/budget sono visibili e limitabili.

### 🟦 V5 — Verticali AI: Web & ADV + Audit/Report
**Obiettivo:** produzione asset guidata dal contesto.
**Contenuto:**
- **Web & ADV**: generazione strutture HTML/landing + copy campagne **Meta/Google/TikTok** per sotto-progetto.
- **Higgsfield** visual generation (catena Contesto → Claude → Higgsfield).
- **Audit Engine SEO** (analisi URL: H1, meta, mancanze) — completa il modulo `seo`.
- **Report PDF brandizzato Apple-style** con import dati (es. conversioni Google Ads).
**Done quando:** da un progetto si generano landing+copy coerenti col brand e un report cliente brandizzato.

### 🟦 V6 — Laboratorio & Zero Error Protocol
**Obiettivo:** azzerare gli errori di stampa.
**Contenuto:**
- Modulo **Laboratorio (Stampa)**: schede materiali/misure, ruolo **Reparto Lab**.
- **Validazione AI obbligatoria** pre-stampa: confronto dati tecnici ↔ Fonti del progetto, con segnalazione discrepanze in tempo reale.
**Done quando:** nessun job va in stampa senza esito di validazione AI.

### 🟦 V7 — Preventivatore Pro & Strumenti di Vendita
**Obiettivo:** vendita rapida e d'impatto.
**Contenuto:**
- **Builder drag-and-drop** su pacchetti predefiniti.
- **Output duale**: Preventivo Analitico + **Proposta Apple-style** (slide vendita).
- **Validità 72h** automatica + notifica account manager alla scadenza.
**Done quando:** in pochi click si genera sia il documento tecnico sia la proposta visuale, con scadenza gestita.

### 🟦 V8 — Calendario & Comunicazione Avanzata
**Obiettivo:** appuntamenti e comunicazioni centralizzati.
**Contenuto:**
- Integrazione **Meet/Zoom**.
- **Link Calendly-style** per dipendente (disponibilità reale del workspace).
- **Reminder automatici** clienti.
- Messaggistica potenziata a **thread di progetto**.
**Done quando:** un cliente prenota da link personale, riceve reminder, e la conversazione resta legata al progetto.

### 🟦 V9 — Contabilità, Redditività & Integrazioni Business
**Obiettivo:** controllo di gestione data-driven.
**Contenuto:**
- Connettore **Fatture in Cloud** (fatturati/flussi nel CRM, riservato Admin).
- **Time-tracking** su progetti/task.
- **Analisi redditività real-time** (tempo/risorse ↔ fatturato) per cliente e reparto.
- Completamento **API framework** a plugin per integrazioni future.
**Done quando:** l'Admin vede la redditività effettiva per cliente/reparto in tempo reale.

### 🟦 V10 — Finale: Migrazione Legacy, Hardening & Rollout
**Obiettivo:** transizione completa senza interruzioni.
**Contenuto:**
- **Schema mapping & migrazione dati** dal sistema legacy (continuità clienti/storico).
- **Hardening** sicurezza/performance, audit completo, test end-to-end.
- Rollout progressivo + QA finale, dismissione definitiva del legacy.
**Done quando:** tutti gli utenti operano sulla nuova piattaforma Apple-style, dati migrati e verificati.

---

## Sintesi visiva della progressione

| Build | Tema | Blocco aggiunto |
|---|---|---|
| **V1** | Shell | Apple UX + Command-K + cleanup |
| **V2** | Governance | Super Admin console + ruoli Discord-style + reparti |
| **V3** | Dato | Custom Fields + import/export + Brevo |
| **V4** | **AI core** | Fonti vettorizzate + Discovery RAG + chat + multi-model + budgeting |
| **V5** | Produzione AI | Web&ADV + Higgsfield + SEO audit + report Apple-style |
| **V6** | Lab | Zero Error Protocol (validazione stampa) |
| **V7** | Vendita | Preventivatore DnD + proposta Apple-style + 72h |
| **V8** | Agenda | Meet/Zoom + Calendly + reminder + thread progetto |
| **V9** | Finance | Fatture in Cloud + time-tracking + redditività |
| **V10** | Go-live | Migrazione legacy + hardening + rollout |

### Note di sequenziamento
- **V4 è la priorità di valore** (il differenziatore AI) e può essere parzialmente parallelizzata a V2/V3 perché lo scaffold OpenAI esiste già.
- V1–V3 sono prerequisiti UX/dato che rendono "vendibile" e ordinata ogni feature successiva.
- V6 dipende da V4 (la validazione Lab usa le Fonti vettorizzate).
- V9 richiede il time-tracking introdotto qui come prerequisito della redditività.

---

*Documento prodotto confrontando il Brief Operativo Definitivo con l'analisi del codice (`prisma/schema.prisma`, `server/modules/`, `src/`, `server/modules/agency-os/agency.service.ts`). Vedi anche `01-brief-stato-attuale.md` per il dettaglio dello stato attuale.*
