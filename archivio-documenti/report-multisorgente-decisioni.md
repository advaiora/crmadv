# Sistema di reportistica multi-sorgente (Agency) — decisioni di lavoro

> Documento di lavoro aperto il **24/7/2026** (Jacopo). Registra le decisioni prese mano a mano su questo pezzo, che è **in fase di ridefinizione allargata**. Va tenuto aggiornato e serve anche a dare visibilità a Claudio.

## Cos'è (e com'è cambiato)

Nato in roadmap come pezzo di **V6**: *"Report PDF brandizzato con import dati (es. conversioni Google Ads)"*. Parlandone il 24/7, Jacopo lo ha **allargato** a un vero **sistema di reportistica multi-sorgente con storico**:

- più **fonti** di dati: **Google Ads**, **Meta**, e **file Excel non standardizzati** forniti dai clienti;
- **storico** dei report accumulati nel tempo, per stime di tendenza/andamento su finestre temporali libere;
- **due livelli**: una **dashboard operativa interna** (per il team) da cui si **deriva**, su scelta, il **report cliente** brandizzato (oggi esportabile in PDF).

## Decisioni CHIUSE

### Storico (chiuso 24/7)
- Il report non è "l'ultima foto" ma una **serie di rilevazioni datate che si accumulano** (non si sovrascrivono).
- Ogni rilevazione ha un **intervallo di date libero** (unica parte obbligatoria — massima elasticità, niente periodi fissi imposti).
- In più, **agganci opzionali e multipli**: **campagne reali**, **evento/milestone di contesto** (es. "lancio prodotto", "Black Friday"), **sorgente/canale** (Google/Meta/Excel), **ambito/livello** (account · gruppo campagne · singola campagna · ad set), **tag/etichette libere**.
- **Implica una tabella dedicata → una migrazione tracciata** (non basta più appoggiarsi a `ProjectMemory.reportsJson` come per un singolo snapshot).
- **NIENTE scheduler**: lo storico si accumula a ogni aggiornamento **manuale**; l'aggiornamento automatico a intervalli è cosa separata e opzionale, per ora **esclusa**.

### Fonti, dashboard e metriche — meccanismo (chiuso 24/7)
- **Multi-fonte con report separati + combinato.** Di base report **separati** per fonte (**solo Google**, **solo Meta**); in più, come opzione, un report **combinato (merge)** dei due. Tutte e tre le viste con le stesse personalizzazioni.
- **UI a dashboard** che presenta i due "mondi" affiancati, sul **modello della pagina "Provider AI"** (OpenAI/Anthropic): una **card per connettore** con stato (configurato/da configurare), credenziali e opzioni; da lì si estrae il report della singola fonte; sezione dedicata per il combinato.
- **Merge fatto bene:** le metriche **additive** (impression, click, spesa, conversioni) si sommano; i **rapporti** (CTR, CPC, CPA, ROAS) sul combinato si **ricalcolano dai totali**, non si mediano.
- **Selettore metriche** a **chip on/off**, raggruppate per famiglia (volume / efficienza / risultato) per restare leggibili.
- **Set di metriche salvabili ("carnè"):** un set = `{ nome, icona essenziale, elenco metriche }`, **rinominabile**, con icona da una libreria interna (no upload). **Condivisi a livello di workspace** (tutto il team li riusa). → piccola **tabella dedicata**, si accoda alla migrazione dello storico.
- **Coerenza storica dei ritocchi:** a ogni rilevazione si salva un **set ampio di metriche grezze**, non solo quelle selezionate. Il set/selettore è un **filtro di presentazione** su dati completi → aggiungere/togliere metriche a report passati è **istantaneo e sui dati reali di allora**, senza nuove chiamate. Ogni report ricorda **quale set** aveva.
- **Ri-estrazione esplicita:** per una metrica **mai catturata** in quella rilevazione, un'azione **"ri-estrai dalla piattaforma"** re-interroga Google/Meta per quel periodo passato. Avvertenza: il dato ri-estratto **oggi** può differire dall'originale (le piattaforme aggiornano conversioni/attribuzioni retroattivamente; Meta ha finestre di conservazione più corte su certi dati) → si mostra un avviso e si conserva lo snapshot originale.

