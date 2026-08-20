---
description: Lavora in autonomia mentre l'utente è lontano dal PC, avanzando a pezzi committabili, mettendo da parte ciò che richiede una sua decisione, e lasciando un rapporto al rientro
argument-hint: "[durata: 1h (default) · 2h30 · 45m · tutto]"
---

# Lavoro in autonomia — l'utente si è allontanato

L'utente **non è al computer** e non lo sarà per un po'. Vuole che il lavoro vada avanti il più possibile **senza suoi ulteriori input**, con dei limiti di sicurezza per gli imprevisti.

Argomento ricevuto: `$ARGUMENTS`

Non ci sono richieste di chiarimento possibili: **nessuno risponderà finché non torna.** Quindi ogni domanda che ti verrebbe da fare va **messa da parte per il rientro**, non posta.

---

## Il principio che regge tutto

> **L'unità di lavoro è il pezzo, non il minuto. Il tempo non taglia un pezzo: decide soltanto se cominciarne un altro.**

Il pericolo non è sforare di dieci minuti. Il pericolo è **essere colti a metà di una modifica** quando il tempo scade: l'utente torna e trova l'albero in uno stato che non è né il vecchio né il nuovo. È lo stesso male che la regola *"committando per estrazione"* evita nelle spezzature dei file grossi.

Quindi: **dentro un pezzo non si guarda l'orologio.** Lo si guarda solo *fra* un pezzo e l'altro.

---

## 1. Fissa il budget e leggi l'ora vera

Leggi l'orologio del computer — `date +%H:%M` — e annotalo. **Non fidarti della tua percezione del tempo trascorso:** è l'errore più facile e non te ne accorgi.

Interpreta l'argomento:

| Argomento | Significato |
|---|---|
| *(vuoto)* | **60 minuti** — il caso normale |
| `2h`, `90m`, `2h30` | quella durata |
| `tutto`, `fino a fine <qualcosa>` | **nessun cancello di tempo**: si va avanti finché la coda dell'obiettivo corrente è vuota |

**Tieni 10 minuti di riserva** in fondo al budget per la chiusura (commit finale, registro, rapporto). Il cancello del punto 3 ragiona sul budget **meno** la riserva.

Poi lancia `npm run consumi` e guarda com'è messa la finestra delle 5 ore. Serve al punto 4.

## 2. Spacchetta il lavoro in pezzi committabili

Prima di toccare qualsiasi cosa, scrivi la **coda**: l'elenco ordinato dei pezzi da fare.

**Un "pezzo" è valido solo se finisce in un punto in cui l'albero è coerente e committabile.** Non "un'ora di lavoro", ma "questi cinque pezzi, in quest'ordine, ognuno chiude bene di suo". Se una cosa non è divisibile così, allora è **un pezzo solo** — e se non ci sta nel budget, semplicemente non si comincia.

Da dove esce la coda, in quest'ordine di precedenza:
1. i **prossimi passi dell'handoff più recente** in `archivio-documenti/handoff/`;
2. l'obiettivo su cui si stava lavorando in questa conversazione;
3. il piano di un esploratore già chiamato in sessione, se c'è.

Applica le regole normali del progetto senza sconti — anzi, con più scrupolo, perché **nessuno sta guardando**: `npm run mappa` prima di chiamare gli assistenti secondari, l'esploratore quando ricorrono le sue condizioni, il **revisore a ogni tappa conclusa** (dove non è stato esplicitamente spento per quella fase), i test della sola cartella toccata durante il lavoro e la suite intera una volta sola in fondo.

## 3. Il ciclo di lavoro, con il cancello

Per ogni pezzo della coda, **prima di cominciarlo**:

1. **Rileggi l'orologio** (`date +%H:%M`) e calcola quanto resta del budget meno la riserva.
2. **Chiediti se il pezzo ci sta.** Per calibrare non usare l'intuito: apri `archivio-documenti/consumi/registro-compiti.md` e guarda quanto sono durati **lavori simili in questo progetto**. Tieni presente che il registro dice a chiare lettere che **più di metà del tempo di un compito può essere giri di test e macchina lenta** — quindi abbonda.
3. **Nel dubbio, non partire.** Restituire 15 minuti liberi è sempre meglio che lasciare un albero a metà.
4. Se parti, **portalo a termine** anche se sfora un po'. Non guardare l'ora nel frattempo.

**A pezzo concluso** (deciso da Jacopo il 6/8/2026):
- **committa e pusha subito sul ramo del lavoro in corso** *(aggiornato il 19/8/2026: prima diceva «su `main`», quando si pushava direttamente sul ramo principale)*. È ciò che rende sicura un'interruzione: se la sessione muore, non si perde niente e il lavoro è visibile anche da fuori. Messaggio di commit nello stile del progetto (italiano, che dice *cosa cambia per chi usa il CRM*, non quali file sono stati toccati).
- **Mai** `--no-verify`, **mai** force push, **mai** riscrivere la storia. ⚠️ E **mai unire a `main`**: l'unione è una decisione dell'utente, che al rientro trova il ramo pronto e la sceglie lui. Creare il ramo del proprio lavoro invece si può — anzi si deve.
- Annota il pezzo nel registro: `npm run consumi:compito -- "<nome del lavoro>"` con `--da`/`--a` per delimitarlo. Non è burocrazia: è quello che rende affidabile il punto 3.2 la prossima volta.

