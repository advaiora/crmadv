# CLAUDE.md — Contratto di lavoro condiviso

> Questo file viene letto automaticamente all'inizio di ogni sessione. È il punto di accordo tra le due persone del progetto e tra le rispettive sessioni AI. Tienilo aggiornato.

## Chi lavora al progetto

Due persone, **a staffetta** (una alla volta):
- **Jacopo** — lavora durante la settimana (lun-ven). Meno esperto di programmazione: può chiedere spiegazioni su meccaniche di base.
- **Claudio** — lavora nel weekend (sab-dom). Più esperto.

## Metodo di lavoro

1. **Si lavora uno alla volta** e si passa il testimone con l'handoff.
2. **Si pusha sempre su `main`**, niente branch (salvo test straordinari). I push sono frequenti, quindi si può sempre tornare indietro.
3. **L'handoff è l'unico raccordo** tra le due persone. A fine sessione si genera con il comando `/handoff` (scrive in `archivio-documenti/handoff/`, tiene solo le ultime 3 versioni). Si legge sempre per primo il file più recente.
4. La **fonte di verità del prodotto** è `archivio-documenti/02-brief-operativo-definitivo-bibbia.md` (la "bibbia"); la roadmap di sviluppo è `archivio-documenti/03-roadmap-confronto-e-build.md`.

## Regola sui conflitti tra le due persone (IMPORTANTE)

Dato che si lavora a staffetta, una nuova richiesta può entrare **in contrasto con una scelta o un lavoro già fatto dall'altra persona**.

Quando si individua un **sospetto conflitto di questo tipo**, NON procedere subito. Prima:
1. **Segnalarlo preventivamente all'utente**, in modo chiaro: cosa era già stato deciso/fatto prima (e dove: handoff, commit, file), e perché la richiesta attuale ci va contro.
2. **Aspettare la decisione dell'utente**, che a quel punto consapevole può:
   - **confermare** e far procedere con quanto richiesto, oppure
   - **fare un passo indietro** e rivedere come sviluppare quella specifica parte (eventualmente sentendo il collega).

Vale per tutto il progetto, in ogni sessione. Nel dubbio, segnalare: meglio una domanda in più che disfare il lavoro dell'altro.

## Auto-miglioramento dell'AI (note operative)

Esiste il file `archivio-documenti/note-operative-ai.md` con gli errori operativi già individuati e il modo corretto di procedere (es. come fare le verifiche in anteprima senza sprechi di tempo).

- **Leggilo a inizio sessione** ed evita gli errori già annotati.
- Quando ti accorgi di aver eseguito un'operazione in modo inefficiente o sbagliato, **aggiorna quel file in autonomia** (senza che l'utente lo chieda), aggiungendo una voce breve nel formato *Contesto → Errore → Modo corretto*.

## Team di agent (dal 23/7/2026)

Esistono tre assistenti secondari in `.claude/agents/`, **nessuno dei quali può modificare file**.

> **Li chiama l'assistente, non l'utente.** Fanno parte del metodo di lavoro: non si chiede il permesso di usarli e non si aspetta che l'utente li nomini. Le condizioni qui sotto sono verificabili apposta — non sono un "quando ti sembra utile".

- **`esploratore`** — **chiamalo prima di scrivere codice** ogni volta che ricorre almeno una di queste: la modifica tocca un file oltre le ~800 righe; aggiunge o cambia un permesso, una rotta, una tabella o una colonna; tocca l'area Agency, Web Assets o la chat; oppure **non sai già con certezza l'elenco completo dei file da toccare**. Se non ricorre nessuna, procedi senza. Torna la mappa e la **lista dei punti da collegare**: quella lista è ciò che il revisore spunterà dopo.
- **`revisore`** — **chiamalo a ogni tappa conclusa**, non solo prima del commit: (a) subito dopo schema+migrazione, prima di costruirci sopra; (b) subito dopo aver completato il collegamento; (c) prima di proporre il commit. Due chiamate per pezzo di lavoro sono il default, si sale a tre-quattro se si toccano schema, permessi o generazioni AI. **Mai su codice a metà.**
- **`architetto`** — ogni 5-10 sessioni: misura i consumi e **propone** modifiche al team. Non applica mai niente: le modifiche approvate le applica la sessione principale, e si annotano nel registro.

