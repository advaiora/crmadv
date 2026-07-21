# Gap Analysis & Roadmap Versionata — CRM "Agenzia Next-Gen"

> Confronto tra lo **stato attuale del codice** (vedi `01-brief-stato-attuale-pre-revisione-apple-style.md`) e il **Brief Operativo Definitivo** (`02-brief-operativo-definitivo-bibbia.md`, "la bibbia"), seguito dalla roadmap di sviluppo suddivisa in build versionate.
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
| **Super Admin: dashboard globale** per creare/sospendere/configurare workspace | ✅ | **FATTA (4a+4b):** identità Super Admin di piattaforma (`User.isPlatformAdmin`, bootstrap da `PLATFORM_ADMIN_EMAILS`), console `/settings/platform-console`, provisioning workspace (crea/rinomina/sospendi/riattiva) + promozione admin, **log costi AI** (tabella `AiUsageLog`, aggregati per workspace) e **vista config AI** per workspace (abilitato/modello/chiave presente) | Completato |
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
> **Numerazione aggiornata al 15/7/2026** (nuova V4 = Chat AI & Messaggistica, tutto il resto slittato di uno).

- `Department` (+ relazione utente/progetto/reparto) → **V2**
- `CustomFieldDefinition` + `CustomFieldValue` (per workspace) → **V3**
- `ProjectSource` + `ProjectSourceChunk` (pgvector) → **V5** — ✅ fatti (migrazioni `20260710081730`, `20260713074114`)
- `AiUsageLog` + `AiBudget` (per utente/die) → **V5** — ✅ fatti
- `AiConversation` + `AiConversationParticipant`/`Message`/`Attachment` → **V4** — ✅ fatti (chat collaborativa, sessioni multiple, allegati)
- `Integration`/`IntegrationCredential` (Brevo, Fatture in Cloud, Zoom…) → **V3/V10**
- `LabJob` + `LabValidation` → **V7**
- `TimeEntry` (time-tracking) + viste redditività → **V10**
- `BookingLink`/`Availability` (Calendly-style) → **V9**
- Modello a **conversazioni per la messaggistica** (gruppi di reparto/agenzia, oltre l'1-a-1 di `WorkspaceMessage`) → **V9**

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
- **Brandizzazione colori — schemi + equilibrio tema (da definire):** oggi il workspace ha due color-picker liberi (primario/accento + secondario), senza preset né vincoli. Va progettato: quali schemi/preset offrire e le **regole/guardrail che garantiscano leggibilità ed equilibrio visivo in chiaro *e* scuro** nonostante il colore scelto dall'utente (le neutre restano dai token; si valida/aggiusta solo l'accento). Rifinitura del design system: farla verso fine V1, al più tardi a inizio V2 (prima di aprire la brandizzazione a workspace reali).
- Navigazione "a sottrazione": menu contestuale per modulo/ruolo.
**Si appoggia su:** multi-tenant + RBAC + moduli già esistenti.
**Done quando:** l'app gira nel nuovo look, Command-K naviga ovunque, zero pagine demo.

### 🟦 V2 — Super Admin Console, Ruoli Discord-Style & Reparti
**Obiettivo:** governance multi-tenant completa e organizzazione per reparti.
**Contenuto:**
- **Console Super Admin globale**: creazione/sospensione/configurazione workspace, log costi AI, config API.
  - **Fase 4a — FATTA (8 luglio 2026):** identità Super Admin di piattaforma sopra i workspace (`User.isPlatformAdmin`, promossa all'avvio dalle email in `PLATFORM_ADMIN_EMAILS`, poi promozione/rimozione dalla console), nuovo guard `requirePlatformAdmin`, API `/admin/*` cross-workspace, pagina `src/views/Settings/PlatformConsole.jsx` (menu "Piattaforma" → "Console piattaforma", visibile solo ai platform admin). Un workspace **sospeso** blocca login/accesso dei suoi membri (i platform admin restano esenti). Migrazione `20260708133751_platform_admin_workspace_status`.
  - **Fase 4b — FATTA (8 luglio 2026):** tabella `AiUsageLog` (una riga per chiamata AI, salvata nel ramo di successo di `runAgencyOpenAiJsonWithMeta`), API `/admin/ai-usage` (costi/token aggregati per workspace + totali + ultime chiamate, finestra 7/30/90 giorni) e `/admin/ai-config` (per workspace: AI abilitata, modello, chiave API presente sì/no senza esporre il segreto, max token). Nella console: sezioni "Costi AI" e "Configurazione AI per workspace". Migrazione `20260708151727_ai_usage_log`. **Blocco 4 completo.**
- **Editor ruoli "Discord-style"** (UI granulare su permessi già esistenti) + **vincoli gerarchici** (Source constraint sugli appuntamenti).
- Modello **Reparti** (Web, Marketing, Social, Grafica, Laboratorio) + appartenenza.
- **Visibilità pertinente** per assegnazione/reparto (dashboard "pulite"), con **gerarchia di reparto** (Capo Reparto vs sottoposti): il sottoposto vede di default solo i progetti a lui assegnati; il Capo Reparto vede tutti i progetti del proprio reparto e ne gestisce gli accessi dei sottoposti. Progetti senza reparto: gestibili solo da Capi Reparto e ruoli superiori, visibili solo agli utenti assegnati.
**Done quando:** un Super Admin crea un workspace, definisce ruoli custom e reparti, e ogni utente vede solo il proprio perimetro.

> **Da fare più avanti (rimandato dalla Fase "Visibilità pertinente"):** *granularità dei permessi per singolo progetto* — distinguere "**vede**" da "**vede ma non modifica**" a livello di singolo progetto/utente. Nella prima implementazione l'accesso a un progetto è **binario** (l'utente lo vede oppure no); il controllo fine vedere-vs-modificare per-progetto è un raffinamento successivo, da agganciare al modello di assegnazione progetto→utente introdotto qui in V2.

