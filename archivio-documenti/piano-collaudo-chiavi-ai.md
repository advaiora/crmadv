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
- [x] **4.6 — "Vista" multimodale immagini (Fase 3b).** ✅ Verificato **end-to-end il 21/7/2026** via script API (nota #29), su **entrambi** i provider con i modelli economici. Allegata `public/og-img.png` (screenshot dashboard) e chiesto di descriverla: **Haiku** e **gpt-4o-mini** hanno entrambi descritto il **contenuto reale** — grafico a barre, importi **$2249/$243.50**, "Welcome back", logo "Jampack", "4m 24s", voci sidebar — non il nome file. Prova che il percorso `collectPromptVisionImages → buildMultimodalMessages → API provider` funziona su Anthropic e OpenAI. Costo: frazione di centesimo. **Restano da provare a schermo (facoltativo):** i **casi limite** — un'immagine **> 4MB** o un **SVG/BMP** deve restare il solo segnaposto testuale (nessun crash), e il consumo nel registro (area 7) deve includere la stima token immagine (~1300/img).

---

## 5. RAG — Fonti vettorizzate (grounding + citazioni)

- [ ] **5.1 — Risposta "grounded" su Progetto.** In un progetto con Fonti indicizzate (pgvector), fai una domanda coperta dalle fonti. **Atteso:** risposta basata sulle fonti, con **citazioni**.
- [ ] **5.2 — Ambito Cliente multi-progetto.** **Atteso:** il RAG pesca dalle fonti di **tutti** i progetti del cliente.
- [ ] **5.3 — Domanda fuori fonti.** Chiedi qualcosa non presente nelle fonti. **Atteso:** l'AI non inventa (nessuna citazione falsa).

---

## 6. Compressione contesto + navigazione suggerita

> **Parte deterministica già verde (unit test, 21/7/2026):** il **parsing/gating della navigazione suggerita** (`chat-nav.test.ts`, 8/8: estrazione token `[[vai:chiave]]`, dedup, max 3, gating per modulo+permesso) e la **logica di compressione del contesto** (`chat-context.test.ts`, 7/7: soglia, coda minima garantita anche a budget zero, richiesta di riassunto). Resta da provare con l'AI vera la **generazione** (che il modello emetta davvero i token e che i riassunti mantengano la qualità).

- [x] **6.1 — Sessione lunga.** ✅ Verificato 21/7 (iniezione di 46 messaggi lunghi via DB — solo gli **ultimi 40** contano, `CONTEXT_FETCH_LIMIT` — ~64k token > soglia 57.6k di gpt-4o-mini): la compressione scatta, il contesto vecchio viene riassunto e la risposta gira sul contesto compresso (input 56.8k ≈ budget). Il **senso generale** resta, ma i **dettagli puntuali** dei messaggi riassunti possono perdersi (il riassunto era 160 token): trade-off fisiologico, non un difetto.
- [x] **6.2 — Riassunto a budget.** ✅ La chiamata di riassunto è loggata in `AiUsageLog` come `fn=chat.summary` (verificato 21/7). Costo reale del mini-test ~$0.045 (~€0.04). ⚠️ Il riassunto è girato su `claude-opus-4-8` invece che su Sonnet: vedi l'osservazione **"modello di default → Opus"** più sotto (impatto sui costi).
- [x] **6.3 — Navigazione suggerita.** ✅ Verificato con **AI vera** (Haiku, 21/7/2026) via `POST /agency/chat/general`. Alla domanda "dove aggiorno l'anagrafica di un cliente?" l'AI ha risposto e allegato **un solo bottone corretto**: `{key:"clienti", label:"Clienti", route:"/apps/clients"}`; nessun token `[[vai:]]` rimasto nel testo (parser ok). I bottoni sono CTA una tantum (non persistiti) e rispettano modulo+permesso dell'utente. *(La conferma che il click naviga — e mai in automatico — è lato UI: resta come check visivo.)*

---

## 7. Consumi & budget

- [ ] **7.1 — Registro consumi scritto.** Dopo qualche interazione, apri "Consumi & costi AI" (Impostazioni Agency). **Atteso:** compaiono le chiamate con **modello/provider** corretti, per **dipendente/funzione**, e con `projectId`/`conversationId` dove pertinente.
- [ ] **7.2 — Costo per-modello.** Confronta una risposta con Haiku vs una con Opus. **Atteso:** costi diversi coerenti col modello usato.
- [x] **7.3 — Budget giornaliero.** ✅ Verificato end-to-end il 21/7 (stesso test di 10.5): limite dipendente sotto il già-speso → la chiamata è bloccata prima del provider con messaggio chiaro. Nota: gli **override per-utente** vanno impostati da un utente **membro gestibile** del workspace (i platform-admin come `admin@test.com` non compaiono nella lista membri dei budget; il budget di default invece vale per tutti).
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
- [~] **10.3 — Modello inesistente.** Vedi 3.6. *(Non riproducibile "in negativo" dal client: lo schema del selettore accetta stringa libera ma il service ripiega sul default se il modello non è nel catalogo, quindi non arriva un id fasullo al provider. Gli id del catalogo sono già stati provati con esito positivo da Jacopo il 20/7 — Opus/Sonnet/Haiku e GPT-5/GPT-4o rispondono.)*
- [ ] **10.4 — Timeout.** **Atteso:** rispettato il timeout configurato, messaggio adeguato.
- [x] **10.5 — Budget esaurito.** ✅ Verificato **end-to-end** (21/7): impostato per un dipendente (giulia) un limite giornaliero sotto il già-speso, la chat successiva torna `budgetExceeded:true` e `aiInvoked:false` — cioè **bloccata prima di contattare il provider** (zero credito), con messaggio chiaro. La chat gestisce il blocco con **HTTP 200 + flag** (non un errore 4xx): vedi `sendScopedChatMessage` (agency.service.ts:8444). Confermata anche la logica isolata dal test `server/integration/ai-budget.smoke.ts` (limite override→default→nessuno, somma spesa odierna). *(Dettaglio cosmetico: con limiti sub-cent il messaggio arrotonda a "$0.00"; irrilevante coi budget reali in dollari.)*
- [ ] **10.6 — AI non configurata.** Rimuovi le chiavi. **Atteso:** torna l'avviso "AI non configurata", pulsante di invio disabilitato; la chat resta usabile per i **messaggi tra persone**.

---

## 11. Realtime (websocket) — collaudo aperto V4 (non dipende dalle chiavi)

- [x] **11.1 — Due client.** ✅ Verificato **lato server end-to-end** il 21/7/2026 (script a due client WS, non due browser): due utenti demo si connettono col biglietto, uno invia un messaggio interno e l'altro riceve il segnale `message.new` **in 103 ms**, con eco al mittente. Inclusa la **sicurezza del canale**: WS senza biglietto → chiuso `4001`, `Origin` non ammessa → `4003`, biglietto **monouso** (riuso → `4001`), `ping/pong` ok. Esito: **10/10**. *(La prova a due browser reali resta come conferma visiva opzionale; la sostanza — propagazione realtime a un secondo client — è dimostrata.)*
- [ ] **11.2 — Fallback polling.** Simula caduta WS. **Atteso:** il polling riprende rapido come rete di sicurezza. *(Da verificare a schermo: il gate è lato client — vedi nota #23 delle note operative.)*
- [ ] **11.3 — Deploy.** In ambiente di produzione: verificare che l'hosting regga le connessioni persistenti (eventuali *sticky session*).

---

## Migliorie e correzioni emerse durante il collaudo

> Raccolte man mano; da affrontare **al termine** del collaudo.

- [ ] **⚠️ COSTI: il modello di default del workspace usa Opus (il più caro) senza saperlo** (emerso 21/7/2026). Il default è `agency_ai_model = "sonnet 4.5"`, che **non inizia con `claude`**: `resolveAgencyProviderModel` ([agency.service.ts:2237](../server/modules/agency-os/agency.service.ts)) ci ripiega su `DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8"`. Prova dai log `AiUsageLog`: sia `discovery.generateBrief` (20/7) sia `chat.summary` (21/7) sono girati su `claude-opus-4-8`. **Impatto:** tutte le funzioni AI che usano il default (Discovery, riassunto del contesto, indicizzazione Fonti, ecc. — cioè quelle senza un modello di catalogo esplicito) pagano **Opus ($5/$25 per 1M token) invece di Sonnet ($3/$15): ~+67%** (e ~5× rispetto a Haiku). **Fix (config):** ✅ FATTO 21/7 — default corretto a `claude-sonnet-5`. **Miglioria di codice:** ✅ IMPLEMENTATA 21/7 — `saveAgencyRuntimeSettings` ora **rifiuta** (400) un modello fuori catalogo e controlla la coerenza provider/modello; `getAgencyRuntimeSettings` espone `availableModels`; in *Impostazioni Agency* il campo Modello è diventato un **select** alimentato dal catalogo e filtrato sul provider (niente più id digitati a mano). `resolveAgencyProviderModel` resta come rete di sicurezza. Verificato: backend 5/5 via API, frontend a schermo, `tsc` 233 = baseline. File: [agency.service.ts](../server/modules/agency-os/agency.service.ts), [AgencySettingsPage.jsx](../src/views/Agency/AgencySettingsPage.jsx).
- [ ] **Allegare un cliente anche senza progetti** (nota Jacopo, 20/7/2026). Oggi `assertEntityAttachable` ([agency.service.ts:2821](../server/modules/agency-os/agency.service.ts)) consente di allegare un cliente solo se esiste un progetto visibile con quel cliente come *principale* (`Project.clientId`) → un cliente **senza progetti non è allegabile**. Richiesta: poterlo allegare comunque (es. per farci domande in chat Generale). **Fattibile**, ma **non** rimuovere la regola e basta (creerebbe un buco privacy: si esporrebbe agli altri partecipanti un cliente che l'utente non dovrebbe vedere); va **sostituita** con *"cliente allegabile se l'utente lo vede nella lista Clienti"* (permesso `clients.view` + eventuale scoping). Prima di implementare, verificare la regola di visibilità reale dei clienti.

## Esito complessivo

- Data collaudo: __________  · Eseguito da: __________
- Provider testati: ☐ OpenAI ☐ Anthropic
- Bloccanti aperti: __________
- Note: __________
