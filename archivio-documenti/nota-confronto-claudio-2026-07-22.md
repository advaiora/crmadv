# Nota per il confronto Jacopo ↔ Claudio — 22 luglio 2026

> Preparata a fine sessione di Jacopo. Raccoglie le questioni "da discutere insieme": una era **esplicitamente bloccata in attesa di Claudio** (Discovery), una è un **avviso** su un lavoro già fatto (Impostazioni AI), una è una **scelta di tooling** condivisa (ESLint). L'obiettivo è arrivare al confronto già informati, con opzioni e trade-off sul tavolo.

---

## 1. Discovery AI — grounding stretto vs ipotesi ragionate *(DECISIONE DI PRODOTTO — era bloccata in attesa di Claudio)*

> ### ⚡ AGGIORNAMENTO 22/7 (pomeriggio) — QUESTA DISCUSSIONE VA RIFORMULATA PRIMA DI DECIDERE
> Collaudando la Discovery su RAG con le chiavi reali è emerso che **l'AI non veniva usata**: con il provider di default (**Claude**) la generazione partiva e veniva **fatturata**, ma il suo output veniva **scartato in fase di parsing** e il sistema ricadeva in silenzio sulla **Discovery rule-based**. Quindi il *"Target non definito"* dell'esempio qui sotto **è quasi certamente il rilevatore rule-based, non l'AI** (che non arrivava mai a produrre le sezioni). Vedi il dettaglio tecnico nella **sezione 4**. **Conseguenza:** la scelta "grounding stretto vs ipotesi ragionate" va decisa **dopo** aver visto cosa produce *davvero* l'AI a JSON leggibile — non sull'output del fallback. Il bug della "fence" è già stato corretto; resta da decidere la robustezza JSON di Anthropic (sezione 4), da cui dipende poter osservare il comportamento reale dell'AI.

**Il fatto (emerso dal collaudo del 20/7).** Generando la Discovery di un progetto le cui fonti non esplicitano il *target*, l'AI lo marca **"non definito"** invece di **inferirlo** dagli indizi. Esempio reale: "fotografa di matrimoni a Torino" → l'AI *non* deduce "coppie in procinto di sposarsi in zona Torino", lo lascia vuoto.

**Perché succede (non è un bug).**
- Il system prompt della Discovery impone **grounding stretto**: `server/modules/agency-os/agency.service.ts:9327` (brief) e `:9631` (rigenerazione sezione) — *"Non inventare target, offerta, CTA, USP o dati di mercato non presenti."*
- Gli alert *"Target non definito / Offerta non chiara / USP non evidenti"* sono **rule-based** (controllano le "evidenze" nelle fonti), **non** prodotti dall'AI: `agency.service.ts:3922-3928`.
- È la **stessa scelta anti-allucinazione** che rende affidabili il RAG e la chat: lì è giusta.

**Le opzioni.**
- **A) Status quo** — grounding stretto ovunque. *Pro:* zero allucinazioni, output difendibile davanti al cliente. *Contro:* la Discovery "lavora poco", scarica sull'operatore anche le inferenze ovvie.
- **B) Allentare SOLO la Discovery** *(raccomandata)* — consentire un'**ipotesi ragionata** sui campi mancanti, marcata esplicitamente **"da validare"**. *Pro:* più valore da strategist, mantiene la trasparenza (l'utente sa cosa è ipotesi e cosa è fonte). *Contro:* il prompt va scritto bene perché l'ipotesi resti dichiarata e non "coli" nelle sezioni factual; il rilevatore rule-based va coordinato (se l'AI inferisce il target, l'alert "Target non definito" va riformulato in "Target inferito — da validare", non lasciato com'è).
- **C) Ibrido** — l'AI inferisce **solo dentro una sezione separata** ("Ipotesi da validare"), lasciando invariate le sezioni grounded. Più conservativo di B, meno integrato.

**Cosa cambierebbe nel codice (per B/C).**
- I due system prompt (`agency.service.ts:9327` e `:9631`): aggiungere una clausola del tipo *"Solo per la Discovery, quando un campo manca puoi proporre un'ipotesi ragionata dagli indizi delle fonti, marcandola esplicitamente come 'da validare'; non usarla come fatto acquisito."*
- Il rilevatore rule-based degli alert (`agency.service.ts:3922-3928`): decidere se l'alert diventa *"inferito, da validare"* quando l'AI ha prodotto un'ipotesi.

**Perché tocca a Claudio.** È **motore AI (V5)** e la scelta grounding-vs-inferenza è una decisione di prodotto condivisa. Jacopo ha chiesto di confrontarsi **prima** di procedere. Nessuna riga è stata toccata su questo.

---

## 2. Impostazioni AI Agency — ridisegno GIÀ FATTO (22/7): avviso, non richiesta

Il ridisegno della schermata `/agency/settings` (configurazione AI), proposto da Jacopo il 20/7, è stato **implementato in questa sessione**.

