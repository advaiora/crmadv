# Spec — Chat AI collaborativa (estensione AI, post-V4)

> Fonte di verità di questa feature. Concordata a staffetta il **14 luglio 2026** (Jacopo).
> **Stato: Fasi 1, 2 e 3a FATTE (14–15/7/2026, Jacopo). Restano 3b, 4, 5, 6.** Le parti AI (turni, RAG cliente, allegati nel prompt) si **collaudano davvero** quando saranno configurate le **chiavi reali OpenAI/Anthropic** (a fine V, come da decisione): finora provate a fondo lato dati/UI con AI "non configurata".
>
> Base di partenza già in `main`: la **chat di progetto per-utente** (motore di generazione a testo `runAgencyAiTextWithMeta`, RAG sulla domanda, persistenza `ProjectChatMessage`, scheda "Chat" nel progetto, integrazione budget+log costi). Questa spec la **evolve** in una chat collaborativa multi-ambito.

---

## 1. Idea in una riga

Una **sola Chat AI** con un concetto di **ambito** (Generale / Cliente / Progetto), esposta sia come **scheda dentro il progetto** sia come **popup globale** in tutto il CRM, **condivisa tra più utenti su invito**, in cui l'AI interviene **solo se interpellata**.

## 2. Decisioni di design (già prese)