> **~~Da fare più avanti~~ FATTA (9 luglio 2026) — rifattorizzazione Console piattaforma:** la Console è stata **separata in due sotto-pagine (tab)** dentro `PlatformConsole.jsx` (ora solo il guscio: intestazione + navigazione a linguette): (1) **Gestione workspace & accessi** → `src/views/Settings/platform/PlatformWorkspacesPanel.jsx` (provisioning/rinomina/sospensione workspace + Super Admin di piattaforma); (2) **Consumi & costi AI** → `src/views/Settings/platform/PlatformAiUsagePanel.jsx` (costi per workspace **e per utente**, config AI per workspace, ultime chiamate) con **filtri** per periodo, utente, modello e funzione. Aggiunto il **tracciamento per singolo utente**: `AiUsageLog` ora ha la colonna `userId` (migrazione `20260709073610_ai_usage_log_user`) valorizzata dal **contesto di richiesta** (`server/core/request-context.ts`, AsyncLocalStorage: userId impostato in `requireAuthIdentity`, letto in `runAgencyOpenAiJsonWithMeta`; i job di sistema senza richiesta HTTP restano `userId=null` → riga "Sistema / non tracciato"). API `/admin/ai-usage` estesa con aggregazione `perUser`, opzioni filtro (`users`/`models`/`functions`, sull'intero periodo) e i filtri opzionali `userId`/`model`/`functionName`.

### 🟦 V3 — Anagrafica Evoluta: Custom Fields, Import/Export & Layer Integrazioni
**Obiettivo:** dato cliente flessibile e pronto alle sincronizzazioni.
**Contenuto:**
- **Custom Fields** persistenti per workspace (definizione + render + storage). **FATTO (9 luglio 2026):** backend — modello `CustomFieldDefinition` per workspace/entità (per ora `client`) + colonna JSON `Client.customFields` (migrazione `20260709092257_custom_field_definitions`); modulo `server/modules/custom-fields/` (repository, service con validazione slug/tipi/opzioni/riordino + validazione **valori** dei clienti, rotte CRUD `/custom-fields` protette da `clients.view`/`clients.edit`); validazione/storage dei valori dentro `createClient`/`updateClient` (obbligatori compresi). Frontend — pagina di gestione `src/modules/customFields/ui/CustomFieldsPage.jsx` (rotta `/apps/clients/custom-fields`, tab sotto Clienti) con crea/modifica/riordino/elimina; **render** dei campi nel form cliente (`ClientForm.jsx`, "Sezione 7") con validazione degli obbligatori. Verificato end-to-end (backend via curl/fetch; frontend compila senza errori). Visualizzazione nel **dettaglio** cliente FATTA (`ClientDetail.jsx`). Inclusione nei CSV **FATTA (9 luglio 2026):** vedi riga Import/Export qui sotto.
- **Import/Export massivo** clienti (CSV/Excel con mapping). **GIÀ FATTO** in precedenza: rotte `/clients/import` e `/clients/export` (`server/modules/clients/csv.ts`). **Esteso ai Custom Fields (9 luglio 2026):** l'export aggiunge una colonna per ogni campo personalizzato attivo con intestazione `cf:<chiave>` (es. `cf:budget`); l'import riconosce le stesse colonne, converte i valori per tipo (numero/booleano/data/select), ignora le chiavi sconosciute e applica gli obbligatori (fallimento isolato per riga). Definizioni lette una sola volta per import. File: `server/modules/clients/service.ts`; validazione in `server/modules/custom-fields/custom-fields.service.ts` (`validateValuesWithDefinitions`/`listActiveDefinitions`). Test: `server/modules/clients/service.customfields.test.ts`.
- **Layer integrazioni a plugin** + primo connettore **Brevo** (sync contatti). **FATTO (9 luglio 2026).** Modulo dedicato e indipendente da agency-os: `server/modules/integrations/` (repository, service, connettore `connectors/brevo.ts`, rotte `/integrations` protette da `clients.view`/`clients.edit`). Modello Prisma **`Integration`** per workspace (migrazione `20260709143726_integrations_layer`) con chiave API **cifrata a riposo** riusando la DEK di workspace del vault (AES-256-GCM, `integrations.crypto.ts`); config non segreta (id lista) in `configJson`. Il connettore Brevo usa l'API v3 (`/account` per il test, `/contacts` con `updateEnabled` per l'upsert). La sync invia i clienti **con email** come contatti (nome/cognome/telefono→SMS, lista opzionale), errori isolati per contatto, esito registrato su `lastSync*`. Frontend: scheda **Integrazioni** sotto Clienti (`/apps/clients/integrations`, `src/modules/integrations/ui/IntegrationsPage.jsx`) per salvare la chiave (mascherata), testare, abilitare e sincronizzare. **Nota progettuale:** scelto un modello dedicato invece di riusare `AgencyRuntimeSetting` (di Claudio) per non avere due scrittori sulla sua tabella; riusata solo la crittografia condivisa del vault. Verificato end-to-end (round-trip cifratura con DEK reale + chiamata Brevo) e nel browser. Test: `server/modules/integrations/**/*.test.ts`.
**Done quando:** si importano contatti in massa, si aggiungono campi custom usati in tutto il workspace, Brevo sincronizza. → **V3 COMPLETA.**

### 🟦 V4 — Chat AI & Messaggistica *(in corso)*

> **Da dove esce questa V (15 luglio 2026).** Non era in roadmap. È nata dentro la V4 originale (ora **V5**) come implementazione minore — "una chat di progetto context-aware" — e strada facendo si è ingigantita: multi-utente, ambiti, popup globale, allegati, sessioni multiple, permessi dedicati, e infine l'aggregazione con la messaggistica fra persone. Il 15/7 si è preso atto che **è una V a tutti gli effetti** e le si è dato il numero 4: è quella che si sta facendo ora, quindi il numero segue il lavoro. La V4 originale slitta a V5 e resta **spezzata** (il suo residuo si completa dopo questa V); tutte le successive slittano di uno.

**Obiettivo:** un solo posto dove si parla — con l'AI per lavorare, con le persone per coordinarsi — senza mai confondere le due cose.

**Fonte di verità:** `archivio-documenti/spec-chat-ai-collaborativa.md` (decisioni, piano a fasi, sez. 4-bis sessioni/gruppi, sez. 4-ter ingressi).

**Il principio** (sez. 4-ter): si aggrega **l'ingresso**, non le due nature. Un solo pulsante in topbar → popup → **selettore** `Chat AI` / `Messaggi`. Due mondi che **non si mescolano mai**, nemmeno negli elenchi: la messaggistica è *parlare fra persone*, la chat AI è *svolgere lavoro con l'AI*.

