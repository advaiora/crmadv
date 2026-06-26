# Handoff — Punto di ripresa

> Documento per riprendere il lavoro esattamente da dove è stato interrotto.
> Viene **sovrascritto** ad ogni richiesta di aggiornamento handoff.
> Ultimo aggiornamento: 26 giugno 2026

## Dove siamo

Completata la fase di **analisi, pianificazione strategica e impostazione collaborativa**. Nessuna modifica al codice applicativo: finora **solo documentazione**.

Fatto finora:
1. ✅ Analizzato lo stato attuale del codice → `01-brief-stato-attuale-pre-revisione-apple-style.md`.
2. ✅ Acquisita la visione target ("bibbia") → `02-brief-operativo-definitivo-bibbia.md`.
3. ✅ Prodotto confronto + roadmap versionata V1→V10 → `03-roadmap-confronto-e-build.md`.
4. ✅ Creato archivio `archivio-documenti/` + indice `README.md`, committato/pushato su `main`.
5. ✅ Rinominato il brief stato attuale aggiungendo "pre-revisione-apple-style" (è la fotografia *prima* dell'allineamento alla bibbia).
6. ✅ Discusso lo **stratagemma per il binomio operativo Jacopo + Claudio** (vedi sotto).

## Team

Due persone sul progetto: **Jacopo** e **Claudio**. Serve un metodo di lavoro a due che eviti conflitti e tenga allineate anche le due sessioni AI.

## Scoperte chiave da non perdere

- Il **motore AI non è assente**: in `server/modules/agency-os/agency.service.ts` esistono già chiamate reali a OpenAI (Responses API + fallback chat/completions), ingestione Word/PDF (`mammoth`/`pdf-parse`), competitor web-search e config multi-modello con stima costi.
- **Manca il cuore RAG**: nessuna vettorizzazione/embeddings/pgvector, nessun provider **Claude/Anthropic**, nessuna **chat di progetto**, nessun **Higgsfield**, nessun **budget token per dipendente**. → Sul motore AI si parte dal ~40%, non da zero.
- UI su template **Jampack/Bootstrap** con molte pagine demo non pertinenti → da ripulire in V1.
- Fondamenta solide da mantenere: multi-tenant, RBAC, clients, projects+pipeline, checklists+gate, quotes, calendar, messaging, vault, web-assets, audit, branding.
- Oggi i commit vanno **dritti su `main`** (rischioso in due).

## PROSSIMA MOSSA (cosa fare all'inizio della prossima sessione)

**All'apertura della prossima sessione: riproporre a Jacopo lo stratagemma per il binomio operativo, e chiudere con la stessa domanda finale qui sotto.** Di seguito il contenuto da riformulare.

### Stratagemma binomio operativo Jacopo + Claudio (da riproporre)
1. **Divisione per modulo/verticale, non per layer** — ognuno possiede un modulo dal DB alla UI (il codice è già isolato in `server/modules/<x>` + `src/modules/<x>`). Meno conflitti git.
2. **Feature flag = dark launch** — `workspaceModules` permette di mergere su `main` codice incompleto a flag spento, senza rompere nulla. Niente branch giganti.
3. **`main` sempre verde via PR reciproci** — basta passare da "commit diretto su main" a branch `feat/<modulo>` + PR che l'altro revisiona (in due la review incrociata è il miglior QA).
4. **`CLAUDE.md` come contratto condiviso** — convenzioni in root + puntatore a `archivio-documenti/` (bibbia = fonte di verità) così le due sessioni AI restano allineate; `HANDOFF.md` fa da staffetta.

### Split suggerito dei 10 build (modificabile)
- **V1 (shell Apple) insieme** (fondamento condiviso).
- Binario **"Esperienza & Verticali"**: V5 Web&ADV, V6 Laboratorio, V7 Preventivatore, V8 Calendario.
- Binario **"Motore & Dato"**: V2 Governance, V3 Custom Fields/Integrazioni, V4 AI core, V9 Finance.
- **V4 (motore AI/RAG) in coppia** — è il pezzo più pesante ed è prerequisito di V5 e V6.

### DOMANDA FINALE da riproporre testualmente
> Vuoi che lo materializzi subito? Posso, in un colpo solo:
> 1. Creare il **`CLAUDE.md`** con convenzioni + riferimento alla bibbia/roadmap;
> 2. Impostare la **strategia branch** (e, se vuoi, una proposta di `.github` con template PR);
> 3. Convertire la roadmap in una **checklist operativa** (o issue GitHub) con l'assegnazione Jacopo/Claudio per build.

## Opzioni di sviluppo ancora aperte (dopo l'impostazione collaborativa)

1. **Esplodere la V1 in task operativi** — backlog della build "Foundation & Apple-Style Shell".
2. **Esportare i documenti in Word/PDF brandizzato** — per condivisione in riunione.
3. **Approfondire il gap del motore AI (V4)** — piano tecnico vettorizzazione/pgvector + provider Claude + architettura RAG.

> **Stato decisione:** in attesa di scelta dell'utente.

## Riferimenti rapidi

- Indice archivio: `archivio-documenti/README.md`
- Stato attuale (pre-revisione Apple-style): `archivio-documenti/01-brief-stato-attuale-pre-revisione-apple-style.md`
- Visione target (bibbia): `archivio-documenti/02-brief-operativo-definitivo-bibbia.md`
- Roadmap V1→V10: `archivio-documenti/03-roadmap-confronto-e-build.md`
- Setup locale: `installazione-e-avvio.md` (root)
- Motore AI esistente: `server/modules/agency-os/agency.service.ts`
- Schema DB: `prisma/schema.prisma`
