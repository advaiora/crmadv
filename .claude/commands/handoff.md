---
description: Genera l'handoff di staffetta (Jacopo ⇄ Claudio) e tiene solo le ultime 3 versioni
allowed-tools: Bash(date:*), Bash(ls:*), Bash(rm:*), Bash(git:*), Read, Write, Glob, Grep
---

# Genera handoff di staffetta

Sei a fine sessione di lavoro su questo progetto. Devi scrivere il **documento di staffetta** (handoff) che permetterà all'altra persona — **Jacopo** (lavora lun-ven) o **Claudio** (lavora nel weekend) — di riprendere il lavoro esattamente da dove è stato interrotto.

## Contesto del metodo di lavoro (importante)

- Si lavora **uno alla volta**, come in una staffetta: chi finisce passa il testimone all'altro.
- Si pusha **sempre su `main`**, niente branch (salvo test straordinari). I push sono frequenti, quindi si può sempre tornare indietro.
- **L'handoff è l'unico vero raccordo** fra le due persone. Deve bastare da solo, senza bisogno di chiedere spiegazioni.

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
**Per chi riprende:** <l'altra persona>

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

### 5. Conferma all'utente
Riporta in modo sintetico:
- Il nome del nuovo file di handoff creato.
- Quali eventuali handoff vecchi sono stati cancellati.
- I file di handoff attualmente presenti (massimo 3).

## Nota
La cartella di lavoro degli handoff è **`archivio-documenti/handoff/`**. Il file più recente è sempre quello da leggere per primo quando si riprende il lavoro.
