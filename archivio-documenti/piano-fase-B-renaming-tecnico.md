# Piano della fase B del re-naming — i nomi tecnici

> **Cos'è questo documento.** Il piano completo di **B1 (frontend) e B2 (backend/permessi)**, costruito il 17/8/2026 su due ricognizioni indipendenti (un esploratore su `src/**`, uno su `server/**` e `prisma/**`). **Nulla è stato eseguito.** Serve a decidere con i numeri davanti, e a permettere a una sessione futura di partire senza rifare l'indagine.
>
> Le fasi A e A2 (etichette visibili e pagina «Ruoli e permessi») sono **chiuse**. Questa è l'ultima parte del re-naming, e non serve alla UX: serve a chi sviluppa, per non tenere in testa due vocabolari — l'interfaccia dice *Produzione AI* e *Brief*, il codice dice ancora `agency` e `discovery`.

---

## 0. La cosa più importante: la divisione «B1 frontend / B2 backend» non regge all'esecuzione

La roadmap divide il lavoro per **lato** (prima il frontend, poi il backend). Le ricognizioni mostrano che **quella divisione non è eseguibile**, per un motivo meccanico:

- Il backend dichiara **94 rotte HTTP** che cominciano tutte con `/agency/...` (`routes/workspace-agency.route.ts`).
- Il frontend chiama quegli stessi endpoint da `src/modules/agency-os/api/agency.api.js` — **84 occorrenze**, 50 chiamate.

Sono **le due metà dello stesso indirizzo**. Rinominarne una sola non "fa metà del lavoro": rompe l'area intera, e in modo totale (404 su tutto), non silenzioso.

**Quindi il lavoro va diviso per ASSE, non per lato.** Ogni lotto qui sotto è committabile e verificabile da solo; alcuni toccano frontend e backend insieme *perché devono*.

> ⚠️ Da correggere in roadmap quando questo piano viene approvato: la voce «B1 — frontend / B2 — backend e permessi» va sostituita con i lotti qui sotto. La distinzione che resta valida è un'altra: **quali lotti richiedono una migrazione** (solo il n° 2 e il n° 5).

---

## 1. Lotto 0 — Decidere i nomi *(nessun codice, ma viene prima di tutto)*

**Non esiste ancora un nome tecnico deciso.** La roadmap dice solo «va fatto, va solo collocato»: a differenza delle etichette della fase A, per cartelle, URL e chiavi **non è mai stato scelto niente**. Questo è il vero prerequisito, e senza non si tocca un file.

Va deciso, col metodo del re-naming già in `CLAUDE.md` (l'assistente spiega l'area, Jacopo conferma, poi si propone un ventaglio):

| Cosa | Oggi | Serve decidere |
|---|---|---|
| Prefisso degli URL | `/agency/...` | il nuovo prefisso |
| Cartella frontend (vista) | `src/views/Agency/` | il nuovo nome |
| Cartella frontend (modulo) | `src/modules/agency-os/` | il nuovo nome |
| Cartella backend | `server/modules/agency-os/` | idem, coerente col frontend |
| La sezione «Brief» | `discovery` | quasi certamente `brief` |
| Le 72 chiavi dei permessi | `vault.reveal`, `web.publish`… | se e quanto italianizzarle |
| Le 7 chiavi di `localStorage` | `agency-os.discovery.` … | seguono il nome nuovo |

**Due domande di prodotto da sciogliere qui, non dopo:**

1. **I vecchi indirizzi `/agency/...` restano vivi?** Se sì servono dei rimandi; se no, chi ha un segnalibro riceve un 404. Esiste già il meccanismo (`src/routes/agencyRemovedRoutes.js`, usato per le tre schede rimosse il 6/8) ma **sostituisce solo la coda dell'indirizzo, non il prefisso**: per il prefisso va aggiunto un rimando nuovo sullo stesso principio.
2. **Il vocabolario dell'Audit si rinomina insieme ai permessi?** Quattro moduli (vault, team, web-assets, quotes) riusano il testo delle chiavi come *nome dell'evento* nel registro. Le righe **già scritte** manterranno per sempre il testo vecchio — la cronologia non si riscrive. Va deciso apposta, non deciso di striscio da un find-and-replace.

---

## 2. Il verdetto sulla condizione posta da Jacopo *(B2 e Claudio)*

