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

## Regole di scrittura degli handoff

- Linguaggio **chiaro e semplice**, niente sigle o nomi "in codice" non spiegati.
- **Nessun report didattico**: l'handoff riporta solo cosa è stato fatto, dove ci si è fermati e come ripartire — mai "cose imparate" su meccaniche base di programmazione.

## Stack tecnico (sintesi)

- **Frontend:** React 19 + Vite + React Router 5 + Redux + Bootstrap 5/tema Jampack + Tailwind 3 + SCSS.
- **Backend:** Node + Fastify 5 (TypeScript via `tsx`), Zod.
- **Database:** PostgreSQL via Prisma 6.
- Avvio e comandi: vedi `installazione-e-avvio.md`.

## Colori e temi (chiaro/scuro) — regola d'oro

Il tema è un sistema globale a token (variabili CSS) in `src/styles/scss/globals.css`. Sviluppando qualsiasi pagina/componente: **usa sempre i token `var(--…)` o i componenti Bootstrap standard, mai colori scritti a mano** (`#hex`/`rgb`/`rgba`), nemmeno negli stili inline in JSX. Così chiaro e scuro funzionano da soli, senza ritocchi pagina per pagina. Riferimento completo dei token: `archivio-documenti/design-system-temi.md`. Controlli automatici sui moduli: `npm run lint:css` (file CSS) e `npm run lint:colors` (stili inline in JSX).
