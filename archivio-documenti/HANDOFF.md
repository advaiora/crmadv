# Handoff — Punto di ripresa

> Documento per riprendere il lavoro esattamente da dove è stato interrotto.
> Ultimo aggiornamento: 25 giugno 2026

## Dove siamo

È stata completata la fase di **analisi e pianificazione strategica** del CRM. In particolare:

1. ✅ Analizzato lo stato attuale del codice → `01-brief-stato-attuale-pre-revisione-apple-style.md`.
2. ✅ Acquisita la visione target ("bibbia") fornita dal team → `02-brief-operativo-definitivo-bibbia.md`.
3. ✅ Prodotto il confronto + roadmap versionata V1→V10 → `03-roadmap-confronto-e-build.md`.
4. ✅ Creato questo archivio (`archivio-documenti/`) e committato/pushato su `main`.

Nessuna modifica al codice applicativo è ancora stata fatta: finora **solo documentazione**.

## Scoperte chiave da non perdere

- Il **motore AI non è assente**: in `server/modules/agency-os/agency.service.ts` esistono già chiamate reali a OpenAI (Responses API + fallback chat/completions), ingestione Word/PDF (`mammoth`/`pdf-parse`), competitor web-search e config multi-modello con stima costi.
- **Manca però il cuore RAG**: nessuna vettorizzazione/embeddings/pgvector, nessun provider **Claude/Anthropic**, nessuna **chat di progetto**, nessun **Higgsfield**, nessun **budget token per dipendente**. → Si parte dal ~40% sul motore AI, non da zero.
- La UI è su template **Jampack/Bootstrap** con molte pagine demo non pertinenti (Blog, Gallery, FileManager, Invoices demo, Scrumboard, Todo, ecc.) → da ripulire in V1.
- Fondamenta solide e da mantenere: multi-tenant, RBAC, clients, projects+pipeline, checklists+gate, quotes, calendar, messaging, vault, web-assets, audit, branding.

## Prossima mossa (da decidere)

Erano state proposte tre opzioni. La prossima sessione dovrà sceglierne una:

1. **Esplodere la V1 in task operativi** — backlog dettagliato della build "Foundation & Apple-Style Shell" (design system, cleanup boilerplate, Command-K, shortcuts, personalizzazione utente), pronto da sviluppare.
2. **Esportare i documenti in Word/PDF brandizzato** — per condivisione in riunione.
3. **Approfondire il gap del motore AI (V4)** — piano tecnico su vettorizzazione/pgvector, provider Claude e architettura RAG.

> **Stato decisione:** in attesa di scelta dell'utente.

## Come riprendere

1. Leggere `README.md` dell'archivio per orientarsi.
2. Rileggere `03-roadmap-confronto-e-build.md` (Parte C) per la sequenza delle build.
3. Eseguire l'opzione scelta tra le tre sopra.

## Riferimenti rapidi

- Stato attuale (pre-revisione Apple-style): `archivio-documenti/01-brief-stato-attuale-pre-revisione-apple-style.md`
- Visione target (bibbia): `archivio-documenti/02-brief-operativo-definitivo-bibbia.md`
- Roadmap: `archivio-documenti/03-roadmap-confronto-e-build.md`
- Setup locale: `installazione-e-avvio.md` (root del progetto)
- Motore AI esistente: `server/modules/agency-os/agency.service.ts`
- Schema DB: `prisma/schema.prisma`