### Excel dei clienti, standardizzazione e i due livelli (chiuso 24/7)
- **Excel come terza fonte.** I fogli non standard dei clienti confluiscono nello stesso modello di metriche di Google/Meta.
- **Standardizzazione — opzione 2 (AI-assistita con profilo):** al primo caricamento di un formato, **l'AI propone la mappatura** colonna Excel → metrica; l'utente **conferma/corregge**; il **profilo di mappatura si salva** per quel cliente/fonte → i caricamenti successivi dello stesso formato si standardizzano da soli. Riusa l'infrastruttura **structured output** (JSON valido garantito). Tocca il nodo AI → **da concordare con Claudio**.
- **Metodo ripreso dal progetto "Revisioni fogli di calcolo"** (esplorato in sola lettura il 24/7): quel progetto **non è un motore automatico** ma un **metodo** guidato da Claude Code in sessione (mappatura esplicita per-cliente scritta a mano + QA + parsing IT; nessun LLM/fuzzy-matching nel codice). Da lì prendiamo l'**approccio**: mappatura esplicita e ispezionabile (non scatola nera); "adatta il modello canonico, non forzare i dati"; **QA di riconciliazione** (record in = record out + un totale di controllo) contro l'errore silenzioso; regole di parsing numeri/date all'italiana. La marcia in più del CRM è l'**AI che propone il primo mapping** (nel progetto lo fa l'umano).
- **Due livelli (fonte di verità unica):**
  1. **Serbatoio dati comune** — tutte le fonti nel modello unico + storico.
  2. **Dashboard operativa** (interna, per il team) — vista ricca sul serbatoio. Qui vive il concetto **master/ad hoc**: il "**template**" = un **set di metriche (carnè) + layout**; c'è un **master** di default adattabile, e un **template ad hoc** per i clienti i cui dati non rientrano nel master.
  3. **Report cliente** — **proiezione filtrata** della dashboard operativa + **branding** (il PDF Apple-style già esistente). Non un secondo sistema: la dashboard "vestita per il cliente".
- **Due filtri in cascata:** il **carnè** decide cosa entra nella dashboard operativa; un **filtro di condivisione** decide cosa di quello vede il cliente (che vede sempre un **sottoinsieme** di ciò che vede il team).
- **Master template di default (struttura di partenza della dashboard operativa):** replica *l'impianto* del template del progetto Revisioni (`_master-template/Template_Dashboard_KPI_Marketing.xlsx`, letto in sola lettura il 24/7) — filtri **Periodo/Sede** e le sezioni **Metriche del periodo · KPI performance · Performance operatori · Performance per canale · Top prestazioni**, con i KPI marketing (Fatturato, Spesa, Contatti, Nuovi lead, Prest. pagate, CAC, CPP/CPA, ROAS, LTV, AOV, CR). L'**impianto marketing è fisso**; le **entità di dominio** (pazienti, prestazioni, professionisti, sedi, consenso, CF — retaggio del cliente sanitario da cui è nato, poi eletto a standard) vanno rese **campi neutri adattabili** per settore (es. "pazienti"→"clienti", "prestazioni"→"prodotti"). Master di default adattabile, oppure **ad hoc** quando la natura dei dati del cliente non ci rientra.

## Decisioni RIMANDATE (a confronto Jacopo ⇄ Claudio)

- **Modalità di aggiornamento dati** (live all'export · snapshot a comando · snapshot+storico). Raccomandazione di Claude: **snapshot con pulsante "aggiorna ora"** (freschezza a comando + PDF sempre istantaneo e robusto; consumo di quota controllato). **La parte comune del CRM non dipende da questa scelta**, quindi si sviluppa intanto; la scelta definitiva la darà Jacopo dopo il confronto con Claudio.
- **Configurazione OAuth lato Google (e Meta)**: in **stand-by**, Jacopo e Claudio si confrontano. Intanto si sviluppa il CRM con connettore "finto" (stub) e dati simulati.

## Metriche (base, ma FLESSIBILI)
- Set di partenza: **conversioni, costo, impression, click, CTR, CPC medio, ROI, ROAS**.
- **Non fisse**: possono cambiare dopo il confronto con Claudio e **variare per cliente**. Il modello va progettato per **metriche configurabili**, non hard-coded. *(Da chiudere come punto a sé.)*

## Punti ancora APERTI
- **Metriche — elenco definitivo**: il *meccanismo* (selettore a chip + set salvabili) è chiuso (vedi sopra); resta da confermare l'**elenco specifico** delle metriche con Claudio e la loro **variabilità per cliente**.
- ✅ **Impianto approvato da Claudio (24/7)** — ha letto la nota per lui (`report-multisorgente-per-claudio.md`) e ha dato l'ok all'intero sistema. Lo sviluppo è **sbloccato** e va in una **V dedicata della roadmap**.

## Cosa si può sviluppare SUBITO (indipendente dalle decisioni rimandate)
- Il **serbatoio dati comune**: modello unico di metriche + **storico** (tabella rilevazioni) + **set di metriche salvabili** (tabella) → **una migrazione tracciata**. Non dipende né dall'OAuth né dalla scelta 1/2/3.
- Lo **scheletro della dashboard operativa** e la **sezione/tabella nel report cliente**, alimentabili con **dati simulati** finché i connettori reali non ci sono.
- Il **connettore "finto" (stub)** con la stessa interfaccia dei futuri connettori Google/Meta.

## Idee da tenere da parte (NON ora)
- **AI che apprende e propone le metriche.** Col tempo l'AI osserva quali metriche vengono incluse nei report a seconda del **cliente** e del **reparto dell'agenzia** che lo segue, e **propone** quali metriche includere. Idea di Jacopo (24/7), approvata come **direzione** ma da **NON realizzare ora**: si valuta più avanti, quando il modulo di base è in piedi e c'è storico d'uso su cui l'AI possa apprendere.

## Vincoli tecnici noti (da ricognizione 24/7)
- Il connettore **OAuth Google Ads** va scritto **da zero**: `google-auth-library` è già presente ma serve solo al login (verifica id_token), non produce il refresh token necessario.
- **Quota API Google Ads**: gratuita ma con tetto giornaliero di operazioni — **15.000/giorno** con *Basic Access*, illimitato con *Standard Access* (da richiedere e far approvare). Oltre il tetto le chiamate vengono **rifiutate**, non addebitate.
- **Developer token Google Ads**: legato a un account Manager/MCC, con **approvazione manuale di Google** (può richiedere giorni). Dipendenza esterna che l'utente dovrà procurare.
- **Aggancio nel report**: nuova sezione in `server/modules/agency-os/reports/client-report-pdf.ts` (dopo le sezioni attuali), prima sezione con numeri/tabella; nessun helper tabella condiviso in `server/core/pdf.ts` (riferimento di stile: `server/modules/quotes/pdf/quotePdf.ts`).
- **Storage credenziali**: candidati `Integration` (layer V3, un solo slot-segreto per riga) o `AgencyRuntimeSetting` (più segreti per workspace, ma dentro la migrazione arretrata `20260706085001`). Da decidere.