**Mappa del progetto (dal 30/7/2026).** C'è `archivio-documenti/mappa/mappa-progetto.md`, una fotografia strutturale (moduli backend + funzioni esportate, catena permessi, centralini, modelli Prisma, indice dei documenti grossi, file da non aprire interi) prodotta da `npm run mappa` in meno di un secondo. **Non è committata** (è generata, sta in `.gitignore`). **Prima di chiamare l'esploratore o il revisore, rigenerala** (`npm run mappa`): così partono da una mappa fresca invece di aprire i file-mostro. È uno script, il costo in token è nullo — si rigenera senza pensarci.

**Consumi.** Si lavora su abbonamento Max 20x (etichetta letta da `/usage` il 3/8/2026; prima nei documenti era scritto "5x" per errore): non si paga a token, il vincolo è **non saturare la finestra di 5 ore**. Per il quadro: **`npm run consumi`**. Dal 31/7/2026 il monitor misura **tutti i progetti insieme**, non solo questo: il limite è dell'account, e Jacopo lavora spesso su due progetti in parallelo (in una finestra misurata, il 41% del consumo veniva dall'altro progetto). L'uscita mostra anche la ripartizione per progetto e **il bilancio del team di agent** (quanto sono costati contro quanto hanno tenuto fuori dalla conversazione).

**A fine sessione, per ogni pezzo di lavoro chiuso**, si annota una riga con `npm run consumi:compito -- "<nome del lavoro>"`: finisce in `archivio-documenti/consumi/registro-compiti.md` con durata, consumo e agent usati. Serve a confrontare lavori **simili fra loro** — i giri di spezzatura dei file, per esempio — e capire se chiamare l'esploratore convenga davvero. Il registro ha senso solo se si accumula: non saltarlo. Dettagli e avvertenze di lettura in `archivio-documenti/team-agenti.md`, §3.

**Promemoria da fare all'utente (non aspettare che lo chieda).** Il monitor non può leggere la percentuale del limite: nessun comando e nessun file locale la espongono, verificato. Quando la finestra risulta **già carica** e i campioni registrati sono meno di 5, chiedi la lettura — appoggiandola a qualcosa che si sta già facendo, tipicamente l'handoff:

> «Scrivi `/usage` nella casella dell'app e passami la percentuale che riporta. Serve a far parlare il monitor in percentuale; adesso è un buon momento perché la finestra è carica.»

I campioni vanno in `archivio-documenti/consumi/calibrazione.json`. Non chiederlo a finestra scarica (il campione non servirebbe) né più di una volta per sessione.

