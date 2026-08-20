# Team di agent — com'è fatto, perché, e cosa è stato scartato

> **Cos'è un agent (per chi non l'ha mai usato).** Un "agent" è un assistente secondario che parte a memoria vuota, riceve un compito preciso, se lo sbriga per conto suo e torna con una risposta breve. Non ha visto la conversazione in corso e non la vede: legge quello che gli serve da solo. I file che lo definiscono stanno in `.claude/agents/`, uno per agent.
>
> **A chi serve questo documento.** A tutte e due le persone del progetto, e alle sessioni future. Contiene il team attuale, come si misura se sta rendendo, e — in fondo — l'**archivio delle alternative scartate**.

Creato il 23/7/2026 da Jacopo. Concordato con Claudio prima di procedere.

---

## 1. Il contesto economico — leggilo prima di tutto il resto

Il progetto gira su un **abbonamento Max 20x** (etichetta letta da `/usage` il 3/8/2026; prima qui era scritto "5x" per errore). Questo cambia completamente il senso della parola "costo":

- **Non si paga a token.** Nessuna cifra in euro è rilevante.
- L'unico vincolo vero è **restare dentro la finestra di consumo di 5 ore**, per non prendere un blocco a metà di un lavoro.
- Quindi "ottimizzare i costi" qui significa una cosa sola: **non arrivare al muro**.

### Da dove viene davvero il consumo

Misurato sulle prime 38 sessioni del progetto (6.576 chiamate, da giugno a luglio 2026):

| voce | quota del consumo |
|---|---:|
| **Rilettura della cache** — la conversazione ripresentata al modello a ogni turno | **56%** |
| Scrittura della cache | 32% |
| Token scritti dall'AI | 12% |
| Ingresso non in cache | ~0% |

Più della metà del consumo **non è lavoro nuovo: è la stessa conversazione riletta ogni volta.** Ecco perché una sessione lunga, con file enormi aperti dentro, non consuma in proporzione alla sua lunghezza ma molto di più.

### La conseguenza controintuitiva

> **Un agent che legge tanto e risponde poco fa RISPARMIARE.**

Quando l'esploratore va a leggersi le 10.000 righe di `agency.service.ts`, quelle righe restano **nel suo contesto** e tornano indietro come mezza pagina di risposta. Non entrano nella sessione principale, quindi non vengono rilette a ogni turno successivo per il resto della giornata.

Su queste sessioni il conto è a favore dell'agent con ampio margine. **Il team agentico qui non è una decisione di spesa: è una decisione di capacità** — serve ad arrivare a fine giornata senza sbattere contro il limite.

Corollario, altrettanto importante: un agent che **risponde con papiri** o che **viene chiamato in continuazione** perde tutto questo vantaggio e diventa un costo netto. È il primo controllo che fa l'architetto.

### I numeri di partenza (23/7/2026)

| | |
|---|---:|
| Sessioni misurate | 38 |
| Chiamate totali | 6.576 |
| **Picco in una finestra di 5 ore** | **117,7 unità** (7/7/2026, ore 14:27) |
| Sessione mediana | 42,8 unità |
| Consumo finito in subagent | **0%** (mai usati prima di oggi) |

L'ultima riga è preziosa: **la base di confronto è pulita.** Qualunque cosa comparirà nella voce "subagent" d'ora in poi è attribuibile al team, e si potrà giudicare sui numeri invece che sulle impressioni.