**Se la coda si svuota e avanza tempo** (deciso da Jacopo il 6/8/2026): pesca **solo item piccoli già scritti in roadmap** — le "trovate per strada", il debito tecnico minuto — cioè cose già tracciate, a basso rischio, che non richiedono una sua decisione. **Vietato** iniziare una V nuova, spezzare un file-mostro non assegnato, o toccare schema e permessi per riempire il tempo.

⚠️ Resta in vigore la regola di sempre: **le cose che trovi per strada vanno in roadmap, non nel lavoro in corso.** Lavorare da solo non è il permesso di allargare il perimetro — è il contrario, perché nessuno può fermarti.

## 4. I limiti di sicurezza

**Ci si ferma e si parcheggia** (mai decidere da soli):

- **Sospetto conflitto col lavoro di Claudio.** È già regola di `CLAUDE.md` e qui vale doppio.
- **Decisioni di prodotto:** nomi, etichette, comportamento dell'interfaccia, cosa deve vedere l'utente. Il re-naming in corso richiede esplicitamente che guidi Jacopo.
- **Migrazioni del database.** Toccano anche il DB dell'altra persona.
- **Qualsiasi cosa irreversibile:** cancellare file o dati, riscrivere la storia di git, terminare processi che non sono di questa sessione.
- **Qualsiasi cosa che esce:** invii, pubblicazioni, acquisti, credenziali.
- **Una richiesta con due letture** che porterebbero a lavori materialmente diversi.

**Si decide e si annota** (senza fermarsi): dove mettere un file, come chiamare una funzione interna, come strutturare un test, l'ordine delle estrazioni, la formulazione di un commento. Sono le scelte che un collega farebbe da sé senza chiedere.

**Tre condizioni fermano tutto, anche a tempo residuo:**

1. **La finestra delle 5 ore si sta caricando.** Rilancia `npm run consumi` circa a metà del budget. Il monitor non legge la percentuale del limite — dà un'indicazione relativa — ma se la finestra risulta già pesante, **chiudi in anticipo**: peggio di non aver fatto abbastanza è che l'utente torni e non possa lavorare.
2. **Una richiesta di permesso ha bloccato uno strumento.** Non insistere con varianti per mezz'ora: annota, aggira se puoi, altrimenti parcheggia quel pezzo e passa al successivo.
3. **Qualcosa si è rotto e non torna verde.** Se dopo un tentativo serio i test o la build restano rossi, **riporta l'albero a uno stato committabile** (o non committare quel pezzo) e parcheggia. Non lasciare mai il lavoro in uno stato peggiore di come l'hai trovato.

## 5. Come si parcheggia una domanda

Un elemento parcheggiato non è "una cosa che non ho fatto". È **una decisione pronta da prendere in trenta secondi** quando l'utente torna. Quindi scrivila già istruita:

- **cosa stavo facendo** e a che punto ero;
- **cosa mi ha fermato**, in una frase;
- **le opzioni concrete** (due o tre, non "cosa vuoi fare?"), ognuna con la sua conseguenza;
- **quale sceglierei io e perché**;
- **cosa resta bloccato** finché non decide.

## 6. Il rapporto al rientro

Scrivi il rapporto in **`archivio-documenti/rapporto-al-rientro.md`**, e solo dopo riassumilo in chat.

**Su file, non solo in chat**, per la stessa ragione per cui le domande vanno in roadmap: la chat finisce. Se la sessione muore mentre l'utente è via, il file resta.

⚠️ **Prima di scrivere, leggi il file se esiste già:** se contiene domande di un giro precedente **ancora senza risposta**, riportale nel nuovo rapporto invece di sovrascriverle. Il file è uno solo e si riscrive ogni volta — le domande non devono cadere nel mezzo.

Struttura:

```markdown
# Rapporto al rientro — <data e ora di inizio> → <ora di fine>

## Fatto e committato
<Un punto per pezzo concluso, con il messaggio di commit. In parole semplici: cosa cambia, non quali file.>

## Da decidere (parcheggiato)
<Le domande, nel formato del punto 5. Se non ce n'è, scrivi "niente".>

## Dove sono arrivato
<Il punto esatto in cui mi sono fermato e perché: budget finito / coda vuota / finestra carica / bloccato.>

## Come si riparte
<Il prossimo passo concreto, già pronto.>

## Stato della macchina
<Dev server accesi o spenti e su quali porte · test e build verdi o no · eventuali migrazioni nuove.>
```

Poi, in chat, dai **solo il riassunto**: cosa è stato chiuso, e le domande parcheggiate una per una. Se una domanda parcheggiata è una vera scelta di prodotto che non si esaurisce sul momento, **portala anche in roadmap** — è la regola del progetto.

Sui dev server: se li hai accesi tu per una verifica e non servono più, spegnili. Quelli che non sono di questa sessione **non si toccano**: si segnalano soltanto.

---

## In sintesi

Avanzi a pezzi interi, committi e pushi ognuno appena chiude, non decidi mai al posto suo sulle cose che contano, ti fermi prima di far male, e lasci un foglio che si legge in un minuto.
