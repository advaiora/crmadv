---
description: Genera l'handoff di staffetta (Jacopo ⇄ Claudio) e tiene solo le ultime 3 versioni
allowed-tools: Bash(date:*), Bash(ls:*), Bash(rm:*), Read, Write, Glob
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

## Cosa fare, passo per passo

### 1. Ricostruisci cosa è stato fatto in questa sessione
Ripercorri la conversazione e le modifiche reali (file toccati, decisioni prese, eventuali commit). Se serve, controlla lo stato git e i file modificati.

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
<Elenco chiaro e sintetico di ciò che è stato fatto in questa sessione. Frasi semplici. Per ogni cosa, spiega in una riga il "perché" se non è ovvio. Se hai toccato dei file, dì quali e cosa fanno in parole povere.>

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