*("Unità" = i vari tipi di token riportati a una scala unica usando i prezzi di listino come proporzione. **Non è una spesa**: con l'abbonamento non si paga a token. È un indicatore di quanto si sta consumando la finestra.)*

---

## 2. Il team

Tre agent. **Nessuno dei tre può modificare file**: non hanno gli strumenti di scrittura.

| Agent | Quando lo chiami | Cosa ti torna | Modello |
|---|---|---|---|
| **esploratore** | *prima* di scrivere codice | la mappa: file da toccare e **lista completa dei punti da collegare** | Sonnet |
| **revisore** | a ogni tappa di lavoro conclusa | le segnalazioni, dalla più grave alla meno grave | Opus |
| **architetto** | ogni 5-10 sessioni, o quando i consumi preoccupano | il quadro dei consumi e le **proposte** di modifica al team | Opus |

### Chi li chiama

**Li chiama l'assistente da solo, non la persona.** Non c'è nessun comando da digitare: la descrizione di ciascun agent dice all'assistente quando usarlo, e in `CLAUDE.md` ci sono le condizioni verificabili che fanno scattare la chiamata (dimensione del file toccato, presenza di un permesso/rotta/tabella nuovi, area del codice, tappa di lavoro raggiunta). Sono scritte come condizioni e non come consigli proprio perché non dipendano da un giudizio a caldo.

> ⚠️ **Il limite onesto:** questo resta un innesco *deciso da un modello*, quindi non è garantito al 100% come lo sarebbe un controllo automatico. Il modo per accorgersene è già dentro il sistema: se l'architetto rileva una **quota subagent vicina a zero**, vuol dire che gli agent esistono ma non li chiama nessuno — e a quel punto o le condizioni sono scritte male, o vanno rese vincolanti in altro modo. È il primo controllo che l'architetto è tenuto a fare.

### Come si incastrano nel lavoro reale

```
      inizio lavoro                  durante                      fine
           │                            │                          │
    ┌──────▼──────┐              ┌──────▼──────┐            ┌──────▼──────┐
    │ esploratore │  ──lista──▶  │  si scrive  │  ──────▶   │  revisore   │
    │  "dove?"    │              │   il codice │            │ "manca?"    │
    └─────────────┘              └─────────────┘            └─────────────┘
           ▲                                                       │
           └───────── la lista è quella che il revisore spunta ─────┘
```

**Il punto chiave della coppia:** l'esploratore consegna la lista dei punti da collegare *prima* che si scriva una riga; il revisore non deve *scoprire* cosa mancava, deve **spuntare quella lista**. È un controllo, non un'autopsia. Senza la lista iniziale, qualunque revisione arriva tardi per costruzione.

### Il revisore non è legato al commit

Legge le modifiche **non ancora committate**, quindi funziona in qualsiasi momento. Le tappe giuste:

1. **dopo schema + migrazione**, prima di costruirci sopra — è la cosa più costosa da disfare;
2. **dopo il collegamento** (catalogo permessi, `app.ts`, `RouteList`, `SidebarMenu`, costanti frontend) — è dove vivono gli errori silenziosi;
3. **prima del commit** — passata finale.

**Default: due chiamate per pezzo di lavoro** (dopo il collegamento e prima del commit). Si sale a tre o quattro solo quando si toccano schema, permessi o generazioni AI. "Revisione continua" è precisamente ciò che l'abbonamento non consente.

E **non** su codice a metà: su lavoro incompleto produce rilievi che sono artefatti dell'incompletezza, pagati a caro prezzo.

---

## 3. Il misuratore dei consumi

```bash
npm run consumi
```

Legge i registri che Claude Code scrive in locale per ogni sessione (`~/.claude/projects/…` — **tutti i progetti**, perché il limite è dell'account) e stampa, in italiano corrente: a che punto sei della finestra di 5 ore, di chi è il consumo quando lavori su più progetti, **se il team di agent si sta ripagando**, e dove finisce il consumo.

- `--tecnico` → aggiunge i numeri grezzi (pesi, chiamate, ultimi agent chiamati)
- `--json` → gli stessi dati in forma leggibile da un programma
- `--scrivi` → aggiunge una riga a `archivio-documenti/consumi/registro.md` (il registro delle rilevazioni, condiviso fra le due persone)
- `--finestra-a "2026-07-31T09:50Z"` → peso di una finestra di 5 ore già passata; serve a **ricalcolare i campioni di calibrazione** quando cambia il modo di pesare (vedi nota operativa #39)

```bash
npm run consumi:compito -- "spezzatura ClientsList, giro 2"
```

Annota un **pezzo di lavoro concluso** in `archivio-documenti/consumi/registro-compiti.md`: durata, consumo, **velocità (unità/min = consumo/durata, dal 4/8/2026)**, quali agent sono stati usati e quanto hanno fatto risparmiare. La velocità risponde alle domande di **capacità** della finestra (rate × durata contro le 5 ore) e **non giudica gli agent** — per quello valgono risparmio e confronto a parità di compito. Serve a confrontare lavori **simili fra loro** (i giri di spezzatura dei file, per esempio) e capire così se chiamare l'esploratore convenga: non serve un periodo "senza agenti", perché le sessioni variano troppo per tipo di lavoro e la differenza sparirebbe nel rumore. Per difetto conta la sessione in corso; con `--da 10:30` si parte da un'ora precisa, e con `--da`/`--a` in formato ISO si annota anche un lavoro di giorni prima.

**Da fare a fine sessione**, insieme all'handoff, per ogni pezzo di lavoro chiuso: il registro ha senso solo se si accumula.

**Non manda niente da nessuna parte.** Legge file locali, stampa, e scrive solo i due registri qui sopra quando glielo si chiede.

### Come si legge il bilancio degli agent

Il conto è tutto misurato dai registri: quanto contesto un agent ha accumulato leggendo, quanto ne ha riportato indietro, quanto è costato, e quante risposte sono arrivate dopo (ognuna avrebbe riletto quel testo, se fosse rimasto in conversazione). Tre avvertenze per non leggerlo storto:

- È un **tetto massimo**, non un valore prudente: in conversazione quel testo avrebbe fatto scattare la compattazione, che taglia le riletture.
- Il **team di progetto** e gli agent di serie di Claude Code (`Explore`, `Plan`) sono contati **separatamente**: la domanda "teniamo esploratore e revisore?" si decide sui nostri.
- Nel registro per compito consumo e risparmio hanno lo **stesso perimetro temporale**, quindi un agent chiamato in chiusura (il revisore, per contratto) risulta piccolo o negativo: le riletture che avrebbe evitato cadono nel compito dopo. Il revisore non si tiene per far risparmiare token, ma per trovare errori.

Ognuno legge i propri registri, che stanno sul proprio computer. Il registro su git è ciò che rende confrontabili i numeri delle due persone.

### La calibrazione — richiede un gesto manuale, e non c'è modo di evitarlo

Il monitor sa dire *quanto* si è consumato, ma non *che percentuale del limite* sia. Verificato il 23/7/2026, con esito negativo su tutti e tre i fronti:

| dove ho cercato | esito |
|---|---|
| un comando che riporti l'uso | nessun eseguibile `claude` sulla macchina: si usa l'app desktop e VS Code, dove `/usage` apre un pannello che l'assistente non può né lanciare né leggere |
| un file locale con la quota | in `~/.claude/` ci sono solo impostazioni, sessioni, task e lock: **nessuna traccia di quota o limiti** |
| il dato dentro i registri di sessione | il campo `rateLimits` esiste ma è **sempre `null`**: si popola solo se un limite scatta davvero |

Quindi: **senza un gesto manuale la percentuale non è raggiungibile.** Però —

- **Senza calibrazione il monitor è già utile**, perché parla *in relativo alla propria storia*: «in questa finestra sei a 60 unità, il tuo picco storico è 117». La percentuale è un miglioramento, non un prerequisito.
- **Un punto di calibrazione arriva gratis** se un blocco scatta davvero: resta scritto nel registro di sessione e il sistema lo raccoglie da solo.

**Procedura, quando l'assistente la chiede:**
1. scrivi `/usage` nella casella dell'app;
2. passa all'assistente la percentuale riportata;
3. finisce in `archivio-documenti/consumi/calibrazione.json`.

Servono **3-5 letture prese a livelli di carico diversi**. Un campione preso a consumo basso non dice nulla su come si comporta la curva vicino al limite: per questo l'assistente la chiede **quando la finestra è già carica**, e appoggiata a qualcosa che si sta già facendo (tipicamente l'handoff di fine sessione), non interrompendo il lavoro.

---

## 4. Come si modifica il team

**Solo l'architetto propone; nessun agent applica.** Il ciclo:

1. si chiama l'**architetto** → misura, valuta, propone (massimo tre proposte, ognuna con costo stimato e risparmio atteso);
2. **la persona decide** — è qui, e solo qui, che si spende;
3. se approvata, la modifica la applica **la sessione principale** (non l'agent);
4. la decisione si annota nel registro in fondo a questo documento.

L'architetto è tenuto a proporre anche **di spegnere** un agent che non rende, incluso se stesso.

> ⚠️ **Un limite da conoscere, dichiarato apertamente.** I tre agent non hanno gli strumenti `Write`/`Edit`: quello è un blocco vero, non un'istruzione. Ma revisore e architetto hanno accesso a comandi di terminale ristretti (`git diff…` per il revisore, il solo script dei consumi per l'architetto). Se quella restrizione per comando non venisse applicata dallo strumento, resterebbe un margine teorico che **nessuna istruzione può eliminare del tutto**. L'esploratore, che non ha alcun accesso al terminale, è l'unico dei tre in sola lettura al 100%.

---

## 5. Archivio delle alternative — materiale di consultazione, NON un vincolo

> **Come va letto.** Quello che segue è il ragionamento fatto il 22-23 luglio 2026 sulla configurazione da adottare, con tutto quello che è stato **considerato e scartato**. Sta qui per essere **ripescato se il contesto cambia**, non per pesare sulle decisioni future. Nessuna riga di questa sezione va trattata come una regola: se un domani conviene fare il contrario, si fa il contrario. Serve solo a non rifare da zero un'analisi già fatta, e a sapere *perché* qualcosa era stato lasciato indietro.

### 5.1 Configurazioni di team valutate

**A — "Due occhi" (2 agent, sola lettura).** Esploratore + revisore. Adottata, poi estesa a tre con l'architetto.
*Motivo della scelta:* miglior rapporto beneficio/costo, rischio nullo perché nessuno scrive, e partenza abbastanza piccola da poter essere valutata sui numeri.

**B — "Squadra di modulo" (5 agent, uno con permesso di scrittura).** Aggiungeva:
- `impalcatura-modulo` — genera lo scheletro di un modulo nuovo (le quattro parti backend + voci nel catalogo permessi + collegamenti frontend) copiando un modulo esistente come modello. **Con permesso di scrittura.**
- `collaudatore-ai` — verifica che una generazione AI sia stata davvero usata, secondo le note operative #30 e #32.
- `allineatore-contratto` — confronta le chiamate del frontend con le rotte del backend e segnala i disallineamenti.

*Perché scartata (per ora):*
- `impalcatura-modulo` — **quanti moduli nuovi da zero restano da fare?** Dalla V6 in poi la roadmap estende quasi sempre roba esistente. Costruire una fabbrica di moduli quando i moduli sono quasi finiti è spesa a fondo perduto. Inoltre ogni esecuzione deve rileggersi un modulo campione (5.000+ righe) per replicarne lo stile.
- `collaudatore-ai` — **idea buona, nata da un dolore vero e documentato** (quattro note operative su questo). Rimandata solo per non partire con troppa roba insieme. Attenzione se si riprende: fa **chiamate vere alle API a pagamento** — vanno vincolati modelli economici e dati di prova, come già scritto nella nota operativa #29.
- `allineatore-contratto` — **idea buona.** Nasce da un fatto reale: 314 file `.js/.jsx` contro 8 `.ts` in `src/`, e il `tsconfig.json` include solo `server` e `prisma`. Il frontend è **fuori da ogni controllo automatico**: se il backend cambia la forma di una risposta, nulla se ne accorge finché non lo si vede a schermo. Rimandata per non partire troppo larghi.

**C — "Fabbrica" (7+ agent che scrivono in parallelo, ognuno su una copia del repo).** Scritture frontend/backend/test separate, migrazioni, revisori di design e sicurezza, agent di documentazione.
*Perché scartata, con tre motivi concreti già scritti nei documenti di progetto:*
- si pusha **sempre su `main`, niente branch** → più agent che scrivono in parallelo producono conflitti su un solo ramo, invisibili finché non esplodono;
- **un solo set di dev server per volta, e Prisma tiene un lock** (`CLAUDE.md` e nota operativa #28) → gli agent potrebbero scrivere in parallelo ma **non verificare** in parallelo: si metterebbero in coda sullo stesso database;
- il consumo sarebbe fuori scala rispetto alla finestra dell'abbonamento.

### 5.2 Cose che è stato deciso di NON trasformare in agent

Elencate perché è la domanda che tornerà: *"e se facessimo un agent che…"*.

| Cosa | Perché no |
|---|---|
| **L'handoff di fine sessione** | Il caso più importante. Un agent parte a **contesto vuoto e non ha visto la sessione**: ricostruirebbe l'handoff solo da git, scrivendone uno peggiore. Il comando `/handoff` funziona proprio perché gira *dentro* la conversazione. |
| **Le regole di progetto** (staffetta, migrazioni, ciclo dei dev server, token colore) | Stanno in `CLAUDE.md`, che si carica **da solo in ogni sessione, gratis**. Un agent che le ripete crea una seconda versione che diverge in silenzio appena si aggiorna l'originale. |
| **Le note operative** (`note-operative-ai.md`) | Il meccanismo di auto-aggiornamento funziona già. Attenzione al risvolto: il file pesa 56 KB ≈ 15.000 token. Se ogni agent dovesse leggerlo per intero, partirebbe con quella zavorra: per questo gli agent **citano le note per numero** invece di ricopiarle. |
| **Un guardiano dei colori** | Esistono già `npm run lint:css` e `npm run lint:colors`, che fanno lo stesso lavoro a costo zero e senza sbagliare. |
| **La roadmap / la bibbia** | Sono decisioni umane, non lavoro delegabile. |

### 5.3 Scelte di forma, con il perché

- **L'architetto è un agent, non un comando.** Prima proposta sbagliata e corretta: si era detto che un agent "non può fermarsi a chiedere l'autorizzazione". Vero ma irrilevante — il cancello non sta *dentro* il processo, sta *dopo*: l'agent produce una proposta, la proposta torna alla persona. E un agent **senza strumenti di scrittura** è un freno più solido di un comando che gira nella sessione principale, il quale avrebbe a disposizione *tutti* gli strumenti, scrittura compresa.
- **Il conteggio è uno script, non un agent.** Non è un'alternativa più povera: è **lo strumento dell'agent**. Macinare 6.576 chiamate dentro 107 MB di registri è aritmetica — un modello non può leggere 107 MB, sbaglierebbe i conti e costerebbe token per fare addizioni. Il medico è l'agent, il termometro è lo script.
- **La documentazione sta qui e non in `CLAUDE.md`.** `CLAUDE.md` si carica in ogni sessione: metterci dentro una procedura lunga significa pagarla *sempre*, anche nelle sessioni in cui non serve. In `CLAUDE.md` è rimasto solo un rimando corto.
- **Gli agent puntano ai file, non li ricopiano.** Il repo si muove in fretta (178 commit, con punte di 20 al giorno): un agent che ricopia "un modulo si fa così: [codice]" è vecchio in poche settimane. Meglio "guarda `web-assets` come modello".

### 5.4 Stime poi corrette dai dati veri

Onestà di registro, così non si ripete l'errore. La prima analisi (22/7) diceva: *"i subagent bruciano token, il beneficio è da dimostrare"*, e stimava il costo di una chiamata in 15-80.000 token.

**Quella lettura era incompleta**, e i dati misurati il 23/7 l'hanno ribaltata su un punto: guardava solo i token *nuovi* dell'agent, ignorando l'effetto sul contesto della sessione principale. Con il 56% del consumo che viene dalla **rilettura**, un agent che tiene fuori dalla sessione principale 60.000 token di file risparmia quella rilettura su tutti i turni successivi — molto più di quanto costa farlo girare.

Da cui la riformulazione: **su questo progetto l'esploratore probabilmente si ripaga da solo.** Resta da verificare sui numeri, che è esattamente il compito dell'architetto.

---

## 6. Registro delle decisioni

| data | decisione | chi |
|---|---|---|
| 23/7/2026 | Team iniziale: `esploratore`, `revisore`, `architetto` — tutti senza strumenti di scrittura. Misuratore dei consumi come script. Documentazione qui, rimando corto in `CLAUDE.md`. | Jacopo (concordato con Claudio) |
| 23/7/2026 | Rimandati e non scartati: `collaudatore-ai` e `allineatore-contratto` (vedi 5.1). Da riprendere se l'architetto trova i numeri che li giustificano. | Jacopo |
| 23/7/2026 | Calibrazione della percentuale: nessuna via automatica, verificato. Si procede con letture manuali di `/usage` chieste dall'assistente quando la finestra è carica. | Jacopo |
| 30/7/2026 | Graphify (knowledge-graph esterno per Claude Code) valutato e **non adottato**: legittimo e sicuro, ma carica nel contesto principale (dove si paga la rilettura) invece di isolare come i subagent, e il suo parser **salta i file `.jsx`** (tutto il nostro frontend). Al suo posto una mappa "in casa". | Jacopo |
| 30/7/2026 | Riparato `consumi.mjs`: ora legge ricorsivamente le sottocartelle `subagents/`. La quota subagent risultava 0% per un **bug**, non per non-uso (~54 invocazioni reali). Vedi nota operativa #36. | Jacopo |
| 30/7/2026 | Nuovo strumento `scripts/agenti/mappa.mjs` (`npm run mappa`) → `archivio-documenti/mappa/mappa-progetto.md`: mappa strutturale deterministica (moduli+export, catena permessi, centralini, modelli Prisma, indice doc grossi, file-mostro). Esploratore e revisore la leggono come punto di partenza. Guardia anti-staleness (fail-on-diff in pre-commit/CI, proposta dall'architetto): **da decidere**. | Jacopo |
| 4/8/2026 | Jacopo dichiara **pieno potere decisionale in sessione**: gli avvisi a Claudio restano come informazione negli handoff ma **non sono mai bloccanti**. | Jacopo |
| 4/8/2026 | Analisi architetto su "procedure lente": il team pesa il 10-13% di un giro e rende (esploratore 5,7x); il collo di bottiglia è la macchina (suite: 64% del tempo in avvio ambienti; 3 poi 14 file su 28 con worker mai partiti). **Adottate A** (velocizzare la suite: `pool: 'threads'` in `vite.config.js`, applicata e misurata il 4/8 — primo giro completo verde, 12 min contro 18-27, zero worker morti; `isolate: false` provato lo stesso giorno e **ritirato**: sdoppia i `vi.mock` per-file, 11 rossi finti; esclusione antivirus a cura di Jacopo, da misurare separatamente) **e B** (regola in CLAUDE.md: durante il lavoro solo la cartella toccata, suite intera una volta prima della revisione finale, in background). | Jacopo |
| 4/8/2026 | **Opzione C adottata**: sotto le ~1.000 righe un file-mostro si spezza in **un giro solo** — l'esploratore consegna il piano completo di estrazione (sezione dedicata aggiunta in `.claude/agents/esploratore.md`: blocchi, ordine, confini, test), si committa per estrazione dentro il giro, **revisione singola** per i refactor senza schema/permessi/AI (regola di CLAUDE.md allineata alla pratica del registro). | Jacopo |
| 4/8/2026 | **Guardia mappa: adottata in forma leggera** (chiude la proposta del 30/7): hook pre-commit in `.githooks/` che rigenera la mappa (sub-secondo, non bloccante), attivazione una tantum `git config core.hooksPath .githooks`. Scartata la forma fail-on-diff: la mappa non è committata, un fallimento aggiungerebbe attrito senza certificare di più. | Jacopo |
| 4/8/2026 | **Metrica dei consumi, precisata su domanda di Jacopo**: la velocità (unità/min) è la chiave per le domande di **capacità** ("possiamo permetterci questo modo di lavorare nella finestra di 5 ore?" — sciami, configurazioni pesanti); il **beneficio degli agent** si misura invece col **bilancio controfattuale** (costo dell'agent vs riletture evitate, già nel monitor) e col **confronto a parità di compito** nel registro (unità per giro simile, unità/100 righe). La velocità NON va usata per giudicare gli agent: il parallelismo alza le unità/min anche quando abbassa le unità totali del lavoro. | Jacopo |
| 4/8/2026 | **Sciame di agent con orchestratore: non adottato oggi** (non attacca il collo di bottiglia; aggraverebbe la contesa I/O; il parallelismo semplice esiste già senza orchestratore). Correzione di Jacopo sulla misura: il margine di consumo osservato (~40% di finestra) è un **artefatto della sua scelta** di chiudere le sessioni prima della saturazione del contesto — i consumi vanno ragionati in **velocità (unità/minuto)**, non in riempimento medio; il terzo motivo anti-Fabbrica del 23/7 (consumo fuori scala) va quindi **ri-argomentato in unità/min**, non dato per decaduto. **Condizione di riapertura**: se dopo A e B un giro di spezzatura resta sopra l'ora con il tempo in analisi (non in macchina), si valuta **un agent pianificatore in più** — non uno sciame. | Jacopo |
| 19/8/2026 | **Si passa a Paperclip**, piattaforma su cui più agent con un mestiere preciso lavorano su una bacheca di compiti, svegliandosi da soli a orari stabiliti. Impianto su VPS Hostinger, due utenti pari grado. **Tutto il lavoro ci si sposta dentro, release di settembre compresa.** Team di **dieci mestieri**: capocantiere, esploratore, sviluppatore backend, sviluppatore frontend, revisore, guardiano (permessi e sicurezza), collaudatore (browser), cronista, capo del personale (è l'`architetto` rinominato), collaudatore AI (nasce spento). Piano completo in `piano-paperclip-2026-08-19.md`. | Jacopo |
| 19/8/2026 | **La regola «si pusha sempre su `main`, niente branch» decade**: si lavora su rami e `main` si tocca solo per unione. Il motivo è la **messa online**, non Paperclip. ⚠️ **Conseguenza sull'archivio delle alternative (§5.1):** il primo dei tre motivi per cui la configurazione **C — «Fabbrica»** era stata scartata il 23/7 **non vale più**. Il secondo (contesa sui server di sviluppo e lucchetto Prisma) resta aperto; il terzo (consumo fuori scala nella finestra dell'abbonamento) **peggiora**, perché adesso alla stessa finestra attingono gli agent più tutte e due le persone. La riga del §5.1 **non è stata riscritta**: registra il ragionamento di allora, e si legge insieme a questa. | Jacopo |
| 19/8/2026 | **Correzioni di allineamento eseguite**: `architetto.md` diceva «abbonamento MAX 5x» (è Max 20x dal 3/8); la regola sui rami è stata riscritta in `CLAUDE.md`, `.claude/commands/handoff.md` e `.claude/commands/vado.md`. In `vado.md` cambia anche la chiusura di un pezzo: si committa **sul ramo del lavoro in corso**, e **unire a `main` non è mai una decisione dell'assistente**. | Jacopo |
