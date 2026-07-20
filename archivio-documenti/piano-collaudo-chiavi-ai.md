# Piano di collaudo — AI con chiavi reali (V4 chat + motore V5)

> Documento operativo per il collaudo dell'AI **quando sono configurate le chiavi vere** OpenAI/Anthropic. Nato il 20/7/2026 (Jacopo). Si spunta man mano (`- [ ]` → `- [x]`) e si annota ogni anomalia sotto il test.

## Premesse (leggere prima)

- **Chi configura le chiavi:** serve un utente con ruolo **Superadmin** del workspace (senza, la schermata Impostazioni Agency è in sola lettura e il pulsante "Salva" è grigio). ⚠️ Gli utenti demo noti (Admin `giulia.ferrari`, Manager `marco.russo`, Operativo `sara.colombo`, Viewer `elena.bianchi`, password `demo123`) **non** includono un Superadmin: **prima del collaudo va identificato/creato l'utente Superadmin** (probabile via `PLATFORM_ADMIN_EMAILS` nel `.env`, es. `info@advaiora.com`). Da chiarire.
- **Ambiente:** dev server API (4000) + frontend (5173), **una sola sessione accesa** per volta (regola CLAUDE.md, lock DLL Prisma).
- **Costi reali:** ogni test consuma **credito vero** sui provider. Dove possibile usare i modelli economici (**gpt-4o-mini** / **Claude Haiku**); tenere il potente (Opus / GPT-5) solo per i test mirati sul selettore.
- **Doppio provider:** per collaudare davvero il multi-provider, inserire **entrambe** le chiavi (OpenAI + Anthropic).
- **Legenda esito:** ✅ ok · ⚠️ ok con riserva (annota) · ❌ fallito (annota errore + screenshot/log).

---

## 1. Configurazione chiavi (Impostazioni Agency)

Rotta: **`/agency/settings`** → Sidebar → Agency → Impostazioni Agency. Utente Superadmin.

- [ ] **1.1 — Salvataggio chiave OpenAI.** Incolla la chiave nel riquadro "API key OpenAI" → attiva "Abilita generazioni AI" → Provider = OpenAI → Salva. **Atteso:** tile "API key" = *Presente*, origine *"CRM backend cifrato"*; tile "AI generativa" = *Configurata*; messaggio di successo.
- [ ] **1.2 — Salvataggio chiave Anthropic.** Idem nel riquadro "API key Anthropic (Claude)". **Atteso:** stato provider-aware coerente.
- [ ] **1.3 — Chiave write-only.** Ricarica la pagina. **Atteso:** i campi "Nuova API key" sono **vuoti** (la chiave non viene mai rimostrata); lo stato resta *Presente*.
- [ ] **1.4 — Salvataggio senza toccare la chiave.** Cambia solo un altro campo (es. timeout) e salva col campo chiave vuoto. **Atteso:** la chiave **resta** invariata (non si perde).
- [ ] **1.5 — Cifratura a riposo.** Verifica sul DB che il valore in `AgencyRuntimeSetting` sia cifrato (`ciphertext`/`iv`/`authTag` valorizzati, nessuna chiave in chiaro).
- [ ] **1.6 — Rimozione chiave (comportamento attuale).** Spunta "Rimuovi la API key salvata nel CRM" per un provider e salva. **Atteso:** quel provider torna *Assente*; l'altro resta *Presente*. *(Nota: in V5 questo diventerà un pulsante "Cancella permanentemente…" con selettore provider.)*
- [ ] **1.7 — Permesso negato.** Entra con un utente **non** Superadmin. **Atteso:** avviso "Accesso in sola lettura…", campi disabilitati, pulsante Salva grigio; l'API `PUT /agency/settings/runtime` risponde 403.

---

## 2. Chat AI collaborativa — risposte nei tre ambiti

Popup chat dalla topbar. Ripetere per **Generale**, **Cliente**, **Progetto**.

- [ ] **2.1 — Risposta ambito Generale.** Scrivi una domanda + `@AI` (o pulsante). **Atteso:** l'assistente risponde; sparisce l'avviso "AI non configurata"; il pulsante di invio è attivo.
- [ ] **2.2 — Risposta ambito Progetto.** In una chat di progetto con Fonti. **Atteso:** risposta pertinente al progetto.
- [ ] **2.3 — Risposta ambito Cliente.** **Atteso:** risposta che considera i progetti del cliente.
- [ ] **2.4 — Turni di gruppo.** In una sessione con ≥2 partecipanti, scrivi **senza** `@AI`. **Atteso:** l'AI **non** risponde. Poi con `@AI`/pulsante **risponde**.
- [ ] **2.5 — "AI risponde da sola quando sei solo".** In una sessione con **un solo** partecipante attivo, scrivi un messaggio normale. **Atteso:** l'AI risponde a ogni messaggio (senza `@AI`); un solo tasto "Invia".
- [ ] **2.6 — Autore corretto.** **Atteso:** ogni bolla mostra l'autore giusto; le risposte AI sono marcate come assistente.

