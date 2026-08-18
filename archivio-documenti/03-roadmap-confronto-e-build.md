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
| **Audit Engine SEO** (H1, meta tag, mancanze) | 🟢 | Analyzer completo e testato (`seo-analyzer.ts`) + anti-SSRF condiviso (`net-guard.ts`) + tab SEO nel dettaglio asset (22/7/2026) | Opzionale: suggerimenti via AI |
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

## 🚩 FUORI NUMERAZIONE — RELEASE DI SETTEMBRE 2026: **priorità assoluta su ogni V**

> **Definita il 17/8/2026 da Jacopo, su commessa.** Non è una V e non entra nella numerazione: è la **prima consegna reale del CRM**, e finché non è chiusa **viene prima di qualunque V**, compresa quella in corso.
>
> **Regola di priorità dichiarata:** la commessa di release batte qualunque altra pianificazione. Se dopo settembre arriveranno nuove direttive con una nuova scadenza di consegna, quelle avranno a loro volta priorità su tutto.
>
> **📄 Il piano completo — perimetro, stato verificato area per area, lavoro punto per punto, ordine di lavorazione, rischi — sta in `archivio-documenti/decisioni-cliente-e-menu-2026-08-07.md`, PARTE SECONDA.** Qui c'è solo la sintesi che serve a chi legge la roadmap per orientarsi; **il dettaglio si legge lì**, ed è lì che va aggiornato (per non avere due copie che divergono).

**Il perimetro — sei aree al 100%:** Clienti · Team · Messaggi · Ruoli e permessi · Profilo · **Registro attività** *(nuova)*.

**Tutto il resto si nasconde al lancio** da Gestione Moduli: Produzione AI, Pipeline, Preventivi, Siti in gestione, Credenziali, Calendario, Memo Operativi. ✅ Verificato che il modulo `modules` è `isCore` e non si può spegnere: il Super Admin resta sempre in grado di riaccendere quello che vuole.

**Il lavoro, in sintesi:**

| Voce | Sostanza |
|---|---|
| **Clienti** | L'import CSV **esiste già e funziona**; il difetto vero è il tetto tecnico di ~1 MB (il file viaggia dentro la richiesta) → volumi grossi falliscono. Da fare: caricamento come vero allegato, anteprima prima di confermare (la modalità "prova senza salvare" c'è già nel backend, scollegata), supporto Excel. Campi nuovi: **PEC, codice SDI, sito web, referente** come standard; **settore, fonte del contatto** come campi personalizzati. I campi personalizzati vanno **ricollocati nel flusso di registrazione di un cliente nuovo** (la funzione è già completa — sei tipi — ma sepolta in una pagina a sé) |
| **Team** | L'invito è meccanicamente corretto ma **la consegna è rotta**: senza server di posta l'email non parte e il CRM dice comunque "successo". Da fare: configurare la posta (`noreply@advaiora.com`), maschera di configurazione dentro il CRM, esito di consegna veritiero, **pulsante "copia link invito"** (è ciò che rende il flusso a prova di guasto). Più: modifica membro oggi è una funzione vuota, filtro "In attesa" morto |
| **Ruoli e permessi** | **Quasi chiuso dal re-naming** (`b94c19a` ~70 descrizioni tradotte, `7465f12` modulo `ai_production` con `generate` separato). I cinque nomi inglesi rimasti (Branding, Audit, Dashboard, Team, SEO) **restano** per decisione di Jacopo |
| **Profilo** | I documenti che lo davano "non cablato ai dati" sono **obsoleti**. Ma manca **il cambio password**, in nessun punto del CRM → 🔴 blocco vero. Si aggiunge anche il **recupero password via email**. Struttura decisa: *Il Mio Profilo* diventa contenitore, con dentro **Impostazioni Account** (modifica + password), **I miei permessi** (ruoli/permessi/moduli) e *Scorciatoie*. La pagina *Modifica Profilo* sparisce (era di sola lettura e dichiarava il falso) |
| **Messaggi** | Il cuore funziona. 🔴 **Il registro viene inondato**: una riga "ha letto" ogni 1,5s per conversazione aperta → **va chiuso PRIMA di costruire il Registro attività**, o nasce illeggibile. 🔴 Se la chiamata al profilo fallisce la casella mostra la **Chat AI**, che al lancio sarà nascosta. Più: storico oltre 120 messaggi irraggiungibile (il server pagina già, il client no), interrogazioni ogni 2s senza rallentare, tetto contatti. **Entrano nella release** anche allegati e cancellazione "alla WhatsApp" (solo per me / per tutti) |
| **Registro attività** | L'impianto **esiste già** (tabella, filtri, pagina, permesso): manca la copertura, oggi manuale e sparsa in ~20 file, con **il login non tracciato**. Approccio deciso: **ibrido** — intercettore automatico sulle entità principali + registrazioni manuali dove serve significato ricco. 📌 **La collocazione nel menu si decide in un confronto con Jacopo, non da soli** |
| **Cestino** | Meccanismo generale, **acceso solo sulle entità in perimetro**; il resto lo eredita in seguito. ⚠️ **Rischio numero uno della release**: se qualcosa deve slittare, guardare prima qui |
| **Sicurezza** | Audit pre-lancio, a codice fermo. Priorità al controllo che **ogni interrogazione sia filtrata per workspace** (in multi-azienda è *il* rischio) |
| **Permessi automatici** | La regola è già in `CLAUDE.md`; manca farla verificare da una macchina. **Metà 1 subito** ("ogni permesso usato esiste nel catalogo": oggi solo 4 moduli su 16 leggono dal catalogo centrale, gli altri riscrivono a mano). Metà 2 ("ogni rotta ha un permesso") da valutare dopo |

