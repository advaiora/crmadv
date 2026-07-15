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
| Popup ↔ scheda progetto | Il popup con ambito "Progetto X" apre **la stessa conversazione** della scheda Chat di quel progetto (un thread per ambito). |
| Condivisione | **Su invito esplicito** → serve un livello "**partecipanti alla conversazione**". |
| Turni di gruppo | L'AI risponde **solo se interpellata**, via **menzione @AI** *e* **pulsante**. Quando risponde legge l'intero thread come contesto. |
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
- **Menu ⋯ per Progetti/Fonti/Preventivi**: oggi solo i Clienti hanno un menu azioni; il tasto destro invece copre già Clienti e Progetti.

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
- **Costi/budget:** ogni chiamata AI della chat passa già dal motore che applica **budget giornaliero** e **log costi** — quindi la chat collaborativa entra automaticamente nel rendiconto consumi.

## 5. Fuori da questa spec (registrato altrove)

- **Estensione dell'onboarding leggero a TUTTO il CRM:** l'approccio "guida in-contesto, non tutorial pesante" andrà esteso all'intero prodotto, ma **a fine sviluppo** (dopo V9 → collocato in V10, rollout). Vedi roadmap.