#### ✅ Fatto
- **Fase 1 — Modello conversazioni + chat di progetto condivisa** (14/7): multi-utente su invito, `AiConversation`/`AiConversationParticipant`/`AiConversationMessage`.
- **Fase 2 — Ambiti + popup globale + selettore** (14/7): Generale/Cliente/Progetto, stessa conversazione da scheda e da popup.
- **Fase 3a — Allegati + "Chiedi all'AI"** (15/7): documenti (riusa l'estrattore delle Fonti) ed elementi CRM, da menu ⋯ e tasto destro. Registro consumi per progetto/conversazione.
- **Sez. 4-bis — Sessioni multiple e governo dei gruppi** (15/7): un ambito ha **N sessioni**, non una sola; creatore che può uscire, congelamento invece della cancellazione, "riprendi in una nuova chat"; **permessi dedicati** `chat.view`/`chat.use`/`chat.moderate` (prima inviare un messaggio — che costa soldi — chiedeva lo stesso permesso della sola lettura); l'admin **modera senza leggere**. *Qui è emerso che la chat era di fatto rotta per chiunque non arrivasse per primo su un ambito.*
- **Sez. 4-ter punti 1, 2, 6** (15/7, commit `528fa59`): **selettore Chat AI/Messaggi** nel popup (la messaggistica entra sul suo modello 1-a-1 attuale, riusando il layer API già in casa); **pulsante espandi** a tutto schermo (l'elenco diventa colonna, il contenuto resta a 860px centrati); **alfabeto delle icone** (`chatIcons.js`, un'icona per concetto).
- **Sez. 4-ter punto 3 — Gestione gruppi nel popup + eliminata la scheda Chat di Agency** (16/7): partecipanti, azzeramento e **"Sciogli il gruppo"** (che nell'interfaccia non c'era) spostati nel popup (`ChatParticipantsPanel.jsx`), per **tutti e tre gli ambiti** — la scheda copriva solo il Progetto. **Solo dopo** cancellata `AgencyProjectChatPage` con la sua voce nella barra tab, la rotta, l'icona `ExternalLink` e 11 funzioni chat morte nell'adapter dati. Verificato dal vivo: invito, scioglimento e congelamento dell'ex membro (confermato contro l'API).
- **Sez. 4-ter punto 4 — Modulo Messaggi = la casella** (16/7): `/apps/email` è ora la chat a tutto schermo montata su rotta, con lo stesso selettore dei due mondi. **"Una sola implementazione"**: modalità `inline` su `AiChatWidget` (stesso componente, non una copia), corpo condiviso in una `const surface`. Nuova `src/views/Messaging/MessagingInboxPage.jsx`; vecchia `Email/index.jsx` sostituita e rimossa; voce/rotta/badge non-letti invariati.
- **Sez. 4-ter punto 5 — QoL casella** (16/7): la casella **ricorda la conversazione Messaggi aperta** cambiando mondo (persona sollevata da `MessagingPanel` a `AiChatWidget`).
- **AI risponde da solo** (16/7): in una sessione con un solo partecipante attivo l'AI risponde a **ogni** messaggio (niente `@AI`); in gruppo torna la regola. UI con un solo tasto "Invia" quando sei da solo.
- **Tasto destro sul widget "I miei progetti" della Dashboard** (16/7): `askAiRowProps('project', item)` in `MyProjectsWidget.jsx`.
- **Fase 5 — Compressione del contesto** (16/7, *versione a finestra*): oltre ~45% della finestra del modello i messaggi vecchi si riassumono (chiamata AI a budget), coda recente verbatim. `chat-context.ts` + test 7/7. La versione **persistita** (copre tutto lo storico) resta da fare (vuole una colonna → migrazione).
- **Fase 6 — Navigazione suggerita** (16/7): l'AI può proporre bottoni verso aree del CRM (mai automatici), filtrati per permessi. `chat-nav.ts` + test 8/8. Suggerimenti non persistiti (CTA una tantum).
- **Onboarding leggero** della chat (16/7): riga dismissibile in-contesto (`ChatOnboarding.jsx`), ricordata in localStorage.

