# Rapporto al rientro — 6 agosto 2026, 12:52 → 13:50

Lavoro autonomo con `/vado 1h e 20min`. Tutto quello che segue è **committato e pushato su `main`**: se questa sessione muore, non si perde niente.

## Fatto e committato

**1. `f49ad94` — Il report tecnico è diventato una vista dentro Report.**
Il pezzo che avevamo chiuso insieme prima che uscissi. Le due viste stanno sullo stesso indirizzo (`…/reports/client`, con `?vista=tecnica` per quella tecnica), la scheda Report resta accesa, e c'è il pulsante esplicito per tornare indietro.

**2. `70f9aa5` — Via il gergo interno dai titoli delle pagine.**
I titoli parlavano la lingua di chi ha scritto il codice. Adesso ogni pagina si chiama come la sua scheda:

| Prima | Adesso |
|---|---|
| Overview progetto | **Panoramica** |
| Discovery Progetto AI | **Brief** |
| Tasks Progetto AI | **Task** |
| Opportunita Progetto AI | **Opportunita** |
| Nuovo progetto Agency | **Nuovo progetto** |

Rifatti anche i sottotitoli che citavano il motore interno (*"Opportunity Engine v2"*) invece di dire cosa c'è nella pagina, e i messaggi che parlavano di *"workspace AI operativo"*.

**3. `d25e751` — La scheda Memoria è visibile a tutti.**
Era una delle quattro che si vedevano solo in sviluppo: in produzione non la vedeva nessuno, nemmeno un Super Admin, perché il cancello era un interruttore di compilazione e non un permesso. Ora sta nella barra principale accanto a Opportunità e Alert — **non** dentro il pieghevole, dove sarebbe stata raggiungibile ma di fatto nascosta.

**4. `f52ea29` — I collegamenti portano alle schede nuove.**
Quattro punti mandavano ancora alle pagine in uscita. Nella Panoramica: la card *"Diagnosis"* ora si chiama **Da risolvere** e porta lì; la card *"Reporting"* si chiama **Report** e apre la vista tecnica. Nella lista Report di workspace: il click sulla riga porta al report cliente, *"Vai al report progetto"* alla vista tecnica.

**5. `7f19a12` — Via tre schede dal progetto, e i vecchi indirizzi rimandano.**
Diagnosis, Brain e Reports tecnici non esistono più: voce, rotta e file, **926 righe cancellate**. Chi ha un segnalibro su uno dei tre vecchi indirizzi non trova una pagina mancante — viene portato dove il contenuto è finito davvero. È sparito anche il pieghevole *"Diagnosi e strumenti tecnici"*, che senza quelle tre voci non si sarebbe più disegnato.

Prima di tutto questo, `e2cf820` ha introdotto il comando `/vado` e messo per iscritto l'eccezione sui colori della stampa.

**Con questo la decisione ② della roadmap è chiusa per intero.** Resta la ③, la barra in quattro gruppi.

## Da decidere (parcheggiato)

**① Come si chiama il modulo "Agency Brain".** *(unica cosa che mi ha davvero fermato)*
- *Cosa mi ha fermato:* in Panoramica c'è una pastiglia con scritto **"Agency Brain"** (`src/modules/agency-os/brain/agencyBrainRules.js:236`). La parola "Agency" non esiste più nel prodotto, ma **il modulo resta vivo**: alimenta Contenuti Web e Campagne ADS. Va cambiata l'etichetta, non la chiave — e un'etichetta è un nome, quindi la scegli tu.
- *Opzioni:*
  - **(a) "Motore AI"** — dice cosa fa: è il pezzo che ragiona sui dati del progetto e alimenta gli altri moduli.
  - **(b) "Regole progetto"** — più letterale (è un motore a regole), ma sembra una pagina di impostazioni.
  - **(c) Toglierla dall'elenco** — la pastiglia elenca i *moduli attivi*: ora che Brain non è più una scheda visitabile, si può discutere se debba comparirci.
- *Sceglierei (a):* resta comprensibile a chi non conosce l'architettura, e non promette una pagina che non esiste più.
- *Cosa resta bloccato:* solo quella pastiglia.

**② Da guardare quando riscriveremo la barra** *(non è una domanda, è un promemoria già in roadmap)*
Ora che tutte le schede secondarie sono sempre visibili, il cancello `import.meta.env.DEV` non filtra più niente. Non è sbagliato — è il meccanismo pronto per una futura scheda nascosta — ma va deciso se tenerlo, invece di trascinarlo dentro la struttura nuova senza guardarlo.

## Dove sono arrivato

**Budget finito con la coda quasi vuota.** Alle 13:46 restavano 16 minuti e il pezzo successivo ne vuole una quarantina: non l'ho iniziato, perché mezza barra riscritta sarebbe stata peggio di nessuna.

Resta **un solo pezzo** del re-naming: **la riscrittura della barra delle schede** (decisione ③) — quattro gruppi con intestazioni (Conoscenza · Produzione · Risultati · Priorità), Panoramica largo in cima, collegamento visivo Fonti→Brief, e i cambi di etichetta rimasti (*Discovery* → Brief, *Web* → Contenuti Web, *Ads* → Campagne ADS, *Memory* → Memoria, *Alert* → Da risolvere).

Dentro quel lavoro va sistemato anche il difetto già annotato: sulla vista tecnica del Report il pulsante grosso in testata dice *"Genera report"* e porta fuori dalla vista. ⚠️ Attenzione a non risolverlo facendo dipendere dalla querystring anche **quale scheda è accesa**: quella deve continuare a guardare solo il percorso, o si riapre il difetto appena chiuso. C'è un test che lo impedisce.

## Come si riparte

Leggere `design-linguaggio-apple-web.md` (regola del progetto prima di toccare l'aspetto), poi riscrivere `AgencyProjectPageTemplate.jsx`. Verificare che i quattro gruppi reggano anche su schermo stretto: undici pulsanti vanno a capo sul telefono.

## Stato della macchina

- **Dev server accesi**, come li avevi chiesti: API sulla **4000**, frontend sulla **5173**. Da spegnere a fine sessione.
- **Test verdi.** Ultimo giro sull'area: **25 file, 386 test passati**. Nessun riferimento residuo alle tre pagine cancellate.
  ⚠️ Un giro intermedio era risultato rosso per un **processo di test mai partito** a macchina carica (l'esploratore girava insieme ai due server): rilanciato mirato, verde. Non era un test rotto — è il caso della nota operativa #46.
- **Nessuna migrazione database.** Resta l'arretrato di sempre (`20260706085001`) per Claudio.
- Il **registro dei compiti non è aggiornato**: `npm run consumi:compito` è andato in timeout a due minuti. Da rilanciare con calma, delimitando i pezzi con `--da`/`--a`.
