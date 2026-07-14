# Spec — Chat AI collaborativa (estensione AI, post-V4)

> Fonte di verità di questa feature. Concordata a staffetta il **14 luglio 2026** (Jacopo).
> **Stato: PIANIFICATA — sviluppo NON iniziato.** Si parte dopo le rifiniture V4 e, per le parti AI, quando saranno configurate le **chiavi reali OpenAI/Anthropic** (a fine V, come da decisione).
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

### Fase 1 — Modello conversazioni + chat di progetto condivisa
- Nuovo modello dati: `AiConversation` (per ambito: progetto/cliente/generale) + `AiConversationParticipant` (invito esplicito); i messaggi si agganciano alla conversazione (evoluzione di `ProjectChatMessage`, che oggi è per-utente).
- **Migrazione dedicata** (da segnalare a Claudio). La chat per-utente attuale viene **subsumed** nel nuovo modello (i dati dev locali si possono azzerare, non c'è uso reale).
- La chat di progetto diventa **condivisa su invito**, con **autore** mostrato su ogni messaggio.
- Turni: **@AI + pulsante**, l'AI risponde solo se interpellata.
- *(Tempo reale rimandato alla Fase 4: qui basta un aggiornamento semplice.)*
- **Done quando:** più utenti invitati lavorano sulla chat di un progetto e chiamano l'AI a richiesta.

### Fase 2 — Ambiti + popup globale + selettore
- **Popup chat globale** disponibile in tutto il CRM.
- **Selettore d'ambito** (Generale/Cliente/Progetto), con **"assegnati a me"** in cima → **dipende dal modello di assegnazione/visibilità di V2** (coordinare con Claudio).
- Ambito **Cliente** = RAG su **tutti i progetti del cliente** (estensione della ricerca, oggi per-progetto).
- Popup con ambito "Progetto X" = **stessa conversazione** della scheda (grazie al modello di Fase 1).
- **Done quando:** la chat è raggiungibile ovunque e l'ambito è scegliibile, con la stessa conversazione condivisa tra popup e scheda.

### Fase 3 — Allegati + "Chiedi all'AI" sugli elementi
- **"Allega"** nel popup: file (doc/immagini) ed **entità CRM** (incluso **thread di messaggistica**, con nota privacy: solo thread di cui fai parte).
- **"Chiedi all'AI"** via **menu ⋯** e **tasto destro** (aggiungi a chat aperta / apri chat su quello).
- Distinzione: l'**ambito** è il contesto primario; gli **allegati** aggiungono elementi specifici sopra.
- **Done quando:** si porta contesto specifico (file/entità/conversazioni) nella chat senza copia-incolla.

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
- **Modello con "vista":** allegare immagini richiede un modello AI multimodale (config provider).
- **Migrazioni previste:** Fase 1 (conversazioni + partecipanti); possibile storage riassunti in Fase 5. Ogni migrazione va **tracciata** e **segnalata nell'handoff** (regola del progetto), da applicare dopo l'arretrato `20260706085001`.
- **Chiavi AI reali:** le parti AI (turni, RAG cliente, compressione, navigazione) si **collaudano davvero** quando saranno configurate le chiavi OpenAI/Anthropic (fine V). Le parti non-AI (modello dati, partecipanti, popup, allegati UI, websocket) si costruiscono e testano prima.
- **Costi/budget:** ogni chiamata AI della chat passa già dal motore che applica **budget giornaliero** e **log costi** — quindi la chat collaborativa entra automaticamente nel rendiconto consumi.

## 5. Fuori da questa spec (registrato altrove)

- **Estensione dell'onboarding leggero a TUTTO il CRM:** l'approccio "guida in-contesto, non tutorial pesante" andrà esteso all'intero prodotto, ma **a fine sviluppo** (dopo V9 → collocato in V10, rollout). Vedi roadmap.
