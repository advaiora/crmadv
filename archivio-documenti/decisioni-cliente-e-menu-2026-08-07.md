# Decisioni del 7 agosto 2026 — arricchimento a livello cliente e riordino del menu
# + PIANO DELLA RELEASE DI SETTEMBRE 2026 (Parte Seconda, priorità assoluta)

> ## ⚠️ LEGGI PRIMA QUESTO — il documento contiene due cose, e la seconda viene prima
>
> - **Parte Prima (§1-§6)** — le decisioni di pianificazione del 7/8/2026 su arricchimento a livello cliente e riordino del menu. **Non è il lavoro in corso**: è il piano di medio periodo, da innestare in `03-roadmap-confronto-e-build.md`.
> - **Parte Seconda (§7 in fondo)** — il **piano della prima release del CRM, consegna settembre 2026**, definito il 17/8/2026. **Questa ha priorità assoluta su tutto il resto**, compresa la Parte Prima. Se stai riprendendo il lavoro e non sai da dove cominciare: **vai alla Parte Seconda.**
>
> La regola di priorità, dichiarata da Jacopo il 17/8/2026: la commessa di release batte qualunque altra pianificazione. Se dopo settembre arriveranno nuove direttive con una nuova scadenza di consegna, quelle avranno a loro volta priorità su tutto.

> **Cos'è la Parte Prima.** Certificazione precisa di tutto ciò che è stato deciso in una sessione di pianificazione tenuta il 7/8/2026, in parallelo a un'altra sessione che lavorava sulla fase A/A2 del re-naming (arrivata, a fine di quella conversazione, fino al commit `7465f12`). Non è ancora stata innestata in `03-roadmap-confronto-e-build.md` perché quel file risultava, al momento della scrittura, ancora con modifiche in corso da parte dell'altra sessione.
>
> Nulla della Parte Prima è stato eseguito nel codice. Un solo file era stato sfiorato (`src/layout/Sidebar/SidebarMenu.jsx`, rimozione di due voci ridondanti) e poi riportato **esattamente** allo stato originale — verificato con `git diff` a diff vuoto — dopo che Jacopo ha chiarito che la conferma di una decisione, in una conversazione di pianificazione, non è un via libera a scriverla subito nel codice. La decisione resta valida, va solo eseguita insieme al resto.

---

## 1. Il problema di partenza, con le due facce che lo compongono

Jacopo ha aperto la discussione segnalando due cose distinte, poi rivelatesi collegate:

**A — L'interfaccia del CRM è organizzata in modo poco intuitivo.** Tre sintomi indicati: collegamenti logici mancanti fra aree che dovrebbero parlarsi; una gerarchia dei moduli sbagliata (diversi moduli che oggi sono "alla pari" di altri dovrebbero essere pagine interne di un altro modulo); troppe informazioni sempre a schermo che, per la loro natura, dovrebbero stare dietro una linguetta o un pulsante dedicato, per rendere le pagine più pulite e leggibili.

**B — Il processo di arricchimento AI (Fonti, Brief, memoria) è ancorato al livello sbagliato.** Oggi tutto ciò che l'AI e l'utente imparano su un'azienda cliente si accumula dentro il *progetto* in Produzione AI, non dentro il *cliente*. Jacopo ha proposto di spostare l'ancoraggio al cliente, coi progetti che ereditano e specializzano; e ha notato che, di conseguenza, va rivista anche la UX del rapporto Clienti ↔ Produzione AI — cioè che B trascina dentro A.