#### ⏭️ Da fare / da decidere
- **Fase 4 — Tempo reale (websocket)** ✅ **FATTA (16/7)** — deciso **websocket** con auth via **biglietto usa-e-getta** (codice monouso a scadenza, niente token nell'URL: regola privacy salva). Server (biglietto + hub "segnale+refetch" + rotta con controllo Origin, trasmissione da messaggistica e chat) e client (riconnessione con backoff, polling che **rallenta** quando il WS è connesso) fatti e verificati offline. ⏳ Resta il **collaudo live a due client** e la verifica **hosting al deploy** (connessioni persistenti / sticky session).
- **Fase 3b — Byte veri di tutti gli allegati + immagini** ✅ **FATTA (16/7)** — nuova tabella `AiConversationAttachmentBinary` + **migrazione `20260716152454_ai_attachment_binary`** (⚠️ **da segnalare a Claudio**, dopo l'arretrato `20260706085001`); upload salva i byte (le **immagini** prima rifiutate ora si allegano), download dell'originale dal chip. Verificato col round-trip byte sul DB reale.
- **Fase 3b — "vista" multimodale (far *vedere* le immagini al modello)** ✅ **COSTRUITA (21/7/2026)** — `runAgencyAiTextWithMeta` monta i byte delle immagini allegate come **content block** sull'ultimo messaggio user, nel formato di **tutti e tre** i rami provider (Anthropic / OpenAI Responses / fallback Chat). Formati png/jpeg/gif/webp (svg/bmp restano segnaposto), tetti 4 immagini / 4MB, stima token nel registro consumi. Senza immagini il flusso resta identico a prima (retro-compat). **Nessuna migrazione** (riusa i byte già salvati). *Verificato offline:* tsc 233 (baseline), unit 225/225, build ok, lint:colors ok. ✅ **Collaudo con le chiavi SUPERATO (21/7)**: Haiku e gpt-4o-mini descrivono entrambi il contenuto reale di un'immagine di prova (piano di collaudo 4.6). File: `chat-attachments.ts`, `agency.service.ts`, `ai-conversation.repository.ts`.
- **Fase 3b — Allegare Fonti/Preventivi** ✅ **FATTO (20/7/2026)** — **thread messaggistica ancora da costruire**. Aggiunta la terza voce "Allega a una chat…" (mode `pick`): unica per fonte/preventivo, terza per progetto/cliente. Il popup diventa il **selettore della chat di destinazione** (elemento in sospeso → naviga alla sessione → "Allega qui", rispetta la nota #24). Backend invariato (accettava già `source`/`quote`). Verificato offline: tsc 233, build ok, lint:colors ok. **Resta:** il **thread di messaggistica come allegato** (dalla `MessagingPanel`, solo i propri) — UX ancora da definire. Dettaglio nella spec, Fase 3b.
- **Selettore del modello AI in chat** 🟢 **COSTRUITO (20/7/2026, Jacopo)** — collaudo con chiavi a fine V. Selettore in Chat AI per **scegliere il modello**: **(b) provider + modello specifico** (Anthropic: Opus/Sonnet/Haiku; OpenAI: gpt-5/gpt-4o/gpt-4o-mini), **ambito per sessione** (default = workspace, cambiabile per conversazione), **solo i provider con chiave** (gli altri disabilitati). *Reso:* catalogo curato + rotta `GET /agency/chat/models`; `runAgencyAiTextWithMeta` accetta un `model` opzionale e sceglie provider+modello per-chiamata (fallback al default); UI `<select>` raggruppato per provider nell'header conversazione + icona `IconModel`. Registro consumi già per-modello. **Verificato offline:** tsc 233 (baseline), unit 220/220, build ok, lint:colors ok. **Persistenza per-sessione a DB** (scelta dell'utente): ⚠️ **nuova migrazione `20260720082642_ai_conversation_model`** (colonna `model` su `AiConversation`, additiva) — **da segnalare a Claudio**, dopo l'arretrato `20260706085001`. La scelta è condivisa tra i partecipanti (salvata all'invio, riletta all'apertura). Dettaglio nella spec, "Estensione — selettore del modello AI".
- **Regola anti-blocco "altra sessione con API accesa"** ✅ **DECISA E SCRITTA (20/7/2026, Jacopo)**. Regola di progetto nel **`CLAUDE.md`** (sezione *"Dev server e database — una sola sessione accesa per volta"*): i dev server si tengono accesi in una sola sessione per volta, e prima di una migrazione o `prisma generate` si ferma l'API dell'altra sessione (il `tsx watch` tiene il lock DLL di Prisma). Contesto in **nota operativa #28**.
- **Sez. 4-ter punto 5 — Non letti / notifiche nel popup** ⏸️ **RIMANDATO (20/7/2026, Jacopo)** *(opzionale)*. Deciso di non farlo ora. Quando si riprende: la messaggistica ha già i non letti (`readAt`), la **chat AI no** — la fetta economica è un badge in topbar sui soli non letti della messaggistica.
- **Collaudo con le chiavi reali** OpenAI/Anthropic: provare le risposte dell'AI **in tutti gli ambiti**, allegati compresi, **compresi navigazione suggerita e compressione** (senza chiavi la logica c'è ma il modello non gira), verificando che il **registro consumi si scriva davvero**. *Le chiavi si configurano una volta sola: servono anche al residuo della V5.*

#### ⛔ Fuori perimetro — rimandato alla V9 *(deciso il 15/7/2026, riconfermato il 15/7 alla nascita di questa V)*
- **Modello a conversazioni per i messaggi** (partecipanti, gruppi di **reparto** e **d'agenzia**). I **reparti esistono già** (`Department`, `DepartmentMember`): la base c'è. ⚠️ **Nodo da riconciliare in V9:** la roadmap prevede thread **di progetto**, la richiesta è gruppi **di reparto/agenzia** — **non coincidono**.
- **Thread di messaggistica come allegato alla chat AI** *(deciso il 20/7/2026, Jacopo — spostato qui dalla V4)*. Confronto Jacopo↔AI su *cosa* si allega davvero: **dipende dall'oggetto-conversazione** che nasce col "modello a conversazioni" qui sopra (oggi `WorkspaceMessage` è 1-a-1, la conversazione è solo la coppia mittente/destinatario), quindi si progetta **insieme** a quello.
  - **Escluso l'"intero thread"** per tre motivi: **privacy** — la chat AI è **collaborativa**, allegarci un thread privato lo esporrebbe agli altri partecipanti; **rumore** — le conversazioni umane hanno bassa densità informativa (riempirebbero il contesto di "ok/ci sentiamo"); **troncamento** — col tetto di **6.000 caratteri** per allegato la parte utile verrebbe tagliata.
  - **Due direzioni da valutare** (l'intero thread è fuori): **(A) "Cita nella chat AI"** — selezioni una/più bolle → si **precompila il composer** con testo già attribuito (`Tizio (14/7): …`), l'utente **vede e conferma** cosa entra; costo minimo, **nessun nuovo modello dati**. *Raccomandata come partenza.* **(B) Allegato granulare** — le bolle scelte diventano un **allegato tracciato** (nuovo `entityType` stringa tipo `messaging_thread` + snapshot dei messaggi col peer; il server lo accetterebbe **senza migrazione**); più strutturata ma intrecciata col modello-conversazioni.
  - **Invariante privacy:** si allega **solo** ciò di cui chi allega è partecipante, e l'esposizione agli altri va resa **esplicita**. Nota: se lo scenario reale è "porto 3 righe concordate con un collega", il **copia-incolla** che esiste già oggi basta.
- **Parlare con i CLIENTI.** ⛔ Oggi **impossibile**: `Client` ha **solo un campo `email` di testo** — nessun account, nessun accesso — e **non esiste alcun portale clienti** in nessuna riga di questo codice. Sarebbe un'area di prodotto intera con un **confine di sicurezza netto** (un cliente non deve vedere i dati di un altro). La V9 assume clienti **senza account**, che interagiscono via **link pubblico ed email**. **Per ora la chat resta interna.**

**Done quando:** dal pulsante in topbar si raggiungono entrambi i mondi senza mai confonderli; la chat AI vive **solo** nel popup (espandibile a tutto schermo) e nella casella, con partecipanti e gruppi governabili da lì; la scheda Chat estesa del progetto **non esiste più**; e con le chiavi reali l'AI risponde in tutti gli ambiti con i consumi tracciati.

### 🟦 V5 — Motore AI Context-Aware *(il cuore)* — ⚠️ **V SPEZZATA: iniziata, interrotta, si completa dopo la V4**

> **Perché questa V ha un numero più alto di quella che la interrompe (15 luglio 2026).** Era la V4. Durante il suo sviluppo la chat AI è nata come implementazione minore, si è ingigantita ed è **maturata in una V a sé** — quella che si sta facendo ora, e che ha preso il numero 4. Questa slitta quindi a **V5**, e con lei tutte le successive.
>
> **Conseguenza da accettare, non da correggere:** a livello di lavoro svolto questa V risulta **spezzata**. Il suo blocco *già fatto* (Fonti + vettorizzazione/RAG, multi-provider OpenAI+Claude, budget giornaliero, cost control) è **il presupposto su cui la V4 gira**: numericamente la V4 dipende dalla V5, cronologicamente no. Il **residuo** elencato qui sotto si completa **dopo la chiusura della V4**.

**Obiettivo:** memoria di progetto vera + AI economicamente controllata.

**Residuo da completare dopo la V4:**
- **Discovery consolidata su RAG reale** (Business Recap, Obiettivi/Target, Offerta/Competitor) — le fondamenta (chunk + embeddings + `sources.rag.ts`) ci sono dal 13/7.
- **Audit grafico dell'area Agency** (chiaro/scuro) — vedi nota di rifinitura più sotto. Era segnato *"da fare prima di aprire la Chat collaborativa"*: **è in ritardo**, la chat è stata aperta lo stesso.
- **Badge `AiCostEstimate` sui pulsanti AI secondari** (`web.generateBlock` ecc.) — vedi nota più sotto.
- *(opzionale)* migrare URL/file **legacy** del blob `ProjectMemory.sourcesJson` dentro `ProjectSource`, per avere un'unica fonte di verità.
- **Collaudo con le chiavi reali** OpenAI/Anthropic su Discovery e verticali *(la V4 fa il proprio collaudo per la chat: le chiavi si configurano una volta, servono a entrambe)*.
- **Ridisegno della schermata Impostazioni Agency (configurazione AI)** — proposta di Jacopo (20/7/2026), da discutere all'apertura della V5: vedi la nota dettagliata più sotto.

**Contenuto:**
- **Modulo Fonti** completo: URL/social + Word/PDF + asset brand → **vettorizzazione (embeddings + pgvector)** → memoria persistente. **FONDAMENTA FATTE (10 luglio 2026):** modulo isolato `server/modules/sources/` — modello `ProjectSource` (una riga per fonte, `content` estratto già pronto per il chunking/embedding; migrazione `20260710081730_project_sources`), estrattore testo per **URL** (strip HTML) e **testo incollato**, CRUD + `refresh`, rotte `/projects/:id/sources` e `/sources/:id` protette da `projects.view`/`projects.edit`. Verificato end-to-end + test. **UI FATTA (10 luglio 2026):** pannello **"Fonti indicizzabili per l'AI"** (`src/modules/sources/ui/ProjectAiSourcesPanel.jsx` + `api/sourcesApi.js`) integrato **dentro** la pagina Agency "Fonti e Materiali" (`AgencyProjectAssetsPage.jsx`) — aggiunta URL/testo con estrazione, lista con stato/anteprima, refresh/elimina. Verificato nel browser. Scelta di **riconciliazione sulla pagina esistente**: il pannello convive con le sezioni URL/file/competitor esistenti (blob `ProjectMemory.sourcesJson`) senza romperle. **MERGE con la pipeline Agency FATTO (10 luglio 2026):** i record `ProjectSource` vengono iniettati come "materiali" sintetici in lettura, così **readiness** (badge su tutte le pagine progetto via `getProject`) e **Discovery** (rule-based + AI, via `buildAgencyAiSourceSnapshot`) li usano come le altre fonti — senza modificare la logica esistente e **senza persisterli** nel blob dell'editor "Fonti e Materiali" (nessun inquinamento del salvataggio). File: `agency.repository.listIndexedProjectSources` (guardia try/catch per DB non migrati) + `agency.service.augmentSourcesWithIndexedRecords` iniettato in `getProject`/`regenerateProjectDiscoveryFromSources`/`generateProjectDiscoveryFromSourcesWithAi`. Verificato end-to-end (readiness `missing`→`partial`, contenuto minato nella Discovery, editor non inquinato). **Caricamento file FATTO (10 luglio 2026):** upload **PDF/Word(.docx)/TXT/CSV/MD** come `ProjectSource` — estrattore `sourceExtractor.fromFile` (riusa `mammoth`/`pdf-parse` come Agency, import on-demand), service `createFileSource` (file illeggibile → stato `error` con messaggio, non blocca), rotta multipart `POST /projects/:id/sources/files` (limite 20MB), UI: terzo tipo "File" nel pannello con input file (`accept=.pdf,.docx,.txt,.csv,.md`). Nessuna migrazione (colonne `fileName/mimeType/fileSize/content` già presenti); il binario NON viene conservato, si indicizza solo il testo. Verificato end-to-end (curl: ready + error path) + test unità. **(b) VETTORIZZAZIONE FATTA (13 luglio 2026)** — *questa riga diceva ancora "ancora da fare", corretta il 15/7:* `pgvector` **è installato e attivo** (versione 0.8.0, abilitato dall'utente come amministratore il 10/7 con `scripts/install-pgvector-win.ps1`); modello **`ProjectSourceChunk`** con colonna `embedding vector(1536)` (migrazione `20260713074114_project_source_chunks`), chunking + embeddings in `server/modules/sources/sources.indexing.ts`, ricerca per similarità in `sources.rag.ts`. **Ancora da fare:** (c) (opz.) migrare anche le URL/file *legacy* del blob dentro `ProjectSource` per avere un'unica fonte di verità.
- **Discovery** consolidata su RAG reale (Business Recap, Obiettivi/Target, Offerta/Competitor).
- **Chat AI di progetto** context-aware. **BASE FATTA (13 luglio 2026):** chat **per-utente** sul progetto — motore di generazione a testo (`runAgencyAiTextWithMeta`), RAG sulla domanda, risposte "grounded" con citazioni delle fonti, persistenza (`ProjectChatMessage`, migrazione `20260713144744_project_chat`), scheda "Chat" nel progetto, integrazione budget+log costi. **Evoluzione collaborativa PIANIFICATA** (multi-utente su invito, ambiti, popup globale, allegati, websocket, compressione contesto, navigazione assistita): spec e piano a fasi in `spec-chat-ai-collaborativa.md` — non iniziata, parte dopo le rifiniture V4 e con le chiavi AI reali.
- **Multi-provider**: aggiunta **Claude/Anthropic** (prompt architect) accanto a OpenAI; mapping modello-per-funzione (economico vs premium). **FATTO (10 luglio 2026):** il motore AI (`server/modules/agency-os/agency.service.ts`) ora supporta il provider `anthropic` accanto a `openai`. Nuova chiave `anthropic_api_key` **cifrata a riposo** (stessa DEK del vault, con fallback `ANTHROPIC_API_KEY` da `.env`); `runAgencyOpenAiJsonWithMeta` ramifica per provider e chiama la **Anthropic Messages API** (`/v1/messages`, header `x-api-key` + `anthropic-version`, `max_tokens` obbligatorio, JSON via system prompt con strip del code-fence in parse); modello di default Claude `claude-opus-4-8` risolto in automatico se il provider è Anthropic ma il modello configurato è ancora un `gpt-*` (`resolveAgencyProviderModel`); mapping modello-per-funzione (`functionModels`) valido per entrambi i provider. Modello **costi** esteso ai prezzi Claude (opus/sonnet/haiku/fable) → il log `AiUsageLog` traccia i consumi Claude come per OpenAI. UI: **Impostazioni Agency** ora ha `Anthropic (Claude)` tra i provider e un campo API key dedicato (write-only). Verificato end-to-end (config→status provider-aware→modello default→storage cifrato); **nessun nuovo errore TypeScript** (agency-os invariato 52=52). **Nota:** nessuna migrazione (la chiave riusa la tabella `AgencyRuntimeSetting` esistente).
- **Cost control**: stima costo/token su ogni pulsante AI + **budget giornaliero per dipendente** con tracking consumi. **FATTO.** (1) **Budget giornaliero per dipendente** (13 luglio 2026): tabella `AiBudget` + enforcement nel motore (`assertWithinAiBudget`) + UI in Impostazioni Agency (migrazione `20260713094017_ai_budget`). (2) **Rendiconto consumi AI per-workspace** (13 luglio 2026): nuovo pannello "Consumi & costi AI" in Impostazioni Agency (per dipendente/funzione, ultime chiamate, filtri); la Console piattaforma è stata ridotta a panoramica cross-workspace (dettaglio spostato in Agency). Sola lettura di `AiUsageLog`, nessuna migrazione. (3) **Stima costo sui pulsanti AI** (13 luglio 2026): endpoint `GET /agency/ai/estimates` + badge riusabile `AiCostEstimate`; range in USD che parte da un token-seed e si affina sui token storici per funzione (p25–p75) col modello corrente. Agganciato ai pulsanti **principali** di Discovery (brief + sezione), Web (`Genera con AI`) e Ads (`Rigenera asset AI`). Sola lettura di `AiUsageLog`, nessuna migrazione.
**Done quando:** si interroga in chat il brief di un progetto, la Discovery gira su fonti vettorizzate, e i consumi/budget sono visibili e limitabili.

> **Da fare più avanti (rinviato dalla stima-costo sui pulsanti, 13 luglio 2026):** estendere il badge `AiCostEstimate` anche ai **pulsanti AI secondari** oggi in righe/toolbar dense — la generazione **per-blocco** del modulo Web (`web.generateBlock`, pulsanti "Genera AI" per singola pagina/blocco) e gli altri punti minori. Lasciati fuori di proposito per non affollare l'interfaccia (design a sottrazione): l'estensione è meccanica (l'endpoint stime già copre tutte le funzioni, incluso `web.generateBlock`), va solo decisa la resa visiva nelle liste dense. **Da affrontare a fine sviluppo V4**, in una passata di rifinitura UI.

> **Rifinitura UI di fine V4 (segnalato 14 luglio 2026):** **audit grafico dell'area Agency** (schede progetto: Discovery e sorelle). Ci sono imperfezioni tema **chiaro/scuro** — box che restano bianchi in dark (uso di `bg="light"` ereditato dal template Jampack, incluso il badge `AiCostEstimate`) e scritte poco leggibili su alcuni pulsanti AI. Passata dedicata contro `design-linguaggio-apple-web.md` + `npm run lint:colors`, da fare **prima** di aprire la Chat collaborativa.

> **Nota storica:** fino al 15 luglio 2026 la Chat collaborativa era annotata qui come *"estensione AI pianificata"* dentro questa V. È cresciuta al punto da diventare una **V a sé** — vedi la **V4** qui sotto, che è quella in corso.

> **Ridisegno della schermata Impostazioni Agency — configurazione AI (proposto 20/7/2026 da Jacopo; DA DISCUTERE all'apertura della V5).** Emerso preparando il collaudo chiavi della V4. Oggi `/agency/settings` tratta l'AI come *"un provider + un modello di default"*: sembra esclusivo (confonde) e ha un limite reale. **Direzione proposta:**
> - **Difetto tecnico da correggere:** lo stato *"AI configurata"* oggi guarda **solo** la chiave del provider di *default* (`getAgencyAiStatusPayload`, `agency.service.ts:2113`). Va sganciato → *"abilitato + almeno un provider con chiave"*, così OpenAI e Anthropic sono **entrambi di prima classe**. *(Nota: il selettore modello in chat usa già qualsiasi provider di cui c'è la chiave — quindi i due provider POSSONO già coesistere; il limite è nello stato globale e nell'UX.)*
> - **Sopprimere** la box "AI generativa".
> - **Fondere** le due box (OpenAI e Anthropic) in **un'unica grande box**, impostazioni di ciascun provider separate ma **affiancate**.
> - Nella stessa box, **un solo interruttore "Abilita generazioni AI"** che copre entrambi i provider.
> - Nella stessa box, il **modello preferito** come **menu a discesa** che mostra solo i modelli dei **provider attivi** (con chiave) — non un campo di testo libero.
> - **Rimozione chiavi — CONFERMATO (20/7/2026, Jacopo):** il checkbox *"Rimuovi la API key salvata nel CRM"* è ambiguo e poco intuitivo → diventa un **pulsante vero e proprio** con dicitura chiara, es. **"Cancella permanentemente le chiavi API dal CRM"**, accompagnato da un **selettore del provider** (solo OpenAI / solo Anthropic); **se non si seleziona nulla, le cancella tutte indistintamente**. Un comando esplicito serve comunque, perché il campo chiave è *write-only* e "vuoto = non cambiare".
> - **Rinomina** dell'etichetta pulsante: da "Salva impostazioni **runtime**" a un più chiaro "Salva impostazioni".
> ⚠️ **Metodo staffetta:** prima di attuare, verificare **chi ha costruito questa schermata** (Jacopo o Claudio) e confrontarsi — è **motore AI = questa V (V5)**, non la V4.

> **Discovery AI — consentire ipotesi ragionate sui campi mancanti (emerso 20/7/2026 dal collaudo; ⛔ DA DISCUTERE CON CLAUDIO PRIMA di attuare).** Generando la Discovery di un progetto le cui fonti non esplicitano il *target*, l'AI lo marca "non definito" invece di inferirlo dagli indizi (es. "fotografa di matrimoni a Torino" → coppie in procinto di sposarsi in zona). **Causa:** il system prompt impone **grounding stretto** — *"Non inventare target, offerta, CTA, USP o dati di mercato non presenti"* (`agency.service.ts:9191`); e gli alert *"Target non definito / Offerta non chiara / USP non evidenti"* sono **rule-based** (`agency.service.ts:3821-3827`, controllo delle "evidenze" nelle fonti), non prodotti dall'AI. **Non è un bug:** è la stessa scelta anti-allucinazione che rende affidabile il RAG/chat. **Rimedio proposto:** allentare il prompt **solo per la Discovery** (lavoro da strategist, non risposta factual) → consentire un'**ipotesi ragionata** sui campi mancanti, marcata esplicitamente *"da validare"* (mantiene l'anti-allucinazione, aumenta il valore); eventualmente affinare il rilevatore rule-based delle evidenze. ⚠️ **Jacopo vuole confrontarsi con Claudio PRIMA di procedere** (è motore AI = V5, e la scelta grounding-stretto-vs-inferenza è una decisione di prodotto da condividere).

### 🟦 V6 — Verticali AI: Web & ADV + Audit/Report
**Obiettivo:** produzione asset guidata dal contesto.
**Contenuto:**
- **Web & ADV**: generazione strutture HTML/landing + copy campagne **Meta/Google/TikTok** per sotto-progetto.
- **Higgsfield** visual generation (catena Contesto → Claude → Higgsfield).
- **Audit Engine SEO** (analisi URL: H1, meta, mancanze) — completa il modulo `seo`.
- **Report PDF brandizzato Apple-style** con import dati (es. conversioni Google Ads).
**Done quando:** da un progetto si generano landing+copy coerenti col brand e un report cliente brandizzato.

> **Da fare (richiesto da Jacopo, 21/7/2026) — immagini di cliente/progetto tra gli Elementi allegabili alla Chat AI.** Oggi allegando un **cliente/progetto** in chat si porta solo il suo **snapshot testuale** (nome, obiettivo, ecc.), non le sue immagini. Da quando esistono immagini legate all'entità — **soprattutto le creatività generate dal sistema visivo (Higgsfield, questa V)**, e gli eventuali **asset brand** del Modulo Fonti (V5) — vanno rese **allegabili in chat come immagini vere**. Il valore è immediato: allego una creatività e chiedo all'AI di commentarla/criticarla/iterarla. **La pipeline che le fa *vedere* al modello esiste già** — `collectPromptVisionImages` → `buildMultimodalMessages`, la **"vista" multimodale fatta e collaudata in V4 il 21/7** (immagini png/jpeg/gif/webp sui tre provider). **Quello che manca** è che le immagini di cliente/progetto esistano come **entità di prima classe allegabili**: verosimilmente un **nuovo tipo allegabile** (es. `creative`/`asset`) accanto agli attuali `project`/`client`/`source`/`quote` (`ATTACHABLE_ENTITY_TYPES` in `server/modules/agency-os/chat-attachments.ts`), oppure l'estensione dello snapshot d'entità perché esponga i propri binari immagine. **Collocato qui** perché è quando le creatività diventano un oggetto reale del CRM; se gli asset-brand immagine diventassero allegabili prima (V5 Fonti), può partire di lì.

### 🟦 V7 — Laboratorio & Zero Error Protocol
**Obiettivo:** azzerare gli errori di stampa.
**Contenuto:**
- Modulo **Laboratorio (Stampa)**: schede materiali/misure, ruolo **Reparto Lab**.
- **Validazione AI obbligatoria** pre-stampa: confronto dati tecnici ↔ Fonti del progetto, con segnalazione discrepanze in tempo reale.
**Done quando:** nessun job va in stampa senza esito di validazione AI.

### 🟦 V8 — Preventivatore Pro & Strumenti di Vendita
**Obiettivo:** vendita rapida e d'impatto.
**Contenuto:**
- **Builder drag-and-drop** su pacchetti predefiniti.
- **Output duale**: Preventivo Analitico + **Proposta Apple-style** (slide vendita).
- **Validità 72h** automatica + notifica account manager alla scadenza.
**Done quando:** in pochi click si genera sia il documento tecnico sia la proposta visuale, con scadenza gestita.

### 🟦 V9 — Calendario & Comunicazione Avanzata
**Obiettivo:** appuntamenti e comunicazioni centralizzati.
**Contenuto:**
- Integrazione **Meet/Zoom**.
- **Link Calendly-style** per dipendente (disponibilità reale del workspace).
- **Reminder automatici** clienti.
- Messaggistica potenziata a **thread di progetto**.
- **Thread di messaggistica come allegato alla chat AI** *(spostato dalla V4 il 20/7/2026)*: da progettare **insieme** al modello a conversazioni; decisioni già prese e direzioni (A "Cita nella chat AI" / B allegato granulare) nel blocco **V4 → "Fuori perimetro / V9"**.
**Done quando:** un cliente prenota da link personale, riceve reminder, e la conversazione resta legata al progetto.

### 🟦 V10 — Contabilità, Redditività & Integrazioni Business
**Obiettivo:** controllo di gestione data-driven.
**Contenuto:**
- Connettore **Fatture in Cloud** (fatturati/flussi nel CRM, riservato Admin).
- **Time-tracking** su progetti/task.
- **Analisi redditività real-time** (tempo/risorse ↔ fatturato) per cliente e reparto.
- Completamento **API framework** a plugin per integrazioni future.
**Done quando:** l'Admin vede la redditività effettiva per cliente/reparto in tempo reale.

### 🟦 V11 — Finale: Migrazione Legacy, Hardening & Rollout
**Obiettivo:** transizione completa senza interruzioni.
**Contenuto:**
- **Schema mapping & migrazione dati** dal sistema legacy (continuità clienti/storico).
- **Hardening** sicurezza/performance, audit completo, test end-to-end.
- Rollout progressivo + QA finale, dismissione definitiva del legacy.
- **Onboarding leggero esteso a tutto il CRM (deciso 14 luglio 2026):** portare l'approccio "guida in-contesto" (empty state, tooltip, card dismissibili — **non** un tutorial/wizard pesante) a **tutte** le aree del prodotto, non solo alla Chat AI. Collocato qui perché ha senso solo a prodotto sostanzialmente completo (dopo la V10 — *era "dopo V9" nella numerazione precedente al 15/7*). L'onboarding **della sola chat** si fa invece dentro la V4.
**Done quando:** tutti gli utenti operano sulla nuova piattaforma Apple-style, dati migrati e verificati.

---

## Debito tecnico / tooling (trasversale)

Voci non legate a una singola versione: si pianificano quando conviene, non fanno parte del "done" di nessuna tappa.

- **Migrazione ESLint a "flat config".** Il lint JavaScript del progetto (`npm run lint`) al momento **non parte**: ESLint 9 richiede il nuovo formato `eslint.config.js`, mentre il progetto usa ancora `.eslintrc.cjs` con flag legacy. Va migrato, aggiornando lo script in `package.json`. **Attenzione:** a lint funzionante emergeranno molti errori pre-esistenti `react-hooks/set-state-in-effect` (e alcuni `no-useless-escape`) da valutare caso per caso — correggere il codice o declassare consapevolmente la regola; concordare l'approccio prima di modifiche di massa ai moduli. Non tocca il guard colori dedicato (`npm run lint:colors`), che è autonomo e già funzionante. **Quando:** idealmente presto (durante o subito dopo la V1), così i moduli successivi si sviluppano con il lint attivo. **Misurato il 15/7/2026:** convertendo la config escono **96 problemi, ma 65 dei 78 errori non sono codice da correggere — sono configurazione mancante** (globali di Node per gli script, test di una libreria di terze parti). Restano ~13 errori veri e banali su 8 file. **Stima: un'ora e mezza**, in una sessione dedicata. ⚠️ C'è `--max-warnings 0`: finché non si azzerano anche i 18 avvisi il comando continuerà a fallire.

- **Due librerie di icone in casa** *(emerso il 15/7/2026)*. La spec della chat prescrive **`react-feather`** (ed è ciò che usa tutto il popup); il documento di design prescrive **Lucide** (ed è ciò che usa il modulo Messaggi, `src/views/Email/index.jsx`). Lucide è un fork di Feather, quindi la resa è omogenea e a occhio non si nota — ma sono due dipendenze per lo stesso scopo, e due regole in contraddizione fra due documenti fondativi. **Va deciso quale vince e allineati i documenti**: è una scelta di prodotto, non da fare di straforo dentro un'altra attività.

- **Il test `server/integration/auth-login.smoke.ts` fallisce** per una chiave mancante nell'ambiente di test. **Preesistente e verificato** (mettendo da parte le modifiche in corso, falliva già). Funzionano `npm run test:unit` (192/192), `lint:css` e `lint:colors`.

- **233 errori TypeScript preesistenti** (`npx tsc --noEmit`). È la **baseline** con cui si convive: il metro di giudizio è *"nessun errore nuovo"*, non *"zero errori"*. Da azzerare, se si decide di farlo, in una passata dedicata — plausibilmente dentro l'hardening della **V11**.

---

## Sintesi visiva della progressione

| Build | Tema | Blocco aggiunto |
|---|---|---|
| **V1** | Shell | Apple UX + Command-K + cleanup |
| **V2** | Governance | Super Admin console + ruoli Discord-style + reparti |
| **V3** | Dato | Custom Fields + import/export + Brevo |
| **V4** | **Conversazione** *(in corso)* | Chat AI collaborativa + messaggistica sotto un solo ingresso |
| **V5** | **AI core** *(spezzata: si completa dopo la V4)* | Fonti vettorizzate + Discovery RAG + multi-model + budgeting |
| **V6** | Produzione AI | Web&ADV + Higgsfield + SEO audit + report Apple-style |
| **V7** | Lab | Zero Error Protocol (validazione stampa) |
| **V8** | Vendita | Preventivatore DnD + proposta Apple-style + 72h |
| **V9** | Agenda | Meet/Zoom + Calendly + reminder + thread progetto + gruppi reparto + clienti |
| **V10** | Finance | Fatture in Cloud + time-tracking + redditività |
| **V11** | Go-live | Migrazione legacy + hardening + rollout |

> **Rinumerazione del 15 luglio 2026.** La **V4 è nuova** (Chat AI & Messaggistica): è nata dentro la vecchia V4 come implementazione minore e si è ingigantita fino a diventare una V a sé. Tutto ciò che seguiva **slitta di uno** (vecchia V4 → V5 … vecchia V10 → V11): si passa da 10 a **11 V**. Se in un documento o in un commit precedente al 15/7 leggi "V5", "V8", "V10", riferisciti alla **numerazione vecchia** e aggiungi uno.

### Note di sequenziamento
- **La V4 (chat) e la V5 (AI core) sono intrecciate, ed è voluto.** La V4 gira sul motore già costruito nella V5 (RAG, budget, multi-provider): **numericamente la V4 dipende dalla V5, cronologicamente no**. Il residuo della V5 si completa **dopo** la chiusura della V4.
- **La V5 resta la priorità di valore** (il differenziatore AI) ed era parzialmente parallelizzabile a V2/V3 perché lo scaffold OpenAI esisteva già.
- V1–V3 sono prerequisiti UX/dato che rendono "vendibile" e ordinata ogni feature successiva.
- V7 (Lab) dipende dalla V5 (la validazione Lab usa le Fonti vettorizzate).
- V9 eredita dalla V4 **tre** pezzi di messaggistica rimandati: **gruppi di reparto/agenzia** (da riconciliare col "thread di progetto" già previsto lì), **parlare con i clienti** (che richiede un portale clienti oggi inesistente) e il **thread di messaggistica come allegato alla chat AI** (da progettare insieme al modello a conversazioni; deciso il 20/7/2026).
- V10 richiede il time-tracking introdotto lì come prerequisito della redditività.

---

*Documento prodotto confrontando il Brief Operativo Definitivo con l'analisi del codice (`prisma/schema.prisma`, `server/modules/`, `src/`, `server/modules/agency-os/agency.service.ts`). Vedi anche `01-brief-stato-attuale-pre-revisione-apple-style.md` per il dettaglio dello stato attuale.*
