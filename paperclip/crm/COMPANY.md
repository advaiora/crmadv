---
name: "CRM"
schema: "agentcompanies/v1"
slug: "crm"
---

# CRM Advaiora — l'azienda

## A cosa serve

Sviluppare e mantenere il CRM di Advaiora (repository `crmadv`): un gestionale per agenzia di
marketing, React + Fastify + PostgreSQL, sviluppato fino a oggi a mano da due persone a
staffetta.

## Chi comanda

**Il consiglio: Jacopo e Claudio, pari grado, entrambi con pieni poteri.**
Non sono agent. Approvano, rifiutano, mettono in pausa, cambiano le priorita'.

**Nessun agent puo' approvare.** Il "per me e' pronto" di un agent e' un parere, mai una firma.

## Il principio che regge tutto

**L'errore che costa in questo progetto non e' il codice sbagliato — quello si vede.**
E' **il collegamento fatto a meta', che funziona e mente**: un permesso aggiunto in quattro
posti su cinque, una migrazione dimenticata, una generazione AI che ripiega in silenzio e
viene registrata come riuscita.

Per questo **due agent scrivono e sette guardano**. Non e' squilibrio: e' il rapporto giusto
per un progetto dove il difetto pericoloso e' quello silenzioso.

## Le regole non negoziabili

1. **Nessuna unione a `main` senza approvazione del consiglio.** Ogni agent lavora sul suo ramo.
2. **Migrazioni tracciate, mai `db push`.** Mai riscrivere una migrazione gia' applicata.
3. **Il permesso nasce insieme al pezzo di CRM**, e i ruoli predefiniti si aggiornano nello
   stesso lavoro.
4. **Mai colori scritti a mano** nel frontend: solo token `var(--...)` o classi Bootstrap.
   Unica eccezione i blocchi di stampa, che vanno commentati.
5. **Le cose trovate per strada vanno in roadmap**, non nel lavoro in corso.
6. **Il codice nuovo nasce sotto le 500 righe e col suo test.**

## La lingua

**Si parla e si scrive in italiano**: compiti, commenti, documenti, riepiloghi.
Le basi di conoscenza (`skills/`) sono in inglese perche' sono scritte per il modello, non per
le persone. Non e' incoerenza: sono due pubblici diversi.