---

## 3. Selettore del modello AI (per sessione)

- [ ] **3.1 — Provider senza chiave disabilitati.** Con solo OpenAI configurato, apri il selettore. **Atteso:** i modelli Anthropic risultano **disabilitati** con "(chiave non configurata)".
- [ ] **3.2 — Entrambi disponibili.** Con entrambe le chiavi. **Atteso:** modelli OpenAI **e** Anthropic selezionabili.
- [ ] **3.3 — Il modello scelto risponde davvero.** Scegli un modello Anthropic (es. Sonnet) in una sessione e invia. **Atteso:** la risposta è generata da quel modello/provider (verifica nel registro consumi, area 7).
- [ ] **3.4 — Scelta condivisa e persistente.** Cambia modello, ricarica / fai entrare un altro partecipante. **Atteso:** la scelta resta (salvata a DB, colonna `model`).
- [ ] **3.5 — Fallback modello non disponibile.** Scegli un modello Anthropic, poi rimuovi la chiave Anthropic. **Atteso:** all'invio si ricade sul modello di default senza errori bloccanti.
- [ ] **3.6 — ⚠️ Id modello `gpt-5`.** Seleziona GPT-5 e invia. **Atteso:** risponde. **Se dà "modello inesistente"**, l'id nel catalogo (`agency.service.ts:2257`) va corretto con quello reale del provider (fix di una riga). Verificare anche gli id Anthropic (`claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`), attesi allineati.

---

## 4. Allegati alla chat (l'AI ne legge il contenuto)