Jacopo (17/8/2026) ha autorizzato a procedere su B2 **a condizione che l'unico nodo da discutere con Claudio fosse la migrazione in più**. La ricognizione ha cercato apposta un secondo motivo. **Non l'ha trovato.**

- La roadmap dice **letteralmente**: *«toccare le chiavi dei permessi può comportare una migrazione. Non si fa unilateralmente»*. Il motivo scritto è quello, più il principio generale «area a decisioni condivise».
- **Nessuna dipendenza esterna**: niente OpenAPI/Swagger/Postman nel repo; le integrazioni (Brevo) non leggono chiavi di permesso; `prisma/seed.ts` non le scrive a mano (itera il catalogo); i tre seed demo non le citano.
- ⚠️ **L'unico limite onesto:** non si può escludere da codice che esista uno script personale *fuori dal repo* che chiami le API dirette. Se ne esiste uno, va detto ora.

**→ La condizione risulta soddisfatta: si può procedere senza ulteriore attesa.** Resta la buona norma di segnalarlo nell'handoff — per informare, non per chiedere il permesso.

**Ma tre rischi tecnici restano, e sono interni al codice, non a Claudio:**

1. **Le chiavi sono duplicate a mano quasi ovunque.** Solo **4 gruppi su 16** hanno una costante condivisa (`TEAM_`, `DASHBOARD_`, `AI_PRODUCTION_`, `CHAT_PERMISSIONS` = 14 chiavi). Le altre **58 chiavi non hanno una costante**: ogni modulo le riscrive nel proprio `policies.ts`, come testo che deve restare identico al catalogo. In tutto ci sono **~210 citazioni letterali fuori dal catalogo, in 44 file**, più 19 in due documenti di `server/modules/vault/`. **Un `sed` sul solo `rbac-catalog.ts` lascerebbe rotto tutto il resto.**
2. **`dashboard.policies.ts` legge 12 chiavi di altri moduli** come stringhe sciolte, per calcolare il livello della Dashboard. Se una cambia e lì non si aggiorna, **la Dashboard sbaglia livello in silenzio** — è lo stesso punto cieco già annotato nel catalogo l'8/8.
3. **Le stringhe-permesso sono già dato scritto a database** in `AuditLog.action` e in `AuditLog.metadata` (`addedPermissions`/`removedPermissions`, scritte a ogni sincronizzazione ruolo). Vedi la domanda 2 del lotto 0.

**La buona notizia, ed è grossa:** la migrazione è **molto più semplice del previsto**.

> `Permission` e `Module` sono tabelle **globali** con `key` unica: **una riga per chiave in tutto il sistema**. E `RolePermission` collega i ruoli **per identificativo, non per testo**.
>
> Quindi rinominare una chiave con `UPDATE "Permission" SET "key" = … WHERE "key" = …` tocca **al massimo 72 righe** (+16 moduli) e **zero righe di `RolePermission`**. Nessun ruolo — nemmeno quelli **personalizzati**, che la risincronizzazione automatica non tocca mai — perde alcunché: il collegamento punta all'id, che non cambia.

⚠️ **Le due migrazioni già in repo NON sono lo stampo giusto.** `20260715141500_chat_permissions` e `20260807120000_ai_production_module` risolvono un problema diverso — *permesso nuovo che eredita da uno vecchio* — con `INSERT` + `JOIN` di riporto. Qui serve un `UPDATE` e basta. Vanno usate come riferimento di stile, non copiate nella sostanza.

---

## 3. I lotti, in ordine di esecuzione

### Lotto 1 — Le classi CSS `.agency-*` *(frontend, indipendente, rischio minimo)*
~24 classi in `src/views/Agency/agency-ui.css`, usate in **86 punti su 20 file** — uno dei quali **fuori** dall'albero Agency (`src/modules/sources/ui/ProjectAiSourcesPanel.jsx`). Nessuna dipendenza dal backend, nessun import che si rompe. Verifica: a schermo, **tema chiaro e scuro**.

