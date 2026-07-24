# Sistema di reportistica multi-sorgente — nota per Claudio

*Scritta il 24/7/2026 (sessione di Jacopo). È una **proposta di impianto da validare insieme**: definisce la visione e le scelte concettuali, non ancora scritta in codice. Il gemello tecnico, con i riferimenti a file, migrazioni e vincoli, è `report-multisorgente-decisioni.md`.*

## Da dove nasce

In roadmap c'era un pezzo piccolo di V6: *"nel report PDF del cliente, importare dati esterni (es. le conversioni di Google Ads)"*. Ragionandoci, è cresciuto: non una singola sezione, ma **un vero modulo di reportistica** che raccoglie i dati di performance da più fonti, li standardizza, li conserva nel tempo e li presenta prima al team e poi al cliente. Questa nota serve perché, essendo diventato grosso e toccando aree condivise (il nodo AI, le integrazioni/OAuth, l'area Agency), voglio che tu lo veda **prima** che si scriva codice — soprattutto perché il primo passo porta con sé migrazioni del database.

## La visione, in breve

Un unico flusso a due livelli. In basso un **serbatoio** dove confluiscono, in un formato comune, i dati da **Google Ads**, **Meta** e dai **file Excel dei clienti**. Sopra, una **dashboard operativa interna** che il team usa per lavorare. E da quella dashboard, su scelta, si **deriva il report per il cliente** (filtrato e brandizzato, il PDF Apple-style che già esiste). Una sola fonte di verità: il cliente vede sempre un sottoinsieme di ciò che vede il team, mai numeri scollegati.

## I pilastri

**1. Più fonti, un formato solo.** Google e Meta espongono metriche quasi identiche, quindi confluiscono nello stesso modello; i file Excel dei clienti, una volta standardizzati, pure. Ogni dato porta con sé la sua *sorgente*. Da qui derivano naturalmente sia i **report separati** (solo Google, solo Meta) sia il **combinato** dei due. La configurazione dei connettori si presenterebbe come una dashboard con i due "mondi" affiancati, sul modello di come oggi presentiamo i provider AI (OpenAI/Anthropic): una card per connettore, con stato e opzioni.

**2. Storico a intervalli liberi.** Il report non è "l'ultima foto" ma una **serie di rilevazioni datate** che si accumulano, per leggere tendenze e andamenti su finestre a piacere. Ogni rilevazione ha un intervallo di date libero e, opzionali, degli agganci: campagne reali, un evento/milestone di contesto ("lancio", "Black Friday"), la sorgente, il livello di dettaglio, tag liberi. Niente aggiornamenti automatici programmati: lo storico si accumula quando si aggiorna a mano.

**3. Metriche configurabili.** Un selettore accende/spegne le metriche del report; le combinazioni si salvano come **set ("carnè") rinominabili**, con una piccola icona, condivisi a livello di workspace. Ogni report ricorda quale set aveva, così i ritocchi sullo storico restano coerenti. Per la maggior parte dei casi, aggiungere o togliere una metrica a un report passato è solo un cambio di vista su dati già salvati (salviamo un set ampio di metriche grezze, non solo quelle mostrate); quando serve una metrica mai catturata, c'è un'azione esplicita per ri-estrarla dalla piattaforma, con l'avviso che i dati storici possono essere stati aggiornati retroattivamente.

**4. Excel dei clienti standardizzati con l'AI.** Ho esplorato (in sola lettura) il tuo progetto "Revisioni fogli di calcolo". La cosa importante che ne ho tratto: là l'intelligenza sta nel **metodo** — mappatura esplicita per cliente, "adatta il modello canonico invece di forzarci i dati dentro", e un controllo di riconciliazione (record in = record out) che è esattamente il freno all'errore silenzioso. Nel CRM aggiungiamo la marcia che lì non c'è: **l'AI propone la mappatura** colonna→metrica al primo caricamento, l'utente conferma, e il **profilo si salva** per quel cliente; i caricamenti successivi si standardizzano da soli. Riutilizza l'infrastruttura di structured output (JSON garantito) che abbiamo appena reso robusta.

**5. Il master template della dashboard operativa.** La dashboard di partenza deve **presentarsi e strutturarsi come il template del tuo progetto Revisioni**: filtri per periodo e sede, e le sezioni *Metriche del periodo → KPI performance → Performance operatori → Performance per canale → Top prestazioni*, con i KPI marketing classici (fatturato, spesa, contatti, lead, prestazioni pagate, CAC, CPA, ROAS, LTV, AOV, conversion rate). L'impianto di marketing è **fisso**; le voci di dominio che in quel file sono sanitarie (pazienti, prestazioni, professionisti, sedi, consenso, codice fiscale) diventano **campi neutri adattabili** al settore del cliente — se vende orologi, "pazienti" diventa "clienti", "prestazioni" diventa "prodotti". È lo **standard di partenza**; quando un cliente non ci sta, si fa una versione **ad hoc** — esattamente la logica master/ad hoc del tuo progetto.

## Cosa dobbiamo ancora decidere insieme

- **Come si aggiornano i dati**: interrogare la piattaforma dal vivo a ogni export, oppure salvare uno *snapshot a comando* (la mia proposta: snapshot + pulsante "aggiorna ora" — il report resta sempre istantaneo e robusto, e si consuma quota solo quando serve).
- **La parte OAuth/credenziali di Google e Meta**: la stai valutando tu con me a parte; intanto il resto si può sviluppare con connettori "finti" e dati simulati.
- **L'elenco definitivo delle metriche** (il meccanismo dei set è deciso; la lista specifica no) e la sua variabilità per cliente.

## Dipendenze esterne di cui tenere conto

Google Ads e Meta non si integrano con una chiave incollata: servono un OAuth server-side e, per Google, un **developer token** legato a un account Manager, con **approvazione manuale che può richiedere giorni**. Le chiamate sono gratuite ma con un tetto giornaliero di operazioni (oltre il quale vengono rifiutate, non addebitate). Meglio muovere per tempo la richiesta delle credenziali.

## In una frase

Da "una sezione Google Ads nel PDF" a un **modulo di reportistica multi-fonte, storicizzato e configurabile**, con una dashboard operativa interna (sul modello del template Revisioni, reso neutro per settore) da cui si derivano i report cliente. Prima di partire con il codice — che porta migrazioni — voglio la tua lettura.