- [ ] **4.1 — Documento caricato.** Allega un PDF/DOCX/TXT e chiedi qualcosa sul suo contenuto. **Atteso:** l'AI usa il testo estratto.
- [ ] **4.2 — Entità Progetto/Cliente.** Allega un progetto o cliente. **Atteso:** l'AI risponde sui dati snapshot dell'entità.
- [ ] **4.3 — Fonte / Preventivo (#3).** Da tasto destro → "Allega a una chat…" → "Allega qui". Chiedi sul contenuto. **Atteso:** l'AI legge lo snapshot di fonte/preventivo.
- [ ] **4.4 — Troncamento 6k.** Allega un documento lungo (>6.000 caratteri utili). **Atteso:** l'AI vede fino a ~6k con marcatore `[…estratto troncato]`; verifica che risponda su ciò che è dentro il limite.
- [ ] **4.5 — Allegati dei turni precedenti.** Dopo alcuni turni, verifica che gli ultimi 3 allegati restino nel contesto.

---

## 5. RAG — Fonti vettorizzate (grounding + citazioni)

- [ ] **5.1 — Risposta "grounded" su Progetto.** In un progetto con Fonti indicizzate (pgvector), fai una domanda coperta dalle fonti. **Atteso:** risposta basata sulle fonti, con **citazioni**.
- [ ] **5.2 — Ambito Cliente multi-progetto.** **Atteso:** il RAG pesca dalle fonti di **tutti** i progetti del cliente.
- [ ] **5.3 — Domanda fuori fonti.** Chiedi qualcosa non presente nelle fonti. **Atteso:** l'AI non inventa (nessuna citazione falsa).

---

## 6. Compressione contesto + navigazione suggerita

- [ ] **6.1 — Sessione lunga.** Porta una sessione oltre ~45% della finestra del modello (molti messaggi). **Atteso:** il contesto vecchio viene riassunto (piccolo caricamento), la qualità resta stabile, la coda recente è integra.
- [ ] **6.2 — Riassunto a budget.** **Atteso:** la chiamata di riassunto è loggata; se manca budget, prosegue con la sola coda senza crashare.
- [ ] **6.3 — Navigazione suggerita.** Fai una richiesta che porta a un'area del CRM. **Atteso:** compaiono **bottoni** di navigazione; navigano **solo** al click (mai in automatico); rispettano i permessi (nessuna area vietata).

---

## 7. Consumi & budget

- [ ] **7.1 — Registro consumi scritto.** Dopo qualche interazione, apri "Consumi & costi AI" (Impostazioni Agency). **Atteso:** compaiono le chiamate con **modello/provider** corretti, per **dipendente/funzione**, e con `projectId`/`conversationId` dove pertinente.
- [ ] **7.2 — Costo per-modello.** Confronta una risposta con Haiku vs una con Opus. **Atteso:** costi diversi coerenti col modello usato.
- [ ] **7.3 — Budget giornaliero.** Imposta un budget basso per un dipendente e superalo. **Atteso:** le chiamate vengono **bloccate** (`assertWithinAiBudget`) con messaggio chiaro.
- [ ] **7.4 — Stima costo (badge).** Sui pulsanti AI principali (Discovery, Web, Ads). **Atteso:** il badge `AiCostEstimate` mostra un range coerente.

---

## 8. Multi-provider

- [ ] **8.1 — OpenAI end-to-end.** Una generazione completa con provider OpenAI.
- [ ] **8.2 — Anthropic end-to-end.** Una generazione completa con provider Anthropic (Messages API, `x-api-key`).
- [ ] **8.3 — Modelli per funzione.** Imposta (casella "Modelli per funzione", JSON) un modello diverso per una funzione specifica. **Atteso:** quella funzione usa quel modello.
- [ ] **8.4 — Default di ripiego.** Una chiamata che non specifica modello (es. indicizzazione Fonti). **Atteso:** usa il default di workspace.

---

## 9. Discovery / verticali (motore V5)

- [ ] **9.1 — Business Recap** su RAG reale. **Atteso:** generazione coerente con le fonti.
- [ ] **9.2 — Obiettivi/Target.** **Atteso:** idem.
- [ ] **9.3 — Offerta/Competitor.** **Atteso:** idem; se la ricerca competitor è attiva, competitor reali (nessun dato finto se il provider non risponde).
- [ ] **9.4 — Readiness.** **Atteso:** i badge di prontezza riflettono le fonti indicizzate.

---

## 10. Casi di errore (robustezza)

- [ ] **10.1 — Chiave errata (401).** Inserisci una chiave non valida e invia. **Atteso:** errore gestito e leggibile, nessun crash.
- [ ] **10.2 — Credito esaurito / quota.** (se riproducibile) **Atteso:** messaggio chiaro, nessun crash.
- [ ] **10.3 — Modello inesistente.** Vedi 3.6.
- [ ] **10.4 — Timeout.** **Atteso:** rispettato il timeout configurato, messaggio adeguato.
- [ ] **10.5 — Budget esaurito.** Vedi 7.3.
- [ ] **10.6 — AI non configurata.** Rimuovi le chiavi. **Atteso:** torna l'avviso "AI non configurata", pulsante di invio disabilitato; la chat resta usabile per i **messaggi tra persone**.

---

## 11. Realtime (websocket) — collaudo aperto V4 (non dipende dalle chiavi)

- [ ] **11.1 — Due client.** Due browser autenticati, stessa conversazione. **Atteso:** i messaggi (e le risposte AI) compaiono **in tempo reale** senza ricaricare.
- [ ] **11.2 — Fallback polling.** Simula caduta WS. **Atteso:** il polling riprende rapido come rete di sicurezza.
- [ ] **11.3 — Deploy.** In ambiente di produzione: verificare che l'hosting regga le connessioni persistenti (eventuali *sticky session*).

---

## Migliorie e correzioni emerse durante il collaudo

> Raccolte man mano; da affrontare **al termine** del collaudo.

- [ ] **Allegare un cliente anche senza progetti** (nota Jacopo, 20/7/2026). Oggi `assertEntityAttachable` ([agency.service.ts:2821](../server/modules/agency-os/agency.service.ts)) consente di allegare un cliente solo se esiste un progetto visibile con quel cliente come *principale* (`Project.clientId`) → un cliente **senza progetti non è allegabile**. Richiesta: poterlo allegare comunque (es. per farci domande in chat Generale). **Fattibile**, ma **non** rimuovere la regola e basta (creerebbe un buco privacy: si esporrebbe agli altri partecipanti un cliente che l'utente non dovrebbe vedere); va **sostituita** con *"cliente allegabile se l'utente lo vede nella lista Clienti"* (permesso `clients.view` + eventuale scoping). Prima di implementare, verificare la regola di visibilità reale dei clienti.

## Esito complessivo

- Data collaudo: __________  · Eseguito da: __________
- Provider testati: ☐ OpenAI ☐ Anthropic
- Bloccanti aperti: __________
- Note: __________