### Lotto 2 — Le chiavi dei permessi *(backend + migrazione, indipendente dagli URL)*
Migrazione `UPDATE` + `rbac-catalog.ts` **nello stesso commit** (il catalogo e i tre array-ruolo di Manager/Operativo/Viewer), poi i moduli con ridichiarazione locale **uno alla volta**: clients, vault, web-assets+seo, checklists, quotes, calendar, projects, dashboard (⚠️ le 12 citazioni sciolte), messaging, e le rotte di vecchia convenzione in `server/routes/` (roles, modules, branding, departments).
**Rete di sicurezza:** i test che citano le chiavi come stringa **falliscono rumorosamente** — sono la difesa vera. Da estendere: un test sulle *chiavi* modellato su quello del vocabolario in `rbac-catalog.unit.test.ts`.
**Revisore obbligatorio** (roadmap, per tutta la fase B), qui almeno tre passaggi: dopo la migrazione, dopo i moduli, prima del commit finale.

### Lotto 3 — Gli URL ⚠️ *(frontend e backend INSIEME, atomico — non spezzabile)*
Le **94 rotte** del backend e le **50 chiamate** del frontend cambiano nello stesso commit. Insieme a loro, i punti che *costruiscono* l'indirizzo lato client, che sono **almeno quattro copie**: `RouteList.jsx` (21 rotte), `SidebarMenu.jsx`, `TopNav.jsx:122` (`pathname.startsWith('/agency')`), e `Account/index.jsx:8-24` — la **terza copia dei nomi dei moduli**, che ha già un commento nel file a ricordarlo. Più i `Link to=`/`history.push` sparsi.
⚠️ Va aggiornato anche `server/modules/agency-os/chat-nav.ts` (5 URL **del frontend** dentro il backend, usati dalla chat AI per suggerire dove andare): è **il gemello del menu**, e se diverge l'AI propone indirizzi che non esistono.
Se si è deciso di tenere vivi i vecchi indirizzi, qui entra il rimando di prefisso.

