# Consegna alla sessione del piano di settembre — 17 agosto 2026, ore 14:40

> ## ⚠️ QUESTO NON È UN HANDOFF. Non far ripartire una sessione da qui.
>
> Gli handoff normali stanno in `archivio-documenti/handoff/` e servono a far **riprendere** il lavoro a chi arriva dopo. **Questo documento fa il contrario**: chiude un flusso e lo **versa dentro un altro già in corso**.
>
> **Destinatario:** la sessione che sta scrivendo il **piano della release di settembre 2026** (Parte Seconda di `decisioni-cliente-e-menu-2026-08-07.md`). Da lì in avanti il lavoro prosegue **in una sola sessione**: questa è chiusa e non riprenderà.
>
> **Decisione di Jacopo (17/8/2026):** il lavoro in parallelo su due sessioni finisce qui. Tutte le informazioni aggiornate confluiscono nella sessione di settembre, che diventa **l'unico flusso**.
>
> Se sei una sessione nuova e stai leggendo questo file per sbaglio: **non è il tuo punto di partenza**. Leggi l'ultimo file in `archivio-documenti/handoff/`, e sappi che il lavoro vero prosegue sul piano di settembre.

---

## 1. Cosa sapevano l'una dell'altra le due sessioni — e perché non bastava

Il parallelismo è stato **gestito, non subito**, ma la consapevolezza era **asimmetrica e in ritardo**, ed è il motivo per cui Jacopo lo chiude:

- **La sessione di settembre sapeva di questa.** Al §7 del suo documento ha scritto: *«Cinque file risultano modificati e non committati — sono di una sessione parallela attiva in questo momento, che li committerà da sé. Non toccarli.»* Corretto: erano i miei, e li ho committati io.
- **Questa sessione ha scoperto quella tardi**, e per caso: un `git add -A` ha inglobato 154 righe scritte da lei mentre lavoravo. È così che ho letto il piano di settembre — **non perché qualcuno me l'avesse detto**.
- **Conseguenza concreta del ritardo:** ho costruito un piano completo della **fase B del re-naming** (due esploratori, ~50 minuti di ricognizione) **prima** di sapere che il piano di settembre la mette esplicitamente fuori perimetro (§7.6). Il piano non è sprecato — resta valido per dopo la consegna — ma è lavoro fatto contro una priorità già decisa e non ancora comunicata.

**La lezione da portare nell'unico flusso:** due sessioni che si accorgono l'una dell'altra *leggendo i file* si accorgono sempre **troppo tardi**, cioè a lavoro già fatto.

---

## 2. Cosa è stato chiuso qui — con i commit

Tre commit su `main`. ⚠️ **Vedi §6: al momento della scrittura solo il primo è sul remoto.**

### `7e7cb07` — i nove rilievi della fase A2 («Ruoli e permessi»)

La revisione del 7/8 aveva lasciato otto rilievi aperti; sono chiusi tutti, più i due punti che Jacopo aveva chiesto di annotare.

**Sei descrizioni di permessi promettevano meno del potere reale** — riscritte dopo un censimento delle rotte:

| Chiave | Cosa governa DAVVERO |
|---|---|
| `clients.edit` | anche i **campi personalizzati** e le **integrazioni**: salvare/eliminare la **chiave API di Brevo** e sincronizzare i clienti verso l'esterno |
| `team.deactivate` | disattivazione, **riattivazione** e **rimozione** (quest'ultima con un secondo cancello nel service: solo Superadmin) |
| `quotes.accept` | anche il **rifiuto** |
| `quotes.send` | anche **annulla invio** e **reinvia** |
| `quotes.manage_templates` | anche i **testi delle email** (serve pure solo per leggerli) e le **metriche** |
| `checklists.complete_item` | **avvia** il memo sul progetto, riapre le voci e le segna «non applicabili» |

**Tre commenti dicevano il falso**, corretti: `checklists.edit` non è affatto «in disuso» (`dashboard.policies.ts` la legge per decidere il livello della Dashboard); le descrizioni dei ruoli non sono «testo mostrato» ma dato scritto e **mai riletto da nessuna query**; il catalogo accorcia *Gestione Moduli* e *Branding Workspace* di proposito.

**Verificato che le descrizioni arrivano davvero a schermo:** l'upsert riscrive `description` anche in `update`, quindi si propagano da sole al prossimo `/auth/me`. **Nessuna migrazione dovuta.**

### `39167f7` — il piano della fase B *(lavoro per DOPO la release)*

`archivio-documenti/piano-fase-B-renaming-tecnico.md`. **Nulla eseguito.** Tre cose che valgono comunque:
1. **La divisione «B1 frontend / B2 backend» della roadmap non è eseguibile:** il backend dichiara **94 rotte** `/agency/...` e il frontend ne chiama 50 — sono le due metà dello stesso indirizzo. Va diviso **per asse**, non per lato.
2. **Manca il prerequisito:** nessun nome tecnico è mai stato deciso.
3. **Il nodo con Claudio è solo la migrazione**, cercato apposta e non smentito. E la migrazione è più semplice del previsto: `Permission` ha `key` unica globale e `RolePermission` collega **per identificativo**, quindi un `UPDATE` tocca ~72 righe e **nessun ruolo perde niente**, personalizzati compresi.

### `a668a5c` — la fase A è chiusa davvero

Le tre code passate in rassegna con Jacopo oggi: il pulsante *«Genera report»* nella vista tecnica **resta com'è** (deciso, non riaprire); la verifica della barra schede **sul telefono** sotto i 768px è **rimandata a tempo debito** — è l'**unica cosa della fase A ancora da fare**, ed è una verifica a schermo; le *«eventuali rifiniture»* erano una porta lasciata aperta, **non un arretrato**: nessuna, voce chiusa.

---

## 3. ⚠️ Correzioni e informazioni PER IL PIANO DI SETTEMBRE

Questa è la parte che serve davvero. Quattro punti.

### 3.1 Un'imprecisione nel §7.6 — da correggere

Il §7.6 mette fuori perimetro *«l'italianizzazione residua già censita in roadmap (stati mostrati in inglese crudo, alcune tendine, parole isolate)»*. **Quella lista è già stata eseguita il 7/8/2026** — sono le sei voci chiuse dai commit `7cf5cd9`, `4bf2635`, `745be46`, `b363804`, `75131ef`.

Sembra letta dall'elenco originale dentro il blocco richiudibile della roadmap, senza vedere la tabella che sopra lo dichiara chiuso. **Non cambia il perimetro** (quelle aree sono fuori comunque), ma è un riferimento a lavoro inesistente dentro un documento che ha priorità assoluta.

### 3.2 «Ruoli e permessi» è una delle sei aree della release: ecco cosa resta aperto

Il piano la dà come *«quasi chiusa dal re-naming»*. Vero, e oggi è migliorata ancora. **Ma due punti dell'audit restano aperti e sono dentro il perimetro**, quindi vanno valutati esplicitamente prima di dichiararla al 100%:

- **I pulsanti che fanno spendere l'AI non controllano `ai_production.generate`** (roadmap, voce «fuori perimetro dell'audit», punto 8). Otto chiamate partono da pulsanti sempre visibili: chi non può generare vede un 403 invece di un pulsante spento. ⚠️ **Attenuante forte per la release:** la Produzione AI è fra i moduli **nascosti al lancio**, quindi il difetto non si vede — ma è dentro l'area «Ruoli e permessi» come qualità del controllo permessi.
- **Manca un test tabellare** «questa rotta chiede quel permesso» sulle rotte dell'area (punto 10). I Siti in gestione ce l'hanno. È il posto dove un test costerebbe poco e varrebbe molto — e ha attinenza diretta col **«controllo automatico dei permessi, metà 1»** che il piano mette al passo 3 di §7.5.

### 3.3 Un difetto di permessi trovato oggi — non blocca la release, ma va saputo

**`checklists.complete_item` scavalca `checklists.override_gate`.** Il permesso copre anche il marcare una voce **«non applicabile»**, che è uno **stato terminale**; il cancello di avanzamento cerca solo gli stati *incompleti*. Quindi chi ha `complete_item` può far passare un progetto in uno stage gated **senza avere il permesso nato apposta per quello**. L'audit registra solo le voci critiche, quindi sulle altre non resta traccia.

**Perché non blocca:** i **Memo Operativi sono fuori perimetro** (nascosti al lancio). **Perché va saputo comunque:** è un permesso che ne scavalca un altro, ed è annotato in roadmap (voce 11) con le tre strade possibili. **Non risolto di proposito:** è una scelta di prodotto di Jacopo, non un difetto tecnico da correggere d'iniziativa.