**Cosa entra qui dal piano di riordino** (vedi *Debito tecnico* → «Riordino gerarchico»): la rimozione delle voci ridondanti *Nuovo Cliente*/*Nuovo Preventivo*, il nuovo gruppo **Impostazioni**, **Reparti** spostato sotto Team, e la collocazione del Registro attività. **Non** entrano il dossier cliente né l'arricchimento AI.

⚠️ **Regola di demarcazione sui Clienti** — è l'unica area che release e riordino toccano insieme: a settembre si fa il **contenuto** (campi, import, dove sta il pulsante dei campi personalizzati); il **ridisegno della pagina** è V12. Non anticipare la forma, verrebbe rifatta.

**Punti ancora aperti:** la data esatta di consegna; la collocazione a menu del Registro attività (confronto con Jacopo); i due dettagli della cancellazione messaggi (traccia «messaggio eliminato» sì/no, limite di tempo sì/no).

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
- **Fase 4 — Tempo reale (websocket)** ✅ **FATTA (16/7)** — deciso **websocket** con auth via **biglietto usa-e-getta** (codice monouso a scadenza, niente token nell'URL: regola privacy salva). Server (biglietto + hub "segnale+refetch" + rotta con controllo Origin, trasmissione da messaggistica e chat) e client (riconnessione con backoff, polling che **rallenta** quando il WS è connesso) fatti e verificati offline. ✅ **Collaudo live a due client SUPERATO** (confermato da Jacopo il 22/7/2026). Resta solo la **verifica hosting al deploy** (connessioni persistenti / sticky session), che è per natura una prova da fare **al momento del deploy**, non un collaudo di sviluppo.
- **Fase 3b — Byte veri di tutti gli allegati + immagini** ✅ **FATTA (16/7)** — nuova tabella `AiConversationAttachmentBinary` + **migrazione `20260716152454_ai_attachment_binary`** (⚠️ **da segnalare a Claudio**, dopo l'arretrato `20260706085001`); upload salva i byte (le **immagini** prima rifiutate ora si allegano), download dell'originale dal chip. Verificato col round-trip byte sul DB reale.
- **Fase 3b — "vista" multimodale (far *vedere* le immagini al modello)** ✅ **COSTRUITA (21/7/2026)** — `runAgencyAiTextWithMeta` monta i byte delle immagini allegate come **content block** sull'ultimo messaggio user, nel formato di **tutti e tre** i rami provider (Anthropic / OpenAI Responses / fallback Chat). Formati png/jpeg/gif/webp (svg/bmp restano segnaposto), tetti 4 immagini / 4MB, stima token nel registro consumi. Senza immagini il flusso resta identico a prima (retro-compat). **Nessuna migrazione** (riusa i byte già salvati). *Verificato offline:* tsc 233 (baseline), unit 225/225, build ok, lint:colors ok. ✅ **Collaudo con le chiavi SUPERATO (21/7)**: Haiku e gpt-4o-mini descrivono entrambi il contenuto reale di un'immagine di prova (piano di collaudo 4.6). File: `chat-attachments.ts`, `agency.service.ts`, `ai-conversation.repository.ts`.
- **Fase 3b — Allegare Fonti/Preventivi** ✅ **FATTO (20/7/2026)** — **thread messaggistica ancora da costruire**. Aggiunta la terza voce "Allega a una chat…" (mode `pick`): unica per fonte/preventivo, terza per progetto/cliente. Il popup diventa il **selettore della chat di destinazione** (elemento in sospeso → naviga alla sessione → "Allega qui", rispetta la nota #24). Backend invariato (accettava già `source`/`quote`). Verificato offline: tsc 233, build ok, lint:colors ok. **Resta:** il **thread di messaggistica come allegato** (dalla `MessagingPanel`, solo i propri) — UX ancora da definire. Dettaglio nella spec, Fase 3b.
- **Selettore del modello AI in chat** 🟢 **COSTRUITO (20/7/2026, Jacopo)** — collaudo con chiavi a fine V. Selettore in Chat AI per **scegliere il modello**: **(b) provider + modello specifico** (Anthropic: Opus/Sonnet/Haiku; OpenAI: gpt-5/gpt-4o/gpt-4o-mini), **ambito per sessione** (default = workspace, cambiabile per conversazione), **solo i provider con chiave** (gli altri disabilitati). *Reso:* catalogo curato + rotta `GET /agency/chat/models`; `runAgencyAiTextWithMeta` accetta un `model` opzionale e sceglie provider+modello per-chiamata (fallback al default); UI `<select>` raggruppato per provider nell'header conversazione + icona `IconModel`. Registro consumi già per-modello. **Verificato offline:** tsc 233 (baseline), unit 220/220, build ok, lint:colors ok. **Persistenza per-sessione a DB** (scelta dell'utente): ⚠️ **nuova migrazione `20260720082642_ai_conversation_model`** (colonna `model` su `AiConversation`, additiva) — **da segnalare a Claudio**, dopo l'arretrato `20260706085001`. La scelta è condivisa tra i partecipanti (salvata all'invio, riletta all'apertura). Dettaglio nella spec, "Estensione — selettore del modello AI".
- **Regola anti-blocco "altra sessione con API accesa"** ✅ **DECISA E SCRITTA (20/7/2026, Jacopo)**. Regola di progetto nel **`CLAUDE.md`** (sezione *"Dev server e database — una sola sessione accesa per volta"*): i dev server si tengono accesi in una sola sessione per volta, e prima di una migrazione o `prisma generate` si ferma l'API dell'altra sessione (il `tsx watch` tiene il lock DLL di Prisma). Contesto in **nota operativa #28**.
- **Sez. 4-ter punto 5 — Non letti / notifiche nel popup** ⏸️ **RIMANDATO (20/7/2026, Jacopo)** *(opzionale)*. Deciso di non farlo ora. Quando si riprende: la messaggistica ha già i non letti (`readAt`), la **chat AI no** — la fetta economica è un badge in topbar sui soli non letti della messaggistica.
- **Collaudo con le chiavi reali** OpenAI/Anthropic ✅ **SUPERATO (confermato da Jacopo il 22/7/2026)** — risposte dell'AI **in tutti gli ambiti** (allegati, navigazione suggerita, compressione) verificate, con il **registro consumi che si scrive davvero**. *Le chiavi restano configurate: servono anche al residuo della V5.*

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

> ### ⭐ ATTO DI CHIUSURA DELLA V5 — l'arricchimento AI si ancora al CLIENTE, non al progetto *(deciso il 7/8/2026, approvato da Claudio)*
>
> **Il problema, in una riga:** nello schema dati **tutto ciò che appartiene a qualcuno è già ancorato al `Client`** — siti, credenziali, preventivi, perfino le conversazioni AI con `scope: 'client'`. L'unica eccezione sono `ProjectMemory`, `ProjectSource` e i loro embedding, ancorati solo al `Project`. Cioè: **l'unico strato del prodotto che non conosce il cliente è proprio quello dove si accumula la conoscenza.** Un cliente con tre progetti richiede di caricare, estrarre e vettorizzare il suo brand book **tre volte** — e di aggiornarlo in tre posti quando cambia.
>
> **Le decisioni prese** *(dettaglio completo, con le alternative scartate e il loro perché, in `decisioni-cliente-e-menu-2026-08-07.md` Parte Prima)*:
> 1. **Salgono al cliente** i materiali (le Fonti) **e il ritratto stabile dell'azienda**. Restano al progetto l'obiettivo specifico e tutto ciò che viene prodotto.
> 2. **Delle otto sezioni del Brief:** quattro diventano piena proprietà del cliente (*Contesto business, Brand e comunicazione, Aspetti tecnici, Materiali disponibili*), una resta del progetto (*Obiettivo progetto*), e **tre esistono in due gradi** — *Target, Offerta, Marketing e acquisizione*: una versione generale sul cliente, una **ristretta** sul progetto, presentata come ritaglio esplicito di quella del cliente. ⚠️ Requisito non negoziabile: l'interfaccia deve rendere inequivocabile **quale livello si sta leggendo e quale si sta modificando**.
> 3. **Eredità ≠ verifica:** il progetto nasce già compilato, ma chi lo apre **vede cosa ha ereditato e da quando**, e conferma con un gesto solo (per progetto, non per campo). Serve a evitare che un ritratto vecchio di mesi resti in circolo proprio *perché* l'eredità funziona bene.
> 4. **Un progetto è "pronto"** quando le informazioni esistono, **indipendentemente dal livello in cui stanno scritte**. È un cambio di comportamento reale rispetto a oggi.
> 5. **Progetti con più clienti collegati** (il CRM lo permette già, e oggi sceglie *in silenzio* il primo selezionato): alla creazione si chiede **esplicitamente** — eredita da uno di questi (quale?) oppure non ereditare da nessuno.
> 6. **Il cliente ha una propria area indipendente** — Fonti e generazione del Brief usabili **anche prima che esista un progetto** (serve a profilare in trattativa). Di conseguenza, **nel progetto quelle schede vanno modificate**, non affiancate: le quattro sezioni del cliente spariscono come campi da compilare (restano leggibili), le tre a doppio livello cambiano faccia, e il pulsante di generazione si divide in due.
>
> **Ordine obbligato:** ① sciogliere l'ambiguità `Project.clientId` vs la tabella `ProjectClient` (di fatto risolta dalla decisione 5) → ② fissare la regola di precedenza (decisioni 2-3) → ③ spostare l'ancora → ④ **solo allora** eseguire il consolidamento delle fonti *legacy* parcheggiato il 22/7 (vedi voce più sotto). Invertire ④ significa travasare i dati in una forma che si sta per cambiare, cioè farlo due volte.
>
> **Perché qui e non più tardi:** ogni V successiva aggiunge un consumatore dell'ancoraggio sbagliato — la Discovery su RAG (qui sotto), la reportistica per cliente (V6), le creatività (V7), la validazione contro le Fonti (V8). Il costo cresce, e a differenza del re-naming qui si spostano **dati**, non stringhe.

**Residuo da completare dopo la V4:**
- **Discovery consolidata su RAG reale** (Business Recap, Obiettivi/Target, Offerta/Competitor) — le fondamenta (chunk + embeddings + `sources.rag.ts`) ci sono dal 13/7. ⚠️ **Da fare dopo l'atto di chiusura qui sopra**, o si costruisce a livello progetto ciò che va poi rifatto a livello cliente.
- **Audit grafico dell'area Agency** (chiaro/scuro) — vedi nota di rifinitura più sotto. Era segnato *"da fare prima di aprire la Chat collaborativa"*: **è in ritardo**, la chat è stata aperta lo stesso.
- **Badge `AiCostEstimate` sui pulsanti AI secondari** (`web.generateBlock` ecc.) — vedi nota più sotto.
- *(opzionale)* migrare URL/file **legacy** del blob `ProjectMemory.sourcesJson` dentro `ProjectSource`, per avere un'unica fonte di verità. **⏸️ Analizzato e RIMANDATO per decisione di Jacopo (22/7/2026 — è lavoro suo, Modulo Fonti del 10/7).** Audit read-only sul DB demo: **6 ProjectMemory, 0 con dati legacy nel blob** (né in `sourcesJson` né nel fallback `briefJson.sources`); le 12 fonti esistenti sono **già** in `ProjectSource`. Quindi: (a) sul demo **non c'è nulla da migrare**; (b) il merge in lettura (`augmentSourcesWithIndexedRecords`) **già unifica** le due sorgenti per l'AI — questa V è **solo pulizia architetturale, nessun guadagno funzionale**; (c) l'esecuzione tocca **dati reali dei progetti** e richiede scelte di prodotto che non vanno indovinate: come trattare i **file senza testo integrale** (nel blob c'è solo l'anteprima/`manualText`, il binario non è conservato → non re-indicizzabili), se i **competitor** diventano fonti (semantica diversa), come **de-duplicare** col merge in lettura ed evitare il doppio conteggio, e se cambiare il **percorso di scrittura** dell'editor "Fonti e Materiali". Domande poste a Jacopo a fine sessione 22/7.
- **Collaudo con le chiavi reali** OpenAI/Anthropic su Discovery e verticali. **⚠️ ESEGUITO il 22/7 — ha trovato un bug (parzialmente corretto), il resto rimandato a Claudio.** Esito: la **pipeline RAG funziona** (ricerca semantica sulle fonti vettorizzate → estratti pertinenti), ma con il provider di default **Claude** la generazione Discovery **veniva fatturata e poi scartata in parse**, ricadendo in silenzio sul rule-based. Due cause: **(1) cornice markdown** (`stripJsonCodeFence` con regex ancorato) → **CORRETTA il 22/7** (robusta; `tsc` 233=baseline, unit 225/225); **(2) Claude a volte emette JSON non valido** → **rimandata a Claudio** (motore AI condiviso): opzioni A tool-use / B default OpenAI / C repair — dettaglio in `nota-confronto-claudio-2026-07-22.md` §4. Il ramo **OpenAI** usa `json_object` forzato → non ha il problema. **Nota grossa:** il *"target non definito"* alla base della discussione Discovery (§1 della nota) è **il fallback rule-based, non l'AI** → quella scelta va rivista dopo il fix JSON. *(Costo collaudo ~$0.026.)*
  - ✅ **CHIUSA il 23/7/2026 con l'opzione A** (decisa da Jacopo con Claudio): **structured output via tool-use** nel ramo Anthropic. Nuovo modulo `server/modules/agency-os/anthropic-json.ts` + parametro `jsonSchema` su `runAgencyOpenAiJsonWithMeta`: il JSON lo produce l'API ed è valido per costruzione (equivalente di `json_object` per OpenAI). **Verificato dal vivo** (Claude Sonnet 5, `cacheHit:false`): **1029 token di output**, tutte e 8 le sezioni Discovery compilate e ancorate alle fonti. ⚠️ **Lezione:** lo `input_schema` deve **elencare davvero i campi** — con uno schema generico Claude risponde `{"_dummy":…}` (4 token), JSON valido ma **vuoto**, e veniva pure marcato come "AI usata" (vedi `note-operative-ai.md` #32). Sicurezze: il tool-use si attiva **solo** se il chiamante passa lo schema (gli altri restano sul percorso storico → nessuna regressione) e un payload vuoto è trattato come **fallimento**. **Migrata solo `discovery.generateBrief`; restano da migrare Discovery-sezione, Web progetto/blocco, Ads asset.** Nessuna migrazione DB.
  - 📌 **Effetto sulla discussione Discovery (§1):** con l'AI davvero usata, la Discovery **inferisce** il target e **dichiara cosa validare** (es. *"…le PMI e i titolari di partita IVA della provincia di Verona… Da validare con il cliente: settori merceologici prevalenti…"*) — cioè si comporta già vicino all'**opzione B** senza toccare i prompt. Da riguardare insieme su più progetti prima di decidere se serve ancora modificarli.
- **Ridisegno della schermata Impostazioni Agency (configurazione AI)** — proposta di Jacopo (20/7/2026). ✅ **FATTO (22/7/2026)** (attribuzione verificata = Jacopo, nessun conflitto): vedi la nota dettagliata più sotto.

**Contenuto:**
- **Modulo Fonti** completo: URL/social + Word/PDF + asset brand → **vettorizzazione (embeddings + pgvector)** → memoria persistente. **FONDAMENTA FATTE (10 luglio 2026):** modulo isolato `server/modules/sources/` — modello `ProjectSource` (una riga per fonte, `content` estratto già pronto per il chunking/embedding; migrazione `20260710081730_project_sources`), estrattore testo per **URL** (strip HTML) e **testo incollato**, CRUD + `refresh`, rotte `/projects/:id/sources` e `/sources/:id` protette da `projects.view`/`projects.edit`. Verificato end-to-end + test. **UI FATTA (10 luglio 2026):** pannello **"Fonti indicizzabili per l'AI"** (`src/modules/sources/ui/ProjectAiSourcesPanel.jsx` + `api/sourcesApi.js`) integrato **dentro** la pagina Agency "Fonti e Materiali" (`AgencyProjectAssetsPage.jsx`) — aggiunta URL/testo con estrazione, lista con stato/anteprima, refresh/elimina. Verificato nel browser. Scelta di **riconciliazione sulla pagina esistente**: il pannello convive con le sezioni URL/file/competitor esistenti (blob `ProjectMemory.sourcesJson`) senza romperle. **MERGE con la pipeline Agency FATTO (10 luglio 2026):** i record `ProjectSource` vengono iniettati come "materiali" sintetici in lettura, così **readiness** (badge su tutte le pagine progetto via `getProject`) e **Discovery** (rule-based + AI, via `buildAgencyAiSourceSnapshot`) li usano come le altre fonti — senza modificare la logica esistente e **senza persisterli** nel blob dell'editor "Fonti e Materiali" (nessun inquinamento del salvataggio). File: `agency.repository.listIndexedProjectSources` (guardia try/catch per DB non migrati) + `agency.service.augmentSourcesWithIndexedRecords` iniettato in `getProject`/`regenerateProjectDiscoveryFromSources`/`generateProjectDiscoveryFromSourcesWithAi`. Verificato end-to-end (readiness `missing`→`partial`, contenuto minato nella Discovery, editor non inquinato). **Caricamento file FATTO (10 luglio 2026):** upload **PDF/Word(.docx)/TXT/CSV/MD** come `ProjectSource` — estrattore `sourceExtractor.fromFile` (riusa `mammoth`/`pdf-parse` come Agency, import on-demand), service `createFileSource` (file illeggibile → stato `error` con messaggio, non blocca), rotta multipart `POST /projects/:id/sources/files` (limite 20MB), UI: terzo tipo "File" nel pannello con input file (`accept=.pdf,.docx,.txt,.csv,.md`). Nessuna migrazione (colonne `fileName/mimeType/fileSize/content` già presenti); il binario NON viene conservato, si indicizza solo il testo. Verificato end-to-end (curl: ready + error path) + test unità. **(b) VETTORIZZAZIONE FATTA (13 luglio 2026)** — *questa riga diceva ancora "ancora da fare", corretta il 15/7:* `pgvector` **è installato e attivo** (versione 0.8.0, abilitato dall'utente come amministratore il 10/7 con `scripts/install-pgvector-win.ps1`); modello **`ProjectSourceChunk`** con colonna `embedding vector(1536)` (migrazione `20260713074114_project_source_chunks`), chunking + embeddings in `server/modules/sources/sources.indexing.ts`, ricerca per similarità in `sources.rag.ts`. **Ancora da fare:** (c) (opz.) migrare anche le URL/file *legacy* del blob dentro `ProjectSource` per avere un'unica fonte di verità — **⏸️ analizzato e RIMANDATO (decisione di Jacopo, 22/7);** vedi la nota di dettaglio nel "Residuo da completare" più sopra (sul demo non c'è nulla da migrare, il merge in lettura già unifica per l'AI, l'esecuzione richiede scelte di prodotto su file-senza-testo/competitor/dedup/scrittura editor).
- **Discovery** consolidata su RAG reale (Business Recap, Obiettivi/Target, Offerta/Competitor).
- **Chat AI di progetto** context-aware. **BASE FATTA (13 luglio 2026):** chat **per-utente** sul progetto — motore di generazione a testo (`runAgencyAiTextWithMeta`), RAG sulla domanda, risposte "grounded" con citazioni delle fonti, persistenza (`ProjectChatMessage`, migrazione `20260713144744_project_chat`), scheda "Chat" nel progetto, integrazione budget+log costi. **Evoluzione collaborativa PIANIFICATA** (multi-utente su invito, ambiti, popup globale, allegati, websocket, compressione contesto, navigazione assistita): spec e piano a fasi in `spec-chat-ai-collaborativa.md` — non iniziata, parte dopo le rifiniture V4 e con le chiavi AI reali.
- **Multi-provider**: aggiunta **Claude/Anthropic** (prompt architect) accanto a OpenAI; mapping modello-per-funzione (economico vs premium). **FATTO (10 luglio 2026):** il motore AI (`server/modules/agency-os/agency.service.ts`) ora supporta il provider `anthropic` accanto a `openai`. Nuova chiave `anthropic_api_key` **cifrata a riposo** (stessa DEK del vault, con fallback `ANTHROPIC_API_KEY` da `.env`); `runAgencyOpenAiJsonWithMeta` ramifica per provider e chiama la **Anthropic Messages API** (`/v1/messages`, header `x-api-key` + `anthropic-version`, `max_tokens` obbligatorio, JSON via system prompt con strip del code-fence in parse); modello di default Claude `claude-opus-4-8` risolto in automatico se il provider è Anthropic ma il modello configurato è ancora un `gpt-*` (`resolveAgencyProviderModel`); mapping modello-per-funzione (`functionModels`) valido per entrambi i provider. Modello **costi** esteso ai prezzi Claude (opus/sonnet/haiku/fable) → il log `AiUsageLog` traccia i consumi Claude come per OpenAI. UI: **Impostazioni Agency** ora ha `Anthropic (Claude)` tra i provider e un campo API key dedicato (write-only). Verificato end-to-end (config→status provider-aware→modello default→storage cifrato); **nessun nuovo errore TypeScript** (agency-os invariato 52=52). **Nota:** nessuna migrazione (la chiave riusa la tabella `AgencyRuntimeSetting` esistente).
- **Cost control**: stima costo/token su ogni pulsante AI + **budget giornaliero per dipendente** con tracking consumi. **FATTO.** (1) **Budget giornaliero per dipendente** (13 luglio 2026): tabella `AiBudget` + enforcement nel motore (`assertWithinAiBudget`) + UI in Impostazioni Agency (migrazione `20260713094017_ai_budget`). (2) **Rendiconto consumi AI per-workspace** (13 luglio 2026): nuovo pannello "Consumi & costi AI" in Impostazioni Agency (per dipendente/funzione, ultime chiamate, filtri); la Console piattaforma è stata ridotta a panoramica cross-workspace (dettaglio spostato in Agency). Sola lettura di `AiUsageLog`, nessuna migrazione. (3) **Stima costo sui pulsanti AI** (13 luglio 2026): endpoint `GET /agency/ai/estimates` + badge riusabile `AiCostEstimate`; range in USD che parte da un token-seed e si affina sui token storici per funzione (p25–p75) col modello corrente. Agganciato ai pulsanti **principali** di Discovery (brief + sezione), Web (`Genera con AI`) e Ads (`Rigenera asset AI`). Sola lettura di `AiUsageLog`, nessuna migrazione.
**Done quando:** si interroga in chat il brief di un progetto, la Discovery gira su fonti vettorizzate, e i consumi/budget sono visibili e limitabili.

> **~~Da fare più avanti (rinviato dalla stima-costo sui pulsanti, 13 luglio 2026)~~ FATTO (verificato 22 luglio 2026):** il badge `AiCostEstimate` è ora su **tutti** i pulsanti AI che consumano token, non solo quelli principali. La generazione **per-blocco** del modulo Web (`web.generateBlock`) è stata coperta il 21/7 (commit `80b8c4a`), e risultano coperti anche `discovery.generateSection` (badge per singola sezione) e `ads.generateAsset` (badge sull'intestazione del gruppo "Rigenera asset AI"). **Resa visiva decisa:** un badge **rappresentativo per gruppo** dove i pulsanti sono una fila fitta (Web "Rigenera un blocco" = 7 pulsanti sotto un solo badge; Ads asset idem), un badge **per riga** dove le voci sono distanziate (sezioni Discovery). **Non toccati (correttamente):** i pulsanti *rule-based* e gratuiti — "Rigenera diagnosis", "Rigenera report cliente", "Rigenera snapshot", "Cerca competitor", "Genera Google/Meta Ads", "Genera checklist", "Rigenera task base" — non chiamano il motore AI (nessun `functionName` tracciato), quindi non devono mostrare un costo. **Verifica 22/7:** `GET /agency/ai/estimates` risponde `aiConfigured: true` con la stima per tutte e 5 le funzioni che spendono (discovery brief/sezione, web progetto/blocco, ads asset) → i cinque badge si mostrano. Copre di fatto tutti gli "altri punti minori" ipotizzati il 13/7.

> **💡 In forse (idea emersa il 22/7, non pianificata):** portare una forma di **consapevolezza di costo anche nella chat AI**. Oggi la chat consuma token veri (`chat.summary`, `chat.<scope>`) ma **non ha alcun indicatore di costo**, a differenza dei pulsanti "Genera". Non è un semplice riuso del badge `AiCostEstimate`: la spesa di un turno di chat **non si pre-stima** come un pulsante (dipende dal contesto variabile), quindi servirebbe una piccola scelta di UX (es. costo *a consuntivo* per messaggio/sessione, oppure una stima "a spanne" pre-invio). **Da valutare se/quando si vorrà**, non ora.

> **📌 DA VALUTARE — far pesare i consumi AI sull'abbonamento invece che sulle API a consumo *(richiesta di Jacopo, 17/8/2026 — da affrontare al momento opportuno, NON nella release di settembre)*.**
>
> **Com'è oggi.** Ogni generazione e ogni messaggio della chat AI passa dalle **API a pagamento** di Anthropic e OpenAI, con chiavi salvate cifrate per workspace (`AgencyRuntimeSetting`, vedi la voce Multi-provider qui sopra). Si paga **a token**, e questa spesa si **somma** agli abbonamenti che l'agenzia già paga per usare Claude e ChatGPT nel lavoro quotidiano.
>
> **Cosa vorrebbe Jacopo.** Verificare se è possibile — e se sì, farlo — **agganciare le funzioni AI del CRM direttamente ai piani di abbonamento** delle due piattaforme, così che l'uso della chat AI dentro il CRM rientri nell'abbonamento già pagato invece di generare un costo aggiuntivo a consumo.
>
> **Stato della domanda: aperta, la verifica non è ancora stata fatta.** Quello che si sa già e che serve per impostarla:
> - Gli abbonamenti (Claude Pro/Max, ChatGPT Plus/Pro) coprono le **interfacce di Anthropic e OpenAI** — il sito, le app, e gli strumenti ufficiali. L'accesso **programmatico** da un'applicazione di terzi è storicamente un canale separato, con fatturazione a token: sono due prodotti commerciali diversi, non due porte sullo stesso credito.
> - Esiste però un precedente che rende la domanda legittima invece che oziosa: **Claude Code si autentica con l'abbonamento Max** invece che con una chiave API. Quindi "inferenza pagata dall'abbonamento" **è** un meccanismo esistente — la domanda vera non è *se esiste*, ma **se è concesso a un prodotto di terzi** come questo CRM.
> - ⚠️ **Il nodo non è tecnico ma di licenza e di modello multi-utente.** Un abbonamento è **personale**. Questo CRM è multi-azienda e multi-utente: farlo girare sull'abbonamento di una persona significherebbe **condividere un account fra più dipendenti** — cosa che le condizioni d'uso vietano, e che espone al rischio concreto di sospensione dell'account. E poiché il CRM va consegnato a un cliente, il problema si moltiplica per ogni azienda che lo usa.
>
> **Come procedere quando sarà il momento (mezza giornata, sessione a sé):** ① leggere le condizioni d'uso aggiornate dei due abbonamenti sul punto "uso da applicazioni di terzi"; ② verificare se esiste un canale ufficiale (una modalità di autenticazione dichiarata, non un espediente); ③ **solo se entrambe danno esito positivo** valutare l'integrazione. Se l'esito è negativo — che è l'ipotesi più probabile — la voce si chiude scrivendo il perché, così non si riapre ogni sei mesi.
>
> **Nel frattempo, le leve che abbassano davvero il conto** e non dipendono da questa risposta (nessuna richiede un permesso di nessuno): la **cache dei prompt** (il CRM rimanda le stesse fonti e lo stesso brand book a ogni chiamata: è esattamente il caso in cui la cache taglia la parte grossa della spesa); il **mapping modello-per-funzione** già esistente (`functionModels`), usando i modelli economici dove la qualità non cambia; e le **richieste in blocco** dove il risultato non serve all'istante. Il **budget giornaliero per dipendente** e il **rendiconto consumi** già costruiti in questa V restano il modo per vedere dove va la spesa prima di decidere dove tagliarla.

> **Rifinitura UI di fine V4 (segnalato 14 luglio 2026):** **audit grafico dell'area Agency** (schede progetto: Discovery e sorelle). Ci sono imperfezioni tema **chiaro/scuro** — box che restano bianchi in dark (uso di `bg="light"` ereditato dal template Jampack, incluso il badge `AiCostEstimate`) e scritte poco leggibili su alcuni pulsanti AI. Passata dedicata contro `design-linguaggio-apple-web.md` + `npm run lint:colors`, da fare **prima** di aprire la Chat collaborativa.

> **Nota storica:** fino al 15 luglio 2026 la Chat collaborativa era annotata qui come *"estensione AI pianificata"* dentro questa V. È cresciuta al punto da diventare una **V a sé** — vedi la **V4** qui sotto, che è quella in corso.

> **Ridisegno della schermata Impostazioni Agency — configurazione AI (proposto 20/7/2026 da Jacopo).** ✅ **FATTO (22/7/2026).** Attribuzione verificata (regola staffetta): la schermata e la sua configurazione AI sono lavoro di Jacopo (commit feriali 10-21/7), nessun conflitto → implementato. `/agency/settings` trattava l'AI come *"un provider + un modello di default"* (sembrava esclusivo, con un limite reale). **Direzione realizzata (era la proposta):**
> - **Difetto tecnico da correggere:** lo stato *"AI configurata"* oggi guarda **solo** la chiave del provider di *default* (`getAgencyAiStatusPayload`, `agency.service.ts:2113`). Va sganciato → *"abilitato + almeno un provider con chiave"*, così OpenAI e Anthropic sono **entrambi di prima classe**. *(Nota: il selettore modello in chat usa già qualsiasi provider di cui c'è la chiave — quindi i due provider POSSONO già coesistere; il limite è nello stato globale e nell'UX.)*
> - **Sopprimere** la box "AI generativa".
> - **Fondere** le due box (OpenAI e Anthropic) in **un'unica grande box**, impostazioni di ciascun provider separate ma **affiancate**.
> - Nella stessa box, **un solo interruttore "Abilita generazioni AI"** che copre entrambi i provider.
> - Nella stessa box, il **modello preferito** come **menu a discesa** che mostra solo i modelli dei **provider attivi** (con chiave) — non un campo di testo libero.
> - **Rimozione chiavi — CONFERMATO (20/7/2026, Jacopo):** il checkbox *"Rimuovi la API key salvata nel CRM"* è ambiguo e poco intuitivo → diventa un **pulsante vero e proprio** con dicitura chiara, es. **"Cancella permanentemente le chiavi API dal CRM"**, accompagnato da un **selettore del provider** (solo OpenAI / solo Anthropic); **se non si seleziona nulla, le cancella tutte indistintamente**. Un comando esplicito serve comunque, perché il campo chiave è *write-only* e "vuoto = non cambiare".
> - **Rinomina** dell'etichetta pulsante: da "Salva impostazioni **runtime**" a un più chiaro "Salva impostazioni".
> ✅ **Implementato il 22/7:** box unica "Provider AI" (interruttore unico + "modello preferito" a menu dei soli provider con chiave, il provider si sceglie dal modello + chiavi affiancate con badge + pulsante "Cancella permanentemente le chiavi API dal CRM" con selettore provider + rinomina "Salva impostazioni"); backend `getAgencyAiStatusPayload` sganciato dal solo default ("abilitato + almeno un provider con chiave") con **risoluzione del provider effettivo** a uno che ha la chiave. Nessuna migrazione; `tsc` 233=baseline, lint verde, build ok. ⚠️ **Nota per Claudio** (il cambio di semantica di `configured` tocca il motore AI): `archivio-documenti/nota-confronto-claudio-2026-07-22.md`.

> **Discovery AI — consentire ipotesi ragionate sui campi mancanti (emerso 20/7/2026 dal collaudo; ⛔ DA DISCUTERE CON CLAUDIO PRIMA di attuare).** Generando la Discovery di un progetto le cui fonti non esplicitano il *target*, l'AI lo marca "non definito" invece di inferirlo dagli indizi (es. "fotografa di matrimoni a Torino" → coppie in procinto di sposarsi in zona). **Causa:** il system prompt impone **grounding stretto** — *"Non inventare target, offerta, CTA, USP o dati di mercato non presenti"* (`agency.service.ts:9191`); e gli alert *"Target non definito / Offerta non chiara / USP non evidenti"* sono **rule-based** (`agency.service.ts:3821-3827`, controllo delle "evidenze" nelle fonti), non prodotti dall'AI. **Non è un bug:** è la stessa scelta anti-allucinazione che rende affidabile il RAG/chat. **Rimedio proposto:** allentare il prompt **solo per la Discovery** (lavoro da strategist, non risposta factual) → consentire un'**ipotesi ragionata** sui campi mancanti, marcata esplicitamente *"da validare"* (mantiene l'anti-allucinazione, aumenta il valore); eventualmente affinare il rilevatore rule-based delle evidenze. ⚠️ **Jacopo vuole confrontarsi con Claudio PRIMA di procedere** (è motore AI = V5, e la scelta grounding-stretto-vs-inferenza è una decisione di prodotto da condividere). → **Nota di confronto pronta (22/7):** `archivio-documenti/nota-confronto-claudio-2026-07-22.md` (opzioni A/B/C, trade-off, posizioni di codice aggiornate: prompt `agency.service.ts:9327`/`:9631`, alert rule-based `:3922-3928`).

### 🟦 V6 — Reportistica multi-sorgente (dashboard operativa + report cliente)
**Obiettivo:** un sistema unico di reportistica delle performance, dal team al cliente.
**Contenuto:** raccoglie i dati di performance da **Google Ads**, **Meta** e **file Excel non standardizzati dei clienti** in un **formato comune**; li **storicizza** (rilevazioni datate a **intervalli liberi**, con agganci a campagne/eventi/sorgente/ambito/tag) per leggere tendenze nel tempo; li presenta in una **dashboard operativa interna** (strutturata come il **master template** del progetto "Revisioni fogli di calcolo" — filtri periodo/sede, sezioni Metriche/KPI/Operatori/Canali/Top prestazioni — con le entità di dominio rese **neutre e adattabili** per settore) da cui si **deriva**, filtrato e brandizzato, il **report per il cliente** (riusa l'export PDF Apple-style già fatto in V7). Metriche **configurabili** con **set salvabili ("carnè")** per workspace; **report separati** per fonte **+ combinato**; standardizzazione dei fogli Excel **assistita dall'AI** (propone il mapping colonna→metrica, l'utente conferma, il **profilo si salva** e si riusa). ✅ **Impianto approvato da Claudio (24/7/2026).**
**Riferimenti:** visione leggibile in `archivio-documenti/report-multisorgente-per-claudio.md`; dettaglio tecnico, decisioni e vincoli in `archivio-documenti/report-multisorgente-decisioni.md`.
**Dipendenze esterne:** OAuth Google/Meta + **developer token Google Ads** (approvazione manuale di Google, da avviare per tempo). **Primo passo sviluppabile subito** (indipendente da OAuth e dalla modalità dati): **serbatoio dati comune + storico + set metriche** → **una migrazione tracciata**.
**Idea da tenere da parte (non ora):** un'AI che **apprende** quali metriche si usano per cliente/reparto e **propone** i set — vedi `report-multisorgente-decisioni.md`.
⚠️ **Nota di manutenzione:** questa V passa dai due centralini dell'area Agency (`src/modules/agency-os/data/agencyDataAdapter.js`, 2.775 righe, e `src/modules/agency-os/api/agency.api.js`, 1.093), che sono ancora file-mostro. La loro spezzatura è stata **rinviata apposta** a quando si sa quali funzioni nuove dovranno ospitare (decisione di Jacopo, 5/8/2026): se questa V ci aggiunge roba, si spezzano **prima** — vedi *Debito tecnico*, voce *"Spezzatura dei file-mostro: quali aspettano la loro V"*.
**Done quando:** da un progetto si genera una dashboard operativa multi-fonte con storico, e se ne deriva il report cliente brandizzato.

### 🟦 V7 — Verticali AI: Web & ADV + Audit/Report
**Obiettivo:** produzione asset guidata dal contesto.
**Contenuto:**
- **Web & ADV**: generazione strutture HTML/landing + copy campagne **Meta/Google/TikTok** per sotto-progetto.
- **Generazione visiva** — grafiche statiche per social e ADS. ⚠️ **Impostazione da rivedere prima dello sviluppo (nota di Jacopo, 24/7/2026).** Lo **scopo resta valido e prioritario**: integrare nel CRM un sistema di **generazione immagini** (soprattutto **grafiche statiche per social e ads**) che si appoggi a **Claude** — sfruttando **skill di prompt engineering già sviluppate e collaudate** (le ha Jacopo) — più un **collegamento MCP** verso una piattaforma/modello di generazione immagini. **Higgsfield** era stato indicato perché offre un'integrazione MCP con Claude: **resta un'opzione in teoria valida ma NON confermata** (non c'era, e non c'è, certezza che sia l'integrazione ideale allo scopo). La catena "Contesto → Claude → Higgsfield" va quindi letta come **ipotesi di partenza, non come scelta fatta**. **Prima di scrivere codice servirà una sessione esplorativa lunga e approfondita** su fattibilità, sensatezza e aderenza allo scopo dell'opzione MCP scelta (Higgsfield o alternative).
- **Audit Engine SEO** (analisi URL: H1, meta, mancanze) — completa il modulo `seo`. ✅ **FATTO (22/7/2026):** l'analyzer era già registrato ma minimale; ora arricchito e messo in sicurezza. **Backend:** analyzer puro e testato `server/modules/web-assets/seo-analyzer.ts` (title, meta description robusta all'ordine attributi, H1/H2, canonical, viewport, `lang`, robots `noindex`, Open Graph, copertura `alt` immagini, HTTPS, copertura keyword) con punteggio pesato e problemi tipizzati `{code, severity, message}`; **anti-SSRF** condiviso `server/core/net-guard.ts` (`safeFetch` con validazione host + risoluzione DNS + redirect ri-validati) estratto dalla logica del logo PDF (ora in un posto solo) e applicato a **SEO scan + healthcheck** dei web asset. **UI:** nuova tab **SEO** nel dettaglio asset (pulsante "Esegui scansione" con keyword, punteggio, lettura meta/H1, problemi per severità, consigli, storico). Verificato: tsc 233=baseline, unit **239/239** (+14: analyzer+guard), scansione reale E2E (score+issues) e **blocco SSRF su 127.0.0.1 → 400**, eslint/lint:colors puliti. Nessuna migrazione (tabella `WebAssetSeoReport` già presente). **Rimane possibile in futuro:** suggerimenti generati dall'AI (oggi rule-based, di proposito indipendenti dal nodo AI di Claudio).
- **Report PDF brandizzato Apple-style** con import dati (es. conversioni Google Ads). ✅ **PRIMO PEZZO FATTO (22/7/2026):** export PDF brandizzato del **report cliente** — pulsante "Scarica PDF" nella pagina Report cliente → `GET /agency/projects/:id/reports/client/pdf` → PDF pdfkit in stile Apple (brand: logo+colori da `WorkspaceBranding`, sezioni Executive/Stato/Attività/Elementi/Opportunità/Prossimi passi). Helper PDF condivisi estratti in `server/core/pdf.ts` (riusati da preventivi e report; logo con anti-SSRF in un posto solo). Verificato E2E (endpoint 200 `application/pdf`, browser click→download, testo corretto); `quotePdf.test.ts` 2/2, tsc 233=baseline, unit 225/225. **Ancora da fare → PROMOSSO alla nuova V6** (*Reportistica multi-sorgente*): l'**import dati esterni** (Google Ads, Meta, Excel dei clienti) è cresciuto fino a diventare una **V a sé** — vedi V6 qui sopra. L'**export PDF** del report cliente (già fatto) resta qui come base, ma viene riusato dalla V6.
**Done quando:** da un progetto si generano landing+copy coerenti col brand e un report cliente brandizzato.

> **Quattro punti aperti sulle pagine Web/Ads, emersi il 4/8/2026 spezzando `AgencyProjectWebPage.jsx` ed esplorando `AgencyProjectAdsPage.jsx`.** Nessuno è una regressione: sono tutti comportamenti già presenti, che la lettura ravvicinata ha portato a galla. Vanno decisi qui, non dentro un giro di rifattorizzazione (che per regola non cambia comportamento).
>
> 1. **Il pannello "Contratto generazione" può dichiarare al cliente meno di quello che ha prodotto.** Il campo *Modalità* legge `aiStatus?.configured`, mentre i pulsanti leggono l'assenza di AI: coincidono sempre **tranne** quando la chiamata `getAgencyAiStatus()` **fallisce**. In quel caso `aiStatus` resta `null` → i pulsanti AI restano attivi e la generazione parte davvero, ma il pannello scrive "Bozza base dichiarata". È il riquadro che dice al cliente quanto fidarsi dell'output, quindi la scelta va fatta apposta. Opzioni: (a) lasciarlo com'è e replicarlo su Ads/Assets; (b) allinearlo ai pulsanti; (c) **terzo stato esplicito "stato AI non verificabile"** — in un riquadro di trasparenza "non lo so" è un'informazione, "bozza base" può essere un'affermazione falsa.
> 2. **Adottare su Ads il pannello "Qualità input" condiviso aggiunge un riquadro di giudizio che Ads oggi non ha** (Web sì). Non è riuso a costo zero: è un piccolo cambiamento visibile. Va deciso se l'obiettivo è uniformare le tre pagine sorelle o non toccare la resa di Ads.
> 3. **`src/views/Agency/project/ads/hooks/useAgencyProjectAdsSubProjects.js:65` — probabile refuso:** `campaignGoal: projectItem.goal ? current.output.campaignGoal : current.output.campaignGoal` restituisce lo stesso valore sui due rami, quindi l'obiettivo campagna **non viene mai aggiornato** quando si usa una campagna come contesto corrente; la riga sotto (`offerAngle`) fa invece la cosa analoga correttamente. Da verificare e sistemare qui, con l'intento originale sotto mano. *(La riga stava in `AgencyProjectAdsPage.jsx:304` finché quel file non è stato spezzato, il 4/8/2026: nella nuova posizione c'è un commento che rimanda a questo punto.)*
> 4bis. **Le tre pagine sorelle mostrano i messaggi di stato in ordine diverso** *(emerso il 4/8/2026 spezzando `AgencyProjectAssetsPage.jsx`)*. Web e Ads usano il pannello condiviso `shared/AgencyStatusAlerts`, che mette **prima l'errore e poi l'informazione**; la pagina Fonti e Materiali fa il **contrario** (prima l'informazione blu, poi l'errore giallo) e per questo non adotta il pannello condiviso — i due avvisi restano scritti nella pagina. Non è un ordine casuale: su Fonti i due messaggi **compaiono spesso insieme** (diversi handler ne scrivono uno senza pulire l'altro), quindi l'ordine si vede davvero. Adottare il pannello condiviso cambierebbe anche altre due cose: l'errore diventerebbe `alert-warning` con `py-2 mb-3`, che oggi lì non ci sono. Da decidere insieme al punto 2: **o si uniformano le tre sorelle** accettando un cambiamento visibile su Fonti, **o si lascia com'è** e si annota che il pannello condiviso vale per due pagine su tre.
>
> 4. **Il pannello delle fonti può comparire due volte sulla stessa pagina:** `AgencyProjectPageTemplate.jsx` ne rende già uno compatto per ogni sotto-pagina tranne Assets, e Web e Ads ne rendono un secondo, non compatto, come prima riga del proprio contenuto. Da guardare quando si mette mano alla resa di queste pagine.

> **Da fare (richiesto da Jacopo, 21/7/2026) — immagini di cliente/progetto tra gli Elementi allegabili alla Chat AI.** Oggi allegando un **cliente/progetto** in chat si porta solo il suo **snapshot testuale** (nome, obiettivo, ecc.), non le sue immagini. Da quando esistono immagini legate all'entità — **soprattutto le creatività generate dal sistema visivo (Higgsfield, questa V)**, e gli eventuali **asset brand** del Modulo Fonti (V5) — vanno rese **allegabili in chat come immagini vere**. Il valore è immediato: allego una creatività e chiedo all'AI di commentarla/criticarla/iterarla. **La pipeline che le fa *vedere* al modello esiste già** — `collectPromptVisionImages` → `buildMultimodalMessages`, la **"vista" multimodale fatta e collaudata in V4 il 21/7** (immagini png/jpeg/gif/webp sui tre provider). **Quello che manca** è che le immagini di cliente/progetto esistano come **entità di prima classe allegabili**: verosimilmente un **nuovo tipo allegabile** (es. `creative`/`asset`) accanto agli attuali `project`/`client`/`source`/`quote` (`ATTACHABLE_ENTITY_TYPES` in `server/modules/agency-os/chat-attachments.ts`), oppure l'estensione dello snapshot d'entità perché esponga i propri binari immagine. **Collocato qui** perché è quando le creatività diventano un oggetto reale del CRM; se gli asset-brand immagine diventassero allegabili prima (V5 Fonti), può partire di lì.
>
> ⚠️ **Primo passo obbligato quando si apre questo punto: spezzare `src/views/Agency/chat/AiChatWidget.jsx`** (1.454 righe). Il selettore degli allegati sta lì dentro, ed è proprio ciò che questa voce va a estendere; la regola di `CLAUDE.md` vieta di aggiungere funzioni a un file sopra soglia. La spezzatura è stata **rinviata apposta** a questo momento (decisione di Jacopo, 5/8/2026) per non tagliare il file due volte — motivo e criterio nel *Debito tecnico*, voce *"Spezzatura dei file-mostro: quali aspettano la loro V"*. Il piano di estrazione va costruito da zero, in quella sede.

### 🟦 V8 — Laboratorio & Zero Error Protocol
**Obiettivo:** azzerare gli errori di stampa.
**Contenuto:**
- Modulo **Laboratorio (Stampa)**: schede materiali/misure, ruolo **Reparto Lab**.
- **Validazione AI obbligatoria** pre-stampa: confronto dati tecnici ↔ Fonti del progetto, con segnalazione discrepanze in tempo reale.
**Done quando:** nessun job va in stampa senza esito di validazione AI.

### 🟦 V9 — Preventivatore Pro & Strumenti di Vendita
**Obiettivo:** vendita rapida e d'impatto.
**Contenuto:**
- **Builder drag-and-drop** su pacchetti predefiniti.
- **Output duale**: Preventivo Analitico + **Proposta Apple-style** (slide vendita).
- **Validità 72h** automatica + notifica account manager alla scadenza.
**Done quando:** in pochi click si genera sia il documento tecnico sia la proposta visuale, con scadenza gestita.

### 🟦 V10 — Calendario & Comunicazione Avanzata
**Obiettivo:** appuntamenti e comunicazioni centralizzati.
**Contenuto:**
- Integrazione **Meet/Zoom**.
- **Link Calendly-style** per dipendente (disponibilità reale del workspace).
- **Reminder automatici** clienti.
- Messaggistica potenziata a **thread di progetto**.
- **Thread di messaggistica come allegato alla chat AI** *(spostato dalla V4 il 20/7/2026)*: da progettare **insieme** al modello a conversazioni; decisioni già prese e direzioni (A "Cita nella chat AI" / B allegato granulare) nel blocco **V4 → "Fuori perimetro / V9"**. ⚠️ Come per la voce gemella della V7, il **primo passo è spezzare `src/views/Agency/chat/AiChatWidget.jsx`** (1.454 righe), se non l'ha già fatto la V7: rinviata apposta qui perché è questa voce a estendere il selettore degli allegati. Vedi *Debito tecnico*, voce *"Spezzatura dei file-mostro: quali aspettano la loro V"*.
**Done quando:** un cliente prenota da link personale, riceve reminder, e la conversazione resta legata al progetto.

**Due difetti piccoli del calendario attuale** *(trovati il 5/8/2026 spezzando `views/Calendar/index.jsx`; nessuno dei due è stato toccato, il giro era a comportamento invariato)*:
- **Spegnendo "Intera giornata" l'orario non torna a mezzanotte ma alle 02:00** (01:00 d'inverno). Il motivo: una data "nuda" come `2026-08-05` JavaScript la legge come UTC, e riconvertendola in ora locale italiana si sposta di due ore. Si vede solo accendendo e poi rispegnendo la spunta su un evento. Il rimedio è leggere quella data come locale invece che come UTC. È fotografato da un test (`board/boardPureFunctions.test.js`), che oggi documenta il comportamento sbagliato: **quando si corregge, va corretto anche quel test**.
- **Il periodo in cima al calendario è in inglese** ("August 2026"): la griglia è in italiano (`locale="it"` su FullCalendar), ma l'etichetta la scrive `moment`, di cui nel progetto non è caricata nessuna localizzazione italiana. Sistemarlo tocca solo l'etichetta, ma `moment` è usato in parecchi punti: caricare la localizzazione globalmente cambierebbe anche le altre date del CRM, quindi è una decisione da prendere, non una riga da cambiare di straforo.

**Un miglioramento possibile, non un difetto** *(stesso giro)*: il colore proposto per un evento nuovo è il blu fisso `#0d6efd` (ora in un posto solo, `board/boardConstants.js`), mentre altrove il progetto prende il colore primario del **branding del workspace** con `readBrandingColor('--bs-primary', …)` (`src/lib/brandingColors.js`, usato da `views/Projects/ProjectPipelineSettings.jsx`). Farlo anche qui allineerebbe il calendario al branding. **Non è stato fatto nel giro di spezzatura perché cambia il comportamento**, e quel giro doveva lasciarlo identico. Resta un dato e non uno stile: finisce nel database e nel campo `<input type="color">`, che vuole un esadecimale — un token CSS lì non funziona.

### 🟦 V11 — Contabilità, Redditività & Integrazioni Business
**Obiettivo:** controllo di gestione data-driven.
**Contenuto:**
- Connettore **Fatture in Cloud** (fatturati/flussi nel CRM, riservato Admin).
- **Time-tracking** su progetti/task.
- **Analisi redditività real-time** (tempo/risorse ↔ fatturato) per cliente e reparto.
- Completamento **API framework** a plugin per integrazioni future.
**Done quando:** l'Admin vede la redditività effettiva per cliente/reparto in tempo reale.

### 🟦 V12 — Finale: Importazione dati legacy, Hardening & Rollout
**Obiettivo:** transizione completa senza interruzioni.
**Contenuto:**
- **⭐ PRIMO BLOCCO — Riordino gerarchico dell'interfaccia** *(deciso il 7/8/2026; dettaglio in `decisioni-cliente-e-menu-2026-08-07.md` §3)*. **Va fatto per primo, prima del rollout**, e il motivo è di tempistica: riorganizzare la navigazione **dopo** che le persone hanno imparato quella vecchia è il momento peggiore possibile. Si consegna la forma definitiva, non quella che cambierà fra un mese.
  - **La pagina cliente diventa un dossier completo**: tutto ciò che è del cliente vive lì dentro **per intero** (non anteprime) — Fonti/Brief, i suoi progetti, i suoi preventivi, i suoi siti, le sue credenziali — ciascuno in una propria scheda, più una **scheda Panoramica** con lo stesso ruolo che ha oggi quella di un progetto: lettura sintetica, non elenco grezzo.
  - **I moduli dedicati restano anche a sé** (Preventivi, Siti in gestione, Credenziali): rispondono a una domanda che il dossier del singolo cliente non può dare — *"cosa scade questa settimana, su tutti i clienti insieme"*. Sono due modi diversi di guardare gli stessi dati e servono entrambi.
  - **Il criterio di densità** applicato per intero: un blocco va dietro una linguetta se **non cambia una decisione che stai prendendo adesso**; resta visibile se la cambia, anche a costo di densità. ⚠️ Non è "nascondi tutto": il precedente contrario è la scheda Memoria, nascosta per errore e resa visibile di proposito il 5/8 perché *"in un'area dove l'AI scrive per te, poterlo guardare è una questione di fiducia"*.
  - **Perché non prima:** dipende dall'ancoraggio al cliente deciso in V5 e dal set finale dei moduli. **Perché non in V13:** quella è dichiarata come "l'ultima, quella che rischia di non farsi mai" — metterci la navigazione equivale a non farla.
- **Mappatura schema & importazione dei dati** dal sistema legacy (continuità clienti/storico). *(NB: qui "importazione" = travaso dei dati reali dal vecchio sistema al nuovo — è cosa diversa dalle migrazioni dello schema del DB, che si fanno tracciate durante lo sviluppo.)*
  - 📌 **Domanda da riaprire qui, non prima** *(7/8/2026)*: come si travasa **l'elenco vero dei clienti dell'agenzia**. È stata esplicitamente distinta dai dati oggi nel CRM, che sono **tutti di test** e non richiedono nessuna strategia di migrazione.
- **Hardening** sicurezza/performance, audit completo, test end-to-end.
- Rollout progressivo + QA finale, dismissione definitiva del legacy.

### 🟦 V13 — Pulizia finale dei file *(nata il 5/8/2026)*
**Obiettivo:** chiudere il residuo del riordino, cioè i file troppo grossi che **nessuna V ha mai avuto motivo di aprire**.

**Perché esiste, e perché è in coda.** Il riordino dei file grossi si fa **dentro la V che li riapre**, come suo primo passo: è la regola decisa il 5/8 (vedi *Debito tecnico* → *"Dimensione dei file: il censimento completo e chi spezza cosa"*). Ma alcuni file non li riapre nessuna V: se aspettassero un'occasione che non arriva, resterebbero fuori norma per sempre. Questa V è il loro contenitore.

**Contenuto** (l'elenco vivo sta nel *Debito tecnico*, gruppo ②, ed è lì che va aggiornato quando un file esce di lista):
- `views/WebAssets/index.jsx` (2.706 righe) — da solo vale più di una sessione.
- `views/Authentication/SignUp/Signup/index.jsx` (920) — a meno che non lo si faccia prima, visto che è libero.
- I **14 file** fra 500 e 800 righe del frontend.
- I file **backend** sopra soglia che nessuna V ha toccato nel frattempo.
- Cancellazione dei **file morti** censiti (i sei relitti del tema nella cartella Calendario, più quanto emerso strada facendo).

**Regola d'ingaggio:** man mano che le V precedenti spezzano i loro file, **questa V si accorcia**. Se al momento di aprirla la lista fosse vuota, la V si chiude senza fare nulla — ed è il risultato migliore possibile, non uno spreco.

**Done quando:** nessun file del codice che scriviamo noi sta sopra la soglia senza una ragione scritta.

> ⚠️ **Il rischio dichiarato di questa V:** essere l'ultima, e quindi quella che non si fa mai. È il motivo per cui la pulizia **non** è stata concentrata tutta qui: qui arriva solo ciò che nessun altro momento può prendersi. Se questa V dovesse slittare all'infinito, il danno resta limitato al residuo.
- **Onboarding leggero esteso a tutto il CRM (deciso 14 luglio 2026):** portare l'approccio "guida in-contesto" (empty state, tooltip, card dismissibili — **non** un tutorial/wizard pesante) a **tutte** le aree del prodotto, non solo alla Chat AI. Collocato qui perché ha senso solo a prodotto sostanzialmente completo (dopo la V11 — *era "dopo V9" prima del 15/7, "dopo V10" prima del 24/7*). L'onboarding **della sola chat** si fa invece dentro la V4.
**Done quando:** tutti gli utenti operano sulla nuova piattaforma Apple-style, dati importati e verificati.

---

## Debito tecnico / tooling (trasversale)

Voci non legate a una singola versione: si pianificano quando conviene, non fanno parte del "done" di nessuna tappa.

- **Migrazione ESLint a "flat config".** ✅ **FATTO (22/7/2026, Jacopo).** Creato `eslint.config.js` (formato flat, ESLint 9), rimosso il vecchio `.eslintrc.cjs`, aggiornato lo script in `package.json`. Fedele all'intento del vecchio config (eslint:recommended + react + jsx-runtime + react-refresh + hook `rules-of-hooks`/`exhaustive-deps`); **NON** si è adottato l'intero ruleset "React Compiler" del plugin react-hooks 7.x (`set-state-in-effect`, `static-components`, `immutability`…): sarebbe una scelta a sé, con molte correzioni di massa, da concordare. `npm run lint` ora **gira ed è verde**: azzerati i 66 errori (51 erano nei test di una libreria vendored `@hk-gantt` non importata → ignorata; 6 `no-useless-escape` e 9 `no-unescaped-entities` → correzioni banali; 5 direttive `eslint-disable` morte rimosse). Restano **13 avvisi pre-esistenti** (`react-refresh/only-export-components` sul design system + `react-hooks/exhaustive-deps` sugli hook), lasciati apposta (vanno valutati caso per caso, non di straforo). ⚠️ **Una scelta fatta, da confermare:** tolto il gate `--max-warnings 0` (con quei 13 avvisi il comando resterebbe rosso per sempre); così il lint passa e serve a controllare il **codice nuovo**. Alternativa se si vuole il gate severo: sessione dedicata per azzerare i 13 avvisi (le deps degli hook una a una = revisione, rischiose da auto-correggere), poi rimettere `--max-warnings 0`. Non tocca il guard colori dedicato (`npm run lint:colors`), autonomo e già funzionante.

- **Due librerie di icone in casa** *(emerso il 15/7/2026)*. La spec della chat prescrive **`react-feather`** (ed è ciò che usa tutto il popup); il documento di design prescrive **Lucide** (ed è ciò che usa il modulo Messaggi, `src/views/Email/index.jsx`). Lucide è un fork di Feather, quindi la resa è omogenea e a occhio non si nota — ma sono due dipendenze per lo stesso scopo, e due regole in contraddizione fra due documenti fondativi. **Va deciso quale vince e allineati i documenti**: è una scelta di prodotto, non da fare di straforo dentro un'altra attività.

- **Il test `server/integration/auth-login.smoke.ts` fallisce** per una chiave mancante nell'ambiente di test. **Preesistente e verificato** (mettendo da parte le modifiche in corso, falliva già). Funzionano `npm run test:unit` (192/192), `lint:css` e `lint:colors`.

- **233 errori TypeScript preesistenti** (`npx tsc --noEmit`). È la **baseline** con cui si convive: il metro di giudizio è *"nessun errore nuovo"*, non *"zero errori"*. Da azzerare, se si decide di farlo, in una passata dedicata — plausibilmente dentro l'hardening della **V11**.

- **Etichette dei form non collegate ai campi (accessibilità)** *(censito il 4/8/2026)*. Nel frontend le `<Form.Group>` di react-bootstrap che contengono una `<Form.Label>` spesso **non hanno `controlId`**: senza, la label non riceve `htmlFor` e il campo non riceve `id`, quindi non risultano collegati. Chi usa uno screen reader non sente a cosa serve il campo su cui si trova, e nei test i campi non si possono cercare per etichetta. **Misura: 137 gruppi in 30 file** (i più carichi: `views/WebAssets/index.jsx` 20, `modules/clients/ui/ClientForm.jsx` 11, `views/Agency/AgencyProjectNewPage.jsx` 9, Quotes 24 in 5 file, Calendar 17 in 3 file, Projects 12 in 3 file). **Come si sta chiudendo:** *in scia ai giri di spezzatura dei file .jsx*, non con una passata unica — i file che si riscrivono si sistemano lì, con i test nuovi che dimostrano il collegamento (già fatto così in `modules/projects/ui/` durante i due giri pipeline, e in `views/Agency/project/web/WebPageSettingsCard.jsx` il 4/8). Restano da coprire le aree che il riordino .jsx non tocca (Quotes, Team, Settings, Authentication): **sessione dedicata**, da decidere. ✅ **Calendar chiuso il 5/8/2026** durante la spezzatura: i sette gruppi del modulo evento hanno il loro `controlId` e un test lo dimostra (`board/CalendarBoardPageUi.test.jsx`, *"tutti i campi si raggiungono dalla loro etichetta"*). Gli altri gruppi scollegati di quella cartella stanno tutti nei **quattro file morti** (`AddCategory`, `CreateNewEvent`, `EventsDrawer`, `SetReminder`): si chiudono cancellandoli, non correggendoli. ⚠️ **Nota che senza un controllo il buco si riapre:** il plugin che lo verifica (`eslint-plugin-jsx-a11y`, regola `label-has-associated-control`) **non è installato** — aggiungerlo a livello di avviso, in linea con gli altri guardrail, è una decisione a sé perché è una dipendenza nuova.

- **`formatDateTime` copiata identica in nove file dell'area Agency** *(trovata il 4/8/2026)*. Stessa funzione, stesso corpo, in `views/Agency/project/ads/adsFormatDateTime.js` (era in `AgencyProjectAdsPage.jsx` fino alla spezzatura del 4/8/2026), `AgencyAiUsagePanel.jsx`, `AgencyProjectsListPage.jsx`, `AgencyReportsPage.jsx`, `AgencyProjectClientReportPage.jsx`, `AgencyProjectDiagnosisPage.jsx`, `AgencyProjectMemoryPage.jsx`, `AgencyProjectOverviewPage.jsx`, `AgencyProjectReportsPage.jsx`. Va consolidata in un posto solo (candidato naturale: `src/views/Agency/project/agencyProjectUx.js`, già condiviso). **Non è un rischio, è manutenzione**: nove copie divergeranno prima o poi. Da fare quando il riordino .jsx passa su quei file, o in una passata mirata (è una convergenza meccanica, come quelle già fatte su `sortCategories`/`getErrorMessage`). ⚠️ Attenzione alla trappola già annotata per `getErrorMessage`: prima di accorpare, verificare che le nove copie siano **davvero** identiche e non varianti con comportamento diverso.

- **Tre duplicazioni nell'area Checklist** *(trovate il 5/8/2026, preparando la spezzatura di `views/Checklists/ChecklistTemplates.jsx`)*. Non sono difetti: sono copie che divergeranno.
  1. **I badge di uno step di checklist** (`isRequired`, `requiresEvidenceSnapshot`, `isCriticalSnapshot`) sono disegnati due volte con la stessa logica, in `views/Checklists/ChecklistTemplates.jsx` e in `modules/checklists/ui/ProjectChecklistPanel.jsx`. Stesso modulo, stesso significato: è il candidato più forte a un componente condiviso (`ChecklistItemBadges`). **Da valutare quando si spezza il pannello di progetto**, così i due posti si toccano insieme invece che a distanza di mesi.
  2. **Lo "sposta su / sposta giù" disabilitato ai bordi** esiste identico in `views/Checklists/ChecklistTemplates.jsx` e in `modules/customFields/ui/CustomFieldsPage.jsx`. Due casi confermati dello stesso schema: se ne spunta un terzo, conviene un hook di riordino condiviso invece di una terza copia.
  3. **`getErrorMessage` è copiata quasi identica in una decina di file**, incluso `ProjectChecklistPanel.jsx` che consuma la stessa API. Candidato: un `src/lib/apiErrors.js`. ⚠️ Vale la trappola già annotata per questa stessa funzione: prima di accorpare, verificare che le copie siano **davvero** identiche e non varianti con comportamento diverso.

- **Quello che l'audit dei permessi ha trovato fuori dal suo perimetro** *(7/8/2026, fase A2 pezzo ①; raccolto qui per non allargare quel lavoro)*. Nessuna di queste voci è urgente, e nessuna è stata toccata.
  1. **Due file di rotte irraggiungibili.** `server/routes/workspace-quotes.route.ts` è una scorciatoia verso il modulo Preventivi che **nessuno importa** (`server/app.ts` prende direttamente da `server/modules/quotes/`), e `server/routes/me.route.ts` definisce un handler `GET /me` **mai registrato** — il vero endpoint è `/auth/me`. Sono codice morto: si cancellano quando si passa di lì, verificando prima con un grep che nessuno li importi.
  2. **`GET /debug/cors` non ha nessun gate**, nemmeno di ambiente (`server/app.ts`). Espone solo l'elenco delle origin CORS configurate, quindi il rischio è basso, ma resta una rotta di debug raggiungibile in produzione. Va chiusa dietro un controllo su `NODE_ENV` o rimossa.
  3. **Due aree dove l'interruttore del modulo non spegne niente.** `workspace-departments.route.ts` e `workspace-roles.route.ts` controllano il permesso ma **non** `requireModuleEnabled`, mentre `departments` e `team` sono moduli disattivabili: spegnerli dalle Impostazioni non chiude quelle rotte. Può essere voluto (sono pagine di sistema), ma non è dichiarato da nessuna parte — va deciso e scritto.
  4. **Permessi che restano senza rotta.** `seo.export` e `seo.manage_settings` (le funzioni non esistono ancora: esportazione e impostazioni SEO arriveranno con la V7) e `checklists.create` / `.edit` / `.delete` (le mutazioni sui modelli sono tutte protette da `checklists.manage_templates`). Sono state **lasciate nel catalogo di proposito** — Jacopo ha chiesto di preservare le voci esistenti e non moltiplicarle — ma sono caselle che oggi non governano nessuna rotta. Il frontend non le usa più: prima accendevano pulsanti che il server rifiutava.
     ⚠️ **Correzione dell'8/8/2026: «senza rotta» non vuol dire «senza effetto», e su una delle tre è un errore.** `checklists.edit` è letta **fuori dalle rotte**, da `server/modules/dashboard/dashboard.policies.ts:121`: concorre ad alzare a *manager* il livello dell'utente sulla Dashboard, e quel livello decide **quali riquadri vede**. Quindi chi un domani ripulisce queste caselle può cancellare `create` e `delete`, ma **non `edit`** senza passare prima di lì. L'impatto vero, per non sopravvalutarlo: `checklists.edit` sta in un OR con altre sei chiavi (`team.edit`, `projects.edit`, `projects.move_stage`, `quotes.send`, `quotes.accept`, `checklists.assign`), quindi cancellarla cambierebbe la Dashboard **solo** ai ruoli che hanno quella e nessuna delle altre sei — caso raro, ma che nessuno vedrebbe accadere. `seo.export` e `seo.manage_settings` invece sono davvero inerti, verificato.
  5. **`projects.move_stage` non è controllato in interfaccia:** il trascinamento delle schede nel kanban si può tentare sempre, e fallisce lato server. Non è un buco di sicurezza, è un pulsante che mente.
  6. **La Produzione AI non c'è nella barra in basso del telefono** (`src/layout/Mobile/MobileBottomNav.jsx`), che invece elenca Dashboard, Clienti, Pipeline, Messaggi, Team, Preventivi, Siti, Credenziali, Calendario, Audit. È l'area principale del prodotto: probabilmente una dimenticanza, ma è una scelta di prodotto (lo spazio là sotto è poco) e va decisa da Jacopo.
  7. **`prisma/seed.ts` reimplementa la stessa logica di `workspace-bootstrap.ts`** per popolare moduli e permessi dal catalogo. Oggi entrambe leggono il catalogo, quindi aggiungere voci non richiede di toccarle — ma sono due implementazioni parallele della stessa cosa, e una delle due prima o poi resterà indietro.
  8. **I pulsanti che fanno spendere l'AI non controllano il permesso `ai_production.generate`.** Le otto chiamate in `src/modules/agency-os/api/agency.api.js` partono da pulsanti sempre visibili. Non è una regressione — prima serviva `projects.edit` e nemmeno quello era controllato — ma ora che *«modificare senza poter far spendere»* è una configurazione sensata, quei pulsanti mostrano il 403 a chi non può generare. Va chiuso quando si passa su quelle pagine, nascondendo o disabilitando il pulsante come si è fatto per la scansione SEO.
  9. **`projects.view_all` è l'ultimo prestito rimasto nell'area Produzione AI:** decide se una persona vede tutti i progetti o solo quelli del suo reparto (`agency.service.ts`), e non ha un gemello `ai_production.view_all`. Coerente col passato e non rotto, ma se un domani si vorrà separare la visibilità delle due aree, serve la voce corrispondente.
  10. **Le rotte della Produzione AI non hanno un test tabellare** che verifichi «questa rotta chiede quel permesso», mentre i Siti in gestione ce l'hanno (`workspace-web-assets.route.test.ts`). Sono 63 punti classificati a mano: è il posto dove un test costerebbe poco e varrebbe molto. Il file rotta però non accetta dipendenze iniettate come quello dei Siti, quindi va prima predisposto — motivo per cui non è stato fatto insieme all'audit.
  11. **Tre permessi coprono più di quanto il loro nome dica** *(emerso l'8/8/2026 riscrivendo le descrizioni; le descrizioni ora lo dicono, ma la struttura sotto non è cambiata)*. Nessuno è rotto, ma tutti e tre sono **il ripiego che `CLAUDE.md` §① vieta per il codice nuovo** — funzioni senza una voce propria appoggiate a quella di un'altra:
      - **`clients.edit`** governa, oltre alla scheda cliente, le **definizioni dei campi personalizzati** (le quattro rotte di scrittura di `custom-fields.route.ts`) e la **configurazione delle integrazioni** (`integrations.route.ts`) — dove "configurare" comprende salvare ed eliminare la **chiave API di Brevo** e lanciare la sincronizzazione dei clienti verso l'esterno. È una scelta dichiarata a commento in quei due file, non una svista; ma vuol dire che non si può dare a qualcuno la modifica dell'anagrafica senza dargli anche le chiavi di un servizio esterno.
      - **`quotes.manage_templates`** copre tre famiglie: i modelli di preventivo, i **testi delle email** al cliente (dove serve anche solo per **leggerli**) e le **metriche** dei preventivi. Chi vuole far vedere le metriche a qualcuno gli sta dando anche la cancellazione dei modelli.
      - ⚠️ **`checklists.complete_item` scavalca `checklists.override_gate`, ed è il più serio dei tre** *(trovato dalla revisione dell'8/8)*. Il permesso copre anche il marcare una voce **«non applicabile»**, che non è una spunta più debole: è uno **stato terminale** (`checklists.repository.ts:6-7`), e il cancello di avanzamento cerca **solo gli stati incompleti** (`listMissingRequiredItemIds`, `:853-874`). Quindi chi ha `complete_item` può far passare un progetto in uno stage gated marcando "non applicabili" le voci obbligatorie — **senza avere il permesso nato apposta per farlo**, che nel catalogo si descrive come *«Far avanzare un progetto anche con un memo non completato»*. Aggravante: `markChecklistItemNotApplicable` scrive in audit **solo** se la voce è critica (`checklists.service.ts:1680-1693`), quindi sulle altre non resta traccia. **Da decidere quando si tocca l'area Memo Operativi:** o "non applicabile" richiede `override_gate`, o smette di soddisfare il cancello, o resta così ed è una scelta dichiarata invece di un effetto collaterale.

      Per tutti e tre la separazione è un lavoro a sé — nuove voci nel catalogo più la migrazione dati di riporto — e va valutata quando si tocca quell'area, non prima. Nel frattempo **le descrizioni dicono il vero**, che era il problema urgente.

- **Dimensione dei file: il censimento completo e chi spezza cosa** *(deciso da Jacopo il 5/8/2026; è la fonte di verità a cui rimanda `CLAUDE.md`)*.

  Fino a oggi il tetto di dimensione valeva **solo per il frontend** (`src/**/*.{js,jsx}`, guardrail ESLint a 500 righe). Il censimento esteso a tutte le tipologie ha mostrato che il file più grosso del progetto **non è nel frontend**: è `server/modules/agency-os/agency.service.ts`, **10.452 righe**, quasi quattro volte il più grande file React. Da qui la decisione di censire tutto e di stabilire, file per file, **chi lo spezza e quando**.

  **La regola in una riga:** il codice **nuovo** nasce sotto soglia, sempre; i file **già fuori norma** elencati qui sotto sono **eccezioni deliberate**, ognuna con un momento assegnato. Non sono un arretrato da smaltire a vista, e **non vanno spezzati di iniziativa** mentre si fa altro.

  **① Assegnati a una V precisa — si spezzano quando quella V li apre, come suo primo passo**

  | File | Righe | Chi lo riaprirà |
  |---|---|---|
  | `src/views/Agency/chat/AiChatWidget.jsx` | 1.454 | **V7** (immagini allegabili in chat) o **V10** (thread di messaggistica allegabile); entrambe estendono il selettore degli allegati, che sta lì dentro |
  | `src/modules/agency-os/data/agencyDataAdapter.js` | 2.775 | **V6** (dashboard performance) e **V7** (generazione visiva): è un centralino dell'area Agency |
  | `src/modules/agency-os/api/agency.api.js` | 1.093 | idem |
  | `server/modules/agency-os/agency.service.ts` | **10.452** | **V5/V6/V7** (è il motore AI). ⛔ **Da concordare con Claudio prima**: è l'area a decisioni condivise, non si tocca unilateralmente |

  **② Il residuo — nessuna V li nomina: vanno alla V13 (pulizia finale)**

  - `src/views/WebAssets/index.jsx` (2.706): la voce V7 che lo toccava (Audit SEO) è **già chiusa** dal 22/7. Libero, ma è il più grosso del frontend: da solo vale più di una sessione.
  - `src/views/Authentication/SignUp/Signup/index.jsx` (920): **nessuna V lo nomina**, verificato sull'intera roadmap. È l'unico mostro che si può fare subito, ed è il prossimo candidato naturale se si vuole continuare prima della V13.
  - **I 14 file fra 500 e 800 righe** *(erano rimasti fuori da ogni documento fino al 5/8: tracciati solo in un handoff, che sarebbe sparito con la rotazione)*: `modules/clients/ui/ClientForm.jsx` (794), `modules/checklists/ui/ProjectChecklistPanel.jsx` (768), `modules/quotes/ui/QuoteWizardForm.jsx` (749), `views/Profiles/Profile/Body.jsx` (727), `views/Team/index.jsx` (**771 dal 17/8/2026**, era 694 — vedi la nota qui sotto), `views/Agency/project/AgencyProjectPerformancePage.jsx` (666), `layout/Header/TopNav.jsx` (617), `views/Quotes/QuoteDetail.jsx` (599), `views/Agency/project/AgencyProjectDiscoveryPage.jsx` (564), `views/Vault/index.jsx` (550), `modules/agency-os/ads/agencyAdsRules.js` (550), `views/Profiles/Profile/index.jsx` (538), `modules/projects/api/projects.api.js` (533), `views/WorkspaceBranding/index.jsx` (519).
  - **I 22 file backend sopra 500 righe** diversi da `agency.service.ts` (i maggiori: `checklists.service.ts` 2.068, `agency.repository.ts` 1.800, `web-assets/repository.ts` 1.603, `web-assets/service.ts` 1.590, `workspace-agency.route.ts` 1.471, `projects.service.ts` 1.445, `dashboard.repository.ts` 1.411, `auth.route.ts` 1.396). Quelli che una V tocca seguono la regola ①; gli altri restano qui.

  **③ Fuori perimetro — non si toccano, e non è una dimenticanza**

  - **CSS e SCSS del tema** (`styles/css/style.css` 91.015 righe, `style-dark.css` 36.755, `scss/style.scss` 25.824, `styles/back/**`, font-awesome, bootstrap-icons, animate). Sono **codice di terze parti**, si sostituiscono in blocco aggiornando il tema: spezzarli sarebbe lavoro buttato e renderebbe l'aggiornamento più difficile. Il nostro CSS vero — i token in `styles/scss/globals.css` — è piccolo e sta bene com'è.
  - **`prisma/schema.prisma`**: la sua lunghezza è la dimensione del dominio, non complessità da spezzare. Dividerlo non rende niente più leggibile e tocca la zona migrazioni, dove il progetto ha già sofferto.
  - **File di test**: un test lungo ma piatto si legge benissimo; spezzarlo per soglia frammenta la storia che racconta. Già esclusi dal metro di `npm run mappa`.
  - **File generati** (`archivio-documenti/mappa/`) e **librerie incorporate** (`src/components/@hk-gantt/**`, già esclusa ovunque).

  > ⚠️ **`views/Team/index.jsx` è cresciuto invece di essere spezzato — 694 → 771 righe il 17/8/2026.** È il lavoro sull'invito Team della release di settembre (esito reale della consegna + pulsante "Link invito"). CLAUDE.md dice che a un file già sopra soglia non si aggiungono funzioni, e qui è successo: la parte estraibile *è* stata estratta (`src/modules/team/ui/inviteDelivery.js`, con il suo test), ma il saldo resta +77 e il file è ora a **29 righe dalla soglia-mostro** (800), oltre la quale entra nella lista "non si apre intero" e ogni lavoro futuro lì costa di più.
  > **Non spezzarlo di passaggio** (vale la regola di sempre). Ma il Team è **area di release**, quindi ci si tornerà: il punto naturale in cui farlo è **il giro delle due lacune del Team** (modifica membro oggi vuota + filtro "In attesa" morto), che ci aggiungerà ancora codice. Chi affronta quel giro spezzi **prima** — il candidato ovvio è la scheda "Inviti" per intero, che è già un blocco a sé.

  **Il criterio, per quando la domanda si ripresenterà:** non basta che una V tocchi l'area. Conta *come* la tocca — se **riscrive** i blocchi che spezzeresti, aspettare; se li **estende**, aspettare comunque conviene, perché si taglia meglio conoscendo la destinazione. Se nessuna V la nomina, va alla V13.

  **La colonna "durata" del registro compiti e' inaffidabile, e con lei "velocita'"** *(trovato il 18/8/2026)*. `npm run consumi:compito` calcola la durata come **distanza dall'annotazione precedente**, non come tempo effettivo del lavoro: basta una pausa fra due sessioni e il numero esplode. Nel registro ci sono gia' righe da **232h 48m**, **244h 36m**, **22h 26m** e **17h 56m** per lavori durati poche ore. Conseguenza pratica: la colonna **unita'/min si azzera** (0,00 e 0,01 su quelle righe) e il confronto fra lavori simili — che e' *l'unico motivo per cui il registro esiste*, vedi `CLAUDE.md` — non si puo' fare su meta' delle voci. **Come si chiude:** o si misura la durata dall'inizio reale della sessione invece che dall'ultima riga, oppure si smette di scriverla e si tiene solo il consumo, che e' l'unico dato sempre valido. Le righe gia' scritte restano come sono: correggerle a mano vorrebbe dire inventare dei numeri.

  **Due decisioni tecniche ancora aperte** (nessuna delle due bloccante, tutte e due da concordare con Claudio perché riguardano il backend, che è in larga parte suo):
  1. **Se estendere il guardrail automatico al backend TypeScript.** Oggi ESLint copre solo `src/**/*.{js,jsx}` — restano fuori il backend, gli script e perfino i `.ts` del frontend. Estenderlo richiede installare **`typescript-eslint`**, cioè una dipendenza nuova. Alternativa a costo zero: farlo misurare a **`npm run mappa`**, che già gira in meno di un secondo e non aggiunge nulla.
  2. **Quale soglia usare per il backend.** Le 500 righe sono tarate su un componente React; per un service o un repository il numero giusto è probabilmente più alto. Sceglierlo a caso produrrebbe solo rumore.

- **Sei file morti nella cartella del Calendario** *(censiti il 5/8/2026)*. `src/views/Calendar/` contiene sei relitti del tema grafico Jampack che **nessuno importa**: `AddCategory.jsx`, `CalendarSidebar.jsx`, `CreateNewEvent.jsx`, `Events.jsx`, `EventsDrawer.jsx`, `SetReminder.jsx` (verificato con due giri di ricerca separati, più il censimento degli import fatto durante la spezzatura). Non fanno danno, ma ingombrano: costringono a scegliere i nomi dei file nuovi girandoci intorno — la sottocartella creata il 5/8 si chiama `board/` e **non** `events/` proprio perché su Windows avrebbe sbattuto contro `Events.jsx`. **Da cancellare in una passata di pulizia**, verificando un'ultima volta con `git grep` che nessuno li nomini. Stessa famiglia delle voci "da DISMETTERE" della Parte B.

- **Il controllo dei nomi duplicati delle checklist è più severo lato client che lato server** *(notato il 5/8/2026)*. `ChecklistTemplates.jsx` rifiuta un nome che differisce solo per maiuscole/minuscole, mentre il vincolo del database (`ChecklistTemplate @@unique([workspaceId, name])`) è verosimilmente sensibile alle maiuscole: quindi due memo "Onboarding" e "onboarding" il database li accetterebbe, l'interfaccia no. **È il comportamento attuale e va lasciato com'è finché non si decide.** La domanda da chiudere è di prodotto, non tecnica: *i nomi dei memo devono distinguersi per maiuscole o no?* Se la risposta è no, il posto giusto per il controllo è il server (oggi non è stato verificato se lo faccia: il service è un file da 2.000 righe non aperto). Se è sì, va tolto il pre-controllo dal client.

- **Un pulsante della barra superiore è senza etichetta accessibile** *(notato il 5/8/2026 verificando la barra a varie larghezze)*. Nella barra in alto, **il selettore del tema** (`ThemeSwitcher`, reso da `src/layout/Header/TopNav.jsx` dentro `app-topnav-theme-item`) è l'unico pulsante privo sia di `aria-label` sia di `title`: chi usa uno screen reader sente soltanto *"pulsante"* e non sa cosa fa, e nei test non è raggiungibile per etichetta. **Tutti i suoi vicini ce l'hanno** e seguono già la convenzione "Apri …" (ricerca rapida, chat, branding, notifiche, menu utente, Piattaforma), quindi il rimedio è una riga sola e coerente con l'esistente — probabilmente in `src/utils/theme-provider/theme-switcher.jsx`, dove il pulsante è costruito. **Preesistente**, non introdotto dal re-naming. Stessa famiglia della voce sulle etichette dei form non collegate: è la parte "pulsanti-icona" dello stesso problema.

- **La ricerca rapida (Ctrl+K) non controlla il flag Super Admin** *(trovato il 5/8/2026 dall'esploratore, preparando lo spostamento della Console piattaforma)*. `src/components/command-palette/CommandPalette.jsx` costruisce le destinazioni "Vai a" iterando **direttamente** l'array `SidebarMenu`, ma la sua funzione di filtro `canAccessEntry` (righe 25-33) guarda solo `requiredModule` e `requiredPermission`: **non guarda mai `requirePlatformAdmin`**. Risultato: **qualunque utente loggato, anche non Super Admin, digitando in Ctrl+K si vede suggerire "Console piattaforma"** — cosa che nella sidebar vera non succede, perché lì il controllo c'è (`menuUtils.js:56-59`, `canRenderMenuEntry`). **Non è un buco di sicurezza**: la pagina si difende da sola (`PlatformConsole.jsx:18-41` mostra *"Questa area è riservata ai Super Admin di piattaforma"*) e il backend ha un guard dedicato. È un **suggerimento di navigazione che non dovrebbe comparire**, e una **seconda funzione di filtro divergente** dalla prima — due liste che decidono la stessa cosa in modo diverso, cioè il classico difetto che peggiora col tempo. **Il rimedio naturale** è far usare a CommandPalette lo stesso `canRenderMenuEntry` di `menuUtils.js` invece della propria copia. ⚠️ Diventa più rilevante se si decide di lasciare voci nell'array `SidebarMenu` **solo** per renderle cercabili da Ctrl+K (è il caso della Console piattaforma dal 5/8): in quello scenario la palette diventa l'unica via d'accesso, e il filtro sbagliato si vede di più.

- **Un ripiego che non scatta mai: il nome cliente nella testata di progetto** *(trovato il 6/8/2026 leggendo il contesto di lavoro per i pallini)*. In `AgencyProjectPageTemplate.jsx` la testata scrive `project?.clientName?.trim() || workingContext?.client?.name?.trim() || ""`. Il secondo ramo **non può funzionare**: il contesto di lavoro che arriva dal server (`buildProjectWorkingContext`, `agency.service.ts:9349`) non ha nessuna chiave `client` — il nome del cliente sta in `project.clientName`. Quindi il ripiego è scritto ma non scatta mai, e quando il progetto non porta il nome cliente si legge *"Cliente non assegnato"* anche se il cliente c'è. **Non è urgente** (nel caso normale il primo ramo funziona) e **non è stato corretto di proposito**, per non allargare il lavoro in corso: la correzione è di una parola (`workingContext?.project?.clientName`), ma cambia cosa si vede a schermo e va guardata con l'occhio, non solo con i test.

- **Riordino gerarchico del menu — la parte che non dipende da nulla** *(deciso il 7/8/2026 con Jacopo, approvato da Claudio; dettaglio in `decisioni-cliente-e-menu-2026-08-07.md` §3.2-3.3)*.

  **Il problema, misurato.** Il menu laterale ha **15 voci di primo livello**, e almeno sei sono nel posto sbagliato **per natura, non per gusto**: la configurazione è sparsa in tre gruppi diversi (Ruoli e Reparti sotto *Sicurezza*; Branding, Gestione Moduli e Scorciatoie **dentro il menu Profilo**, mescolate a "Il Mio Profilo"); **Reparti** sta sotto Sicurezza invece che con Team, di cui è struttura organizzativa; **Theme Preview** e **Responsive QA** sono strumenti di sviluppo esposti all'utente finale; **Nuovo Cliente** e **Nuovo Preventivo** sono *azioni* messe in un menu di *navigazione*, e per giunta **ridondanti** (il pulsante equivalente esiste già negli elenchi — `ClientsList.jsx:278`, `QuotesList.jsx:268` — e c'è pure una scorciatoia da tastiera). Non è un menu da rifinire: è cresciuto per accumulo, una voce per ogni modulo consegnato.

  **La destinazione: da 15 righe a 10.** Clienti diventa l'ombrello che raccoglie anche Preventivi, Siti in gestione e Credenziali; nasce una riga **Impostazioni** (Ruoli e permessi, Registro attività, Branding Workspace, Gestione Moduli); Reparti passa sotto Team; gli strumenti di sviluppo escono dal menu utente; Profilo tiene solo roba personale. *(Memo Operativi **resta dov'è**: era stato proposto lo spostamento in Impostazioni, Jacopo l'ha escluso.)*

  **Come si divide, e perché.** Stessa logica che ha funzionato per il re-naming (A leggero subito, B pesante dopo):
  - **La parte leggera — regruppamento del menu — non dipende da niente di futuro** e si può fare presto: quei sei difetti restano sbagliati qualunque cosa aggiungano V6-V11. **Una fetta è già assegnata alla release di settembre** (gruppo Impostazioni, Reparti sotto Team, rimozione delle due voci ridondanti, collocazione del Registro attività) — vedi la sezione *Release di settembre* in testa alla Parte C.
  - **La parte pesante — il dossier cliente e il criterio di densità applicato ovunque — è collocata come primo blocco della V12**, perché dipende dall'ancoraggio al cliente (V5) e dal set finale dei moduli.

  ✅ **Incastro con la fase B del re-naming — riformulato il 17/8/2026, la versione precedente era troppo restrittiva.**

  La prima stesura (7/8) diceva *"non toccare la struttura degli indirizzi dei moduli fino alla V12, o li si tocca due volte"*. **Verificando si è scoperto che quel conflitto in gran parte non esiste**, e la regola si è ristretta a ciò che serve davvero. Tre righe:

  1. **Il vocabolario si rinomina quando si fa la fase B**, senza rimandarlo (`agency` → nome nuovo, `discovery` → `brief`), in file, cartelle e rotte. Non dipende dalla gerarchia. ⚠️ *"Senza rimandarlo" vale dentro il lavoro di re-naming: la fase B **non precede la release di settembre**, perché rinomina l'area Produzione AI, che al lancio sarà nascosta — vedi la nota di sequenziamento in fondo.*
  2. **Il raggruppamento del menu NON richiede di spostare nessun indirizzo**, quindi si può fare quando conviene — anche dentro la release di settembre — senza toccare una sola rotta. In questo CRM la posizione a menu e l'indirizzo sono **indipendenti**: il gruppo *Sicurezza* contiene già oggi `/settings/roles`, `/settings/departments` e `/audit`, tre indirizzi senza nulla in comune, e nessun gruppo impone un prefisso ai figli. In più i moduli **restano anche come aree a sé** (§3.1 del documento di dettaglio): la vista globale tiene il suo indirizzo, e il dossier semmai ne aggiunge uno **nuovo** per il singolo cliente — che è una creazione, non uno spostamento.
  3. **Spostare davvero un indirizzo sotto il cliente resta una decisione a sé**, non implicata dal riordino: si valuta quando il dossier esiste. ⚠️ Il motivo per non anticiparla non è la documentazione che invecchia, è che **alcuni indirizzi potrebbero essere salvati a database** (Scorciatoie utente, Console piattaforma — sospetto già annotato nella voce della fase B): lì cambiare un indirizzo è anche spostare dati, e farlo due volte costa due migrazioni.

  📌 **Regola di igiene generale, adottata su proposta di Jacopo (17/8):** chi cambia una di queste cose **aggiorna nello stesso lavoro il documento che la descrive**, così nessun piano resta a dire cose superate. Vale a prescindere da questa voce.

  🔸 **Osservazione lasciata qui apposta:** il riordino riapre in parte la **V1**, che aveva fra gli obiettivi dichiarati la *«navigazione a sottrazione: menu contestuale per modulo/ruolo»* ed è segnata come chiusa. Non è una dimenticanza di allora — una struttura si vede solo dopo aver riempito il prodotto — ma va scritto, perché chi legge fra sei mesi non pensi che sia stato saltato qualcosa.

- **Re-naming delle aree: prima le etichette (A), poi i nomi tecnici (B)** *(aperto il 5/8/2026 con Jacopo; è l'attività che aspettava la chiusura del riordino file)*.

  **Perché esiste.** I nomi attuali non si capiscono da soli: **"Agency"** non fa intuire che lì c'è la base operativa delle funzioni AI legate a clienti e progetti; **"Discovery"** è oscuro. Richiesta esplicita di Jacopo fin dall'handoff del 30/7: rivedere ogni etichetta perché sia riconoscibile a colpo d'occhio.

  **Il lavoro è diviso in due, e la divisione è voluta:**
  - **A — le etichette visibili** (il testo che si legge a schermo). Basso rischio: si cambia `label`, non `path`. Ottiene da solo tutto l'obiettivo UX. ✅ **CHIUSA il 6/8/2026**: eseguite tutte e quattro le decisioni (①②③④).

    ✅ **Punto fatto il 17/8/2026 — la fase A è chiusa davvero, restava una sola cosa e non è lavoro.** Le tre code che risultavano aperte sono state passate in rassegna con Jacopo:
    1. Il pulsante *"Genera report"* nella vista tecnica → **deciso: resta com'è** (vedi la voce dedicata più sotto).
    2. La barra delle schede **sul telefono** sotto i 768px (undici pulsanti in quattro gruppi) → **verifica rimandata a tempo debito**, indicazione esplicita di Jacopo. È l'**unica cosa della fase A che resta da fare**, ed è una verifica a schermo, non uno sviluppo.
    3. Le *«eventuali rifiniture dopo averla usata»* → **nessuna**: non era un arretrato ma una porta lasciata aperta, nel caso che usando l'interfaccia un nome non convincesse più. Non è successo, quindi **la voce si chiude**. Non cercare un elenco di rifiniture: non è mai esistito.
  - **B — i nomi tecnici** (URL/rotte, nomi dei file, cartella-modulo `agency-os`, chiavi dei permessi). **Non serve alla UX**, ma Jacopo lo vuole comunque **per un motivo pratico e dichiarato**: mentre sviluppa, l'assistente gli cita continuamente URL e percorsi di file — se quelli restano coi vecchi nomi mentre l'interfaccia ne mostra di nuovi, si lavora con due vocabolari in testa e ci si confonde. **Va fatto, va solo collocato.**

  **⚠️ Il metodo di A, richiesto da Jacopo e da rispettare (non è una preferenza estetica: serve a decidere con cognizione).** Per **ogni** area candidata al re-naming:
  1. **Jacopo indica** l'area che vuole rinominare — guida lui, "a naso", guardando il CRM in prima persona.
  2. **L'assistente spiega** *prima* di proporre: a cosa serve quell'area, quali funzioni la guidano e — **soprattutto** — come e cosa ci dovrebbe fare l'utente.
  3. **Si aspetta la conferma di Jacopo** di aver compreso.
  4. **Solo allora** l'assistente propone un **ventaglio** di nomi possibili per quell'area.

  Mai invertire l'ordine (nomi prima della spiegazione): il nome giusto si sceglie sapendo cosa fa l'area, non a intuito sul suono.

  ⚠️ **Il revisore è spento per tutta la fase A** (deciso da Jacopo il 5/8/2026, dopo il primo giro): sono cambi di etichetta e di collocazione, e la revisione a ogni tappa rallentava troppo rispetto a quanto rende. **Non è una dimenticanza** — chi legge il registro dei compiti non si stupisca di non trovarla. La verifica in anteprima resta, e il revisore torna obbligatorio in **fase B** (che tocca URL, file e permessi, dove sbagliare costa davvero).

  **✅ Decisioni già prese (5/8/2026) — fase A, sole etichette, nessun URL toccato:**

  | Prima | Adesso | Note |
  |---|---|---|
  | **Console piattaforma** (voce in cima alla sidebar) | **Piattaforma** | Non è più una voce di menu: è un'**icona nella barra superiore**. La voce resta nell'array `SidebarMenu.jsx` col nome lungo *"Piattaforma — workspace e consumi AI"* perché è da lì che la ricerca rapida (Ctrl+K) la pesca. |
  | **Agency** | **Produzione AI** | Dice le due cose che mancavano: che **si produce** (non si consulta) e che lo si fa **con l'AI**. |
  | **Progetti** (gruppo Operatività) | **Pipeline** | Con dentro **Bacheca** (era *"Board"*, inglese residuo del tema) e **Impostazioni** (era *"Impostazioni Pipeline"*, ripetitivo sotto un genitore già chiamato Pipeline). |

  **Perché la coppia "Produzione AI" / "Pipeline" e non due nomi qualsiasi:** è un **solo `model Project`** — Agency e Operatività sono **due finestre sullo stesso record** (il progetto ha perfino due stati distinti, `statusAgency` e la fase di pipeline). Chiamarli entrambi "progetti" faceva credere che ci fossero due archivi. Il criterio adottato è quindi: **si nomina l'attività, non l'entità** — dove *produci* vs dove *vedi a che punto sei*.

  **✅ Le schede dentro un progetto — tre decisioni prese il 5/8/2026.** ⚠️ **Attenzione: queste vanno oltre il re-naming.** Le prime due comportano cancellare, unire e promuovere pagine, la terza rifà la barra delle schede: è **lavoro di struttura**, con rischio di regressione vero, non un cambio di etichetta.

  **① Alert: il doppione è corretto, non è un difetto.** La scheda *Alert* dentro il progetto e la voce *Alert* di Produzione AI chiamano **la stessa funzione** (`getAgencyProjectAlerts`): senza argomenti dà tutti gli alert, con `projectId` li filtra su quel progetto. Stessa fonte, stesso mestiere, due ampiezze — quindi **non** è il caso "Progetti / Progetti Agency" (dove la stessa parola copriva due mestieri diversi e quindi mentiva). Se si rinomina, **si rinominano tutti e due insieme e allo stesso modo**. La ragione per cambiarlo non è l'ambiguità ma la precisione: il sottotitolo dice *"segnali da risolvere **prima** di generare output o consegnare al cliente"*, cioè sono **impedimenti**, non notifiche ignorabili. Patto con Jacopo: se nessuna alternativa convince, **si tiene "Alert"**.

  ✅ **La decisione ② è stata eseguita per intero il 6/8/2026.** Memoria è visibile a tutti (sta nella barra principale, non nel pieghevole); Diagnosis, Brain e Reports tecnici non esistono più — voce, rotta e file. Le tre vecchie rotte sono diventate **rimandi** (`src/routes/agencyRemovedRoutes.js`, funzione pura con test), quindi i segnalibri vecchi atterrano dove il contenuto è finito. È sparito anche il pieghevole *"Diagnosi e strumenti tecnici"*, che senza quelle tre voci non si sarebbe più disegnato. Resta da fare solo la decisione ③, la barra in quattro gruppi.

  ⚠️ **Osservazione lasciata lì apposta:** ora che tutte le schede "secondarie" sono sempre visibili, il cancello `import.meta.env.DEV` in `visibleWorkspaceSections` non filtra più niente. Non è sbagliato — è il meccanismo pronto per una futura scheda nascosta — ma **quando si riscrive la barra (③) va deciso se tenerlo o toglierlo**, invece di trascinarlo dentro la struttura nuova senza guardarlo.

  **② Le quattro schede nascoste: deciso il destino di ognuna.** Erano visibili solo con `import.meta.env.DEV` — cioè un **interruttore di compilazione, non un permesso**: in produzione non le vedeva **nessuno, nemmeno un Super Admin**; solo chi gira `npm run dev`. Non erano abbozzi (leggono dati veri), ma **finestre sul funzionamento interno dell'AI**, e tre delle quattro si sovrapponevano ad altre. Il perché fossero nascoste **non era scritto da nessuna parte** — né commento né roadmap.
  - **Memory → si promuove e diventa visibile.** È l'unica che dà qualcosa di suo: *cosa sa l'AI del progetto e cosa ha già prodotto*. In un'area dove l'AI scrive per te, poterlo guardare è una questione di fiducia.
  - **Diagnosis → si assorbe dentro Alert**, che fa già quel mestiere ("cosa risolvere prima di generare/consegnare").
  - **Brain → si elimina**: non aggiunge nulla a Overview (prossima azione, qualità, segnali) e riusa i dati di Diagnosis.
  - **Reports tecnici → si assorbe nel Report** come vista alternativa: è la versione interna dello stesso documento, non una scheda a sé.

    ⚠️ **Requisito d'integrazione, posto da Jacopo il 6/8/2026 dopo aver guardato il comportamento attuale.** Oggi il pulsante "Report tecnico" dentro il Report cliente **porta a un'altra pagina**: l'utente si ritrova in una vista che visivamente non dice più di essere dentro "Report", e la scheda Report in cima **si spegne**. La fusione deve togliere esattamente questo effetto. Tre condizioni, tutte obbligatorie:
    1. **La scheda "Report" resta accesa** anche mentre si guarda la vista tecnica: l'utente deve continuare a percepire di essere in quell'area.
    2. **Si può sempre tornare alla vista generale** con un pulsante esplicito, non col tasto indietro del browser.
    3. La vista tecnica **si presenta come una vista dentro Report**, non come una pagina a sé.

    **Come ottenerlo, concretamente:** la vista alternativa deve vivere **sullo stesso percorso** (`/reports/client`) distinguendosi con un parametro in coda all'indirizzo (per esempio `?vista=tecnica`), **non** con un percorso diverso. Il motivo è meccanico: `AgencyProjectPageTemplate` decide quale scheda illuminare confrontando il **percorso** (`location.pathname === entry.path`); con un percorso diverso la scheda si spegne per forza, con un parametro in coda resta accesa da sola. Il parametro serve anche a tenere i collegamenti diretti funzionanti (i due link in `AgencyReportsPage.jsx` che oggi puntano alla scheda tecnica).

    **Vale come regola generale, non solo qui:** ogni volta che una scheda ne assorbe un'altra come "vista alternativa", le tre condizioni sopra valgono uguali. ✅ La fusione **Diagnosis → Da risolvere** (fatta il 5/8) le rispetta già per costruzione, perché i contenuti stanno *dentro* la stessa pagina e non c'è nessuna navigazione: non va ritoccata.

    ✅ **La fusione Reports tecnici → Report è stata fatta il 6/8/2026** e rispetta le tre condizioni: la vista tecnica vive su `.../reports/client?vista=tecnica`, la scheda resta accesa, e una striscia in cima dichiara dove sei con il pulsante "Torna al report cliente". Costruita in `src/views/Agency/project/reports/` (sette file, il più grosso 257 righe), coperta da test. **Additiva di proposito:** la vecchia pagina `AgencyProjectReportsPage.jsx` e la rotta `/reports` sono ancora vive.

    ⚠️ **Due code lasciate aperte apposta, da chiudere ai passi successivi:**
    - **Il pulsante grosso in testata, sulla vista tecnica, porta fuori senza dirlo** *(trovato dal revisore il 6/8)*. `AgencyProjectPageTemplate.jsx:128-129` calcola l'azione primaria dalla sola `activeSection`, che vale `reports-client` in **tutte e due** le viste: quindi dalla vista tecnica il bottone più in evidenza dice *"Genera report"* e riporta alla vista generale, con un'etichetta che promette un'altra cosa. Prima della fusione non si vedeva, perché quel pulsante compariva solo sulla pagina cliente dov'era un link a sé stessa. **Si sistema quando si riscrive la barra delle schede** (decisione ③ qui sotto), che tocca già quel file: lì l'azione primaria va calcolata guardando *anche* la coda dell'indirizzo. ⚠️ Attenzione a non "risolverlo" facendo dipendere dalla querystring anche la **scheda accesa**: quella deve continuare a guardare solo il percorso, o si riapre il difetto che la fusione ha tolto (c'è un test che lo impedisce, `AgencyProjectPageTemplate.test.jsx`).
    - **~250 righe di resa vivono in doppia copia** finché la vecchia pagina resta al suo posto: `renderAlerts`, `renderTasks`, `SummaryBlock` e l'impianto di riquadri stanno sia in `reports/TechnicalReportView.jsx` sia in `AgencyProjectReportsPage.jsx`, **entrambe raggiungibili dall'utente**. È voluto, ma la finestra di convivenza dev'essere **corta**: una correzione applicata a una sola delle due non arriva all'altra e le due strade divergono in silenzio. Chiudere presto la rimozione della vecchia scheda.

  ✅ **Le decisioni ③ e ④ sono state eseguite il 6/8/2026.** La barra è quella descritta qui sotto, con i nomi della tabella ④. Tre scelte di resa prese applicando `design-linguaggio-apple-web.md`, da conoscere prima di ritoccarla: le schede non attive sono **neutre tenui e non bottoni con il contorno** (§7.1: undici outline spenti disegnavano undici scatole che competevano con i dati); i gruppi si separano **con lo spazio, non con linee** (§3.3); le intestazioni sono in **maiuscoletto tenue da 12px con tracking largo** (§2.3). La scheda accesa si riconosce da `aria-current="page"`, che è anche ciò che sente un lettore di schermo. Rinominata insieme anche la voce *Alert* del menu laterale, come prescriveva la decisione ①.

  ✅ **Deciso il 17/8/2026 da Jacopo: il pulsante resta com'è.** In testata, sulla vista tecnica del Report, il pulsante grosso dice *"Genera report"* e riporta alla vista generale. Erano state proposte tre strade (lasciarlo · rinominarlo *"Vai al report cliente"* · non mostrarlo lì, visto che la striscia in cima ha già il pulsante di ritorno): **scelta la prima, senza modifiche**. Tecnicamente è coerente — il report si genera davvero lì — e l'attrito segnalato dal revisore il 6/8 è accettato. **Non riaprire la questione** proponendo di nuovo le altre due: è già stata guardata e chiusa.

  **③ La barra delle schede si riorganizza in gruppi.** Oggi sono otto pulsanti in fila piatta più un pieghevole "Diagnosi e strumenti tecnici": la fila non dice né l'ordine né la natura delle cose. Struttura decisa (proposta di Jacopo, rivista insieme):

  ```
  ┌──────────────── OVERVIEW ────────────────┐   ← largo, sopra, domina gli altri
  CONOSCENZA           PRODUZIONE      MISURA E CONSEGNA
  Fonti → Discovery    Web · Ads       Performance · Report
  Memory
  ──────────────────────────────────────────────────────
  QUELLO CHE IL SISTEMA TI SEGNALA
  Alert · Task · Opportunità
  ```

  Le ragioni, che servono a chi dovrà difendere questa forma:
  - **I primi tre gruppi sono una catena** (prepari → produci → misuri e consegni) e si leggono da sinistra a destra nell'ordine vero delle cose.
  - **Report sta con Performance, non con la produzione:** si nutre di quei numeri. Metterlo prima farebbe leggere all'occhio un ordine che contraddice quello reale. *(Correzione alla proposta iniziale di Jacopo.)*
  - **Task non è monitoraggio:** Performance è *guardare*, Task è *fare*. Task, Alert e Opportunità sono invece parenti stretti — **sono le tre cose che il motore a regole genera da solo** dal tipo di progetto e dallo scope. Oggi sono trattate in modo incoerente (Task primaria, le altre due relegate fra le secondarie). *(Correzione alla proposta iniziale.)*
  - **Il quarto gruppo è staccato apposta:** non è una fase da attraversare, è quello che la macchina dice mentre lavori.
  - **Memory sta in "Conoscenza"** e completa la terna: *Fonti* è quello che dai all'AI, *Discovery* quello che ne ha capito, *Memory* quello che si ricorda e ha prodotto.
  - **Il collegamento visivo va solo fra Fonti e Discovery**, dove la dipendenza è reale (c'è già un semaforo che blocca se le fonti non sono pronte). Incatenare anche gli altri comunicherebbe un obbligo inesistente — Web e Ads sono paralleli — e appesantirebbe: la bussola è "Apple a sottrazione", lo spazio separa meglio dei bordi.
  - ⚠️ **Da verificare sul telefono:** undici pulsanti in quattro gruppi vanno a capo su schermo stretto. E **prima di toccare l'aspetto si legge `design-linguaggio-apple-web.md`**, come da regola.

  **④ I nomi finali delle schede, decisi il 5/8/2026.** Da applicare tutti insieme quando si riscrive la barra.

  | Oggi | Diventa | Nota |
  |---|---|---|
  | Overview | **Panoramica** | Parola già usata nella Dashboard ("Panoramica operativa del workspace"): riusarla crea abitudine |
  | Fonti | **Fonti** *(invariata)* | — |
  | Discovery | **Brief** | Non è un'invenzione: il pulsante d'azione della scheda dice già *"Rigenera brief"* e lo stato interno si chiama già `brief` |
  | Memory | **Memoria** | — |
  | Web | **Contenuti Web** | Tiene "Web" (Jacopo ci teneva) e si mette in parallelo a "Campagne ADS": entrambe dicono *cosa produci + su quale canale* |
  | Ads | **Campagne ADS** | "ADS" esplicito così quando arriveranno le campagne email di Brevo si chiameranno "Campagne Email marketing" senza ambiguità |
  | Performance | **Performance** *(invariata)* | Valutata "Risultati", scartata: Jacopo preferisce il termine corrente |
  | Report | **Report** *(invariata)* | Ora è libero e non ambiguo, visto che il report tecnico viene assorbito |
  | Alert | **Da risolvere** | Vale **anche** per la voce Alert di Produzione AI: si rinominano insieme (vedi ①) |
  | Task | **Task** *(invariata)* | — |
  | Opportunità | **Opportunità** *(invariata)* | — |

  **Intestazioni dei quattro gruppi — visibili a schermo** (scelta di Jacopo: aiutano l'utente, con un trattamento grafico leggero): **Conoscenza · Produzione · Risultati · Priorità**. Sono quattro parole singole dello stesso registro; "Misura e consegna" e "Segnali" erano le versioni iniziali, scartate perché la prima rompeva la simmetria e la seconda non convinceva. "Priorità" riusa il vocabolario della Dashboard (sezione *"Priorità operative"*), con l'attrito noto e accettato che gli elementi dentro hanno una loro priorità individuale.

  **Come renderle:** intestazioni piccole, in maiuscoletto e colore tenue — devono guidare senza competere coi pulsanti. Leggere `design-linguaggio-apple-web.md` prima di fissare misure e spaziature.

  **❌ Alternative scartate, con la ragione (per non riproporle):**
  - **"AI Lab"** *(piaceva a Jacopo, scartata il 5/8 dopo verifica)* — **"Lab" è l'abbreviazione naturale di "Laboratorio", che è un reparto aziendale vero**, nominato nella bibbia (`02-brief-operativo-definitivo-bibbia.md` righe 13, 53, 100: *"Laboratorio (Stampa)"*, elencato fra i reparti accanto a Web/Marketing/Social/Grafica) e destinato a diventare un modulo in **V8**. Avremmo avuto *"AI Lab"* e *"Laboratorio"* nello stesso menu: la stessa parola in due lingue per due cose diverse — cioè **esattamente l'ambiguità "Progetti / Progetti Agency" appena rimossa**. Restava la strada di rinominare il reparto in "Stampa", ma è una modifica al **documento fondativo su un nome aziendale**: non si fa dentro un giro di re-naming di etichette. ⚠️ Se un domani si volesse davvero "AI Lab", il prerequisito è **quella** decisione, da prendere con Claudio.
  - **"Studio AI"** — in italiano *"lo studio"* significa anche **lo studio professionale, l'azienda**: ripeterebbe il peccato di "Agency" (far credere che sia una sezione *sull'agenzia* invece del posto dove si lavora).
  - **"Laboratorio"** — stessa collisione di "AI Lab".
  - Qualsiasi nome con **"Clienti"** per l'area Piattaforma — sbatte contro l'area **Clienti** del CRM.

  ✅ **Chiuso il 6/8/2026** *(era: due sottovoci contenevano ancora "Agency" — "Progetti Agency" e "Impostazioni Agency" — con una decina di messaggi che le citavano)*. Le sottovoci si chiamano **Progetti** e **Impostazioni AI**, e i messaggi che rimandavano a *"Impostazioni Agency"* sono stati riscritti: verificato, nel codice quella stringa non esiste più.

  ---

  ### ✅ La coda della fase A — chiusa il 6/8/2026 (quattro commit)

  **Il problema che ha chiuso.** La fase A aveva rinominato le **etichette delle schede**, ma non i testi *dentro* le pagine. Risultato: l'interfaccia si contraddiceva da sola — la scheda diceva *Brief* e il pulsante sotto diceva *"Salva Discovery"*. Non erano nomi nuovi da scegliere: erano i nomi già decisi il 5/8, applicati a metà. Per questo è stato eseguito senza ripassare dal metodo "spiega prima, proponi poi" (che serve a **scegliere** un nome, non ad applicarne uno già scelto).

  1. **`05e36f7` — "Discovery" sparisce dai testi.** Pulsante di salvataggio, schermata di caricamento, messaggio d'errore, voce della checklist in Panoramica, card *"Brief nel contesto"* in Memoria, colonna "Modulo" dello storico AI, e i messaggi che le generazioni AI mostrano a fine lavoro. Cambiata anche la frase di sintesi del contesto (*"Discovery aggiornata"* → *"Brief aggiornato"*) **nelle due copie che la producono**, frontend e backend.
  2. **`c020a1e` — il titolo della pagina dice il nome della scheda.** Sei disallineamenti: *Contenuti Web*/"Web", *Campagne ADS*/"Ads", *Fonti*/"Fonti e Materiali", *Memoria*/"Memoria e log AI", *Report*/"Report AI", e la briciola di pane di *Da risolvere* rimasta "Alert". Tolto anche un *"Reporting v1"* sfuggito alla ripulitura del gergo.
  3. **`929d064` — l'ultima "Agency" letta dall'utente.** Undici punti. ⚠️ **Uno non era nell'inventario e vale la pena saperlo:** sul **telefono** la barra in cima a *ogni* pagina dell'area diceva **"Agency OS"**, perché in `TopNav.jsx` non esisteva un caso per `/agency` e si cadeva sul valore di ripiego. Aggiunto il caso; il ripiego ora è un neutro "CRM". Nei messaggi di salvataggio è sparito anche il gergo *"layer"* e *"backend"*: dicono **"sul server"** e **"solo su questo dispositivo"**.
  4. **`a960965` — le voci di "Moduli attivi".** Erano rimaste Discovery, Web, Ads, Reports, Memory, Assets, Tasks, Diagnosis; ora dicono i nomi delle schede. Cambiate le **due copie insieme** (backend `agency.service.ts` e frontend `agencyBrainRules.js`).

  **⚠️ Due cose da sapere prima di rimetterci mano.**

  - **Quelle etichette non sono solo testo a schermo:** l'elenco dei moduli attivi **finisce nel contesto passato all'AI** quando genera Contenuti Web e Campagne ADS. Se un domani si cambiano ancora, si cambiano **in entrambe le copie**, o le due sorgenti divergono in silenzio.
  - **"Agency Brain" è rimasta apposta.** È l'unica voce che l'utente non vede (la vista la filtra, e c'è un test che presidia il filtro): rinominarla darebbe **zero** in interfaccia cambiando solo ciò che legge l'AI.

  **Perché non è servito toccare i dati di test** *(domanda di Jacopo, verificata il 6/8)*. L'etichetta è salvata a database (colonna `moduleLabel` di `ProjectActiveModule`) **ma non è mai definitiva**: `syncProjectActiveModules` la ricalcola dalle regole e la **riscrive sopra** alla riga esistente (aggiornamento su `projectId + moduleKey`, quindi niente doppioni), e viene chiamata alla creazione del progetto e **all'apertura della Panoramica**. Verificato sull'API coi progetti demo: rispondono già coi nomi nuovi. *Unica sfumatura:* la colonna "Moduli attivi" dell'**elenco progetti** legge il dato salvato senza passare dalla Panoramica, quindi un progetto mai aperto mostrerebbe lì la parola vecchia fino alla prima apertura.

  **🔸 Trovato strada facendo, da collocare:** le due copie della lista moduli non divergono solo nelle etichette — **il frontend non ha la voce `diagnosis`, il backend sì** (9 moduli contro 8). Non produce danno visibile oggi (comanda il backend), ma è la stessa lista in due versioni diverse: va riconciliata quando si tocca quell'area.

  ---

  ### ✅ Fase A — chiusa per intero il 7/8/2026

  L'elenco qui sotto era il residuo raccolto il 6/8 dall'esploratore (72 file, ~10.900 righe battuti). **Tutte e sei le voci sono state eseguite il 7/8**, dopo che Jacopo ha deciso ① e ③ e ha dato via libera sul resto (*«traduci quelle opportune e mantieni quelle altrettanto opportune da mantenere»*). Suite intera verde al primo colpo: **67 file, 810 test**. Tipi a 233 = baseline.

  | Voce | Commit | Cosa è stato fatto |
  |---|---|---|
  | ① Stati in inglese | `7cf5cd9` | Badge via dalla testata; funzioni di traduzione estratte in `agencyProjectLabels.js` col loro test |
  | ② Report tecnico | `4bf2635` | Cinque card tradotte **+ la radice**: `formatReportLabel` e `formatOpportunityLabel` non traducevano affatto |
  | ④⑤ Tendine e parole isolate | `745be46` | Stati di lavorazione, tipi di opportunità, tipi di pagina, scope, *Stage / Working context / append-only / carnè* |
  | ③ Impostazioni AI | `b363804` | Via le chiavi tecniche da pastiglie, cataloghi e rendiconto consumi |
  | ⑥ Vault, Web Assets | `75131ef` | → Credenziali, Siti in gestione |

  **⚠️ Cosa è stato MANTENUTO in inglese, e perché non va "sistemato" in futuro.** *Hook, Headline, Primary text, Keyword, Sitelink/callout, Ad Groups, RSA Ideas* e gli obiettivi di campagna (*Lead generation, Sales, Traffic, Awareness*). **Non sono gergo nostro: sono i nomi veri delle cose dentro Google Ads e Meta**, quelli che si leggono nelle piattaforme. Tradurli renderebbe il CRM più italiano e meno usabile da chi ci lavora. Indicazione esplicita di Jacopo su *Awareness*, estesa per coerenza a tutta la famiglia.

  **⚠️ Due punti restano tecnici perché devono esserlo** *(non sono dimenticanze)*:
  - **"Modelli per funzione"** (`SettingsAiLimitsPanel.jsx`) è l'unico campo dove la chiave **è il valore da digitare**: nasconderla romperebbe la funzione. Il testo d'aiuto ora dice a cosa serve e affianca a ogni chiave il suo nome leggibile.
  - **L'avviso sullo storage non pronto** (`SettingsAiProviderCard.jsx`) continua a nominare la migrazione `agency runtime settings`, perché è l'unica informazione azionabile che dà; è stato riscritto il contorno.

  **🔸 Un debito nuovo, creato da questo giro:** le etichette delle funzioni AI esistono **in due copie** — `src/modules/agency-os/ai/aiFunctionLabels.js` e `AGENCY_AI_ESTIMATABLE_FUNCTIONS` in `agency.service.ts`. C'è un avviso scritto in testa al file frontend, ma se un domani si aggiunge una funzione AI vanno toccate entrambe o stime e consumi chiameranno la stessa cosa in due modi. *(Una terza copia scritta a mano nel testo d'aiuto è stata eliminata il 7/8: ora quell'elenco si costruisce dalla stessa sorgente.)*

  #### ⚠️ La revisione del 7/8 ha trovato un errore che i test non potevano prendere — `d9b4245`

  **Vale la pena leggerlo prima di scrivere un'altra mappa di traduzione.** I due dizionari del commit `4bf2635` erano stati scritti **elencando i valori attesi, invece di leggere `prisma/schema.prisma`**. Suite verde, test verdi, e sotto:
  - per le opportunità c'erano `accepted`, `rejected`, `in_progress`, `done` — **quattro valori che il backend non può produrre** — e mancava **`open`, il default dell'enum**: ogni riga continuava a leggersi *"Stato: Open"*, cioè il difetto che il commit dichiarava chiuso;
  - gravità degli alert, stati dei task e priorità restavano inglesi nel Report mentre erano già tradotti bene nella scheda *Da risolvere*: **lo stesso alert si leggeva "Da gestire / Alta" in un punto e "Open / High" a due click**;
  - una mappa completa e giusta esisteva già (`alertsConstants.js`) e ne era stata aggiunta **una quarta parziale** accanto.

  I test non l'hanno preso perché **erano scritti sullo stesso elenco sbagliato**: un test che verifica un dizionario contro se stesso passa sempre. Il metodo corretto è in `note-operative-ai.md` §49.

  **Come è stato chiuso:** il vocabolario è ora **uno solo** — `src/modules/agency-os/labels/agencyStatusLabels.js` — costruito sugli enum veri, che sono **citati nel commento** del file; `formatReportLabel` e `formatOpportunityLabel` ci delegano invece di tenere copie. Il test è scritto sugli enum, quindi si rompe se l'enum cambia. Aggiunta anche `toImpactLabel` perché *"Impatto"* è maschile e dal dizionario generale usciva *"Impatto: Alta"*.

  ⚠️ **Non è un disallineamento, non "correggerlo":** `strategic` vale **"Strategica"** per un'opportunità e **"Strategico"** per un alert. I sostantivi hanno genere diverso, la concordanza è giusta così.

  **Sistemate insieme le altre copie che divergevano:** le etichette scope **nel backend** (`agency.service.ts:1585-1590`) dicevano ancora *Reporting/Diagnosis* ed erano proprio quelle che finiscono nei documenti generati e nel contesto passato all'AI; l'elenco *"Moduli attivi"* delle Impostazioni era diventato leggibile ma **diceva il falso** (conteneva voci che moduli non sono, ometteva Memoria); e *"Vault"* era rimasto in cinque punti — fra cui **la riga immediatamente sotto** a quella rinominata nello stesso commit.

  <details>
  <summary>L'elenco originale delle sei voci, con i riferimenti file:riga (utile se una va ripresa)</summary>

  - **① Gli stati mostrati in inglese crudo — il più visibile di tutti.** In testa a **ogni** scheda di progetto c'è un badge che dice letteralmente `Stato: discovery` (minuscolo, il valore grezzo del database) — `AgencyProjectPageTemplate.jsx:248`, `AgencyProjectOverviewPage.jsx:305,308`. Nelle select per cambiare stato a una pagina o a una campagna si leggono `draft`, `in_progress`, `review`, `approved` (`WebSubProjectsCard.jsx:82-84`, `AdsCampaignsCard.jsx:95-97`). E in tutta l'area Report/Diagnosi/Opportunità ci sono due funzioni che **non traducono, capitalizzano soltanto** (`reportPresentation.js:15-25`, `opportunityPresentation.js:15-26`): escono *Draft, Ready, Partial, In Progress, On Hold, Critical, Commercial, Strategic*. Nello stesso prodotto gli stati degli Alert e delle Fonti sono invece tradotti bene (`alertsConstants.js`, `assetsPageConstants.js`) — quindi non è una scelta, è una dimenticanza. Serve decidere il vocabolario italiano degli stati.
  - **② Il Report tecnico ha quattro card interamente in inglese:** *Project Snapshot*, *Top Alert*, *Top Opportunities*, *Top Tasks*, *Next Steps* (`TechnicalReportView.jsx:191,240,248,260,269`), in una pagina per il resto tutta italiana.
  - **③ Le Impostazioni AI mostrano chiavi tecniche interne all'utente:** badge con scritto `sources/assets`, `client_report`, `landing_page` (`SettingsModulesCard.jsx`, `SettingsProjectTypesCard.jsx`, `SettingsTeamRolesCard.jsx`, `SettingsScopeSourcesCard.jsx`), un campo con dentro `{"discovery.generateBrief":"gpt-4o-mini"}` (`SettingsAiLimitsPanel.jsx:114`), e il filtro "Funzione" dei consumi che elenca `discovery.generateBrief`, `web.generateBlock` (`AgencyAiUsagePanel.jsx`). ⚠️ Qui la domanda **non è solo il nome: è se quella roba vada mostrata**. Stessa famiglia: l'avviso *"Applica la migration Agency runtime settings"* (`SettingsAiProviderCard.jsx:88`), che è l'ultima "Agency" rimasta a schermo — lasciata perché riscriverla farebbe perdere l'unica informazione utile che dà.
  - **④ Le opzioni non tradotte nei menu a tendina:** obiettivi campagna *Sales/Traffic/Awareness* (`adsPageConstants.js:12-17`), filtro opportunità *Critical/Improvement/Commercial/Strategic* (`AgencyOpportunitiesPage.jsx:112-115`), tipo pagina *Service Page/Ecommerce Lite* (`webPageConstants.js:9-10`), e lo scope acquistato con dentro ancora `Diagnosis` (`agencyProjectsModel.js:51-58`, duplicato in `AgencyProjectOverviewPage.jsx:18-26`).
  - **⑤ Parole isolate da tradurre o spiegare:** *Stage* (`AgencyOpportunityList.jsx:68`), *Working context* (`AgencyProjectMemoryPage.jsx:103`), *Context summary* (`AgencyProjectOverviewPage.jsx:348`), *Source* come colonna dell'elenco progetti, *append-only* in un messaggio di conferma (`AgencyProjectPerformancePage.jsx:232`), *Hook*, *Ad Groups*, *RSA Ideas* nelle campagne, e in Performance il termine **"carnè"** per i set di metriche salvati — desueto, non lo capisce nessuno.
  - ✅ **⑥ Le due aree della lista originale — CHIUSO il 7/8/2026.** Vedi la scheda qui sotto.

  </details>

  #### ✅ `Vault` → **Credenziali** e `Web Assets` → **Siti in gestione** (7/8/2026)

  Erano le due voci rimaste della lista originale del 5/8, quelle che Jacopo aveva chiesto esplicitamente di non perdere. Applicato il metodo: spiegazione dell'area → conferma di Jacopo → ventaglio → scelta.

  | Prima | Adesso | Perché |
  |---|---|---|
  | **Vault** | **Credenziali** | Dice il contenuto (username, password, URL per ogni cliente) invece di una parola inglese. Nella barra mobile e nel menu è la stessa parola, quindi niente doppio vocabolario. |
  | **Web Assets** | **Siti in gestione** | Dice *quali* siti sono: quelli in carico all'agenzia, non un elenco qualsiasi. ⚠️ Nella **barra in basso del telefono** resta **"Siti"** da solo: lì lo spazio è quello che è, e il contesto lo dà la barra stessa. |

  **❌ Alternative scartate, con la ragione:**
  - **"Cassaforte"** *(per Vault)* — comunicava anche la protezione, che qui è reale (password di workspace che apre e chiude, permesso `vault.reveal` separato da `vault.view_list`). Scartata perché sarebbe stata **l'unica voce del menu a usare una metafora** invece di dire cosa contiene: contro la bussola Apple.
  - **"Accessi"** *(per Vault)* — è come se ne parla in agenzia (*"mi servono gli accessi del cliente X"*), ma **collide con "Ruoli e permessi"**: fa pensare a chi può entrare nel CRM.
  - **"Password"** *(per Vault)* — riduttivo (dentro ci sono anche username, URL, note) e come etichetta a menu suona come un invito.
  - **"Siti"** e **"Siti web"** *(per Web Assets)* — "Siti web" riportava la parola *Web* accanto a *Contenuti Web*, cioè due voci di menu che iniziano allo stesso modo: esattamente la confusione che il re-naming stava togliendo. "Siti" da solo era la più corta ma non diceva che sono quelli **in gestione**.
  - **"Presenze online"** — comprende tutto (siti, app, ecommerce) ma non dice niente: linguaggio da brochure.
  - **"Monitoraggio siti"** — descrive metà del lavoro (uptime, SEO) e ignora l'altra metà, che è l'anagrafica.

  **🔸 Trovato strada facendo, NON toccato:** il catalogo dei moduli in `server/auth/rbac-catalog.ts:80-95` è **interamente in inglese** — *Team, Departments, Clients, Projects, Checklists, Calendar, Quotes, Web, Vault, SEO, Messages*. Non si tocca una voce sola (creerebbe un italiano in mezzo a dieci inglesi) e non si tocca a cuor leggero: quei nomi li **semina a database** il `workspace-bootstrap`. Va deciso in blocco, insieme alla voce ③ (chiavi tecniche mostrate all'utente).

  **🔸 Deciso il 7/8/2026, da eseguire: via il badge dello stato dalla testata di progetto.** In cima a *ogni* scheda c'era `Stato: discovery` — il valore grezzo del database. Verificato: lo stato viene scritto **una volta sola, alla creazione, sempre a `DISCOVERY`** (`agency.service.ts:6152`) e **non esiste nessuna interfaccia per cambiarlo**, quindi quel badge diceva la stessa cosa per tutti i progetti, per sempre. Decisione di Jacopo: **toglierlo dalla testata** (`AgencyProjectPageTemplate.jsx:247`), tenerlo dove serve — colonna dell'elenco progetti e filtri dei Report. In Panoramica la card *Stato progetto* lo tiene ma va fatto passare dalle due funzioni di traduzione che già esistono in `AgencyProjectsListPage.jsx:30-65` (oggi lì è grezzo: `Stato: discovery`, `Priorita: high`); vanno **estratte in un punto condiviso e nascono col loro test**. Il ventaglio di nomi italiani per i sette stati (`discovery, planning, production, review, live, paused, archived`) **resta in sospeso**: si riapre solo se un giorno quello stato diventa modificabile. ⚠️ Da notare: lo stato si chiama `discovery`, cioè il nome vecchio della scheda ora chiamata *Brief* — tradurlo farebbe rientrare quella parola da un'altra porta.

  **Le candidate proposte dall'assistente il 5/8 — da ri-proporre a Jacopo quando avrà finito il suo giro "a naso"**, per quelle che non avrà toccato di suo (è una richiesta esplicita: non devono perdersi):
  - **`Agency`** — il caso n°1: non dice che è la base operativa AI su clienti/progetti.
  - **`Discovery`** — il caso n°2: oscuro.
  - **`Diagnosis` / `Brain` / `Memory`** — gergo inglese in mezzo a tab italiane (`Brain` e `Memory` compaiono **solo in sviluppo**).
  - **`Web Assets`** (area CRM) **vs la tab `Web`** del progetto: due "Web" diversi.
  - **`Progetti`** (Operatività, il kanban) **vs `Progetti Agency`**: due "Progetti" diversi.
  - **`Vault`** — inglese.

  ✅ **Aggiornamento 6/8/2026:** di questa lista restano aperte **solo `Vault` e `Web Assets`** (riportate al punto ⑥ qui sopra). Tutte le altre sono state chiuse: `Agency`→Produzione AI, `Discovery`→Brief, `Memory`→Memoria, `Diagnosis` e `Brain` non esistono più come schede, `Progetti Agency`→Progetti.

  **L'inventario di ciò che si legge a schermo** (rilevato il 5/8 su mappa fresca, serve come base di lavoro):
  - *Menu laterale:* Console piattaforma · Dashboard · **Agency** (→ Progetti Agency, Alert, Opportunità, Report, Impostazioni Agency) · Clienti · Team · Preventivi · Web Assets · Vault · Progetti · Memo Operativi · Calendario · Messaggi · Ruoli e permessi · Reparti · Audit · Profilo — in `src/layout/Sidebar/SidebarMenu.jsx`.
  - *Tab dentro un progetto Agency:* Overview · Fonti · Discovery · Web · Ads · Performance · Report · Task, più Opportunità · Alert · Diagnosis · Reports tecnici · Brain · Memory (le ultime quattro solo in sviluppo) — in `src/views/Agency/project/AgencyProjectPageTemplate.jsx`.

  **Quanto costa B, misurato il 5/8:** `Agency` compare in **oltre 60 file** di `src/`, `Discovery` in **28**. Il costo **cresce col tempo**: la sola fase di riordino ha generato 165 file nuovi in `src/`, molti col nome vecchio dentro. Più si aspetta, più superficie c'è da rinominare — è l'argomento principale per **non** parcheggiare B in fondo.

  ---

  ### ✅ Fase A2 — «Ruoli e permessi»: eseguita per intero il 7/8/2026

  **Com'è andata, in breve.** L'audit non ha trovato "qualche voce mancante": ha trovato che **un'area intera non esisteva nel catalogo**. La Produzione AI — una novantina di rotte su dieci sotto-aree — girava tutta sui permessi della Pipeline, e cinque rotte (impostazioni AI, budget, consumi) scavalcavano il catalogo con un controllo scritto a mano sul *nome* del ruolo. Il modulo `seo`, viceversa, esisteva da sempre con quattro permessi che **nessuna rotta controllava**.

  **Cosa è stato fatto** (commit `7465f12` per la struttura, più il commit dei nomi):
  - **Nuovo modulo `ai_production` = «Produzione AI»**, con cinque permessi: *vedere · modificare · far generare all'AI · impostazioni AI · budget e consumi*. Scelta di Jacopo fra tre opzioni, con l'indicazione esplicita di **non moltiplicare le voci**: il catalogo passa da 15 moduli a 16 e da 67 permessi a 72, non uno di più. La separazione che conta è **`generate`**, l'unico permesso che autorizza a spendere: prima far generare un contenuto all'AI chiedeva lo stesso permesso di rinominare una scheda nel kanban.
  - **Nove rotte hanno `generate`**, e sono esattamente quelle che chiamano un provider: le quattro del Brief, la ricerca competitor, i due generatori di contenuti web, il copy Ads e **la mappatura Excel** (quest'ultima trovata dalla revisione: non è nell'elenco delle funzioni stimabili, ma chiama l'AI e scrive un costo). Report, diagnosi, sync di alert/opportunità/task ed Excel *commit* sono rule-based: restano su `edit`.
  - **La chat è passata sotto il modulo nuovo.** Stava sotto `projects` per ripiego dichiarato a commento — *«l'area Agency non ha un modulo suo»* — e quel motivo è venuto meno.
  - **SEO agganciato:** le due rotte chiedono `seo.view`/`seo.run_scan`, e il modulo non nasce più spento (era un interruttore che non spegneva niente).
  - **I nomi visibili sono allineati al menu** (pezzo ②): *Vault → Credenziali, Web → Siti in gestione, Projects → Pipeline, Checklists → Memo Operativi, Departments → Reparti*, e tutte le ~70 descrizioni dei permessi riscritte in italiano, con quelle dei ruoli di sistema. Restano inglesi *SEO, Ads, Brief, Dashboard, Team, Branding, Audit*: sono i termini veri del mestiere. Un test presidia il ritorno del vocabolario vecchio.
  - **✅ I NOMI dei ruoli restano come sono — `Viewer` compreso — ed è una decisione, non un residuo.** Jacopo lo ha detto esplicitamente il 7/8/2026: *Superadmin, Admin, Manager, Operativo, Viewer* vanno bene così, **non c'è nessuna italianizzazione da fare**. Erano state sollevate dall'assistente senza che nessuno le chiedesse. Sono cinque parole entrate nell'uso comune di chi lavora in agenzia, e i primi quattro sono già identici in italiano; tradurre *Viewer* da solo lascerebbe un italiano in mezzo a quattro nomi che nessuno percepisce come inglesi. **Quindi non si riaprono.**

    *(Esiste comunque un vincolo tecnico, che però non è più la ragione per cui non si toccano: `Role.name` è la chiave con cui il bootstrap fa l'upsert, quindi oggi rinominarne uno non lo rinominerebbe — ne creerebbe un secondo lasciando il primo con le persone ancora attaccate. È il motivo della voce «Dare a `Role` una chiave stabile» qui sotto, che serve a prescindere da questi cinque nomi.)*

  - **⚠️ Cosa resta in inglese alla fine della fase A2**, così non ci si chieda più se è una dimenticanza. Tre cose, tutte volute: **i nomi di cinque moduli** — *SEO, Dashboard, Team, Branding, Audit* — perché sono i termini veri del mestiere (restano inglesi per la stessa ragione anche *Ads* e *Brief*, che però **non sono moduli**: compaiono dentro la descrizione di `ai_production` e come nomi delle schede di progetto); **i cinque nomi dei ruoli**, per la decisione qui sopra; e **le chiavi dei permessi** (`vault.reveal`, `ai_production.generate`…), che sono nomi tecnici e **non si decidono qui: le decide in blocco la fase B**. Nessuna delle tre è "l'unica": sono tre categorie diverse con tre ragioni diverse.

  **La migrazione `20260807120000_ai_production_module`** (solo dati, nessun cambio di schema) porta l'eredità completa: chi poteva fare una cosa ieri la può fare oggi, **ruoli personalizzati compresi** — che la risincronizzazione automatica non tocca mai. Applicata e verificata sul database di sviluppo: Admin correttamente **senza** impostazioni e budget, Manager con `generate`, Operativo e Viewer in sola lettura.

  **Verificato dal vivo, e risolve un dubbio che era scritto qui:** i nomi nuovi **si propagano da soli**. `ensureRbacCatalog` gira dentro `ensureWorkspaceSystemRoles`, che è chiamata a ogni `/auth/me` — quindi basta un caricamento del frontend e i moduli a database hanno già il nome nuovo. Non serve nessun intervento manuale sui workspace esistenti.

  **Le tre regole permanenti sono in `CLAUDE.md`** (sezione *«Come nasce una cosa nuova: il nome e il permesso»*): il permesso nasce col codice, **i ruoli predefiniti si aggiornano insieme al permesso — migrazione compresa, e il costo della migrazione non è una scusa per rimandare** (indicazione esplicita di Jacopo), il nome nasce italiano.

  **Quello che la revisione ha lasciato aperto** è nella voce *«Quello che l'audit dei permessi ha trovato fuori dal suo perimetro»*, sopra in questa stessa sezione: in particolare i **pulsanti di generazione non ancora protetti in interfaccia** (punto 8) e il **test tabellare mancante sulle rotte dell'area** (punto 10).

  **Un effetto collaterale accettato, da sapere:** con cinque permessi soli, `ai_production.edit` assorbe anche ciò che prima chiedeva `projects.create` e `projects.delete`. In pratica un ruolo personalizzato che avesse `edit` ma non `delete` guadagna la cancellazione degli snapshot di performance e dei set di metriche. Non riguarda la spesa AI e non tocca i ruoli di sistema; è il prezzo della scelta di non moltiplicare le voci, ed è scritto qui perché sia una scelta e non una sorpresa.

  #### 🔸 Dare a `Role` una chiave stabile — da valutare, non ancora pianificata

  **Nasce da una domanda di Jacopo** (7/8/2026), fatta scoprendo che i nomi dei ruoli di sistema non si potevano toccare: *«non si può cambiare la dinamica, così che rinominare un ruolo lo rinomini davvero invece di crearne un altro?»* Sì, si può — e vale la pena saperlo prima di riproporre l'argomento.

  **Metà del problema non esiste già oggi.** I ruoli **personalizzati** si rinominano correttamente: la modifica passa per l'identificativo del ruolo, quindi cambiare nome cambia quel ruolo e basta. Il blocco riguarda **solo i cinque di sistema**, ed è doppio:
  1. **Un divieto esplicito** — `server/services/workspace-roles.service.ts:179` respinge ogni modifica con *«System roles cannot be modified»*.
  2. **Sotto il divieto, il vero motivo:** il bootstrap ritrova i ruoli di sistema **per nome**, perché `Role` non ha una `key`. Nello schema (`prisma/schema.prisma:1363-1378`) l'unicità è `@@unique([workspaceId, name])`: il nome *è* la chiave. Per questo rinominarne uno non lo rinomina — ne crea un secondo e lascia il primo con le persone ancora attaccate.

  **Il rimedio** è dare a `Role` la stessa forma che hanno già `Module` e `Permission`: una **`key` per riconoscerlo** e un **`name` per mostrarlo**. Fatto questo, rinominare un ruolo di sistema diventa un'operazione ordinaria invece di un tabù, e il divieto al punto 1 può ammorbidirsi (restando su permessi e flag di sistema, che sono un'altra cosa dal nome).

  **Il costo, per decidere con cognizione:** una **migrazione di schema** con riporto dei ruoli esistenti (a ognuno va assegnata la chiave giusta a partire dal nome che ha adesso), più i punti che oggi ragionano sul nome — il riconoscimento del ruolo di sistema, la normalizzazione dei nomi, e l'elenco dei ruoli assegnabili in registrazione (`REGISTRABLE_WORKSPACE_ROLE_NAMES`).

  ⚠️ **Non è il prerequisito per italianizzare i cinque nomi**, che è una cosa che **non si farà** (vedi la decisione qui sopra). Serve a togliere una rigidità strutturale: oggi il CRM ha un tipo di oggetto che non si può rinominare, e prima o poi qualcuno vorrà chiamare *Operativo* in un altro modo per la propria agenzia.

  <details>
  <summary>Il piano originale della fase A2, come era stato scritto prima di eseguirlo</summary>

  > ⚠️ **Questa voce sostituisce la "fase C" scritta poche ore prima nella stessa giornata**, che collocava il solo catalogo dei moduli in coda a tutto. Jacopo ha corretto: il lavoro è più largo di quel catalogo e **precede** la fase B. Se in un vecchio commit o handoff si legge "fase C — per ultima", è quella la versione superata.
  >
  > 🔸 **L'attrito noto e accettato:** la ragione per cui era stata messa dopo la B è che **la B tocca le chiavi dei permessi**, e ogni voce qui ha sia il nome visibile sia la chiave. Facendola prima, se poi la B rinomina una chiave, quella parte va ripassata. L'attrito è limitato — nome visibile e chiave sono campi diversi — ma chi esegue la B deve **ricontrollare** che l'audit fatto qui sia ancora allineato.

  **Il lavoro è di tre pezzi, in quest'ordine.**

  **① L'audit: cosa manca.** Il CRM è cresciuto (area Produzione AI, chat, Web Assets, Performance, Reportistica…) ma **«Ruoli e permessi» non ha tenuto il passo**: mancano voci che corrispondono a pezzi di prodotto già esistenti. Serve un **censimento accurato** — non a campione — di tutto ciò che oggi il CRM sa fare e che lì non è rappresentato, e poi l'aggiunta delle voci mancanti. È il pezzo più delicato: una voce dimenticata significa una funzione che nessun ruolo può governare.

  **② L'italianizzazione.** Le voci si leggono nella pagina **Ruoli e permessi** e oggi sono in inglese. Il catalogo dei moduli sta in `server/auth/rbac-catalog.ts:80-95`:

  > Team · Departments · Clients · Projects · Checklists · Calendar · Quotes · Web · Vault · SEO · Messages

  **⚠️ La regola di Jacopo, che vale più della traduzione:** ogni voce dev'essere **identica al nome deciso durante il re-naming** — *in italiano o in inglese, a seconda di cosa si è deciso per quella voce*. Non è «traduciamo tutto»: è «allineiamo tutto». La tendenza generale è verso l'italiano, ma dove un termine inglese è stato tenuto apposta, qui va tenuto uguale.

  **③ Le due regole permanenti da mettere per iscritto in `CLAUDE.md`.** Sono la ragione per cui questo giro dovrà essere l'ultimo del suo genere:
  - **«Ruoli e permessi» si aggiorna insieme allo sviluppo, da sé.** Quando si aggiunge un pezzo di CRM, la voce corrispondente si crea **nello stesso lavoro**, senza che l'utente debba chiederlo. Non è una cortesia: è parte del "finito".
  - **Il naming segue sempre la regola del re-naming.** Ogni elemento nuovo o modificato nasce già con un nome **in italiano, comprensibile e funzionale allo scopo**, con inglesismi **solo dove sono il termine vero del mestiere** (es. i nomi delle cose dentro Google Ads e Meta). Così non servono più sessioni lunghe di ricontrollo e rinomina a mano come quella del 5-7/8/2026.

  **Quello che già si sa, per chi lo eseguirà:**
  - Due voci hanno già il loro nome deciso: `vault` → **Credenziali**, `web` → **Siti in gestione** (fase A, 7/8/2026).
  - ⚠️ **`projects` va guardato con attenzione:** nel menu esistono ora **Pipeline** (l'operatività, il kanban) e **Produzione AI**, che sono due finestre sullo stesso `model Project`. Va deciso a quale delle due corrisponde il modulo — o se le copre entrambe, nel qual caso serve un nome che valga per tutte e due.
  - **Non si tocca una voce sola.** Tradurne una lascerebbe una parola italiana in mezzo a dieci inglesi, che si legge come una svista invece che come una scelta.
  - **I nomi vengono copiati nel database.** C'è una riscrittura automatica (`tx.module.upsert` in `workspace-bootstrap.ts:314`, che aggiorna `name` sulla chiave), **ma non parte a ogni avvio**: gira dentro `ensureWorkspaceSystemRoles`, cioè quando si crea un workspace o si rifanno i ruoli di sistema. È il **contrario** del caso dei moduli di progetto, dove bastava aprire la Panoramica. Va quindi verificato come far ripassare quella riscrittura sui workspace già esistenti, o i nomi vecchi resteranno a schermo.
  - **Nulla è rotto oggi** sul fronte dei nomi: il legame fra nome e modulo passa dalla `key`, non dal `name`. Le voci **mancanti** (pezzo ①) sono invece un buco vero, non un'incoerenza estetica.
  - Il catalogo dei permessi sta nello stesso file (`rbac-catalog.ts:150-170` circa, voci del tipo `vault.view_list`, `vault.reveal`): è lì che si vede quali azioni un ruolo può compiere, ed è lì che si misura cosa manca.

  </details>

  ### 📋 Il piano di B è scritto: `archivio-documenti/piano-fase-B-renaming-tecnico.md` *(17/8/2026)*

  Costruito su due ricognizioni indipendenti (una su `src/**`, una su `server/**` + `prisma/**`). **Niente è stato eseguito.** Tre cose da sapere subito, perché cambiano quanto è scritto qui sotto:

  1. **⚠️ La divisione «B1 frontend / B2 backend» qui sotto NON è eseguibile.** Il backend dichiara **94 rotte** `/agency/...` e il frontend ne chiama 50: sono le **due metà dello stesso indirizzo**, e rinominarne una sola rompe l'area intera. Il piano riorganizza il lavoro **per asse** (classi CSS · chiavi permesso · URL · file e cartelle · vocabolario `discovery`), dove solo il lotto degli URL è obbligatoriamente atomico fra i due lati.
  2. **Manca il prerequisito vero: nessun nome tecnico è mai stato deciso.** A differenza delle etichette della fase A, per cartelle, URL e chiavi non è stato scelto niente — va fatto col metodo del re-naming prima di toccare un file.
  3. **Il nodo con Claudio risulta essere solo la migrazione**, cercato apposta e non smentito: nessuna dipendenza esterna alle chiavi (niente OpenAPI/Postman, le integrazioni non le leggono, i seed non le scrivono a mano). Jacopo ha autorizzato a procedere a questa condizione (17/8/2026). E la migrazione è **più semplice del previsto**: `Permission` ha `key` unica globale e `RolePermission` collega **per identificativo**, quindi un `UPDATE` della chiave tocca ~72 righe e **nessun ruolo perde niente**, personalizzati compresi.

  **Dove collocare B — la raccomandazione originale, superata dal punto 1 qui sopra ma tenuta per memoria del ragionamento:**
  - **B1 — frontend (URL/rotte, nomi file e cartelle di `src/`):** è roba nostra, meccanica, senza decisioni di prodotto una volta che A ha fissato il vocabolario. Va fatto **subito dopo A** (stessa sessione se regge, altrimenti la successiva): è il pezzo che risolve davvero il problema di Jacopo, ed è quello che rincara aspettando.
  - **B2 — backend e permessi** (cartella-modulo `server/modules/agency-os/`, chiavi permesso tipo `projects.view`, eventuali righe `Permission` a database): ⛔ **da concordare con Claudio prima**, è area a decisioni condivise, e toccare le chiavi dei permessi può comportare una **migrazione**. Non si fa unilateralmente.

  ⚠️ **Da verificare quando si aprirà il piano di B** (l'esploratore è obbligatorio, si tocca l'area Agency): se esistono **percorsi salvati a database** che si romperebbero cambiando gli URL — sospetti principali le **Scorciatoie** utente (`/settings/shortcuts`) e la **Console piattaforma**. Un URL cambiato a codice è banale; un URL cambiato che vive anche come dato salvato è un'altra cosa.

  ✅ **Rapporto con il riordino della navigazione — riscritto il 17/8/2026. La versione del 7/8 diceva che i due lavori si contendevano gli stessi indirizzi: verificando si è visto che in gran parte NON è vero, e la regola si è ristretta.**

  Il riordino deciso il 7/8 (`archivio-documenti/decisioni-cliente-e-menu-2026-08-07.md` §3.2 e §4.4) porta Siti in gestione, Credenziali e Preventivi **sotto Clienti nel menu**. Si era dedotto che ciò spostasse i loro indirizzi, e quindi che B dovesse tenerne le mani lontane. **Non è così:**
  - **La posizione a menu e l'indirizzo sono indipendenti in questo CRM.** Il gruppo *Sicurezza* contiene già oggi `/settings/roles`, `/settings/departments` e `/audit` — tre indirizzi senza nulla in comune. Nessun gruppo impone un prefisso ai propri figli.
  - **I moduli restano anche come aree a sé** (decisione §3.1: serve la vista "cosa scade su tutti i clienti"). Quindi la vista globale **tiene il suo indirizzo**; il dossier semmai ne aggiunge uno **nuovo** per il singolo cliente, che è una creazione e non uno spostamento.

  **La regola che resta, in tre righe:**
  1. **B rinomina il vocabolario senza rimandarlo** (`agency` → nome nuovo, `discovery` → `brief`) in file, cartelle e rotte.
  2. **Il raggruppamento a menu non richiede nessuno spostamento di indirizzo** e può essere fatto quando conviene, indipendentemente da B — anche dentro la release di settembre, dove infatti è già assegnato.
  3. **Spostare davvero un indirizzo sotto il cliente è una decisione a sé**, da prendere quando il dossier esiste (V12). ⚠️ Il motivo per non anticiparla è quello annotato qui sopra: alcuni di quegli indirizzi **potrebbero vivere come dati salvati a database**, e allora cambiarli due volte significa due migrazioni, non due find-and-replace.

  📌 **Regola di igiene generale, adottata su proposta di Jacopo (17/8):** chi cambia una di queste cose **aggiorna nello stesso lavoro il documento che la descrive**. Serve a evitare che un piano resti a dire cose superate — ed è il motivo per cui questa voce è stata riscritta invece di lasciata com'era.

  **⚠️ Nota anti-conflitto per chi riprende:** B **non** è "pulizia da fare quando capita" e **non** va anticipato di iniziativa mentre si fa altro — vale la regola generale delle cose trovate per strada. Ha un motivo suo e un momento suo. ⛔ **In particolare, B NON precede la release di settembre:** rinomina l'area Produzione AI, che al lancio sarà **nascosta**, quindi anticiparla non porterebbe nulla alla consegna — e non è breve (`Agency` compare in oltre 60 file, e in B il revisore torna obbligatorio).

---

## Sintesi visiva della progressione

| Build | Tema | Blocco aggiunto |
|---|---|---|
| **🚩 Settembre 2026** | **Prima consegna reale** | **Fuori numerazione, priorità su ogni V.** Sei aree al 100% (Clienti, Team, Messaggi, Ruoli e permessi, Profilo, Registro attività) + cestino sul perimetro + audit sicurezza; tutto il resto nascosto al lancio |
| **V1** | Shell | Apple UX + Command-K + cleanup |
| **V2** | Governance | Super Admin console + ruoli Discord-style + reparti |
| **V3** | Dato | Custom Fields + import/export + Brevo |
| **V4** | **Conversazione** *(in corso)* | Chat AI collaborativa + messaggistica sotto un solo ingresso |
| **V5** | **AI core** *(spezzata: si completa dopo la V4)* | Fonti vettorizzate + Discovery RAG + multi-model + budgeting |
| **V6** | **Reportistica** *(nuova, 24/7)* | Multi-fonte (Google/Meta/Excel) + storico + dashboard operativa → report cliente |
| **V7** | Produzione AI | Web&ADV + generazione visiva + SEO audit + report Apple-style |
| **V8** | Lab | Zero Error Protocol (validazione stampa) |
| **V9** | Vendita | Preventivatore DnD + proposta Apple-style + 72h |
| **V10** | Agenda | Meet/Zoom + Calendly + reminder + thread progetto + gruppi reparto + clienti |
| **V11** | Finance | Fatture in Cloud + time-tracking + redditività |
| **V12** | Go-live | Importazione dati legacy + hardening + rollout |
| **V13** | Pulizia finale | I file troppo grossi che nessuna V ha mai avuto motivo di aprire |

> **Rinumerazione del 15 luglio 2026.** La **V4 è nuova** (Chat AI & Messaggistica): è nata dentro la vecchia V4 come implementazione minore e si è ingigantita fino a diventare una V a sé. Tutto ciò che seguiva **slitta di uno** (vecchia V4 → V5 … vecchia V10 → V11): si passa da 10 a **11 V**. Se in un documento o in un commit precedente al 15/7 leggi "V5", "V8", "V10", riferisciti alla **numerazione vecchia** e aggiungi uno.

> **Rinumerazione del 24 luglio 2026.** È stata inserita una **nuova V6** (*Reportistica multi-sorgente*) **prima** della vecchia V6, perché quest'ultima aveva ancora pezzi aperti (generazione visiva). Tutto ciò che seguiva **slitta di uno**: vecchia V6 "Produzione AI" → **V7**, Lab → V8, Vendita → V9, Agenda → V10, Finance → V11, Go-live → V12: si passa da 11 a **12 V**. Se in un documento o in un commit precedente al 24/7 leggi "V6"–"V11" riferito a Produzione AI / Lab / Vendita / Agenda / Finance / Go-live, aggiungi uno.

### Note di sequenziamento
- **🚩 La release di settembre 2026 precede tutto** *(dal 17/8/2026)*. Non è una V, non entra nella numerazione, e finché non è consegnata **viene prima di qualunque V**, compresa quella in corso. Le V riprendono dopo — salvo nuove commesse con nuova scadenza, che avrebbero a loro volta la precedenza. Il perimetro è **quasi disgiunto** da quello delle V: le sei aree della release stanno fuori da Produzione AI, che è il cuore di V5-V7. Le sole intersezioni sono i **Clienti** (la release fa il contenuto, la V12 la forma) e il **menu** (la release prende la fetta leggera del riordino).
- **La V4 (chat) e la V5 (AI core) sono intrecciate, ed è voluto.** La V4 gira sul motore già costruito nella V5 (RAG, budget, multi-provider): **numericamente la V4 dipende dalla V5, cronologicamente no**. Il residuo della V5 si completa **dopo** la chiusura della V4.
- **La V5 resta la priorità di valore** (il differenziatore AI) ed era parzialmente parallelizzabile a V2/V3 perché lo scaffold OpenAI esisteva già.
- V1–V3 sono prerequisiti UX/dato che rendono "vendibile" e ordinata ogni feature successiva.
- V7 (Lab) dipende dalla V5 (la validazione Lab usa le Fonti vettorizzate).
- V9 eredita dalla V4 **tre** pezzi di messaggistica rimandati: **gruppi di reparto/agenzia** (da riconciliare col "thread di progetto" già previsto lì), **parlare con i clienti** (che richiede un portale clienti oggi inesistente) e il **thread di messaggistica come allegato alla chat AI** (da progettare insieme al modello a conversazioni; deciso il 20/7/2026).
- V10 richiede il time-tracking introdotto lì come prerequisito della redditività.

---

*Documento prodotto confrontando il Brief Operativo Definitivo con l'analisi del codice (`prisma/schema.prisma`, `server/modules/`, `src/`, `server/modules/agency-os/agency.service.ts`). Vedi anche `01-brief-stato-attuale-pre-revisione-apple-style.md` per il dettaglio dello stato attuale.*