| Tema | Decisione |
|---|---|
| Architettura | **Una chat con ambiti**, non due feature separate. Riusa un solo motore/persistenza/UI. |
| Ambiti | **Generale** (nessun dato) · **Cliente** · **Progetto**. Progetto = stessa entità del CRM (una sola tabella `Project`); nel selettore si mostrano i progetti con **Fonti indicizzate**. |
| Selettore ambito | Nel popup; in cima gli elementi **assegnati all'utente**. |
| Popup ↔ scheda progetto | Il popup con ambito "Progetto X" apre **le stesse conversazioni** della scheda Chat di quel progetto. ⚠️ **Rivisto il 15/7/2026:** la formulazione originale era "un thread per ambito" — **superata** dalla decisione sulle **sessioni multiple** (sez. 4-bis): un ambito ha **N sessioni**, e popup e scheda mostrano lo stesso elenco. |
| Condivisione | **Su invito esplicito** → serve un livello "**partecipanti alla conversazione**". |
| Turni di gruppo | L'AI risponde **solo se interpellata**, via **menzione @AI** *e* **pulsante**. Quando risponde legge l'intero thread come contesto. **Precisazione del 15/7/2026 (decisa, DA FARE):** questa regola vale **solo in gruppo**. Se sei l'**unico partecipante**, ogni messaggio interpella l'AI: da soli non c'è nessun altro a cui parlare, e chiedere `@AI` è un effetto collaterale di una regola nata per il gruppo. Appena si invita qualcuno, la regola torna. Effetto accettato: da soli ogni messaggio è una chiamata a pagamento. |
| Allegati | Pulsante **"Allega"** nel popup: **file** (doc → estrattore testo; immagini → modello con "vista") **ed elementi CRM** (progetto/cliente/fonte/preventivo/**thread messaggistica**). |
| "Chiedi all'AI" sugli elementi | Via **menu azioni ⋯** *e* **tasto destro** (niente pulsanti fissi ovunque). Doppio senso: *aggiungi alla chat aperta* / *apri chat su questo*. |
| Tempo reale | **Websocket** (istantaneo). Richiede infrastruttura realtime nuova. |
| Compressione contesto | Riassunto rotante **invisibile**: oltre ~**45–50%** della finestra del modello (soglia **per-modello e tarabile**), il contesto vecchio passato all'AI viene riassunto. L'utente vede sempre lo storico intero; comprimiamo solo **ciò che l'AI legge**. |
| Navigazione assistita | L'AI può **suggerire** di portare l'utente in un'area del CRM, ma **mai di iniziativa**: solo su richiesta o come suggerimento **con conferma esplicita** (bottone da cliccare). |
| Onboarding | **Guida leggera in-contesto** (empty state, tooltip, card dismissibile), **non** un tutorial/wizard pesante. Distribuita in ogni fase, non un modulo a sé. |

## 3. Piano a fasi (ognuna rilasciabile)

### Fase 1 — Modello conversazioni + chat di progetto condivisa ✅ FATTA (14/7/2026)
- Nuovo modello dati: `AiConversation` (per ambito: progetto/cliente/generale) + `AiConversationParticipant` (invito esplicito); i messaggi si agganciano alla conversazione (evoluzione di `ProjectChatMessage`, che oggi è per-utente).
- **Migrazione dedicata** (da segnalare a Claudio). La chat per-utente attuale viene **subsumed** nel nuovo modello (i dati dev locali si possono azzerare, non c'è uso reale).
- La chat di progetto diventa **condivisa su invito**, con **autore** mostrato su ogni messaggio.
- Turni: **@AI + pulsante**, l'AI risponde solo se interpellata.
- *(Tempo reale rimandato alla Fase 4: qui basta un aggiornamento semplice.)*
- **Done quando:** più utenti invitati lavorano sulla chat di un progetto e chiamano l'AI a richiesta.

### Fase 2 — Ambiti + popup globale + selettore ✅ FATTA (14/7/2026)
- **Popup chat globale** disponibile in tutto il CRM. *(Fatto: `src/views/Agency/chat/AiChatWidget.jsx`, montato nello shell `ClassicLayout`, icona nella topbar.)*
- **Selettore d'ambito** (Progetto/Cliente/Generale), con **"assegnati a me"** in cima → si appoggia al modello di assegnazione/visibilità di **V2** (fatta da **Jacopo**, confermato: niente coordinamento con Claudio). *(Fatto: endpoint `GET /agency/chat/projects` con scoping V2; i clienti sono derivati dai progetti visibili, perché V2 non ha assegnazione diretta utente↔cliente.)*
- Ambito **Cliente** = RAG su **tutti i progetti del cliente** *(Fatto: `searchClientSources` + `listClientProjectIds` che unisce `Project.clientId` e `ProjectClient`).*
- Popup con ambito "Progetto X" = **stessa conversazione** della scheda (riusa gli endpoint `/agency/projects/:id/chat`).
- **Nuova migrazione** `20260714170302_ai_conversation_client_general_scope` (aggiunge `clientId` + indici ad `AiConversation`; ambito 'general' senza vincolo DB, unicità applicativa). Additiva, non distruttiva.
- **Done quando:** la chat è raggiungibile ovunque e l'ambito è scegliibile, con la stessa conversazione condivisa tra popup e scheda. ✅

### Fase 3a — Allegati (documenti + entità CRM) + "Chiedi all'AI" ✅ FATTA (15/7/2026)

La Fase 3 è stata **divisa in due**: 3a (documenti ed elementi CRM) e **3b** (immagini "con vista" e thread di messaggistica), perché le immagini richiedono due cose che oggi non esistono — storage dei binari e un motore AI multimodale — mentre i documenti riusano l'estrattore delle Fonti già collaudato.

- **"Allega"** nel composer, sia nel **popup** sia nella **scheda Chat del progetto** (aprono la stessa conversazione: sarebbe stonato che una delle due non potesse allegare).
  - **Documenti**: TXT, CSV, MD, DOCX, PDF via `sourceExtractor.fromFile` (lo stesso delle Fonti). Come per le Fonti **il binario non viene conservato**: si salva solo il testo estratto (tetto 20.000 caratteri per allegato).
  - **Entità CRM**: progetto, cliente, fonte, preventivo. Se ne salva uno **snapshot testuale** al momento dell'allegato, così il contesto resta quello che l'utente vedeva. *(Il selettore nel composer propone progetti e clienti; fonti e preventivi sono accettati dal server e si allegano via "Chiedi all'AI" quando quelle liste avranno il loro menu.)*
  - Ciclo di vita: **bozza** (caricata nel composer, visibile solo a chi la carica) → **legata al messaggio** all'invio, e da lì visibile a tutti i partecipanti.
  - **Visibilità (V2)**: un elemento CRM si può allegare solo se l'utente potrebbe comunque vederlo — stessa regola del selettore d'ambito (`resolveVisibleChatProjects`, condiviso). Verificato: un utente senza progetti visibili viene bloccato sugli elementi ma può allegare un proprio documento.
- **"Chiedi all'AI"** via **menu ⋯** (Clienti) e **tasto destro** (Clienti e Progetti), con le due voci previste: *aggiungi alla chat aperta* / *apri chat su questo*. Il tasto destro passa da un **unico menu globale** (`AskAiContextMenu`, montato nello shell) che legge gli attributi `data-ask-ai-*` della riga: una lista si abilita aggiungendo attributi, senza montare componenti per riga né ri-renderizzare.
- **Nel prompt**: gli allegati sono una sezione **ALLEGATI** in coda al system prompt (fino a 6.000 caratteri l'uno, con marcatore di troncamento), più i **3 allegati più recenti dei turni precedenti**, così il contesto allegato prima non sparisce al turno dopo. La regola *"usa ESCLUSIVAMENTE le informazioni del contesto"* è stata **rivista** in tutti e tre gli ambiti: senza quella modifica l'AI avrebbe rifiutato il contenuto degli allegati perché non è nelle Fonti.
- **Nuova migrazione** `20260715093040_ai_conversation_attachments` (tabella `AiConversationAttachment`). Additiva, non distruttiva.
- **Debito ripagato strada facendo:** le rotte chat di progetto (Fase 1) avevano una **copia parallela** della logica scoped (Fase 2). La Fase 3a l'ha reso evidente — gli allegati esistevano solo nella versione scoped, quindi non funzionavano sull'ambito Progetto, il principale. Ora i sei metodi di Fase 1 **delegano** a quelli scoped: 250 righe duplicate diventate 56 di delega, una sola implementazione.
- **Done quando:** si porta contesto specifico (documenti/entità) nella chat senza copia-incolla. ✅

### Fase 3b — Immagini "con vista" + thread di messaggistica (da fare)
- **Immagini**: richiede (a) **storage dei binari** (oggi le Fonti scartano il buffer; il precedente è `uploads/agency-sources/` del vecchio codice Agency, ma con una tabella dedicata invece del JSON in `ProjectMemory`), e (b) un **motore AI multimodale** — `runAgencyAiTextWithMeta` accetta `content: string`, va esteso a blocchi su **tutti e tre** i rami (Anthropic `/v1/messages`, OpenAI `/v1/responses`, fallback `chat/completions`).
- **Thread di messaggistica**: `WorkspaceMessage` è 1-a-1 **senza entità thread** — va identificato dalla coppia (mittente, destinatario), non da un id. Nota privacy: solo i thread di cui l'utente fa parte.
- **Menu ⋯ per Progetti/Fonti/Preventivi**: oggi solo i Clienti hanno un menu azioni; il tasto destro invece copre già Clienti e Progetti (sia la lista Agency sia la board di Operatività — sono la stessa entità, una sola tabella `Project`).
- **Widget "I miei progetti" della Dashboard** (`src/modules/dashboard/ui/MyProjectsWidget.jsx`): unico posto dove i progetti si vedono ma il tasto destro non c'è. **Deciso il 15/7/2026, DA FARE.** Basta aggiungere `askAiRowProps('project', project)` alla riga: il menu è globale. Escluso di proposito il selettore progetti dei Preventivi (`ProjectPicker.jsx`): lì scegli un progetto per il preventivo, non ci ragioni sopra.

### Fase 4 — Tempo reale (websocket)
- Infrastruttura **websocket** + push istantaneo dei nuovi messaggi e delle risposte AI ai partecipanti.
- **Done quando:** la collaborazione è dal vivo, senza ricaricare.

### Fase 5 — Compressione del contesto (qualità sessioni lunghe)
- **Riassunto rotante** del contesto AI oltre soglia ~45–50% (per-modello, tarabile), invisibile all'utente (solo un piccolo caricamento).
- Tabella **modello → finestra di contesto**.
- **Done quando:** la qualità delle risposte resta stabile anche in conversazioni lunghe.

### Fase 6 — AI azionabile: navigazione suggerita
- La risposta AI può includere **suggerimenti di navigazione** (bottoni) verso aree del CRM; navigano **solo se l'utente clicca**, **mai** in automatico. Si fornisce al modello la **mappa delle aree**.
- **Done quando:** l'AI accompagna l'utente dove serve, sempre con conferma.

### Trasversale — onboarding leggero
- Empty state, tooltip e card dismissibili aggiunti **dentro ogni fase**. Nessun modulo tutorial separato.

## 4. Dipendenze e note

- **Assegnazione/visibilità (V2):** la Fase 2 ("assegnati a me") si appoggia al modello di assegnazione utente↔progetto/cliente, area con possibile lavoro di **Claudio** → verificare prima di muovere.
- **Modello con "vista":** allegare immagini richiede un modello AI multimodale (config provider) → rimandato alla **Fase 3b**, vedi sopra.
- **Migrazioni previste:** Fase 1 (conversazioni + partecipanti); Fase 2 (`clientId` + indici); Fase 3a (`AiConversationAttachment`); possibile storage riassunti in Fase 5. Ogni migrazione va **tracciata** e **segnalata nell'handoff** (regola del progetto), da applicare dopo l'arretrato `20260706085001`.
- **Chiavi AI reali:** le parti AI (turni, RAG cliente, compressione, navigazione) si **collaudano davvero** quando saranno configurate le chiavi OpenAI/Anthropic (fine V). Le parti non-AI (modello dati, partecipanti, popup, allegati UI, websocket) si costruiscono e testano prima.
- **Costi/budget:** ogni chiamata AI della chat passa già dal motore che applica **budget giornaliero** e **log costi** — quindi la chat collaborativa entra automaticamente nel rendiconto consumi. Il consumo è attribuito a **chi preme invia** (non all'owner della conversazione né a quello del progetto): in un gruppo ognuno paga i propri turni sul proprio budget.
- **Dimensioni del registro consumi (15/7/2026):** oltre a workspace/utente/funzione, il registro distingue ora anche **progetto** e **conversazione** (migrazione `20260715120831`). Serve a rispondere a "quanto è costato il progetto X", non solo "quanto ha speso Marco in chat di progetto". Le chiamate senza contesto di progetto (chat generale, ricerca sulle fonti di più progetti insieme) restano senza progetto e confluiscono in "Senza progetto". Il registro è **contabilità**: le relazioni sono `SetNull`, così cancellare un progetto non falsa la spesa storica.

## 4-bis. SESSIONI MULTIPLE e governo dei gruppi — **DECISO il 15/7/2026 (Jacopo), DA REALIZZARE**

> Discussione aperta il 15/7 su un'analisi del codice, chiusa con decisione il 15/7. Sostituisce l'impianto "una chat per ambito, con proprietario" della Fase 1. **Sotto: prima i difetti accertati che l'hanno motivata, poi il disegno deciso.**

### Perché (difetti accertati sul codice, non impressioni)

Il vincolo `@@unique([projectId])` / `@@unique([clientId])` in `schema.prisma` impone **una sola chat per progetto e per cliente in tutto il workspace**; la chat **generale** è **una sola per l'intera azienda** (`findGeneralConversation` = `findFirst` per workspace+scope). Incrociandolo con il controllo di scrittura (`resolveConversationForUser`: *"Non fai parte di questa conversazione"*) emerge il difetto grosso:

- 🔴 **La chat non parte per chiunque non arrivi per primo.** Il secondo dipendente che apre la chat generale trova quella del primo, non ne è partecipante → **zero messaggi e non può scrivere**, finché il primo non lo invita. Idem su ogni progetto già aperto da un collega. Non è un problema dei gruppi: è la chat che non funziona per il secondo utente in poi.
- **Owner = chi apre per primo**, anche solo per guardare: la conversazione nasce in quel momento e chi l'ha aperta ne è proprietario **a vita**.
- **L'owner non può uscire né essere rimosso** (il controllo che lo protegge in `removeScopedChatParticipant` scatta prima di quello che permette l'uscita autonoma) e **non esiste passaggio di proprietà**: se lascia l'azienda, la chat resta ingestibile. `addParticipant` è un upsert con `update: {}` → re-invitare non cambia il ruolo. A DB, cancellare lo `User` lascia la conversazione **senza owner**.
- **Non esiste "sciogli il gruppo"**: `clearScopedChat` azzera solo i messaggi, la conversazione non si cancella mai, i membri si tolgono uno per chiamata.
- **I ruoli RBAC del CRM non contano nulla**: un superadmin non invitato non vede né modera; chi ha il solo `projects.view`, se apre per primo, è owner a vita.
- **`getScopedChat` non applica la visibilità V2**: basta `projects.view` + un `projectId` esistente per aprire — e possedere — la chat di *qualsiasi* progetto. (Gli allegati quel controllo ce l'hanno dalla Fase 3a; la chat no.)
- **`clearScopedChat` fa get-or-create prima del controllo owner**: una `DELETE` su una chat mai aperta la **crea** col chiamante come owner, poi passa il controllo.
- **Tutte le rotte chat richiedono solo `projects.view`**: inviare un messaggio (che *spende soldi*), azzerare, invitare e allegare chiedono lo stesso permesso della sola lettura.

### Il disegno deciso

**1) Un ambito ha N sessioni, non una chat.** Cade `@@unique([projectId])` / `@@unique([clientId])`. Apri un progetto (o cliente, o la generale) e vedi **l'elenco delle tue sessioni** su quell'ambito — le tue e quelle in cui sei stato invitato — più **"Nuova chat"**. Popup e scheda progetto mostrano lo stesso elenco. **Vale per tutti e tre gli ambiti** (Progetto/Cliente/Generale): una regola sola, e il difetto 🔴 sparisce alla radice perché ognuno apre una **propria** sessione invece di sbattere contro quella di un altro.

**2) Niente proprietario dell'ambito, solo un creatore della sessione.** La sessione ricorda chi l'ha aperta (`createdByUserId`, **già nel modello**). Tutti i partecipanti sono pari su **scrivere, allegare, invitare**; **rimuovere** un membro e **sciogliere** il gruppo li fa il **creatore** — oppure un **admin del CRM** (vedi 3). Nessuno "possiede il progetto": possiede una sessione tra le tante. Il creatore **può uscire** come chiunque altro; la sessione passa a chi resta (più anziano per `createdAt` del partecipante).

**3) I ruoli del CRM contano, ma non sui contenuti.** Un **admin/superadmin** del workspace può sempre **gestire i membri, subentrare come creatore e sciogliere** un gruppo, anche senza esserne partecipante — così una sessione non resta mai orfana. **Non vede però i messaggi** finché non entra come partecipante: moderazione sì, lettura no.

**4) Lasciare un gruppo = congelamento, MAI cancellazione. Regola unica per tutti e tre i modi.** Che tu **esca da solo**, che ti **rimuova il creatore/admin**, o che il gruppo si **sciolga**: la riga di `AiConversationParticipant` **non si cancella**, si **marchia** (ruolo di sola lettura + `frozenAt`). Da lì discende tutto:
- la sessione resta nel tuo elenco, contrassegnata **archiviata**;
- vedi **solo i messaggi precedenti a `frozenAt`** (una condizione sola);
- non compari tra i partecipanti attivi → **chi resta a scrivere sa esattamente chi lo legge**;
- **"Riprendi in una nuova chat"** duplica lo storico **fino a `frozenAt`**, non oltre.

**Perché congelato e non "in diretta"** (valutata e **scartata** l'alternativa): se un rimosso continuasse a vedere i messaggi nuovi, "rimuovere" non significherebbe nulla e la persona resterebbe un **lettore invisibile** — non comparendo tra i partecipanti, chi scrive **non saprebbe di avere un pubblico**. Regola in una riga: *vedi ciò che hai vissuto, non ciò che è successo dopo che sei uscito di scena.*

**Perché la stessa regola anche per chi è rimosso** (valutata e scartata la distinzione "chi esce si tiene lo storico, chi è rimosso lo perde"): quella persona i messaggi **li ha già letti** — toglierglieli dalla vista non li fa dimenticare. In cambio si complicherebbe la regola e si perderebbe il caso legittimo di chi ha lavorato settimane sul progetto e a cui resta la traccia del proprio lavoro.

**5) Scioglimento: copia a richiesta (lazy), non copia immediata.** Sciogliendo, la sessione resta **una**: attiva per chi ha sciolto (che torna solitario), **congelata in sola lettura** per gli ex membri (punto 4). Chi vuole continuare preme **"Riprendi in una nuova chat"** e *solo allora* si duplica. **Perché non la copia eager** (N sessioni con storico duplicato subito, una per ex membro): oltre a moltiplicare i dati per chi su quella chat non tornerà mai, farebbe **divergere N copie senza più un originale**; con la lazy c'è un originale e delle riprese esplicite, volute. La contabilità (`AiUsageLog.conversationId`) resta agganciata dov'era.

**6) Titoli delle sessioni:** generati dalle **prime parole del primo messaggio** (nessuna chiamata AI → gratis, funziona anche senza chiavi configurate), **rinominabili a mano**. Il campo `title` **esiste già** nel modello.

**7) Permessi: separare lettura da scrittura.** ✅ **FATTO (15/7/2026).** Prima tutto chiedeva `projects.view`: inviare — che *spende soldi* — chiedeva lo stesso permesso della sola lettura. Tre permessi nuovi, modellati sul precedente di `messages` (view/send), sotto il modulo `projects` (è quello che le rotte della chat già richiedono; l'area Agency non ha un modulo suo):

| Permesso | Cosa dà | Superadmin | Admin | Manager | Operativo | Viewer |
|---|---|:--:|:--:|:--:|:--:|:--:|
| `chat.view` | consultare le sessioni di cui si fa parte | ✅ | ✅ | ✅ | ✅ | ✅ |
| `chat.use` | inviare (spende), invitare, allegare, azzerare, sciogliere | ✅ | ✅ | ✅ | ✅ | ❌ |
| `chat.moderate` | gestire i gruppi altrui **senza leggerli** | ✅ | ✅ | ❌ | ❌ | ❌ |

**Migrazione `20260715141500_chat_permissions`.** Serve una migrazione *oltre* al catalogo perché il bootstrap (`ensureWorkspaceSystemRoles`, eseguito a ogni login) risincronizza **solo i ruoli di sistema**: i ruoli **personalizzati** (`isSystem: false`) non li tocca nessuno e perderebbero la chat in silenzio nel momento in cui le rotte chiedono `chat.use`. La migrazione quindi **eredita** `chat.view` + `chat.use` a *ogni* ruolo che ha già `projects.view` (nessuno perde ciò che aveva), poi riporta il **Viewer di sistema** alla sola lettura e dà `chat.moderate` ad Admin/Superadmin.

**Moderazione senza lettura — come è reso:** `resolveConversationForModeration` e `listScopedChatParticipants` ammettono chi ha `chat.moderate` anche se non partecipa; `getScopedChat` **no**. L'admin quindi vede e gestisce i membri, rimuove, subentra e scioglie, ma i **messaggi** gli restano preclusi finché non entra come partecipante. Sciogliendo da esterno non si autoinvita: congela tutti. Verificato dal vivo.

**Fatti anche i due controlli mancanti:** visibilità V2 su `getScopedChat` (`assertScopeVisible`) e niente get-or-create prima del controllo in `clearScopedChat`.

### Conseguenze da tenere a mente
- **Nuova migrazione** (tracciata, da segnalare in handoff): via i due `@@unique`, ruolo di sola lettura + `frozenAt` su `AiConversationParticipant`. Le conversazioni esistenti diventano semplicemente la prima sessione del loro ambito.
- La decisione **"AI risponde sempre se sei l'unico partecipante"** (sez. 2, tabella "Turni di gruppo") si applica **per sessione**, non per ambito: in una sessione solitaria l'AI risponde sempre, in una di gruppo serve `@AI`.

## 5. Fuori da questa spec (registrato altrove)

- **Estensione dell'onboarding leggero a TUTTO il CRM:** l'approccio "guida in-contesto, non tutorial pesante" andrà esteso all'intero prodotto, ma **a fine sviluppo** (dopo V9 → collocato in V10, rollout). Vedi roadmap.
