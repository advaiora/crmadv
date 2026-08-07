# Decisioni del 7 agosto 2026 — arricchimento a livello cliente e riordino del menu

> **Cos'è questo documento.** Certificazione precisa di tutto ciò che è stato deciso in una sessione di pianificazione tenuta il 7/8/2026, in parallelo a un'altra sessione che lavorava sulla fase A/A2 del re-naming (arrivata, a fine di questa conversazione, fino al commit `7465f12`). Non è ancora stato innestato in `03-roadmap-confronto-e-build.md` perché quel file risultava, al momento della scrittura, ancora con modifiche in corso da parte dell'altra sessione. Serve da base per due cose: (a) l'innesto nella roadmap non appena il campo è libero, (b) il confronto con la lista di consegna della prima versione del CRM (settembre 2026) che Jacopo espone subito dopo questo documento.
>
> Nulla di quanto segue è stato eseguito nel codice. Un solo file è stato sfiorato (`src/layout/Sidebar/SidebarMenu.jsx`, rimozione di due voci ridondanti) e poi riportato **esattamente** allo stato originale — verificato con `git diff` a diff vuoto — dopo che Jacopo ha chiarito che la conferma di una decisione, in una conversazione di pianificazione, non è un via libera a scriverla subito nel codice. La decisione resta valida, va solo eseguita insieme al resto.

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

**⛔ Nota di metodo, da rispettare:** questo lavoro tocca `server/modules/agency-os/agency.service.ts` (10.452 righe), già segnato in roadmap come "area a decisioni condivise, non si tocca unilateralmente" rispetto a Claudio. Per la regola già in memoria ("Jacopo ha piena autorità decisionale in sessione"), questo non blocca la decisione — ma va comunque segnalato con trasparenza nell'handoff, come per ogni altra modifica di quell'area.

### 4.2 UX-A (pulizia strutturale del menu, indipendente dal futuro) → presto, a sé
Include: il nuovo gruppo Impostazioni, Reparti spostato con Team, gli strumenti di sviluppo tolti dal menu utente, le azioni trasformate in pulsanti invece che voci di navigazione (§3.3). **Non dipende da nessuna decisione futura** — può partire appena c'è spazio nel calendario di lavoro.

### 4.3 UX-B (il dossier cliente, l'assorbimento dei moduli satellite, i criteri di densità applicati per intero) → primo blocco della V12
**Perché non prima:** dipende dal modello cliente/progetto appena deciso (Blocco 1) e dal set finale dei moduli — non si può disegnare la gerarchia finale prima di sapere cosa conterrà.
**Perché non dopo (cioè non in V13):** la V13 è dichiarata in roadmap stessa come "l'ultima, quella che rischia di non farsi mai". Mettere lì una riorganizzazione della navigazione equivale a non farla.
**Perché proprio in V12 e all'inizio:** la V12 è l'importazione dei dati legacy e il rollout ai veri utenti — riorganizzare la navigazione **dopo** che le persone hanno imparato quella vecchia è il momento peggiore possibile. Va consegnata la forma definitiva, non quella che cambierà fra un mese.

### 4.4 Punto di attenzione tra Fase B del re-naming e UX-B
La **Fase B del re-naming** (già in roadmap: URL/rotte tecniche, nomi file, cartella `agency-os`, chiavi permesso) e **UX-B** toccano gli stessi indirizzi (es. `/apps/web-assets`). Per non toccarli due volte:
- **Sì, subito:** rinominare il *vocabolario* (`agency`→nome nuovo, `discovery`→`brief`) in file/cartelle/rotte — indipendente dalla gerarchia.
- **No, aspetta UX-B:** "sistemare" la *struttura* degli indirizzi dei moduli che UX-B sposterà (Siti, Credenziali, Preventivi sotto Clienti) — quelli si toccano una volta sola, in quella sede.

---

## 5. Esplicitamente aperto o rimandato

- **L'importazione dei clienti veri dell'agenzia** (§2.7) — riguarda la V12, non questo blocco. Da riproporre quando quella V si apre.
- **Il posto di Memo Operativi dentro "Impostazioni"** (§3.2) — segnalata come la mossa meno solida delle sei nel riordino menu; da confermare o correggere osservando l'uso reale.
- **Il criterio popup/linguetta** (§3.4) — applicato con coerenza ma mai formalizzato come regola scritta a sé; se in futuro genera un caso ambiguo, va deciso lì, non qui.
- **Le tre decisioni sul backend già in roadmap** (chi spezza `agency.service.ts`, se estendere il controllo dimensione al backend, quale soglia) restano invariate da questa conversazione — non toccate, non richiamate se non per la nota di metodo al §4.1.

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
| 9 | Riordino menu laterale | Da 15 a 9 righe di primo livello (dettaglio §3.2) |
| 10 | "Nuovo Cliente"/"Nuovo Preventivo" nel menu | Da rimuovere (ridondanti); decisione presa, esecuzione in coda |

**Collocazione in roadmap:** arricchimento cliente → chiusura V5; pulizia menu indipendente → presto, a sé; riordino gerarchico completo (dossier + assorbimento moduli) → primo blocco V12.