Verifica di merito (non solo istinto): ispezionando `src/layout/Sidebar/SidebarMenu.jsx` e `prisma/schema.prisma` si è confermato che entrambe le osservazioni corrispondono a difetti reali, non a percezioni:
- Su 15 righe di primo livello nel menu, almeno 6 sono nel posto sbagliato per natura (config sparsa in tre gruppi diversi; Reparti sotto Sicurezza invece che con Team; strumenti di sviluppo — Theme Preview, Responsive QA — esposti nel menu dell'utente finale; azioni come "Nuovo Cliente"/"Nuovo Preventivo" trattate come destinazioni di navigazione).
- Nello schema dati, tutto ciò che è "di qualcuno" è già ancorato al `Client` (siti, credenziali, preventivi, perfino le conversazioni AI con `scope: 'client'`) **tranne** `ProjectMemory`, `ProjectSource` e i relativi embedding vettoriali, che sono ancorati solo al `Project`. L'unico strato del prodotto senza il cliente come riferimento è proprio quello dove si accumula la conoscenza.

---

## 2. Blocco 1 — Il modello dati: cosa sale dal progetto al cliente

### 2.1 Cosa appartiene al cliente
**Deciso:** il cliente riceve i **materiali** (le Fonti: documenti, URL, testi caricati) più il **ritratto stabile dell'azienda** (chi sono, come parlano, il loro mercato). Restano al progetto l'obiettivo specifico e tutto ciò che è stato prodotto (contenuti, campagne, task, alert, opportunità).

*Scartate:* portare solo i materiali senza il ritratto (guadagno parziale, il ragionamento si rifà comunque da capo ogni volta); portare tutto, inclusa la memoria di quanto prodotto (confonde di nuovo "quello che è vero dell'azienda" con "quello che è vero di questo lavoro", oltre a rischiare un contesto enorme e costoso per l'AI).

### 2.2 La linea, sezione per sezione
Le otto sezioni del Brief oggi compilate a livello di progetto (`src/views/Agency/project/AgencyProjectDiscoveryPage.jsx`) si dividono così:

| Sezione | Livello |
|---|---|
| Contesto business | **Cliente**, piena proprietà |
| Brand e comunicazione | **Cliente**, piena proprietà |
| Aspetti tecnici | **Cliente**, piena proprietà |
| Materiali disponibili | **Cliente**, piena proprietà |
| Obiettivo progetto | **Progetto**, piena proprietà |
| Target | **Doppio livello** |
| Offerta | **Doppio livello** |
| Marketing e acquisizione | **Doppio livello** |

**Deciso (senza esitazioni):** le tre sezioni a doppio livello esistono in due gradi — una versione generale sul cliente, una versione ristretta/specializzata sul progetto, che si presenta come un ritaglio esplicito di quella del cliente, non come un campo scollegato. **Requisito esplicito legato a questa decisione:** l'interfaccia deve rendere inequivocabile, in ogni punto in cui compaiono, quale livello si sta leggendo e quale si sta modificando — non è opzionale, è parte della decisione stessa.

*Scartata:* tenere ogni sezione in un solo posto (più semplice, ma il target/offerta/canale generale del cliente non sarebbe scritto da nessuna parte — il problema che si vuole risolvere rientrerebbe dalla finestra).

### 2.3 Eredità non vuol dire verificata
**Problema:** un ritratto cliente ereditato da un progetto vecchio può risultare "pronto" pur essendo obsoleto (nuova sede, nuovo listino…), senza che nessuno se ne accorga, proprio perché l'eredità funziona bene e nessuno è più costretto a riaprirlo.

**Deciso:** il progetto nasce già compilato dall'eredità (zero ricompilazione), ma chi lo apre vede in chiaro **cosa** ha ereditato e **da quando**, e lo conferma con un solo gesto per progetto (non per singolo campo).

*Scartate:* ereditare in silenzio senza alcuna conferma (rischio di deriva silenziosa, incoerente con come Jacopo ha guidato ogni altra decisione di questa conversazione); un meccanismo che chiede conferma solo se il cliente è cambiato dall'ultima apertura (più elegante ma richiede comunque la stessa tracciatura della soluzione scelta — resta un affinamento futuro, non escluso).

### 2.4 Cosa vuol dire "progetto pronto"
**Deciso (confermato esplicitamente da Jacopo):** un progetto è pronto quando le informazioni richieste esistono, **indipendentemente dal livello — cliente o progetto — in cui sono scritte**. È un cambio di comportamento reale rispetto a oggi, che controlla solo i campi del progetto.

### 2.5 Progetti con più di un cliente collegato
**Fatto verificato nel codice** (non ipotesi): il sistema permette già oggi di collegare un progetto a più clienti insieme (selezione multipla nel modulo di creazione, `src/modules/projects/ui/modals/QuickCreateProjectModal.jsx`); oggi il "cliente principale" è scelto in automatico e in silenzio come il primo selezionato, senza mostrarlo mai all'utente.

**Deciso:** alla creazione, se più di un cliente è collegato, il sistema chiede esplicitamente — **eredita da uno di questi (scegli quale)**, oppure **non ereditare da nessuno**. Mai una scelta silenziosa, mai un'eredità forzata su progetti multi-cliente.

### 2.6 Dove si scrive il ritratto del cliente — e conseguenza diretta sul progetto
**Deciso:** il cliente ha una **propria area dedicata**, indipendente — proprie Fonti, proprio pulsante di generazione del Brief — usabile anche prima che esista un solo progetto per lui. Non un semplice "promuovi dal progetto".

*Scartate:* far nascere il ritratto del cliente solo come sotto-prodotto di un progetto (più economico, ma impedisce di preparare il ritratto di un cliente prima della sua prima commessa — cosa che Jacopo ha indicato essere proprio lo scopo di tutto questo lavoro); costruire entrambe le vie insieme fin da subito (più lavoro, rischio di due percorsi di scrittura che divergono).

**Conseguenza esplicita, confermata da Jacopo:** poiché i pulsanti e le funzioni di generazione si spostano dal progetto al cliente, la scheda Brief e la scheda Fonti **dentro il progetto** vanno corrispondentemente modificate, non semplicemente affiancate da quelle nuove sul cliente:
- Le quattro sezioni di piena proprietà del cliente **spariscono come campi da compilare nel progetto** (restano leggibili, per contesto, non editabili lì).
- Le tre sezioni a doppio livello cambiano faccia: non più un campo vuoto, ma un campo che mostra la versione del cliente e chiede il ritaglio specifico.
- Il pulsante "genera Brief" si divide in due: uno sul cliente (le sue quattro sezioni, dalle sue Fonti), uno più piccolo sul progetto (Obiettivo + i tre ritagli).
- La scheda Fonti del progetto smette di essere il posto dove si carica il materiale di marca; tiene solo le fonti specifiche di quel lavoro, con l'utente informato che il progetto legge comunque anche le fonti del cliente.

### 2.7 Dati già esistenti — chiarimento importante, di metodo prima ancora che di contenuto
La domanda "cosa facciamo dei clienti/progetti che hanno già un Brief compilato oggi" **si è sciolta senza bisogno di una scelta**, per un fatto che Jacopo ha specificato con forza e che vale come regola generale, non solo qui: **tutti i clienti, i progetti e gli utenti attualmente nel CRM — tranne gli account admin — sono dati di test**, senza alcun valore da proteggere. Non serve nessuna strategia di migrazione prudente: se un cliente di test avrà bisogno di un ritratto popolato per una demo, si genera direttamente nella nuova area, in pochi minuti.

**Distinto e rimandato esplicitamente:** l'elenco **vero** dei clienti dell'agenzia, che dovrà essere importato quando il CRM va online, è un'altra questione — appartiene alla **V12** ("Mappatura schema & importazione dei dati legacy") e va riaperta lì, non ora.

---

## 3. Blocco 2 — L'interfaccia che ne consegue

### 3.1 La pagina del cliente diventa un dossier completo
**Deciso — mix di due opzioni, non un compromesso a metà:**
- **Tutto ciò che è del cliente vive nella sua pagina, per intero** (non anteprime): Fonti/Brief, elenco dei suoi progetti, i suoi preventivi, i suoi siti, le sue credenziali — ciascuno nella propria scheda completa, come oggi un progetto ha più schede sotto la stessa pagina.
- **Si aggiunge una scheda Panoramica**, con lo stesso ruolo che ha oggi quella di un progetto in Produzione AI: non un elenco grezzo, una **lettura sintetica** (cosa merita attenzione, segnali chiave).
- **I moduli dedicati restano anche a sé**, indipendenti — Preventivi, Siti in gestione, Credenziali continuano a esistere come aree proprie, perché rispondono a una domanda che il dossier del singolo cliente non può dare: *"cosa scade questa settimana, su tutti i clienti insieme"*.

### 3.2 Riordino del menu laterale — proposta concreta, confermata
Da **15 righe di primo livello** a **10**, raccogliendo senza rimuovere funzioni:

| Riga oggi | Destinazione | Perché |
|---|---|---|
| Clienti | resta, diventa l'ombrello | Con dentro: elenco, Campi personalizzati, Integrazioni — **e ora anche** Preventivi, Siti in gestione, Credenziali |
| Preventivi / Siti in gestione / Credenziali | voci sotto Clienti | Restano raggiungibili come oggi (vista su tutti i clienti), non occupano più tre righe proprie |
| Reparti (oggi sotto Sicurezza) | sotto Team | Struttura organizzativa, non permessi |
| Ruoli e permessi, Audit (oggi sotto Sicurezza) | nuova riga **Impostazioni** | Configurazione d'azienda |
| Branding Workspace, Gestione Moduli (oggi dentro "Profilo") | stessa **Impostazioni** | Impostazioni d'azienda, non della persona — oggi mescolate con "Il Mio Profilo" |
| Theme Preview, Responsive QA (oggi dentro "Profilo") | **spariscono dal menu utente** | Strumenti di collaudo per chi sviluppa, non per l'agenzia |
| Profilo | resta, solo cose personali | Il Mio Profilo, Modifica Profilo, Impostazioni Account, Scorciatoie |
| Dashboard, Produzione AI, Team, Pipeline, Calendario, Messaggi, Memo Operativi | invariati | Già al posto giusto |

**Confermato da Jacopo** in blocco, incluso il collegamento esplicito con la richiesta iniziale di sfoltire il menu. **Corretto lo stesso giorno:** Memo Operativi resta dove sta oggi (sotto Operatività) — richiesta esplicita di Jacopo. La proposta iniziale lo segnava come la mossa meno solida delle sei, quindi toglierla non intacca il resto dell'impianto.

### 3.3 Pulizia del doppio rumore in "Nuovo Cliente" / "Nuovo Preventivo"
**Verificato nel codice:** la pagina elenco Clienti ha già un pulsante che porta a "crea nuovo cliente" (`src/views/Clients/ClientsList.jsx:278`), e l'elenco Preventivi ha già lo stesso per i preventivi (`src/views/Quotes/QuotesList.jsx:268`); esiste inoltre una scorciatoia da tastiera indipendente per entrambe le azioni (`src/components/shortcuts/shortcutCommands.js`, tasti `c` e `q`). Le voci "Nuovo Cliente" e "Nuovo Preventivo" nel menu laterale (`src/layout/Sidebar/SidebarMenu.jsx`) sono quindi una **terza via ridondante** verso un'azione già raggiungibile in due modi.

**Deciso:** rimuoverle dal menu. **Non ancora eseguito** — decisione valida, da eseguire insieme al resto.

### 3.4 Il criterio per decidere cosa va dietro una linguetta/popup
Applicato più volte nel corso della conversazione (Panoramica come sintesi vs. schede di dettaglio complete), mai formalizzato come regola a sé da Jacopo, ma mai contraddetto: un blocco di informazione si tiene dietro una linguetta/popup se la risposta a *"cambia una decisione che sto prendendo adesso?"* è no; resta sempre visibile se la risposta è sì, anche a costo di densità. Non è una regola "nascondi tutto": il precedente diretto nel progetto è la scheda Memoria, tenuta nascosta per errore (dietro un interruttore di sviluppo) e poi resa visibile di proposito il 5/8/2026 perché "in un'area dove l'AI scrive per te, poterlo guardare è una questione di fiducia".

---

## 4. Collocazione in roadmap — dove va cosa, e perché lì

### 4.1 Arricchimento a livello cliente → chiusura della V5
**Non una V nuova: l'atto conclusivo della V5** ("Motore AI Context-Aware"), già segnata come "spezzata" con un residuo da completare dopo la V4.

**Perché lì e non altrove:**
- La roadmap ha già subito due rinumerazioni complete (15/7 e 24/7); una terza andrebbe evitata se non necessaria.
- La V5 è letteralmente "dove vive il contesto AI": la domanda "dove sta ancorato il contesto" è la sua domanda naturale, non un'aggiunta.
- **Il costo cresce con ogni V successiva che si costruisce sopra l'ancoraggio sbagliato**: il residuo V5 stesso (Discovery su RAG reale), la V6 (Reportistica — un "report del cliente" è la richiesta più naturale del mondo), la V7 (generazione visiva — le creatività vivono naturalmente sotto il cliente), la V8 (Lab — valida contro le Fonti, che si spostano). Più si aspetta, più consumatori dell'ancoraggio sbagliato si accumulano.
- **Assorbe e chiude una decisione già parcheggiata il 22/7/2026**: la migrazione delle fonti *legacy* dal blob `ProjectMemory.sourcesJson` dentro `ProjectSource`, sospesa perché le domande aperte allora (come de-duplicare, se i competitor diventano fonti, come trattare i file senza testo integrale) dipendono in parte da come si struttura l'ancoraggio nuovo. **Ordine corretto:** prima si scioglie l'ambiguità `Project.clientId` vs `ProjectClient` (di fatto già risolta dalla decisione §2.5), poi la regola di precedenza (§2.2–2.3), poi si sposta l'ancora, **solo allora** si esegue la migrazione legacy parcheggiata — così si fa una volta sola, nella forma giusta.

**✅ Nota di metodo, risolta:** questo lavoro tocca `server/modules/agency-os/agency.service.ts` (10.452 righe), area che la roadmap segna come "a decisioni condivise, non si tocca unilateralmente" rispetto a Claudio. **Confermato da Jacopo il 7/8/2026: approvazione piena di Claudio su tutto quanto pianificato in questo documento** — l'elemento bloccante non si applica qui. Resta comunque buona norma segnalarlo nell'handoff, non per chiedere il permesso ma per tenere allineato chi riprende la sessione nel weekend.

### 4.2 UX-A (pulizia strutturale del menu, indipendente dal futuro) → presto, a sé
Include: il nuovo gruppo Impostazioni, Reparti spostato con Team, gli strumenti di sviluppo tolti dal menu utente, le azioni trasformate in pulsanti invece che voci di navigazione (§3.3). **Non dipende da nessuna decisione futura** — può partire appena c'è spazio nel calendario di lavoro.

### 4.3 UX-B (il dossier cliente, l'assorbimento dei moduli satellite, i criteri di densità applicati per intero) → primo blocco della V12
**Perché non prima:** dipende dal modello cliente/progetto appena deciso (Blocco 1) e dal set finale dei moduli — non si può disegnare la gerarchia finale prima di sapere cosa conterrà.
**Perché non dopo (cioè non in V13):** la V13 è dichiarata in roadmap stessa come "l'ultima, quella che rischia di non farsi mai". Mettere lì una riorganizzazione della navigazione equivale a non farla.
**Perché proprio in V12 e all'inizio:** la V12 è l'importazione dei dati legacy e il rollout ai veri utenti — riorganizzare la navigazione **dopo** che le persone hanno imparato quella vecchia è il momento peggiore possibile. Va consegnata la forma definitiva, non quella che cambierà fra un mese.

### 4.4 Rapporto tra Fase B del re-naming e UX-B — *riformulato il 17/8/2026*

> ⚠️ **La prima stesura (7/8) diceva che i due lavori si contendevano gli stessi indirizzi, e che quindi la Fase B doveva tenerne le mani lontane fino alla V12. Verificando si è visto che in gran parte NON è così.** La versione corretta è questa; quella vecchia è superata e non va riproposta.

**Il conflitto che si era supposto non c'è, per due motivi verificati:**
- **Posizione a menu e indirizzo sono indipendenti in questo CRM.** Il gruppo *Sicurezza* contiene già oggi `/settings/roles`, `/settings/departments` e `/audit` — tre indirizzi senza nulla in comune. Nessun gruppo impone un prefisso ai propri figli. Quindi portare Siti, Credenziali e Preventivi **sotto Clienti nel menu non richiede di spostare nessuna rotta.**
- **I moduli restano anche come aree a sé** (§3.1): la vista globale **tiene il suo indirizzo**, e il dossier semmai ne aggiunge uno **nuovo** per il singolo cliente — una creazione, non uno spostamento.

**La regola che resta, in tre righe:**
1. **La Fase B rinomina il vocabolario senza rimandarlo** (`agency` → nome nuovo, `discovery` → `brief`) in file, cartelle e rotte. ⚠️ Vale *dentro* il lavoro di re-naming: **la Fase B non precede la release di settembre**, perché rinomina l'area Produzione AI che al lancio sarà nascosta — e non è breve (`Agency` in oltre 60 file, revisore obbligatorio).
2. **Il raggruppamento del menu si può fare quando conviene**, senza toccare una sola rotta e senza aspettare la Fase B. Una fetta è già dentro la release di settembre.
3. **Spostare davvero un indirizzo sotto il cliente resta una decisione a sé**, da prendere quando il dossier esiste. Il motivo per non anticiparla **non è la documentazione che invecchia**, è che alcuni indirizzi **potrebbero vivere come dati salvati a database** (Scorciatoie utente, Console piattaforma — sospetto annotato nella voce Fase B della roadmap): lì cambiare due volte significa **due migrazioni**, non due sostituzioni di testo.

📌 **Regola di igiene generale, adottata su proposta di Jacopo il 17/8:** chi cambia una di queste cose **aggiorna nello stesso lavoro il documento che la descrive**, così nessun piano resta a dire cose superate. È il motivo per cui questa sezione è stata riscritta invece di lasciata com'era.

---

## 5. Esplicitamente aperto o rimandato

- **L'importazione dei clienti veri dell'agenzia** (§2.7) — riguarda la V12, non questo blocco. Da riproporre quando quella V si apre.
- **Il criterio popup/linguetta** (§3.4) — applicato con coerenza ma mai formalizzato come regola scritta a sé; se in futuro genera un caso ambiguo, va deciso lì, non qui.
- **Le tre decisioni sul backend già in roadmap** (chi spezza `agency.service.ts`, se estendere il controllo dimensione al backend, quale soglia) restano invariate da questa conversazione — non toccate, non richiamate se non per la nota di approvazione al §4.1.

---

## 6. Tabella riassuntiva — tutte le decisioni prese oggi

| # | Decisione | Esito |
|---|---|---|
| 1 | Cosa sale al cliente | Materiali + ritratto stabile dell'azienda |
| 2 | Linea per sezione del Brief | 4 al cliente, 1 al progetto, 3 a doppio livello |
| 3 | Eredità = verifica? | Precompilato + conferma esplicita a un click, per progetto |
| 4 | Progetto "pronto" | Conta l'informazione, non il livello dove sta scritta |
| 5 | Progetti multi-cliente | Scelta esplicita alla creazione: primario o nessuna eredità |
| 6 | Dove si scrive il ritratto cliente | Area propria e indipendente sul cliente (non solo promozione da progetto) |
| 7 | Dati di test esistenti | Nessuna migrazione necessaria; i clienti veri sono un tema V12 a sé |
| 8 | Struttura pagina cliente | Dossier completo a schede + Panoramica sintetica; moduli satellite restano anche a sé |
| 9 | Riordino menu laterale | Da 15 a 10 righe di primo livello (dettaglio §3.2) |
| 10 | "Nuovo Cliente"/"Nuovo Preventivo" nel menu | Da rimuovere (ridondanti); decisione presa, esecuzione in coda |

**Collocazione in roadmap:** arricchimento cliente → chiusura V5; pulizia menu indipendente → presto, a sé (una fetta è già dentro la release di settembre); riordino gerarchico completo (dossier + assorbimento moduli) → primo blocco V12.

> ✅ **Innestato nella roadmap il 17/8/2026.** Le decisioni di questa Parte Prima sono ora scritte anche in `03-roadmap-confronto-e-build.md`, in tre punti: l'atto di chiusura della **V5** (arricchimento al cliente), il primo blocco della **V12** (riordino gerarchico), e una voce nuova nel **Debito tecnico** (riordino del menu). Qui resta il dettaglio con le alternative scartate e il loro perché; **la roadmap rimanda a questo documento e non lo duplica.**

> ✅ **Correzione del 17/8/2026 alla §4.4 — la fase B del re-naming NON blocca il riordino del menu.** La stesura del 7/8 dava per scontato che portare Siti, Credenziali e Preventivi sotto Clienti ne cambiasse gli indirizzi, e quindi che i due lavori si contendessero le stesse rotte. **Verificando si è visto che non è così:** in questo CRM la posizione a menu e la rotta sono indipendenti (il gruppo *Sicurezza* contiene già `/settings/roles`, `/settings/departments` e `/audit`, tre indirizzi senza nulla in comune), e i moduli **restano anche come aree a sé**, quindi la vista globale tiene il suo indirizzo mentre il dossier semmai ne aggiunge uno nuovo. Resta valido solo il punto 3 della regola: **spostare davvero un indirizzo sotto il cliente è una decisione a sé**, da prendere quando il dossier esiste — non per via della documentazione che invecchia, ma perché alcuni indirizzi potrebbero vivere come **dati salvati a database** (Scorciatoie, Console piattaforma), e allora cambiarli due volte sono due migrazioni.
>
> 📌 **Regola di igiene adottata nella stessa occasione, su proposta di Jacopo:** chi cambia una cosa **aggiorna nello stesso lavoro il documento che la descrive**. Vale in generale, non solo qui.

---
---

# PARTE SECONDA — Piano della release di settembre 2026

> **Definito il 17/8/2026** su commessa esplicita di Jacopo. **Priorità assoluta su tutto il resto**, Parte Prima compresa.
>
> **Stato dei fatti al momento della scrittura:** ultimo commit `43abcaf` del 7/8. Cinque file risultano modificati e non committati (catalogo permessi, suo test, `CLAUDE.md`, roadmap, una rotta agency) — **sono di una sessione parallela attiva in questo momento, che li committerà da sé. Non toccarli.** Lavorare su due sessioni in parallelo è la modalità normale in questo periodo: prima di modificare un file, controllare che non sia già in mano all'altra.

## 7.1 Il perimetro della release

**Sei aree devono essere al 100%:** Clienti · Team · Messaggi · Ruoli e permessi · Profilo · **Registro attività** (nuova).

**Tutto il resto si nasconde al lancio** (decisione di Jacopo, 17/8): Produzione AI, Pipeline, Preventivi, Siti in gestione, Credenziali, Calendario, Memo Operativi. Si spengono da **Gestione Moduli**, che è già in grado di farlo per workspace — nessuno sviluppo necessario.

✅ **Verificato il 17/8 — il Super Admin non resta chiuso fuori.** Il modulo `modules` è marcato `isCore`, e i moduli core **non si possono spegnere**: il server rifiuta l'operazione (`server/repositories/module.repository.ts:116`) e l'interruttore è disabilitato nell'interfaccia (`src/views/Settings/Modules.jsx:87`). Quindi la pagina Gestione Moduli è sempre raggiungibile e il Super Admin può riaccendere qualunque area quando vuole. **Nessun lavoro da fare su questo punto** — era un dubbio, è stato sciolto verificando.
- *Conseguenza operativa da ricordare:* riaccendere un modulo per guardarlo lo rende visibile **anche a tutti gli altri membri** di quel workspace in quel momento. Il rimedio elegante (una modalità "guarda come un utente normale" per il Super Admin) **non è nella release**: annotato come miglioramento successivo.
- *Nota:* anche `audit` è `isCore`, quindi il Registro attività non sarà mai spegnibile per errore. Per un registro è la proprietà giusta.

## 7.2 Stato verificato area per area

Verifiche condotte il 17/8 in sola lettura, senza modificare nulla.

| Area | Stato accertato |
|---|---|
| **Clienti** | Import CSV **esiste e funziona bene** (alias intestazioni IT/EN, errori isolati riga per riga, supporto campi personalizzati). **Difetto grave per l'uso previsto**: il file viaggia dentro il corpo della richiesta, con tetto ~1 MB → i volumi grossi falliscono. Modalità "prova senza salvare" già scritta nel backend ma **non collegata a nessun pulsante**. Schema e form allineati, nessun campo orfano. |
| **Team** | Invito **meccanicamente corretto** (token, scadenza, accettazione, creazione membership). **Rotto nella consegna**: senza server di posta configurato l'email non parte, ma l'API risponde comunque "creato con successo" e l'interfaccia lo conferma. Nessun "reinvia", nessun modo di recuperare il link dopo. Inoltre: modifica membro è **una funzione vuota** dichiarata "fase 2"; filtro "In attesa" nell'elenco membri è **morto** (non può dare risultati). |
| **Ruoli e permessi** | **Quasi chiuso dal re-naming**: ~70 descrizioni tradotte e allineate al menu (`b94c19a`); creato il modulo `ai_production` con 5 permessi propri, fra cui `generate` separato — prima l'area AI girava a prestito sui permessi della Pipeline, cioè chi vedeva i progetti poteva far spendere soldi (`7465f12`). |
| **Registro attività** | L'impianto **esiste già** (tabella con chi/quando/azione/oggetto/IP/browser, repository con filtri, rotta permessata, pagina con filtri). Manca la **copertura**: le registrazioni sono manuali, inserite a mano in ~20 file. Scoperti: tutta l'area Produzione AI (inclusi i Task di progetto), conversazioni AI, opportunità, alert, **e il login**. |
| **Cestino** | **Non esiste nulla** in 67 tabelle (l'unica cosa simile è un "ritira" sui modelli di memo, non riusabile). 97 cancellazioni a catena nel database, di cui ~35 rilevanti sulle entità principali. |
| **Messaggi** | ✅ Verificato 17/8. Il cuore **funziona** (invio/ricezione 1-a-1, non letti, tempo reale via websocket, azioni già tracciate nell'audit). Problemi veri: **il registro viene inondato** (vedi ⑥-bis), il client **non usa la paginazione** che il server già offre → lo storico oltre 120 messaggi è irraggiungibile, tetto di 80-100 contatti senza paginazione, e un **ripiego pericoloso**: se la chiamata al profilo fallisce, la casella mostra la **Chat AI** — che al lancio sarà nascosta. |
| **Profilo** | ✅ Verificato 17/8. **I documenti erano obsoleti**: le pagine mostrano dati veri, i residui del template sono file morti che nessuno vede. Ma c'è **un blocco vero: non si può cambiare la password**, in nessun punto del CRM. |

## 7.3 Il lavoro, punto per punto

### ① Clienti — import massivo
1. **Far viaggiare il file come vero allegato** invece che dentro il corpo della richiesta. È il punto che sblocca i volumi grossi; la capacità esiste già altrove nel progetto con tetto a 20 MB.
2. **Esporre l'anteprima prima di confermare**, riusando la modalità "prova senza salvare" già scritta: quante righe entrano, quali no e perché, poi si conferma.
3. **Accettare anche Excel** (`.xlsx`). ✅ approvato da Jacopo. La libreria che li legge **è già in casa** (usata dalla reportistica), quindi nessuna dipendenza nuova.

### ② Clienti — campi nuovi
✅ **Confermato da Jacopo il 17/8.**

| Campo | Dove | Perché |
|---|---|---|
| **PEC** | standard (colonna) | Serve alla fatturazione elettronica, uguale per ogni agenzia italiana |
| **Codice destinatario SDI** | standard (colonna) | Idem: le fatture passano dal sistema statale, e ogni azienda ha un codice di 7 caratteri o in alternativa la PEC. Un cliente senza nessuno dei due è un cliente a cui non si può fatturare |
| **Sito web** | standard (colonna) | Confermato |
| **Referente** (persona di contatto) | standard (colonna) | Oggi esiste solo il nome azienda |
| **Settore merceologico** | campo personalizzato | Cambia da agenzia ad agenzia |
| **Fonte del contatto** | campo personalizzato | Idem |

### ③ Clienti — i campi personalizzati vanno rimessi al posto giusto
**Accertato:** la funzione è **più completa di come appare**. Si possono creare quanti campi si vuole, di **sei tipi** (testo breve, testo lungo, numero, data, sì/no, menu a scelta con opzioni definite dall'utente) — `server/modules/custom-fields/custom-fields.service.ts:9`.

**Quindi il difetto è tutto di interfaccia, zero lavoro sul database.** Osservazione di Jacopo confermata: oggi la funzione è collocata in una pagina separata da cercare, senza un pulsante ben visibile, e dà l'impressione di poter aggiungere un campo solo con poche scelte.

**Da fare:** ricollocarla **dentro il percorso che l'utente segue quando registra un cliente nuovo**, con un ingresso visibile e nel punto logico del flusso di onboarding — non come pagina a sé.

### ④ Team — l'invito
1. **Configurare il server di posta.** ✅ Dati forniti da Jacopo il 17/8: mittente **`noreply@advaiora.com`** *(confermato: `noreplay` era un refuso)*, host `mail.advaiora.com`, porta `587`. 🔐 **La password NON è in questo documento e non deve mai finirci**: va solo nel file `.env`, che è escluso dal repository. Poiché è transitata in chat, valutare di cambiarla dopo la configurazione.
2. **Maschera di configurazione dentro il CRM** ✅ (richiesta di Jacopo): i parametri del server di posta devono essere modificabili dalle impostazioni, non solo da file.
   - ✅ **Nome deciso (Jacopo, 17/8):** la pagina si chiama **«Server di posta»**. Scartati: *Posta in uscita* (più caldo ma meno esplicito), *Invio email* (sembra il posto dove si scrivono le email), *Notifiche email* (fa pensare a quali avvisi ricevere, non al canale).
   - ✅ **Chi vi accede (Jacopo, 17/8): Superadmin e Admin.** Scelta consapevole: dentro c'è la password di una casella aziendale vera, quindi il permesso va assegnato sapendo che chi ce l'ha può far spedire email a nome dell'agenzia.
   - ⚠️ **Da collegare tutti e tre i lettori dei parametri di posta, non solo l'invito** *(accertato il 17/8 mappando il codice)*: oggi esistono **tre implementazioni SMTP indipendenti** che leggono le stesse variabili d'ambiente — `server/modules/team/team-invite.notifier.ts` (l'invito), `server/modules/quotes/notifications.ts` (i preventivi), e `src/core/email/mailer.ts` (**codice morto**, zero importatori, per giunta dentro l'albero del frontend). Configurare la posta "per il Team" senza collegare anche i preventivi li lascia rotti nello stesso identico modo, in silenzio.
3. **Dire la verità nell'interfaccia:** la risposta deve distinguere "invito creato **e** email partita" da "invito creato, **email non partita**", e la schermata deve mostrarlo invece di dire sempre "successo".
4. **Pulsante "copia link invito"** accanto a ogni invito in attesa. È ciò che rende il flusso a prova di guasto: se la posta non funziona, il link si manda a mano.
5. **Chiudere le due lacune** ✅ approvate: la modifica membro oggi vuota, e il filtro "In attesa" morto.

### ⑤ Ruoli e permessi
✅ **Nomi: si lascia com'è** (Jacopo, 17/8): i cinque rimasti in inglese — Branding, Audit, Dashboard, Team, SEO — restano, sono termini del mestiere. Le chiavi tecniche (`vault.reveal`…) non le vede nessun utente e appartengono alla fase B. Il lavoro è stato completato dalla sessione parallela (commit `7e7cb07`: sei descrizioni riscritte perché promettevano meno del potere reale, tre commenti falsi corretti; nessuna migrazione dovuta, le descrizioni si propagano da sole al prossimo accesso).

⚠️ **Due punti dell'audit restano APERTI e sono dentro il perimetro** *(segnalati dalla sessione parallela il 17/8)* — vanno valutati esplicitamente prima di dichiarare l'area al 100%:
1. **I pulsanti che fanno spendere l'AI non controllano `ai_production.generate`**: otto chiamate partono da pulsanti sempre visibili, quindi chi non ha il permesso riceve un errore invece di trovare il pulsante spento. **Attenuante forte:** la Produzione AI è fra i moduli **nascosti al lancio**, quindi alla consegna il difetto non si vede. Resta però un difetto di qualità del controllo permessi, che è l'area in questione.
2. **Manca un test tabellare** «questa rotta chiede quel permesso» sulle rotte dell'area. I Siti in gestione ce l'hanno già. ⚠️ **Ha attinenza diretta col punto ⑨** (controllo automatico dei permessi): è lo stesso problema, e conviene affrontarli insieme invece che due volte.

🔐 **CHIUSO IL 17/8/2026 — l'invito non concede più il ruolo Superadmin** *(trovato dal revisore lavorando al punto ④)*. Era una **scala di privilegi vera**: in tutto il CRM i ruoli di sistema li assegna **solo un Superadmin** (`assertActorCanAssignRole`, applicato sia al cambio ruolo sia alla creazione diretta di un membro) — tranne che sull'invito, che accettava qualunque preset, **Superadmin compreso**, da chiunque avesse `team.invite` (per esempio un Manager, che non può assegnare ruoli). Chi creava l'invito poteva aprirlo e ritrovarsi una sessione da Superadmin. Restava teorico solo perché senza posta configurata il link non usciva mai: il pulsante "Link invito" del punto ④ lo avrebbe reso praticabile. Ora il preset Superadmin è rifiutato (dal server e non più offerto a schermo), allineandosi alla regola che la **registrazione** applicava già.

📌 **RESIDUO DA DECIDERE — chi può invitare a quale livello.** Chiuso il caso Superadmin, resta un'asimmetria: un **Manager** non può *promuovere* nessuno ad Admin (serve il Superadmin), ma **può invitare** una persona nuova direttamente come Admin. Le tre strade: **(a)** lasciare così — invitare qualcuno di nuovo è un atto diverso dal promuovere qualcuno di esistente, e il Manager risponde di chi porta dentro; **(b)** non si può invitare a un livello superiore al proprio, che è la lettura più prudente e la più coerente col resto; **(c)** solo il Superadmin invita, coerentissima ma **rischia di rendere inutile l'invito** proprio nella release che serve a far entrare le persone. ⚠️ Non deciderlo da soli: cambia chi può far entrare chi, ed è esattamente il genere di regola che va scelta guardando come lavora davvero l'agenzia.

📌 **Per l'audit di sicurezza (⑧):** la rotta che rigenera il link d'invito (`POST /api/team/invites/:inviteId/link`) **non ha un limite di frequenza**, a differenza della creazione dell'invito che ce l'ha. Non manda email e richiede già il permesso, quindi non è urgente; ma ogni chiamata **invalida il link precedente**, quindi due persone che lavorano in parallelo sullo stesso invito possono rompersi il link a vicenda senza accorgersene.

⚠️ **Da sapere per la configurazione dei ruoli alla consegna** *(riguarda i Clienti, che sono area di release)*: **`clients.edit` governa anche la chiave API di Brevo** e la sincronizzazione dei clienti verso l'esterno. Chi assegna «modifica anagrafica» sta dando anche **le chiavi di un servizio esterno**. Non è un difetto da correggere ora, è un fatto da conoscere quando si decidono i ruoli reali.

### ⑥ Registro attività
✅ **Nome deciso: «Registro attività»** (Jacopo, 17/8). Sostituisce la voce oggi chiamata *Audit*.

✅ **Approccio deciso: ibrido.**
- Un **intercettore automatico sulle entità principali**, che registra da sé ogni scrittura senza che nessuno debba ricordarsene → è la rete di sicurezza: il codice nuovo risulta tracciato per costruzione.
- **Più** le registrazioni manuali già esistenti dove serve un significato ricco (*"ha inviato il preventivo al cliente"* dice più di *"ha modificato una riga"*).
- Chiudere in ogni caso i buchi noti, **a partire dal login**, che oggi non è tracciato.

📌 **Istruzione lasciata apposta (richiesta di Jacopo):** **prima di collocare la voce nel menu, fare un breve confronto con Jacopo.** Nel riordino della Parte Prima l'Audit finiva dentro il nuovo gruppo *Impostazioni*, ma se il Registro attività diventa qualcosa che si consulta davvero, quella collocazione va rimessa in discussione. **Non deciderlo da soli.**

### ⑥-bis Messaggi — quello che va sistemato *(verificato il 17/8)*

**Il modulo funziona nel suo cuore** e le sue azioni sono già tracciate. Da sistemare:

1. 🔴 **Il registro attività viene inondato — e questo avvelena il punto ⑥.** Ogni volta che il pannello ricarica una conversazione segna i messaggi come letti, **anche nei controlli automatici silenziosi**: una riga `messages.read` **ogni 1,5 secondi** per conversazione aperta, anche quando non è cambiato nulla (`src/views/.../MessagingPanel.jsx:182`). Costruire il Registro attività senza chiudere prima questo significa consegnare un registro illeggibile dal primo giorno. **Va fatto prima di ⑥, non dopo.**
2. 🔴 **Il ripiego porta dentro un modulo che sarà spento.** Se la chiamata al profilo utente fallisce, la casella mostra la **Chat AI** invece dei Messaggi (`AiChatWidget.jsx:573`). Poiché al lancio l'area AI sarà nascosta, un errore momentaneo di rete farebbe comparire un'area che non deve esistere. **Da correggere.**
3. 🟡 **Lo storico oltre 120 messaggi è irraggiungibile.** Il server offre già la paginazione (`service.ts:222`), il client non la usa e non ha un "carica altri". Correzione piccola, il pezzo difficile esiste già.
4. 🟡 **Carico inutile sul database:** la barra in alto interroga il server **ogni 2 secondi senza rallentare** quando il tempo reale è attivo, e ogni chiamata scandisce fino a 1.500 messaggi (`TopNav.jsx:47`). Il rallentamento c'è già nel pannello, va portato anche qui.
5. 🟡 **Tetto di 80-100 contatti senza paginazione**, ordinati per data d'ingresso: in un workspace grande i colleghi più recenti non compaiono se non cercandoli per nome.
6. ⚪ **Conteggi dei non letti sottostimati** sui workspace molto attivi (calcolati sullo stesso campione da 1.500).
7. 📌 **Da decidere (§7.7):** allegati e cancellazione messaggi **non esistono** — oggi un messaggio inviato è irreversibile. Dentro o fuori perimetro?

*Fuori perimetro per scelta già presa:* gruppi di reparto/agenzia e modello a conversazioni → restano alla V10.

### ⑥-ter Profilo — quello che va sistemato *(verificato il 17/8)*

**I documenti di progetto erano obsoleti:** le pagine sono cablate ai dati reali (nome, email, ruolo, workspace), il salvataggio funziona davvero, il cambio email è gestito correttamente (riemette il token, rifiuta le email già in uso). I residui del template (foto finte, "amici", galleria) sono **file morti mai importati**: invisibili all'utente, da cancellare per igiene.

1. 🔴 **BLOCCO: non si può cambiare la password.** Non esiste né la schermata né la funzione lato server, in nessun punto del CRM. Per un lancio in produzione è grave in due modi: nessuno può cambiare una password compromessa, e **chi la dimentica non ha modo di rientrare** — nemmeno un amministratore può aiutarlo. 📌 Da decidere in §7.7 se serve anche il recupero via email.
2. 🔴 **"Modifica Profilo" è una pagina che mente.** Non modifica niente (è di sola lettura) e dichiara che *«le modifiche a nome, email o password non sono ancora esposte»* — **non è più vero**: si fanno in "Il Mio Profilo". Voce ridondante con testo falso, da togliere o riconvertire.
3. 🟡 **"Impostazioni Account" non contiene nessuna impostazione:** è una pagina di sola consultazione (ruoli, permessi, moduli, attività). Il nome è fuorviante — va rinominato o va reso ciò che promette.
4. ⚪ **Due limiti accettabili in versione 1, ma da dichiarare** invece di lasciarli scoprire: la foto profilo non è salvata come file ma **dentro il database** (funziona, tetto ~1 MB), e le **scorciatoie da tastiera vivono solo nel browser** — si perdono cambiando computer. L'interfaccia lo dice già per le scorciatoie.
5. ⚪ Cancellare i **tre file morti** del template.

### ⑦ Cestino (soft-delete)
✅ **Perimetro deciso** (Jacopo, 17/8): si costruisce il **meccanismo generale**, ma si **accende solo sulle entità che entrano nella release di settembre**. Il resto del CRM lo eredita in seguito accendendolo, senza riprogettarlo.

Cosa comporta anche in versione ristretta: stato "cancellato" sulle entità in perimetro, **tutte le letture** di quelle entità devono escludere i cancellati, e i collegamenti che oggi cancellano a catena nel database vanno gestiti a livello applicativo — altrimenti il record ripristinato torna svuotato dei suoi collegamenti. Più la pagina del cestino: navigabile, con ripristino e cancellazione definitiva.

⚠️ **È il punto più pesante della lista.** Anche ristretto, è quello con più probabilità di sforare: da tenere d'occhio per primo se il tempo stringe.

### ⑧ Audit di sicurezza pre-lancio
✅ approvato. Va **in fondo**, a codice fermo. Cosa guardare: che **ogni interrogazione al database sia filtrata per workspace** (in un sistema multi-azienda è *il* rischio: un cliente che vede i dati di un altro), robustezza di accessi e sessioni, chiavi API e password cifrate, limiti alle richieste ripetute, token degli inviti, dipendenze con vulnerabilità note, nessun segreto finito nel repository, intestazioni di sicurezza.

Il progetto non parte da zero: esiste già la protezione contro le richieste verso indirizzi interni (`server/core/net-guard.ts`), uno script di igiene delle credenziali (`scripts/security/vault-hygiene-check.mjs`), e in ambiente Claude Code è disponibile il comando `/security-review`.

### ⑨ Il controllo automatico dei permessi (il "nb" della commessa)
✅ approvato. La **regola è già scritta** in `CLAUDE.md` dal re-naming ("il permesso nasce insieme al codice"); manca farla **verificare da una macchina**.

- **Metà 1 — «ogni permesso usato esiste davvero nel catalogo»: fare subito.** Poco lavoro e chiude un difetto reale: oggi **solo 4 moduli su 16** prendono i permessi dal catalogo centrale, gli altri li riscrivono a mano nel proprio file senza nessun controllo di coerenza.
- **Metà 2 — «ogni rotta ha un permesso»: valutare dopo.** Fattibile ma artigianale: va dedotta leggendo staticamente il codice (Fastify a runtime non espone il controllo, che è codice dentro l'handler), e serve una lista di eccezioni per le rotte che giustamente non ne hanno (login, accettazione invito).
- **Precedente da copiare:** `scripts/security/vault-hygiene-check.mjs` — script Node autonomo che scansiona ed esce in errore. Stesso meccanismo. *(Nota: il backend testa con `node:test`, non Vitest, che qui è solo frontend.)*
- ⚠️ **Tre permessi faranno inciampare la metà 2** *(segnalati dalla sessione parallela il 17/8)*: `clients.edit`, `quotes.manage_templates` e `checklists.complete_item` fanno da **ombrello** a funzioni che non hanno una voce propria — cioè sono esattamente il ripiego che `CLAUDE.md` vieta per il codice nuovo. Un controllo «ogni rotta ha il suo permesso» li segnalerebbe: vanno previsti come eccezioni note, o risolti dandogli una voce propria.
- ⚠️ **Da fare insieme al punto ⑤.2** (test tabellare mancante sulle rotte di Produzione AI): è lo stesso problema visto da due lati, affrontarli separatamente significa costruire due volte lo stesso meccanismo.

## 7.4 Cosa entra dalla Parte Prima

✅ Confermato da Jacopo il 17/8, incluso il punto che era da valutare.

| Dalla Parte Prima | In settembre? | Nota |
|---|---|---|
| Togliere "Nuovo Cliente"/"Nuovo Preventivo" dal menu | ✅ **Sì** | Decisione §3.3, due righe. Le azioni restano raggiungibili dai pulsanti già esistenti negli elenchi e dalle scorciatoie da tastiera |
| Collocare il Registro attività nella gerarchia decisa | ✅ **Sì** | Va collocato comunque — ma **prima parlarne con Jacopo**, vedi ⑥ |
| Il gruppo **Impostazioni** (Ruoli e permessi, Registro attività, Branding Workspace, Gestione Moduli) + Reparti spostato sotto Team | ✅ **Sì** | Era il punto "da valutare", **approvato**. Attenzione: il catalogo permessi ha due nomi accorciati (*Moduli*, *Branding*) che il menu scrive per esteso — il disallineamento noto si chiude proprio qui |
| Dossier cliente completo (§3.1) | ❌ No | Troppo grosso, e dipende dalle decisioni sull'arricchimento AI. Resta al primo blocco della V12 |
| Arricchimento AI a livello cliente (§2) | ❌ No | Produzione AI è fuori perimetro e verrà nascosta al lancio. Resta alla chiusura della V5 |

⚠️ **Regola di demarcazione da rispettare sui Clienti**, perché è l'unica area che i due piani toccano insieme: a settembre si lavora sul **contenuto** (campi, import, dove sta il pulsante dei campi personalizzati); il **ridisegno della pagina** (dossier a schede + Panoramica) è V12. Non anticipare la forma: verrebbe rifatta.

✅ **Il riordino del menu non è bloccato dalla fase B del re-naming** *(chiarito il 17/8 correggendo §4.4)*: raggruppare le voci **non richiede di spostare nessun indirizzo**, perché in questo CRM la posizione a menu e la rotta sono indipendenti (il gruppo *Sicurezza* contiene già `/settings/roles`, `/settings/departments` e `/audit`). Quindi il gruppo Impostazioni, Reparti sotto Team e la collocazione del Registro attività si fanno **senza toccare una sola rotta**. Vedi §4.4 aggiornato.

## 7.5 Ordine di lavorazione proposto

Sequenza pensata perché **degradi bene**: se il tempo stringe, quello che resta indietro è l'ultimo della lista, non un pezzo che blocca gli altri.

✅ **Aggiornato il 17/8 dopo la verifica di Messaggi e Profilo.**

1. **Server di posta + invito Team** (④). Sblocca l'inserimento di persone vere, serve a collaudare tutto il resto con più utenti, ed **è il prerequisito** del punto 2 se si sceglie il recupero password via email.
2. **Cambio password** (⑥-ter n.1). È il blocco più grave trovato: senza, chi dimentica la password non rientra più. Subito dopo la posta, perché il recupero la usa.
3. **Controllo automatico dei permessi, metà 1** (⑨). Poco lavoro, e da qui in avanti ogni cosa nuova nasce controllata invece che verificata a posteriori.
4. **Le due correzioni rosse dei Messaggi** (⑥-bis n.1 e n.2): fermare l'inondazione del registro e togliere il ripiego verso la Chat AI. ⚠️ **La prima va necessariamente prima del punto 6**, o il Registro attività nasce già illeggibile.
5. **Clienti** (①②③): campi nuovi → import (allegato + anteprima + Excel) → ricollocazione dei campi personalizzati nel flusso di onboarding.
6. **Registro attività** (⑥): intercettore automatico + buchi noti, login compreso. *Prima: il confronto con Jacopo sulla collocazione nel menu.*
7. **Cestino** (⑦) sulle entità in perimetro. Volutamente dopo il punto 5, quando è chiaro quali entità sono davvero in gioco.
8. **Le rifiniture gialle** di Messaggi e Profilo: paginazione dello storico, rallentamento delle interrogazioni della barra in alto, tetto contatti, "Modifica Profilo", "Impostazioni Account", file morti.
9. **Riordino menu**: gruppo Impostazioni, Reparti sotto Team, rimozione delle due voci ridondanti, collocazione del Registro attività.
10. **Nascondere i moduli fuori perimetro** da Gestione Moduli.
11. **Audit di sicurezza** (⑧) — a codice fermo, per definizione ultimo.

## 7.6 Cosa resta esplicitamente fuori

- Tutta la **Parte Prima** tranne le tre voci di §7.4.
- ~~L'**italianizzazione residua** già censita in roadmap (stati in inglese crudo, tendine, parole isolate)~~ → ✅ **CORREZIONE 17/8: quella lista è GIÀ STATA ESEGUITA il 7/8/2026** (commit `7cf5cd9`, `4bf2635`, `745be46`, `b363804`, `75131ef`). Era stata letta dall'elenco originale dentro il blocco richiudibile della roadmap, senza vedere la tabella sopra che lo dichiara chiuso. Non cambia il perimetro — quelle aree restano fuori comunque — ma **non c'è nessun lavoro di italianizzazione residuo da rimandare**.
- La **fase B del re-naming** (URL, nomi file, chiavi permessi).
- Il **cestino sul resto del CRM** — eredita il meccanismo dopo.
- La modalità **"guarda come un utente normale"** per il Super Admin.
- La **metà 2** del controllo automatico dei permessi (ogni rotta ha un permesso).
- **Il permesso dei Memo Operativi che ne scavalca un altro** *(trovato dalla sessione parallela il 17/8)*: `checklists.complete_item` copre anche il marcare una voce «non applicabile», che è uno stato terminale — quindi chi ha quel permesso può far passare un progetto oltre un cancello **senza avere il permesso nato apposta** (`checklists.override_gate`). **Fuori perimetro** perché i Memo Operativi sono nascosti al lancio. ⛔ **Non risolvere d'iniziativa:** è una scelta di prodotto di Jacopo, con le tre strade possibili già annotate in roadmap.
- **La verifica della barra schede sul telefono** (sotto i 768px): è l'unica cosa della fase A del re-naming ancora da fare, ed è una verifica a schermo, non sviluppo.

## 7.7 Punti aperti e rischi

1. ✅ **Messaggi e Profilo: verificati il 17/8** — vedi ⑥-bis e ⑥-ter. Il perimetro non è più incerto. Tre decisioni restano da prendere, elencate ai punti 7-9 qui sotto.
2. ✅ **DATA FISSATA — inizio settembre 2026** *(Jacopo, 17/8/2026)*. Sono circa **quindici giorni lavorativi** dalla data della decisione. ⚠️ **Conseguenza da affrontare subito, non a fine corsa:** con questa data il piano non ci sta intero, e le due voci che sforano sono note in anticipo — il **cestino** (⑦) e gli **allegati dei messaggi** (§7.10 punto 8). Vedi la voce §7.11 qui sotto: sono da decidere **esplicitamente**, non da lasciar scivolare.
3. ⚠️ **Il cestino è il rischio numero uno**, anche ristretto al perimetro. Se qualcosa deve slittare, guardare prima qui. *(Con la data di inizio settembre non è più un "se": vedi §7.11.)*
4. 🔐 **La password della casella di posta è transitata in chat.** Non è in nessun file del repository. Valutare di cambiarla dopo la configurazione.
5. 📌 **Collocazione del Registro attività nel menu: confronto con Jacopo obbligatorio prima di eseguire.**
6. ⚠️ **Si lavora su due sessioni in parallelo.** Prima di toccare un file, verificare che non sia già in mano all'altra sessione — e non committare mai il lavoro altrui.
## 7.8 Le pagine del Profilo — struttura decisa

Le tre pagine di oggi e cosa contengono davvero:

| Pagina | Cosa fa oggi |
|---|---|
| **Il Mio Profilo** (`/pages/profile`) | Mostra i dati **e li modifica** (nome, email, foto, tema) — è qui che la modifica funziona |
| **Modifica Profilo** (`/pages/edit-profile`) | Sola lettura, con dentro un testo che dichiara il falso |
| **Impostazioni Account** (`/pages/account`) | Sola consultazione: ruoli, permessi, matrice moduli, attività recente |

**✅ Struttura decisa da Jacopo il 17/8: «Il Mio Profilo» diventa la voce contenitore, con le sotto-voci allo stesso livello dentro di essa.**

```
Il Mio Profilo                    ← accesso primario nel menu
├── Impostazioni Account          ← i tuoi dati + cambio password (la modifica vera)
├── I miei permessi               ← ruoli, permessi, moduli attivi (sola consultazione)
└── Scorciatoie                   ← già esistente, resta qui: è roba personale
```

Conseguenze operative:
- La modifica **si sposta**: oggi funziona dentro *"Il Mio Profilo"* (`/pages/profile`), deve finire in *"Impostazioni Account"*.
- La pagina *"Modifica Profilo"* (`/pages/edit-profile`) **sparisce**: era di sola lettura e conteneva un testo che dichiarava il falso.
- Il nome *"Impostazioni Account"* **si sposta** dalla pagina informativa a quella di modifica (è lì che descrive bene il contenuto).
- La pagina informativa, che perde il nome che aveva, si chiama **«I miei permessi»** — vedi §7.9.

## 7.9 «I miei permessi» — il nome, e cosa ci resta dentro

✅ **Nome deciso da Jacopo il 17/8: «I miei permessi».**

**Cosa contiene quella pagina** (applicando il metodo: prima si spiega, poi si nomina): mostra all'utente **cosa può fare dentro il CRM** — quali ruoli gli sono stati assegnati, l'elenco dei permessi che ne derivano, quali moduli sono attivi nel suo workspace. È di sola consultazione: non si cambia niente da lì, si capisce soltanto perché si vede quello che si vede, e perché *non* si vede il resto. Serve al dipendente che si chiede *«perché a me questa voce non compare?»*.

**Perché il nome regge:** il possessivo fa da solo il lavoro di disambiguazione rispetto all'area di amministrazione *«Ruoli e permessi»* — là li assegni agli altri, qui guardi i tuoi. *(Sfumatura minima e accettata: la pagina mostra anche i moduli attivi, che permessi non sono in senso stretto, ma determinano cosa puoi fare e quindi ci stanno sotto quel nome.)*

**❌ Alternative scartate, con la ragione:**
- **«Cosa posso fare»** — diceva lo scopo senza spiegazioni, ma più lungo e meno convenzionale.
- **«I miei accessi»** — naturale in agenzia, ma *«Accessi»* era già stato scartato per l'area Credenziali perché fa pensare a chi può entrare nel CRM (vedi §6 Parte Prima).
- **«Ruoli e permessi»** senza possessivo — collide con l'area di amministrazione omonima.
- **«Il mio ruolo»** — più stretto del contenuto.

✅ **L'attività recente esce da questa pagina** (deciso 17/8). Mostrava l'attività dell'utente, che è la stessa informazione del **Registro attività** a un'ampiezza diversa. Da qui si rimanda al Registro filtrato su di sé: ogni informazione vive in un posto solo. Stesso criterio con cui il report tecnico è stato assorbito dentro il Report il 6/8 invece di restare una pagina gemella.

## 7.10 Le decisioni prese sui punti aperti

7. ✅ **DECISO 17/8 — il recupero password si fa.** Oltre al cambio password da dentro, serve anche il *"password dimenticata"* con link via email. Dipende dal server di posta (punto ④), che va quindi configurato prima. ⚠️ Da costruire con le cautele d'obbligo: link a scadenza breve, monouso, e il messaggio di richiesta **non deve rivelare se l'email esiste** nel sistema.
8. ✅ **DECISO 17/8 — allegati e cancellazione dei messaggi entrano nella release.** ⚠️ È l'aggiunta di perimetro più consistente emersa dalle verifiche: gli allegati richiedono di conservare i file, cosa che il modulo Messaggi oggi non fa. **C'è però un precedente in casa da copiare**: la Chat AI conserva già i byte dei suoi allegati in una tabella dedicata (`AiConversationAttachmentBinary`, migrazione `20260716152454`). Riusare quello schema invece di inventarne uno nuovo è la strada corta.
   - ✅ **Cancellazione «alla WhatsApp» (Jacopo, 17/8):** chi cancella **sceglie** fra *elimina solo per me* ed *elimina per tutti*. Comporta: un permesso nuovo (`messages.delete` oggi non esiste) e una cancellazione **per-destinatario**, non una riga sola cancellata — cioè il messaggio deve poter risultare nascosto a uno e visibile all'altro.
   - 📌 **Due dettagli da fissare quando si costruisce, non ora:** (a) *elimina per tutti* lascia la traccia «questo messaggio è stato eliminato» oppure sparisce senza lasciare nulla? (b) c'è un **limite di tempo** entro cui si può eliminare per tutti, o vale per sempre? Su WhatsApp valgono traccia + limite di tempo; sono scelte, non standard.
9. 🟡 **DECISO 17/8 nella direzione, da precisare in un dettaglio — le pagine del Profilo si fondono.** Volontà di Jacopo: *"Modifica Profilo"* diventa davvero la pagina dove si modificano le impostazioni del proprio utente; *"Impostazioni Account"* è il nome giusto per quella pagina; e la vecchia *"Impostazioni Account"* (sola consultazione: ruoli, permessi, moduli, attività recente) **viene inglobata lì dentro**. Da tre pagine a meno.
   - ⚠️ **Attenzione, oggi la situazione è invertita:** la modifica funziona già, ma sta in *"Il Mio Profilo"* (`/pages/profile`), mentre *"Modifica Profilo"* è la pagina di sola lettura. Quindi non si "riconverte" una pagina vuota: si **sposta la modifica** da una pagina all'altra.
   - 📌 **Resta da precisare: una pagina o due?** Vedi §7.8.

## 7.11 Il perimetro contro la data — cosa esce, da decidere esplicitamente

> **Nasce il 17/8/2026**, quando la data di consegna è stata fissata a **inizio settembre** (§7.7 punto 2). Prima la domanda non era ponibile: senza data non si sa cosa non ci sta.

**Il conto, in una riga.** Quindici giorni lavorativi, undici voci in §7.5, e due di quelle voci sono da sole più grosse di tre delle altre messe insieme. Non è una stima al ribasso per prudenza: sono **due lavori che il piano stesso segnala come pesanti** prima ancora che ci fosse una data.

**Le due voci in questione, con cosa costa ciascuna:**

| Voce | Perché sfora | Cosa comporta tagliarla |
|---|---|---|
| **⑦ Cestino** | Anche ristretto alle sole entità in perimetro: stato "cancellato" su ognuna, **tutte le letture** di quelle entità da correggere perché escludano i cancellati, e i collegamenti che oggi il database cancella a catena da riportare a livello applicativo — altrimenti un record ripristinato torna svuotato. Più la pagina del cestino con ripristino e cancellazione definitiva. Il piano lo chiama *"il punto più pesante della lista"* da prima che esistesse una scadenza | Al lancio **una cancellazione è definitiva**. Va detto all'utente nella finestra di conferma, con parole esplicite. I dati di oggi sono tutti di prova, quindi il rischio vero comincia il giorno del rollout |
| **Allegati ai messaggi** *(§7.10 punto 8)* | Richiedono di **conservare i file**, cosa che il modulo Messaggi oggi non fa affatto: serve una tabella per i byte, il caricamento, lo scaricamento permessato, i limiti di dimensione e di tipo. C'è un precedente da copiare (la Chat AI), che accorcia ma non azzera | Si scrivono messaggi di solo testo, come oggi. Nessuna funzione peggiora: non esiste ancora |

**Cosa invece resta dentro comunque**, perché è piccolo o perché è la ragione stessa della consegna: server di posta e invito, cambio e recupero password, le due correzioni rosse dei Messaggi, i Clienti, il Registro attività, il riordino del menu, lo spegnimento dei moduli fuori perimetro, l'audit di sicurezza.

**Le tre strade, con la raccomandazione:**

1. ✅ **Consigliata — fuori entrambe.** Si consegna con le sei aree solide e nessun lavoro a metà. Cestino e allegati diventano il primo blocco **dopo** la consegna, quando il tempo non stringe e il cestino si può fare bene su tutto il CRM invece che solo sul perimetro. *Costo:* al lancio si cancella per sempre, e i messaggi sono di solo testo.
2. **Fuori solo gli allegati, il cestino si fa.** Ha senso se la paura del rollout è che qualcuno cancelli un cliente vero per sbaglio. *Costo:* è la voce col rischio più alto di arrivare a metà il giorno prima della consegna — e un cestino a metà è peggio di nessun cestino, perché fa credere che i dati si recuperino.
3. **Dentro entrambe, sposta la data.** Legittimo se la data è nostra e non del cliente. *Se invece la data è del cliente, questa strada non esiste* e la scelta è fra 1 e 2.

📌 **Chi decide: Jacopo.** Finché non decide si lavora nell'ordine di §7.5, che mette apposta cestino e rifiniture in fondo: quindi **nessuna riga di lavoro va sprecata** qualunque cosa scelga, e la decisione può arrivare anche fra una settimana.

⚠️ **Se la scelta è la 1**, una cosa va fatta *dentro* la release e non dopo: la finestra di conferma di ogni cancellazione deve dire che è **definitiva**. È mezz'ora di lavoro e cambia cosa succede il primo giorno di uso vero.
