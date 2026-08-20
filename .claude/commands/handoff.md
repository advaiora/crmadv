---
description: Genera l'handoff di fine sessione per chi riprende (di norma la sessione successiva della stessa persona; al cambio turno, l'altra) e tiene solo le ultime 3 versioni
allowed-tools: Bash(date:*), Bash(ls:*), Bash(rm:*), Bash(git:*), Bash(netstat:*), Bash(node scripts/agenti/consumi.mjs:*), Bash(npm run consumi:*), Read, Write, Glob, Grep
---

# Genera handoff di staffetta

Sei a fine sessione di lavoro su questo progetto. Devi scrivere il **documento di staffetta** (handoff) che permetterà a **chi riprende** di ripartire esattamente da dove il lavoro è stato interrotto.

## Contesto del metodo di lavoro (importante)

- Si lavora **uno alla volta**, come in una staffetta: chi finisce passa il testimone.
- **Si lavora su rami, e `main` si tocca solo per unione** *(dal 19/8/2026, per la messa online)*: un lavoro, un ramo, con push frequenti sul proprio ramo. ⚠️ **L'handoff deve quindi dire su quale ramo si è rimasti**, e se restano rami aperti non ancora uniti a `main`.
- **L'handoff è l'unico vero raccordo fra una sessione e la successiva, chiunque la riprenda.** Deve bastare da solo, senza bisogno di chiedere spiegazioni.
- ⚠️ **Chi riprende NON è necessariamente l'altra persona, e di norma non lo è.** L'handoff serve in due modi: (a) passare il testimone all'**altra persona** quando cambia il turno — **Jacopo** lun-ven, **Claudio** sab-dom; (b) permettere alla **stessa persona** di riprendere il proprio lavoro giorni dopo, in una sessione nuova che non ricorda nulla di quella precedente. Poiché **Jacopo sviluppa la maggior parte del tempo**, il caso ordinario è **Jacopo → Jacopo**: scrivere l'handoff pensando solo a Claudio è un errore, e produce un documento che dà per scontate proprio le cose che servono a chi continua.

## Regole di scrittura dell'handoff (NON negoziabili)

1. **Linguaggio chiaro e semplice.** Scrivi come se parlassi a un collega che non era presente e potrebbe non ricordare i dettagli.
2. **Niente sigle, codici o nomi "interni"** che il collega potrebbe non conoscere. Se devi citare un file, una funzione o uno strumento, scrivi anche, in parole semplici, **cosa è e a cosa serve**.
3. **Breve ma completo.** Tre sezioni essenziali, nessun muro di testo.
4. Scrivi **in italiano**.
5. **NESSUN REPORT DIDATTICO. Mai.** L'handoff è un passaggio di consegne operativo tra colleghi, non un diario di apprendimento. Durante la sessione una delle due persone (Jacopo) potrebbe chiedere spiegazioni su meccaniche base di programmazione: quelle spiegazioni servono sul momento, **non vanno nell'handoff**. NON includere MAI frasi del tipo:
   - "appreso che usando il codice X si ottiene il risultato Y";
   - "compresa la funzione del file X";
   - "imparato come funziona Z".
   Il collega che riprende è esperto: gli interessa **cosa è stato fatto, dove ci si è fermati e come ripartire** — non cosa qualcuno ha imparato strada facendo. Riporta i **fatti e i prossimi passi**, mai i progressi formativi di chi ha scritto.

## Cosa fare, passo per passo

### 1. Ricostruisci cosa è stato fatto in questa sessione — VERIFICANDO, non solo ricordando
Ripercorri la conversazione, poi **controlla sempre lo stato reale del repo**, senza saltare questo passo:
- `git log --oneline` (i commit di questa sessione) e `git status --short` (cosa è rimasto non committato);
- se serve, `git show --stat <commit>` per vedere quali file sono cambiati davvero.

La memoria della conversazione **non basta**: in una sessione lunga una cosa viene spesso prima annunciata come "da fare" e poi chiusa poco dopo. Scrivendo solo a memoria si finisce per riportare la versione vecchia.

### 1-bis. Controlla cosa risulta ANCORA aperto (regola anti-scorie)
Leggi l'**handoff precedente** (il file più recente già presente nella cartella) e la roadmap `archivio-documenti/03-roadmap-confronto-e-build.md`. Per **ogni** punto che l'handoff precedente dava come "in sospeso / da fare / rimandato":
- verifica nei commit e nei documenti se **nel frattempo è stato chiuso**;
- se è stato chiuso, **non riportarlo come pendente**: semmai scrivi che è stato chiuso;
- se è ancora aperto, riportalo.

**Regola non negoziabile:** non scrivere come "in sospeso" nulla che non hai **verificato adesso**. Un elenco di pendenze stantio è peggio di nessun elenco, perché fa rifare al collega un lavoro già fatto.

### 2. Calcola la data/ora per il nome del file
Esegui:
```
!`date +%Y-%m-%d-%H%M`
```
Userai questo valore per il nome file: `handoff-<data-ora>.md` (es. `handoff-2026-06-30-1530.md`).

### 3. Scrivi il nuovo handoff
Crea il file in `archivio-documenti/handoff/handoff-<data-ora>.md` usando **esattamente** questa struttura:

```markdown
# Handoff — staffetta del <data leggibile, es. 30 giugno 2026, ore 15:30>

**Scritto da:** <Jacopo o Claudio — se non è chiaro, chiedi o deducilo dal giorno della settimana: lun-ven = Jacopo, sab-dom = Claudio>
**Per chi riprende:** <la sessione successiva — di norma la stessa persona; l'altra solo se il turno cambia. Non darlo per scontato: nel dubbio scrivi "la prossima sessione (Jacopo, o Claudio nel weekend)">

## Cosa ho fatto
<Elenco chiaro e sintetico di ciò che è stato fatto in questa sessione. Frasi semplici. Per ogni cosa, spiega in una riga il "perché" se non è ovvio. Se hai toccato dei file, dì quali e cosa fanno in parole povere. NON inserire qui spiegazioni didattiche o "cose imparate" su come funziona la programmazione: solo lavoro svolto e modifiche concrete.>

## Dove mi sono fermato
<Punto esatto in cui ti sei interrotto. Cosa è completo, cosa è a metà, eventuali cose lasciate in sospeso o che non funzionano ancora. Se c'è qualcosa di delicato da sapere prima di toccare il codice, scrivilo qui.>

## Come riprendere — prossimi passi
<Istruzioni concrete e ordinate per ripartire. Numerate. La prima cosa da fare per prima. Spiegate in modo che il collega possa eseguirle senza dover indovinare nulla.>

## Riferimenti utili (opzionale)
<Solo se servono: file principali toccati, comandi per avviare il progetto, link a documenti dell'archivio. Sempre con una riga che spiega cosa sono.>
```

### 4. Ruota le versioni: tieni SOLO le ultime 3
Dopo aver scritto il nuovo file, elenca tutti i file `handoff-*.md` nella cartella `archivio-documenti/handoff/`, ordinati per data nel nome (dal più vecchio al più recente).

- Se ce ne sono **più di 3**, **cancella i più vecchi** finché ne restano esattamente 3 (i 3 più recenti, incluso quello appena creato).
- Non cancellare mai il file appena creato.
- Verifica alla fine che nella cartella ci siano al massimo 3 file `handoff-*.md`.

### 5. Spegni i dev server della sessione
Regola di progetto (vedi `CLAUDE.md`, "Ciclo di vita dei dev server"): **fra una sessione e l'altra non deve sopravvivere nessun dev server**, altrimenti resta acceso un server "orfano" che blocca `prisma generate` e le migrazioni e che nessuno se la sente di spegnere.

- Controlla le porte: `netstat -ano | grep LISTENING | grep -E ":4000|:5173"`.
- **Spegni tutti i server aperti durante questa sessione**, inclusi quelli che ha avviato **a mano l'utente** dal terminale per guardare il CRM su Chrome. Non chiedere il permesso: è la regola. Se li hai avviati tu con lo strumento di preview, spegnili con quello.
- **Eccezione:** se risulta attivo un server che **non** appartiene a questa sessione (un'altra finestra ancora al lavoro), **non terminarlo**: segnalalo soltanto. Dalla porta si vede solo un PID, quindi se non è chiaro di chi sia, **chiedi** invece di terminare.
- Verifica alla fine che le porte siano libere.
- **Riporta lo stato dei server nell'handoff** (nella sezione "Dove mi sono fermato"): tutti spenti, oppure quali restano accesi, su quali porte e di chi sono.

### 5-bis. Annota i compiti chiusi nel registro

Per **ogni pezzo di lavoro concluso** in questa sessione, aggiungi una riga al registro per compito:

```bash
npm run consumi:compito -- "<nome del lavoro, es. spezzatura ClientsList giro 2>"
```

Se in sessione si sono chiusi più compiti, delimitali con `--da <ora> --a <ora>` (ore del computer), così ognuno ha il suo consumo invece di prendersi tutta la sessione. Il registro (`archivio-documenti/consumi/registro-compiti.md`) serve a confrontare lavori **simili fra loro** e capire se chiamare l'esploratore convenga: vale solo se si accumula, quindi non saltarlo. Non chiedere il permesso: fa parte della chiusura, come spegnere i server.

### 5-ter. Se serve, chiedi la lettura dei consumi

Il monitor dei consumi (`npm run consumi`) **non può leggere da solo la percentuale del limite dell'abbonamento**: nessun comando e nessun file locale la espongono. La impara da letture manuali.

Lancialo. Se i campioni registrati in `archivio-documenti/consumi/calibrazione.json` sono **meno di 5** (soglia di `CLAUDE.md`: con 2 la stima già funziona, ma sbaglia ancora più di un punto) e la finestra in corso è **oltre la metà del picco storico**, chiedi la lettura adesso — è il momento giusto perché la finestra è carica e stai già chiudendo:

> «Prima di chiudere: scrivi `/usage` nella casella dell'app e passami la percentuale che riporta. Serve a far parlare il monitor dei consumi in percentuale invece che in relativo.»

Se l'utente la fornisce, aggiungi un campione in `archivio-documenti/consumi/calibrazione.json` (campi: `quando`, `peso`, `percentuale`, `nota`). Se non la fornisce o la finestra è scarica, **lascia perdere senza insistere** e non riportarlo nell'handoff: non è lavoro svolto.

### 6. Conferma all'utente
Riporta in modo sintetico:
- Il nome del nuovo file di handoff creato.
- Quali eventuali handoff vecchi sono stati cancellati.
- I file di handoff attualmente presenti (massimo 3).
- Lo stato dei dev server (spenti / eventuali rimasti attivi e perché).

## Nota
La cartella di lavoro degli handoff è **`archivio-documenti/handoff/`**. Il file più recente è sempre quello da leggere per primo quando si riprende il lavoro.