### Lotto 4 — File e cartelle *(il più grosso; per ultimo fra i meccanici)*
**175 file** vivono sotto le due cartelle frontend (`src/views/Agency/` 143, `src/modules/agency-os/` 32); **83 file** hanno il nome che contiene *Agency*/*Discovery*. Lato backend la cartella è **26 file / 19.068 righe**, con **4 soli importatori esterni**.
Ordine: prima le sottocartelle isolate, poi i file diretti, poi i contenitori. Per **ogni** file: censimento degli import **prima** di spostarlo (nota operativa #40 — un solo giro di ricerca può non bastare).

> ⚠️⚠️ **La trappola peggiore di tutto il piano.** Il rischio non è dentro le cartelle da rinominare: è **fuori**. **Dieci file esterni** importano da `src/views/Agency/chat/` (askAi, AiChatWidget, AskAiContextMenu) — fra cui **`TopNav.jsx` e `ClassicLayout/index.jsx`, che sono layout globali caricati su ogni pagina**. Un import rotto lì **non rompe la Produzione AI: rompe l'intero CRM.** Chi guarda solo "cosa c'è dentro `views/Agency/`" li manca sistematicamente.
> Gli altri otto: `QuotesList.jsx`, `MessagingInboxPage.jsx`, `ProjectAiSourcesPanel.jsx`, `ProjectCard.jsx`, `MyProjectsWidget.jsx`, `ClientMobileCard.jsx`, `ClientGridRow.jsx`, `ClientActionsMenu.jsx`.

**Nota che aiuta:** il progetto **non usa alias né import dinamici** (verificato: nessun `@/`, nessun `React.lazy`). Ogni riferimento è un import relativo, cioè testo — niente da inseguire a runtime, ma **tutto** va trovato per ricerca testuale.

### Lotto 5 — Il vocabolario `discovery` dentro il backend *(+ una migrazione a sé)*
**382 occorrenze in 7 file**, quasi tutte in `agency.service.ts` (305: `DiscoverySections`, `buildDiscoveryBrief`, `DEFAULT_DISCOVERY_SECTIONS`…). È quasi tutto **codice interno**, quindi meccanico — ma è un vocabolario grosso quanto quello dei permessi.
⚠️ **Un pezzo è a database ed è una migrazione separata:** l'enum `AgencyProjectStatus` ha il valore **`DISCOVERY`**, che è il default di `Project.statusAgency` — ogni progetto ha quel valore salvato. Si risolve con `ALTER TYPE … RENAME VALUE`, che aggiorna tutte le righe in un colpo, ma **va contata a parte** e non è coperta da nessuno dei due esempi in repo.

---

## 4. Cosa NON si tocca — e non è una dimenticanza

- ⛔ **I sette valori di stato del progetto** (`discovery, planning, production, review, live, paused, archived`). **Decisione già presa e scritta** in `agencyProjectLabels.js`: restano inglesi finché quello stato non diventa modificabile dall'interfaccia. ⚠️ Attenzione: la parola `discovery` compare **con due significati diversi anche nello stesso file** — *stato del progetto* (fuori scope) e *sezione/scheda Brief* (dentro scope). **Un find-and-replace cieco non li distingue** e romperebbe le etichette di stato.
  *(L'enum a database del lotto 5 è la faccia tecnica di questa stessa parola: se si decide di non toccare lo stato, quella migrazione non si fa.)*
- ⛔ **Gli indirizzi dei moduli che il riordino del menu sposterà** — Siti in gestione, Credenziali, Preventivi finiranno sotto Clienti (`decisioni-cliente-e-menu-2026-08-07.md` §3.2 e §4.4, approvato da Claudio). Si toccano **una volta sola, in quella sede**: rinominarli ora vorrebbe dire spostarli fra un mese.
- ⛔ **Le chiavi delle funzioni AI** (`discovery.generateBrief`, `discovery.generateSection`) **non prima di aver deciso cosa farne**: esistono in **due copie** dichiarate (frontend `aiFunctionLabels.js` e backend `AGENCY_AI_ESTIMATABLE_FUNCTIONS`), **sono il valore che un workspace digita** nel campo "Modelli per funzione", e finiscono nello storico dei consumi AI. Rinominarle orfanizza gli override già salvati e fa apparire chiavi grezze nelle righe storiche.

---

## 5. Il rischio silenzioso da non dimenticare: la cache locale

`src/modules/agency-os/data/agencyDataAdapter.js:115-121` definisce **7 chiavi di `localStorage`** (`agency-os.discovery.`, `.ads.`, `.web.`, `.reports.`, `.client-report.`, `.diagnosis.`, `agency-os.projects`) usate come **ripiego quando il salvataggio sul server fallisce**: lì dentro ci sono bozze che non sono mai arrivate al database.

Rinominando quelle stringhe, chi ha una bozza solo in locale **la perde senza nessun messaggio**: l'app cerca la chiave nuova, non la trova, e non è un errore. Oggi **non esiste nessuna lettura doppia** (nuova, e poi la vecchia come ripiego).

**Due strade, da scegliere:** accettare la perdita (i dati oggi sono tutti di test — ma il giorno del rilascio non lo saranno), oppure scrivere una lettura doppia temporanea. Costa poco farla, molto ricordarsene dopo.

---

## 6. Quanto costa, in sintesi

| | Frontend | Backend |
|---|---|---|
| Occorrenze `agency` | **2.137** in 158 file | (cartella da 19.068 righe) |
| Occorrenze `discovery` | **407** in 48 file | **382** in 7 file |
| File col nome da cambiare | **83** | **5** |
| File dentro le cartelle da rinominare | **175** | **26** |
| Rotte/URL | 21 di router + 50 chiamate API | **94 rotte HTTP** |
| Chiavi permesso | — | **72** (+16 moduli), ~210 citazioni sparse |

**Non è una sessione.** I lotti 1, 2 e 5 sono autonomi e ragionevoli; il **lotto 3 è atomico e non spezzabile**; il **lotto 4 è il più grosso** e va fatto a piccoli passi con verifica a ogni spostamento.

**Verifica trasversale, a ogni lotto:** test della sola cartella toccata durante il lavoro, suite intera **una volta sola** prima della revisione finale e in background (nota operativa #37). Tipi: la baseline è **233**.

---

## 7. Cosa le ricognizioni non hanno verificato *(onestà del piano)*

- Se `ProjectActiveModule.moduleKey` contenga davvero il valore `"discovery"` a database (dedotto dal frontend, non verificato sullo schema): **da controllare prima di toccare l'elenco dei moduli attivi**.
- Il pattern «ogni modulo ridichiara le sue chiavi nel proprio `policies.ts`» è verificato su **tre** moduli (clients, vault, web-assets) e presunto sugli altri.
- Le ~210 citazioni letterali sono un **minimo**: citazioni dentro commenti senza apici possono sfuggire al conteggio.
- Nessuno dei due esploratori ha aperto per intero i file-mostro (`agency.service.ts` 10.459 righe, `agencyDataAdapter.js` 2.776, `agency.api.js` 1.094): i conteggi vengono da ricerche su tutto il file, non da campioni, ma non sono una lettura integrale.