**Il campione migliore si prende subito dopo un reset** (`/usage` dice l'ora del prossimo), riferendolo alla finestra **appena chiusa**: così il periodo misurato dallo script e quello del limite coincidono davvero, invece di sfasarsi come succede con la finestra scorrevole delle ultime 5 ore. Chiedi anche **quali modelli** e **se stava lavorando su altri progetti**: sono le due cose che il solo numero non racconta.

Tutto il resto — com'è composto il team, l'archivio delle alternative scartate, il registro delle decisioni — sta in `archivio-documenti/team-agenti.md`.

## Regole di scrittura degli handoff

- Linguaggio **chiaro e semplice**, niente sigle o nomi "in codice" non spiegati.
- **Nessun report didattico**: l'handoff riporta solo cosa è stato fatto, dove ci si è fermati e come ripartire — mai "cose imparate" su meccaniche base di programmazione.

## Stack tecnico (sintesi)

- **Frontend:** React 19 + Vite + React Router 5 + Redux + Bootstrap 5/tema Jampack + Tailwind 3 + SCSS.
- **Backend:** Node + Fastify 5 (TypeScript via `tsx`), Zod.
- **Database:** PostgreSQL via Prisma 6.
- Avvio e comandi: vedi `installazione-e-avvio.md`.

## Database — regola di metodo (migrazioni, non `db push`)

Per ogni cambiamento di schema che finisce su `main` si usano **solo migrazioni tracciate** (`prisma migrate dev`, che genera un file di migrazione versionato), **mai `prisma db push`**. Il push cambia il database senza lasciare traccia: è così che a marzo 2026 si è accumulato l'arretrato dell'area Agency, poi finito impacchettato nella migrazione `20260706085001` (che su un DB già allineato dà errore *"relation already exists"*). Con le migrazioni tracciate ogni modifica è un file pulito e autosufficiente: chi riprende esegue `migrate deploy`/`migrate dev` e basta, e l'arretrato non si ricrea.

Regola pratica quando si tocca lo schema: modifica `schema.prisma`, genera la migrazione con `prisma migrate dev`, **committa il file di migrazione** insieme al codice, e **segnala nell'handoff** che c'è una nuova migrazione (ricordando che l'arretrato `20260706085001` va riconciliato *prima*). **Non riscrivere migrazioni già applicate** (cambierebbe il loro checksum e romperebbe gli ambienti dove funzionano già).

## Frontend `.jsx` — regole di manutenzione (dal 30/7/2026)

Il frontend è la parte più fragile del progetto (niente tipi, storicamente niente test). Dal 30/7/2026 esiste una rete minima che va **mantenuta e allargata**, non aggirata:

- **I test frontend esistono**: `npm run test:frontend` (Vitest + Testing Library; in sviluppo `npm run test:frontend:watch`). Il file di test sta **accanto al sorgente** (`X.test.js` / `X.test.jsx`). Esempi da imitare: `src/lib/brandingPalette.test.ts` (funzione pura), `src/components/ui/DetailField.test.jsx` (render di componente).
- **Quali test lanciare, e quando** (deciso il 4/8/2026): durante il lavoro si lancia **solo la cartella toccata** (`npx vitest run src/modules/<area>` o il singolo file); la **suite intera UNA volta sola**, prima della revisione finale, **in background** — nel frattempo niente altri processi pesanti in parallelo (nota operativa #37). Un rosso **da timeout o da worker mai partito** a macchina carica non è un test rotto: si rilancia mirato il file incriminato prima di indagare il codice (solo un fallimento di asserzione è reale sempre).
- **Il codice nuovo nasce col suo test.** Vale per helper/funzioni pure (sempre) e per i componenti quando hanno logica propria (condizioni, varianti, stati). Quando si tocca un file esistente estraendone logica, la parte estratta va coperta.
- **Soglie di dimensione file** (guardrail ESLint, `warn`): oltre **500 righe** il lint segnala; **800** è la soglia-mostro (`npm run mappa`, §1: non si apre intero). Un warning `max-lines` significa **spezzare, non allungare**: a un file già sopra soglia non si aggiungono feature — prima si estrae qualcosa.
- **I warning dei guardrail non si zittiscono** con `eslint-disable`: si leggono e si riducono. Il lint resta "blocca solo sul rosso".
- **Per spezzare un file-mostro** (sessioni dedicate, una alla volta): `npm run mappa` → **esploratore** → estrarre prima le funzioni pure (con test) → poi i sottocomponenti evidenti (con smoke test) → verifica in anteprima → **revisore** → commit. Mai rifattorizzare un mostro "di passaggio" mentre si fa altro.

## Dev server e database — una sola sessione accesa per volta

I dev server (`npm run dev:api` sulla 4000 e `npm run dev` sulla 5173) vanno tenuti accesi in **una sola sessione/finestra per volta**. Il motivo è concreto: l'API gira con `tsx watch`, che tiene un **lock sulla DLL di Prisma**; se una seconda sessione ha l'API accesa, `prisma generate` e le migrazioni si bloccano (e al reload la pagina può mostrare dati vuoti mentre l'API si riavvia — non è un bug). È così che il 16/7/2026 una sessione ha dovuto fermare i dev server di un'altra per poter migrare.

Regola pratica: **prima di una migrazione o di `prisma generate`, ferma l'API dell'altra sessione** (o assicurati che nessun altro l'abbia accesa). Contesto ed esempi in `archivio-documenti/note-operative-ai.md` (nota #28).

### Ciclo di vita dei dev server (deciso il 23/7/2026)

Il problema da evitare sono i server **orfani**: accesi da una sessione ormai chiusa, che bloccano `prisma generate` e le migrazioni mentre nessuno se la sente di spegnerli (perché vale la regola "non terminare processi di altri"). È successo il 23/7/2026: API e frontend erano accesi da una sessione già finita. Il ciclo è quindi questo:

- **A inizio sessione l'assistente NON avvia niente in automatico.** *Offre* di avviare i due server e li accende **solo se servono davvero** (cioè se si deve guardare il CRM nel browser). Motivo della scelta: l'API accesa tiene il lock su Prisma, quindi accenderla per abitudine farebbe partire ogni sessione già bloccata per il database, oltre a costare 30-70 secondi di avvio a vuoto.
- **I due server si accendono sempre INSIEME** (`dev:api` sulla 4000 e `dev` sulla 5173). Il frontend da solo mostra il CRM **vuoto o in errore**, perché i dati arrivano dall'API.
- **Prima di avviarli si controlla che le porte 4000 e 5173 siano libere.** Se sono occupate non si avvia nulla e lo si segnala: vuol dire che un'altra sessione le sta tenendo.
- **A fine sessione (insieme all'handoff) si spengono TUTTI i server aperti durante la sessione**, **compresi quelli avviati a mano dall'utente** dal terminale per guardare il CRM su Chrome. Non si chiede: si spengono. Fra una sessione e l'altra non deve sopravvivere nessun server.
- **Unica eccezione:** un server che **non** appartiene a questa sessione (altra finestra ancora attiva) **non si termina mai** — si segnala soltanto. Nota che dalla porta si vede solo un PID: se non è chiaro di chi sia, **si chiede** invece di terminarlo.
- **L'handoff deve sempre dichiarare lo stato dei server**: tutti spenti, oppure quali restano accesi, su quali porte e di chi sono.

Se durante la sessione serve una migrazione, si ferma l'API, si migra, si riaccende.

## Colori e temi (chiaro/scuro) — regola d'oro

Il tema è un sistema globale a token (variabili CSS) in `src/styles/scss/globals.css`. Sviluppando qualsiasi pagina/componente: **usa sempre i token `var(--…)` o i componenti Bootstrap standard, mai colori scritti a mano** (`#hex`/`rgb`/`rgba`), nemmeno negli stili inline in JSX. Così chiaro e scuro funzionano da soli, senza ritocchi pagina per pagina. Riferimento completo dei token: `archivio-documenti/design-system-temi.md`. Controlli automatici sui moduli: `npm run lint:css` (file CSS) e `npm run lint:colors` (stili inline in JSX).

## Design "Apple-style" — la bussola

La direzione visiva del prodotto è **Apple-style a sottrazione** (app minimale, non un sito marketing né un'app nativa). Il documento fondativo — principi, regole "fai/non fare", valori concreti agganciati ai token, checklist per pagina — è `archivio-documenti/design-linguaggio-apple-web.md`. **Leggilo prima di lavorare sull'aspetto** di qualsiasi pagina/componente: è pensato per guidare il design anche nelle sessioni future senza memoria di questa. In sintesi: gerarchia tipografica netta, un solo accento per vista, spazio dove aiuta la lettura ma densità dentro tabelle/liste, meno bordi e ombre morbide, token per tutto.