### 3.4 Tre permessi fanno da ombrello — contesto utile per il «controllo automatico dei permessi»

`clients.edit`, `quotes.manage_templates` e `checklists.complete_item` coprono funzioni che non hanno una voce propria (dettaglio in roadmap, voce 11). È **il ripiego che `CLAUDE.md` §① vieta per il codice nuovo**. Rilevante per il passo 3 di §7.5: se si costruisce un controllo automatico «ogni rotta ha il suo permesso», questi tre sono i casi che lo faranno inciampare.

⚠️ Nota per **Clienti**, che è area di release: `clients.edit` governa anche la **chiave API di Brevo**. Chi configura i ruoli per la consegna deve sapere che dare «modifica anagrafica» dà anche le chiavi di un servizio esterno.

---

## 4. Cosa NON è stato fatto qui, e non va cercato

- **La fase B del re-naming**: pianificata, **non eseguita**, e correttamente fuori perimetro (§7.6). Il piano resta scritto per dopo la consegna.
- **La Parte Prima** di `decisioni-cliente-e-menu-2026-08-07.md` (arricchimento a livello cliente, riordino menu) **non è stata innestata in roadmap**. Era il punto 2 dell'handoff del 7/8, ed è rimasto lì: con la release che ha priorità, lo decide la sessione di settembre. **Unica eccezione già innestata:** il vincolo §4.4 (la fase B non deve toccare gli indirizzi che il riordino del menu sposterà), perché riguardava direttamente il re-naming.
- **Nessuna migrazione** è stata creata oggi. Il DB di sviluppo è allineato.

---

## 5. Cosa ha toccato questa sessione — per non ricontrollare

**File modificati e committati:** `server/auth/rbac-catalog.ts`, `server/auth/rbac-catalog.unit.test.ts`, `server/modules/agency-os/routes/workspace-agency.route.ts`, `CLAUDE.md`, `archivio-documenti/03-roadmap-confronto-e-build.md`, `archivio-documenti/note-operative-ai.md` (nota #50 nuova), `archivio-documenti/consumi/registro-compiti.md`, e il nuovo `archivio-documenti/piano-fase-B-renaming-tecnico.md`.

**⚠️ `decisioni-cliente-e-menu-2026-08-07.md` NON è stato toccato da questa sessione**, ed è importante che lo sappia chi lo sta scrivendo: era finito per sbaglio in un commit mio (`git add -A`), **il commit è stato disfatto e rifatto senza di lui**, e il file è stato verificato **identico byte per byte** a una copia di sicurezza presa prima dell'operazione. Risulta ancora *«modificato e non committato»*, esattamente com'era. **Committalo tu.**

**Verifiche a fine lavoro:** 10 test del catalogo verdi · tipi a **233 = baseline** · descrizioni verificate a database dopo risincronizzazione forzata.

---

## 6. ⚠️ Stato del repository — leggi prima di committare

Al momento della scrittura, `main` locale è **avanti di due commit** rispetto a `origin/main` (fermo a `7e7cb07`). Se al tuo turno risultano già pushati, qualcuno l'ha fatto dopo.

**Ordine consigliato per te:** `git pull` (o verifica di essere allineato) → committa il tuo documento → push. Non serve nessun `rebase` complicato: i due lavori toccano **file diversi**.

**Registro compiti:** la riga annotata oggi riporta una durata di **232h**, che è falsa — il registro misura dall'ultima annotazione, che è del 7/8. Il **consumo** (47,9 unità) è invece attendibile. Non fidarti della colonna durata su sessioni distanti.

---

## 7. Server e ambiente

**Tutti i server sono stati spenti alla chiusura di questa sessione**, comprese le porte 4000 e 5173 che **Jacopo aveva avviato a mano** durante la conversazione (me l'aveva segnalato apposta). Alla consegna di questo documento: **nessun processo di questa sessione resta acceso**.

Se al tuo turno trovi le porte occupate, **non sono mie**.

---

## 8. Una cosa personale da riferire a Jacopo, che non riguarda il codice

Il §7.7 del piano di settembre annota che **la password della casella di posta è transitata in chat** e suggerisce di valutare di cambiarla dopo la configurazione. Non è in nessun file del repository — verificato da chi l'ha scritto. **Vale la pena che non si perda** fra i punti aperti: è l'unica voce di quell'elenco che riguarda una credenziale vera e non una scelta di prodotto.