**Perché si è proceduto senza aspettare.** Verifica di attribuzione (regola staffetta): la schermata e **tutta** la sua configurazione AI sono lavoro di **Jacopo** (commit del 10, 13, 14, 20, 21 luglio — tutti giorni feriali; l'unico altro autore è il template base iniziale). Nessun conflitto con lavoro di Claudio → si è proceduto.

**Cosa è cambiato (per conoscenza):**
- **Stato "AI configurata"**: ora = *"abilitata + almeno un provider con chiave"* (prima guardava **solo** il provider di default → avere solo l'altra chiave risultava "non configurato"). In più `getAgencyAiStatusPayload` risolve il **provider effettivo** a uno che ha davvero la chiave, così una generazione non parte mai verso un provider senza chiave (niente 401 al posto del ripiego pulito). Il selettore per-sessione della chat resta invariato.
- **UI**: le tre box (AI generativa + le due chiavi) fuse in **un'unica box "Provider AI"** → un solo interruttore "Abilita generazioni AI"; **modello preferito** come menu a discesa (solo i modelli dei provider con chiave; il provider si sceglie dal modello, niente più id a mano); chiavi OpenAI/Anthropic affiancate con badge presente/assente; **pulsante** "Cancella permanentemente le chiavi API dal CRM" con selettore provider (al posto delle due checkbox ambigue). Etichetta "Salva impostazioni runtime" → "Salva impostazioni".
- **Nessuna migrazione, nessun cambiamento di schema.** `tsc` invariato (233 = baseline), lint verde, build ok.

**Punto di attenzione condiviso.** Il cambio di semantica di `configured` tocca il motore AI. Ho verificato i consumatori (le due `runAgency*WithMeta` fanno da gate `if (!configured) return null` e usano `status.provider`, ora effettivo → sicuro). Se Claudio ha da qualche parte l'assunzione *"configured = provider di default con chiave"*, vale una rilettura veloce insieme.

---

## 3. (minore, tooling) ESLint — adottare il ruleset "React Compiler"?

Attivato `npm run lint` (migrazione a flat config, 22/7). Si sono tenute **solo le regole hook classiche** (`rules-of-hooks` = error, `exhaustive-deps` = warn), fedeli all'intento storico. Il plugin `eslint-plugin-react-hooks` 7.x offre però un ruleset "React Compiler" molto più severo (`set-state-in-effect`, `immutability`, `static-components`, `use-memo`…): adottarlo farebbe emergere **molte** correzioni di massa sui moduli esistenti → è una **decisione condivisa**, da prendere insieme e non "di straforo". Finché non si decide, resta il set classico.

*(Collegato: è rimasto anche il tema delle "due librerie di icone" — react-feather vs Lucide — già tracciato nel debito tecnico della roadmap: altra scelta di prodotto da chiudere insieme.)*

---

## 4. Motore AI — generazioni JSON con Claude: fence CORRETTA, JSON non valido DA DECIDERE *(emerso dal collaudo Discovery del 22/7 — motore AI = territorio condiviso)*

**Il fatto.** Le generazioni JSON di Agency (Discovery brief/sezione, Web progetto/blocco, Ads asset) passano dal runner `runAgencyOpenAiJsonWithMeta` (`agency.service.ts`). Con il provider **Anthropic** il JSON è richiesto via system prompt e ripulito in parse; con **OpenAI** è forzato dalla modalità `json_object` (sempre valido). Collaudando la Discovery su RAG (progetto demo con fonti vettorizzate) è emerso che **con Claude il parse falliva sistematicamente** → `catch` → fallback rule-based, **con la chiamata AI comunque fatturata** (il log costi è scritto prima del parse).

**Causa 1 — cornice markdown (CORRETTA il 22/7).** `stripJsonCodeFence` usava un regex ancorato `^```…```$`: rimuoveva la cornice ```` ```json ```` **solo** se *tutta* la risposta era un unico blocco pulito. Claude quasi sempre aggiunge preambolo/coda o tronca la chiusura → la cornice sopravviveva → `JSON.parse` lanciava `Unexpected token '`'`. **Reso robusto** (rimuove la fence di apertura anche senza chiusura + isola l'oggetto/array JSON). Verificato: `tsc` 233 = baseline, unit **225/225**. Siccome il default del workspace è Claude, questo bug faceva fallire **quasi sempre** le generazioni JSON con Claude.

**Causa 2 — Claude a volte emette JSON sintatticamente non valido (DA DECIDERE, non toccata).** Dopo il fix della fence l'errore è cambiato in `Expected ',' or '}' at position 4168` su una risposta **completa** da 1067 token: è il JSON *contenuto* a essere malformato (tipico degli LLM su testo lungo con virgolette/apostrofi). Il ramo OpenAI non ha il problema (`json_object`).

**Opzioni (scelta di Jacopo il 22/7: rimandare a te, è motore AI condiviso).**
- **A) Structured output via tool-use (consigliata).** Nel ramo Anthropic, forzare la risposta come *tool call* (`tool_choice` obbligatorio, `input_schema` oggetto permissivo): l'API Anthropic garantisce JSON valido, come `json_object` per OpenAI. Robusto e definitivo. Tocca il ramo Anthropic del runner (+ estrazione dal blocco `tool_use` invece del testo).
- **B) Interim — modello OpenAI come default del workspace.** Sblocca Discovery/Web/Ads oggi (JSON forzato), spesa bassa, zero codice. Non risolve Claude.
- **C) Repair euristico del JSON** prima del fallback (fragile, sconsigliata).

**Perché tocca a te / da fare insieme.** È il **motore AI (V5)**, territorio condiviso; il ramo multi-provider Anthropic è codice di Jacopo del 10/7 ma la scelta di robustezza è architetturale. **E soprattutto** questa causa 2 va risolta **prima** di poter osservare il comportamento reale dell'AI sulla Discovery, da cui dipende la decisione della **sezione 1**. Posizioni codice: runner `agency.service.ts:3120` (ramo `anthropic` ~`:3165`), `stripJsonCodeFence` `:2452` (già corretto), parse `:3281`; catalogo funzioni JSON `AGENCY_AI_ESTIMATABLE_FUNCTIONS :2370`.
