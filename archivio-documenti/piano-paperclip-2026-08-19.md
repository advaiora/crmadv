# Passaggio a Paperclip — piano d'impianto dell'azienda di agent

**Scritto il:** 19 agosto 2026
**Per:** Jacopo e Claudio
**Stato:** piano approvato nelle sue scelte di fondo, **non ancora eseguito**. Nessuna macchina creata, nessun agent costruito, nessun file del CRM modificato.

> **Documento tecnico.** È la versione completa, quella da cui si costruisce davvero l'azienda. Per il quadro d'insieme con gli schemi visivi c'è `paperclip-quadro-insieme.html`, che si apre con un doppio clic. Descrivono la stessa cosa: se divergono, **vince questo**.

---

## 0. Come leggere questo documento

Dodici capitoli: **come funziona l'azienda** (§1), **chi la compone** (§2), **cosa decide da sola e cosa no** (§3), **come si difende dal difetto principale degli agent** (§4), **come impara** (§5), **cosa eredita dal metodo attuale** (§6), **come ci lavorate in due** (§7), **come ci entra la roadmap** (§8), **come si costruisce** (§9), **cosa serve alla macchina** (§10), **il passaggio futuro alle API** (§11), **rischi e punti aperti** (§12).

**Una premessa di metodo, perché cambia la lettura del §10.** Questo piano parte da **cosa serve**, non da cosa la macchina regge — indicazione esplicita di Jacopo del 19/8/2026: *«pianifica orientandoti in maniera oggettiva; se poi ci ritroveremo con problemi dovuti all'abbonamento o all'hosting, sono affari nostri»*. Perciò il capitolo sulla macchina sta **in fondo** ed è una **conseguenza** dell'organigramma, non un vincolo che l'ha rimpicciolito.

---

## 1. Come funziona l'azienda

### 1.1 In dieci righe

Oggi il lavoro è **una conversazione**: si apre una sessione, si spiega cosa serve, si lavora, e alla fine si scrive un handoff perché la conversazione muore e con lei la memoria.

Su Paperclip il lavoro diventa **una bacheca di compiti con dei mestieri intorno**. C'è un elenco di compiti e degli agent con un mestiere preciso che se li prendono uno alla volta. Ogni compito ha uno stato (da fare, in lavorazione, in revisione, fatto), **un solo proprietario per volta** — garantito dal database, non dalla buona volontà — e la traccia di tutto ciò che è successo dentro. Gli agent si svegliano da soli a orari stabiliti, guardano se c'è lavoro per loro, lo fanno, e tornano a dormire.

Voi due non scrivete più codice attraverso una chat: **decidete, approvate e correggete**, dal cruscotto o da Discord.

### 1.2 Il giro di un compito

Esempio reale: la voce ② dell'ordine di lavorazione della release, «cambio password».

1. **Il compito nasce** — lo aprite voi, o lo apre il **capocantiere** leggendo il piano. Nasce con dentro il pezzo di piano che lo descrive.
2. **Il capocantiere lo prepara**: verifica che sia della misura giusta (deve chiudersi in un commit sensato), lo lega al suo traguardo, e se ricorrono le condizioni ci attacca la richiesta di mappa.
3. **L'esploratore fa la mappa** — l'elenco esatto dei file da toccare e dei collegamenti da non dimenticare — e la scrive **dentro il compito**, dove resta.
4. **Lo sviluppatore prende il compito**, si crea il ramo, lavora, fa girare i test della zona toccata, committa.
5. **Il guardiano controlla permessi e sicurezza**, se il compito li tocca.
6. **Il revisore controlla il resto.** Se trova qualcosa, il compito torna indietro **da solo**, senza disturbare nessuno.
7. **Il collaudatore apre la pagina nel browser**, la prova, allega gli screenshot al compito.
8. **Il cancello.** Il compito passa in *da approvare*: arriva su Discord con i pulsanti. Approvate → si unisce. Rifiutate → torna indietro col vostro motivo.
9. **Il cronista registra**: aggiorna il piano, colloca ciò che è stato trovato per strada, scrive il riepilogo della giornata.

Il giro è lo stesso di adesso. Cambia una cosa sola, ed è quella che conta: **i passaggi non stanno più nella testa di un assistente dentro una conversazione, stanno nel sistema** — quindi non si dimenticano, non si saltano quando si va di fretta, e si vedono da fuori mentre succedono.

### 1.3 Cosa cambia per voi due

| | Oggi | Domani |
|---|---|---|
| **Dove si lavora** | Sul portatile, una sessione per volta | Su una macchina sempre accesa |
| **Come si chiede una cosa** | La si spiega a voce in chat | Si scrive un compito, o lo scrive il capocantiere dal piano |
| **Chi ricorda** | L'handoff, scritto a mano a fine sessione | Il compito stesso, più la traccia delle attività |
| **Lavoro in autonomia** | Eccezione, si accende con `/vado` | **Normale.** È la supervisione a essere l'eccezione |
| **Il vostro ruolo** | Scrivete a un assistente | Approvate, rifiutate, riordinate le priorità |
| **In due** | A staffetta, mai insieme | A staffetta **o** insieme, su rami diversi |
| **Dal telefono** | Niente | Approvate con un pulsante su Discord |

---

## 2. L'organigramma

### 2.1 Il consiglio

**Jacopo e Claudio, pari grado, entrambi con pieni poteri.** Nessuna asimmetria nel software: la distinzione fra operativo e responsabile la reggono le convenzioni. Entrambi possono approvare, rifiutare, mettere in pausa un agent, cambiare le priorità.

⚠️ Con due approvatori pari grado, una richiesta può essere sbloccata da chiunque dei due. Nel weekend è esattamente ciò che serve. In settimana significa che potreste approvare la stessa cosa in due modi diversi a distanza di ore: il rimedio non è software, è il testimone (§7.2).

### 2.2 I mestieri

Nove accesi, uno spento in attesa. Ognuno nasce da un pezzo di metodo che esiste già e ha già dimostrato di servire.

---

#### 🧭 Capocantiere — *decide cosa si fa dopo*

**Da dove nasce:** dalla parte di conversazione in cui si decide il prossimo pezzo, e dal punto 2 di `/vado` («spacchetta il lavoro in pezzi committabili»).

**Cosa fa:** legge il piano della release e la roadmap, li spacchetta in compiti della misura giusta, li mette in fila, li assegna. Quando un compito torna indietro bloccato, decide se riprovare, riformularlo o portarlo al consiglio.

**Cosa NON fa:** **non scrive una riga di codice** e **non inventa lavoro**. Pesca solo da ciò che è già scritto nei documenti di piano. Se gli viene un'idea, la scrive come proposta al consiglio — non se la assegna.

**Perché il limite è così stretto:** è l'agent con più potere di far danno, perché sbaglia in silenzio. Un agent che scrive codice sbagliato lo si vede; un capocantiere che mette in fila i compiti sbagliati fa lavorare benissimo tutti gli altri nella direzione sbagliata, per giorni.

**Battito:** due volte al giorno (mattina e metà pomeriggio), più a chiamata.
**Strumenti:** lettura del repository, scrittura sui compiti. Nessuna scrittura sul codice.

---

#### 🗺️ Esploratore — *dice dove si mette mano*

**Da dove nasce:** esiste già, è `.claude/agents/esploratore.md`. Il mandato si trasferisce quasi parola per parola.

**Cosa fa:** dato un compito, produce l'elenco preciso dei file da toccare e — la parte che conta — **l'elenco dei collegamenti da non dimenticare**: il permesso da aggiungere in cinque posti, la rotta da registrare, la migrazione che serve. Lo scrive dentro il compito.

**Quando viene chiamato** (condizioni verificabili, non «quando sembra utile»): il compito tocca un file oltre le ~800 righe; aggiunge o cambia un permesso, una rotta, una tabella o una colonna; tocca Agency, Web Assets o la chat; oppure non si conosce già con certezza l'elenco completo dei file. **Se non ricorre nessuna, si salta.**

**Cosa cambia rispetto a oggi:** su Claude Code esisteva anche per una ragione economica — teneva fuori dalla conversazione principale il costo di rileggere i file-mostro a ogni turno. **Su Paperclip quella ragione decade**, perché ogni agent ha già il suo spazio. Resta la ragione vera: **l'errore da collegamento incompleto è silenzioso**, e la sua lista è quella che revisore e guardiano spunteranno dopo.

**Battito:** nessuno, solo su assegnazione.
**Strumenti:** sola lettura.

---

#### 🔨 Sviluppatore backend — *server, database, permessi*

**Cosa fa:** Fastify e TypeScript in `server/`, Prisma, migrazioni, catalogo dei permessi, test di backend.

**Regole non negoziabili:** migrazioni tracciate e **mai** `db push`; mai riscrivere una migrazione già applicata; il permesso nasce insieme al pezzo di CRM (regola ①) e i ruoli predefiniti si aggiornano nello stesso lavoro (regola ①-bis); le chiavi tecniche seguono la convenzione dell'elenco in cui entrano (regola ②-bis); il codice nuovo nasce sotto le 500 righe e col suo test.

**Battito:** ogni 30 minuti a coda piena, spento a coda vuota.
**Strumenti:** tutto, **sul suo ramo**. Non unisce mai a `main`.

---

#### 🎨 Sviluppatore frontend — *interfaccia, aspetto, esperienza d'uso*

**Perché è separato dal backend, e non è parallelismo artificiale:** sono due mondi con regole diverse **in questo progetto**. Il backend ha i tipi, il frontend praticamente no (314 file `.js/.jsx` contro 8 `.ts`, e la compilazione dei tipi non lo copre). Il backend ha Prisma e le migrazioni, il frontend ha i token colore e il linguaggio Apple. Le due suite di test sono diverse e hanno problemi diversi. Un solo sviluppatore generico porterebbe addosso il doppio delle regole per usarne metà alla volta.

**Regole non negoziabili:** solo token `var(--…)` o classi Bootstrap, **mai** colori scritti a mano — unica eccezione i blocchi di stampa, che vanno commentati; il codice nuovo nasce col suo test; le soglie di dimensione dei file; il linguaggio di design a sottrazione.

**La sua base di conoscenza è la più ricca del team** (§5.5): con un mestiere dedicato, la bussola del design può diventare un ricettario applicabile invece di un documento di principi.

**Battito:** come il backend.
**Strumenti:** tutto, sul suo ramo.

---

#### 🔍 Revisore — *cerca gli errori tipici di questo progetto*

**Da dove nasce:** esiste già, è `.claude/agents/revisore.md`, ed è il ruolo che **guadagna di più** dal passaggio. Oggi è un agent che qualcuno si ricorda di chiamare; domani è **uno stato obbligatorio del compito**: nessun lavoro arriva al consiglio senza esserci passato. È la differenza fra una buona abitudine e una regola.

**Cosa cerca**, in ordine di quanto fa male — elenco costruito sugli errori che questo progetto ha già commesso: collegamenti incompleti, migrazioni mancanti, generazioni AI che ripiegano in silenzio, colori scritti a mano, convenzioni sbagliate, test mancanti.

**Cosa può fare da solo:** **rimandare indietro il lavoro.** Non serve il permesso di nessuno per dire «manca un pezzo». È il cardine dell'equilibrio del §3: la maggior parte delle correzioni si chiude fra due agent senza svegliare nessuno.

**Cosa non può fare:** approvare. Il suo «per me è pronto» è un parere, non una firma.

**Regola ereditata che resta:** *se lo si chiama su codice palesemente a metà, lo dice e si ferma.*

**Battito:** nessuno, si sveglia sui compiti in revisione.
**Strumenti:** sola lettura, più la lettura delle differenze. **Non modifica niente**: un revisore che aggiusta ciò che trova smette di essere un controllo indipendente.

---

#### 🛡️ Guardiano — *permessi, sicurezza, e che le regole siano state rispettate*

**Perché esiste separato dal revisore:** perché in questo CRM i permessi sono la cosa che si sbaglia più spesso e che costa di più. Un permesso dimenticato **non è un difetto estetico: è una funzione che nessun ruolo può governare**, e non si vede finché qualcuno non ne ha bisogno.

**Cosa controlla, in tre blocchi:**

1. **La catena dei permessi, per intero:** il permesso c'è in `server/auth/rbac-catalog.ts` sia nell'elenco sia nei ruoli che devono averlo? E nel `policies.ts` del modulo? E nelle costanti del frontend? E nel menu, laterale e mobile? E se deve arrivare anche ai **ruoli personalizzati**, c'è la **migrazione dati** di riporto?
2. **La sicurezza del codice nuovo:** un indirizzo fornito dall'utente passa da `server/core/net-guard.ts`? Le chiavi restano cifrate e fuori dai registri? **Ogni interrogazione è filtrata per workspace** — che in multi-azienda è *il* rischio?
3. **Che i cancelli siano stati rispettati:** nessuna unione a `main` senza approvazione, nessuna migrazione passata senza cancello rosso, nessun agent che ha lavorato fuori dal suo ramo.

⚠️ **Cosa NON è, per evitare l'equivoco:** non concede e non nega poteri agli agent. **Segnala guardando indietro, non autorizza guardando avanti.** I poteri degli agent li fissa il consiglio nella configurazione. Un agent che distribuisce poteri ad altri agent sarebbe un punto singolo di rottura capace di aumentarsi i propri.

**Battito:** nessuno, si sveglia sui compiti che toccano permessi o sicurezza (~1 su 3 nella roadmap generale, di più nella release).
**Strumenti:** sola lettura, più `npm run security:vault-hygiene`.

---

#### 🖥️ Collaudatore — *apre la pagina e la prova davvero*

**Da dove nasce:** dall'unico anello che oggi è interamente umano — accendere i server, aprire il browser, guardare se funziona.

**Cosa fa:** naviga, legge la struttura della pagina, clicca, compila i campi, estrae il testo e **fa screenshot**, che allega al compito. Fa girare le suite di test. Verifica i casi che i test non coprono: che un Manager veda «accesso negato», che una maschera salvata e in pausa dica la cosa giusta, che il menu abbia la voce al posto giusto.

**Come:** con la skill `agent-browser` del catalogo opzionale di Paperclip, che rileva un Chrome o Chromium già installato senza pretendere un'installazione dedicata.

⚠️ **Il primo mese darà falsi allarmi.** È nella natura del collaudo automatico d'interfaccia: un pulsante spostato di dieci pixel fa fallire una prova che non doveva fallire. **Non è un motivo per non averlo**, è un motivo per dargli un mese di rodaggio prima di fidarsene.

**Battito:** nessuno, si sveglia sui compiti pronti al collaudo.
**Strumenti:** browser, esecuzione dei test. Non modifica codice.

---

#### 📋 Cronista — *tiene la memoria e i documenti*

**Da dove nasce:** da tre regole di `CLAUDE.md` che oggi sono a carico dell'assistente e che, senza un proprietario, si perderebbero il primo giorno:

- **«le cose trovate per strada vanno in roadmap, non nel lavoro in corso»** — quando un agent incontra un difetto slegato dal compito, lo segnala; il cronista lo colloca nel punto giusto e chiude lì;
- **l'aggiornamento delle note operative**, nel formato *Contesto → Errore → Modo corretto*;
- **il registro dei compiti chiusi**, che serve a sapere quanto costano davvero lavori simili fra loro.

**In più, le due cose nuove:** il **riepilogo di giornata**, erede diretto del rapporto al rientro; e il **passaggio di sessione** quando una sessione va ritirata a lavoro aperto (§4.3) — cioè l'handoff, applicato agli agent.

**Perché è un mestiere e non un pezzo del capocantiere:** sono due tempi diversi. Il capocantiere guarda avanti e ha interesse a che la coda scorra; il cronista guarda indietro e ha interesse a che niente si perda. Nella stessa testa, quando si va di fretta sparisce sempre il secondo.

**Battito:** fine giornata, più a chiamata.
**Strumenti:** scrittura sui documenti dell'archivio. Non tocca il codice.

---

#### 📊 Capo del personale — *guarda la squadra, non il prodotto*

**Da dove nasce:** è l'`architetto` di oggi, rinominato perché «architetto» faceva pensare a chi progetta il software, mentre non tocca il codice nemmeno di striscio.

**Cosa fa:** misura quanto costa ognuno, giudica se sta facendo il lavoro per cui esiste, controlla se **le regole di ingaggio** funzionano (chi si chiama quando, quante volte, in che ordine), legge i numeri del termometro delle sessioni (§4.3), e **propone** — assumere, cambiare mansione, spegnere qualcuno, cambiare una soglia. **Non applica mai niente.**

**Il metro cambia:** non più «quanto contesto ha tenuto fuori dalla conversazione principale» — economia di Claude Code che su Paperclip non esiste — ma **costo per compito chiuso e numero di giri di revisione**, confrontando lavori simili fra loro.

⚠️ Il suo file attuale dichiara *«il progetto gira su un abbonamento MAX 5x»*: informazione superata, va corretta prima di riusarlo.

**Battito:** settimanale.
**Strumenti:** sola lettura, più la lettura dei costi.

---

#### 🧪 Collaudatore AI — *nasce spento*

**Da dove nasce:** era l'alternativa `collaudatore-ai` di `team-agenti.md` §5.1, valutata il 23/7/2026 e **rimandata, non scartata** — *«idea buona, nata da un dolore vero e documentato»*.

**Cosa farebbe:** prende l'uscita delle generazioni AI del CRM — Discovery, contenuti Web e ADV, audit SEO, report — e la misura contro **criteri di dominio che scrivete voi**. Più il controllo già documentato: distinguere una generazione vera da un **ripiego silenzioso**, e verificare che uno schema di uscita strutturata **elenchi davvero i campi** invece di produrre un oggetto vuoto che il sistema registra come «AI usata».

**Perché nasce spento:** oggi avrebbe quasi niente da collaudare. Si accende quando riapre la V5. Ma nasce **adesso**, con il team, perché il giorno che servirà sarà il momento peggiore per progettarlo.

⚠️ **Con tetto di spesa e chiave già impostati prima di essere acceso.** È l'unico agent del team che **fa chiamate vere a pagamento**, anche mentre tutto il resto gira su abbonamento. Il budget non si decide il giorno dell'accensione.

**Battito:** nessuno. Spento.

### 2.3 Il quadro d'insieme

| Mestiere | Tocca il codice | Battito | Stato |
|---|---|---|---|
| 🧭 Capocantiere | ❌ | 2 volte al giorno | acceso |
| 🗺️ Esploratore | ❌ sola lettura | su assegnazione | acceso |
| 🔨 Sviluppatore backend | ✅ solo sul suo ramo | 30 min a coda piena | acceso |
| 🎨 Sviluppatore frontend | ✅ solo sul suo ramo | 30 min a coda piena | acceso |
| 🔍 Revisore | ❌ sola lettura | sui compiti in revisione | acceso |
| 🛡️ Guardiano | ❌ sola lettura | sui compiti con permessi/sicurezza | acceso |
| 🖥️ Collaudatore | ❌ solo prove | sui compiti da collaudare | acceso |
| 📋 Cronista | ❌ solo documenti | fine giornata | acceso |
| 📊 Capo del personale | ❌ sola lettura | settimanale | acceso |
| 🧪 Collaudatore AI | ❌ solo prove | — | **spento** |

**Due scrivono, sette guardano.** Non è squilibrio: è il rapporto giusto per un progetto dove l'errore che costa non è il codice sbagliato — quello si vede — ma **il collegamento a metà, che funziona e mente**.

### 2.4 Cosa NON diventa un agent

| Cosa | Perché no |
|---|---|
| **Un guardiano dei colori** | Esistono `npm run lint:css` e `npm run lint:colors`: stesso lavoro, costo zero, non sbagliano |
| **La roadmap e la bibbia** | Sono decisioni vostre. Il cronista le *aggiorna*, non le *decide* |
| **Un esperto di marketing (o di CRM) che giudica il prodotto** | **Gli esperti di dominio siete voi.** Questo progetto è a corto di tempo e di correttezza meccanica, non di competenza di mestiere. Un parere plausibile ma sbagliato costa **più** di nessun parere, perché va letto e scartato da chi già sapeva la risposta. La versione utile di quell'idea è il collaudatore AI, che non giudica il prodotto ma **misura l'uscita** |
| **Un agent che decide quando ripulire le sessioni** | §4: è una regola, e una regola non degrada mentre un agent sì |
| **Un agent che concede permessi agli altri agent** | §2.2, scheda del guardiano |

---

## 3. I cancelli — autonomia e controllo

### 3.1 Il principio

> **Un agent si ferma quando la decisione è vostra. Non si ferma perché la cosa è importante.**

Confonderli produce i due difetti opposti: fermarsi su tutto ciò che è *importante* trasforma il consiglio in un ufficio approvazioni — e dopo tre giorni si approva senza leggere, che è **peggio** di non approvare affatto perché dà l'illusione del controllo; non fermarsi mai riporta al problema noto, cioè qualcosa che nasce col nome o col permesso sbagliato, non dà errore, e viene fuori settimane dopo.

Il criterio è verificabile: **se sbaglio, si disfa da sola con un altro commit, o ce la portiamo dietro?** Si disfa → decide l'agent. Ce la portiamo dietro → decidete voi.

⚠️ **Un fatto nuovo rende i cancelli più leggeri di quanto sarebbero stati:** con i rami, **sbagliato ma reversibile costa poco**. Un lavoro sbagliato su un ramo si butta con un comando. È il motivo per cui il giallo può avere una scadenza.

### 3.2 La tabella dei cancelli

**🟢 Verde — decide l'agent, da solo, e annota**

Dove mettere un file nuovo · come chiamare una funzione interna · come strutturare un test · l'ordine delle estrazioni quando si spezza un file · la formulazione di un commento · **rimandare indietro un lavoro** (revisore e guardiano) · rifare un tentativo fallito, una volta · creare il proprio ramo e committarci sopra · segnalare una cosa trovata per strada.

**🟡 Giallo — si ferma, parcheggia con le opzioni già istruite, e va avanti con altro**

- **decisioni di prodotto:** nomi, etichette, comportamento dell'interfaccia, cosa vede l'utente;
- **dove va una voce nel menu** (regola già scritta: la collocazione del Registro attività si decide in un confronto);
- una richiesta con **due letture possibili** che porterebbero a lavori materialmente diversi;
- **sospetto conflitto con il lavoro dell'altra persona**.

> ⏱️ **I gialli hanno una scadenza di 12 ore.** Trascorse senza risposta, l'agent **procede con l'opzione raccomandata e lo dichiara nel compito**. Sostenibile perché il lavoro è su un ramo e si disfa con un comando; necessario perché altrimenti il sabato l'azienda si ferma sul primo dubbio. Dodici ore significa «entro la mattina dopo».

**🔴 Rosso — si ferma e aspetta. Nessuna scadenza, nessuna eccezione**

- **unire qualsiasi cosa a `main`**;
- **qualsiasi migrazione del database**;
- **qualsiasi modifica al catalogo dei permessi e ai ruoli predefiniti**;
- **qualsiasi cosa irreversibile:** cancellare file o dati, riscrivere la storia di git, terminare processi non suoi;
- **qualsiasi cosa che esce:** invii di email, pubblicazioni, acquisti, credenziali;
- **assumere un agent, cambiare un battito, installare o sostituire una skill** — quest'ultima perché **aggiornare una skill aggiorna tutti gli agent che ce l'hanno, in un colpo solo**;
- **sforare un budget**;
- toccare un **file fuori norma per dimensione** non assegnato a quel compito.

> ⚠️ **I rossi si approvano dal cruscotto, non da Discord.** Dal telefono si vede un riassunto; per un rosso servono le differenze del codice per intero.

### 3.3 Come si parcheggia una decisione

Formato ereditato da `/vado`, da rispettare alla lettera. **Un elemento parcheggiato non è «una cosa che non ho fatto»: è una decisione pronta da prendere in trenta secondi.**

1. **cosa stavo facendo** e a che punto ero;
2. **cosa mi ha fermato**, in una frase;
3. **le opzioni concrete** — due o tre, mai «cosa vuoi fare?» — ognuna con la sua conseguenza;
4. **quale sceglierei io e perché**;
5. **cosa resta bloccato** finché non si decide.

Su Paperclip diventa una richiesta di approvazione strutturata: il testo è il contenuto, le opzioni sono i pulsanti. **Approvare esegue.**

⚠️ **Un compito parcheggiato non ferma la coda.** L'agent lo lascia e passa al successivo. Se la coda si svuota tutta di compiti sbloccati, allora sì — ed è il segnale che il consiglio è in ritardo, non gli agent.

### 3.4 Cosa vuol dire «fatto»

**Deciso da Jacopo il 19/8/2026: un compito può chiudersi senza che un umano abbia guardato la pagina.** La prova a schermo la fa il collaudatore, gli screenshot restano allegati al compito, e voi **guardate a campione**.

Le condizioni perché un compito arrivi al cancello:

- ✅ i test della zona toccata sono verdi;
- ✅ lint e guardia dei colori puliti;
- ✅ il **revisore** ha dato parere favorevole;
- ✅ il **guardiano** ha dato parere favorevole, se il compito tocca permessi o sicurezza;
- ✅ il **collaudatore** ha provato la pagina e allegato gli screenshot;
- ✅ la lista dei collegamenti dell'esploratore è spuntata per intero.

⚠️ **Cosa comporta la scelta, detto chiaramente:** è la più veloce delle tre possibili, e la più esposta. Il rischio non è il codice rotto — quello lo prendono i test — è **la cosa che funziona e non è quella giusta**: l'etichetta sbagliata, il flusso scomodo, la pagina brutta. Il campione serve a quello, e va guardato davvero, non «quando c'è tempo». **Campione consigliato: le prime cose che il cronista mette nel riepilogo di giornata, una volta al giorno, cinque minuti.**

### 3.5 I tre freni automatici

1. **Il serbatoio si sta caricando.** Sopra una soglia di consumo nella finestra in corso, gli agent si mettono in pausa da soli. ⚠️ **Da costruire: non esiste già pronto** — Paperclip conta i soldi, e su abbonamento i soldi sono zero. Vedi §6 e §12.
2. **Qualcosa si è rotto e non torna verde.** Dopo un tentativo serio, se test o compilazione restano rossi: si riporta il ramo a uno stato coerente, si parcheggia, si passa oltre. **Mai lasciare il lavoro peggio di come lo si è trovato.**
3. **Un permesso ha bloccato uno strumento.** Non si insiste con varianti per mezz'ora: si annota, si aggira se possibile, altrimenti si parcheggia quel pezzo.

---

## 4. La saturazione del contesto

### 4.1 Il problema

È il difetto più segnalato dalla comunità di Paperclip, e il modo in cui si manifesta è ciò che lo rende pericoloso: **la qualità cala dopo molti giri, e quando un agent perde il contesto a metà lavoro riparte da assunzioni nuove in silenzio invece di segnalare il buco.** Non dà errore. Sembra che stia lavorando.

Il rimedio che circola è «riassumere il lavoro completato ogni cinque compiti e troncare le voci vecchie». È un'approssimazione. Qui sotto la versione che funziona meglio e costa meno.

### 4.2 La regola che regge tutto

> **La sessione è usa e getta. La memoria è il compito.**

Su Paperclip l'adapter di Claude Code salva l'identificativo di sessione e lo riprende al battito successivo: **è quello il contenitore che si satura, non l'agent.** L'agent è una scheda — nome, mestiere, budget, a chi risponde, storico dei costi. Buttare la scheda per svuotare il contenitore è il gesto più costoso possibile.

Ma il lavoro vero non è resettare: è **rendere il reset innocuo**. Se la conoscenza di un compito vive nella sessione, azzerarla produce **esattamente il difetto che si vuole curare**. Quindi tutto ciò che serve a riprendere — il mandato, la mappa, le decisioni prese, i tentativi falliti, il perché — **deve stare scritto nel compito, non ricordato**. Se questo è vero, il reset è gratuito e si può fare spesso.

### 4.3 I quattro pezzi

| Pezzo | Cos'è | Costo |
|---|---|---|
| **La regola** | **Un compito, una sessione.** Il compito finisce, la sessione si chiude. Più il tetto nativo di Paperclip sui turni per risveglio (300 di serie, abbassabile) | zero |
| **Il termometro** | Uno script che conta turni, token e **giri di revisione per compito**. Il numero che rivela la degradazione non è la lunghezza: è **quante volte lo stesso lavoro torna indietro** | zero |
| **Il passaggio di sessione** | Quando una sessione va ritirata a lavoro aperto, scrive **dentro il compito** ciò che sapeva e il compito non dice ancora: cosa è stato provato e scartato, di cosa diffidare, dove si era arrivati davvero. Lo fa il cronista, con le regole del `/handoff` — **compresa la regola anti-scorie**: *niente si dichiara in sospeso senza averlo verificato adesso* | basso, solo quando serve |
| **Il medico** | Il capo del personale legge i numeri e propone di cambiare le soglie | settimanale |

⭐ **È il punto in cui l'handoff non muore: cambia soggetto.** Non è più Jacopo che scrive a Jacopo, è la sessione che scrive alla sessione che la sostituisce. Il formato resta lo stesso perché il problema è lo stesso.

⚠️ **Cosa NON risolve:** le allucinazioni in generale. Il reset cura la degradazione *da saturazione*. Un agent fresco che si inventa una funzione inesistente resta un problema, e la difesa sono revisore, guardiano, test e cancelli. **Da non fidarsi del meccanismo oltre ciò che fa.**

---

## 5. La conoscenza: skill e note

### 5.1 Paperclip non genera niente

Verificato: **Paperclip non produce nessuna conoscenza di dominio e nessun prompt di sistema.** Fornisce skill di serie che parlano solo di **come si usa Paperclip** (procedura del battito, gestione dell'azienda, come si assume un agent, come si convertono i piani in compiti) — **non modificabili né cancellabili**, si ricreano a ogni reinstallazione — più un catalogo opzionale di skill generiche, fra cui `agent-browser`.

**Tutto il resto è quello che gli si dà. Il livello degli agent sarà esattamente il livello delle skill scritte.**

### 5.2 I tre livelli, che Paperclip implementa da sé

Il campo `description` di una skill è **la logica di instradamento: è la prima cosa che l'agent legge**, e il corpo si carica solo quando la descrizione combacia.

| Livello | Cosa | Costo |
|---|---|---|
| **1 — Addosso sempre** | Le poche note che servono a **chi non sa di averne bisogno**. Esempio esatto: *«un parametro nuovo va collegato a tutte le rotte»* — quella non la cerchi, perché nel momento in cui sbagli sei convinto di aver finito | piccolo, fisso |
| **2 — L'indice** | Le `description` di tutte le skill. L'agent non sa cosa dicono, ma **sa cosa esiste** | trascurabile |
| **3 — Il corpo** | Caricato solo quando la descrizione combacia | pagato solo quando serve |

**È il meccanismo che risolve il problema del bisogno imprevedibile:** la nota che serve solo a metà lavoro si tira su **nel momento in cui il bisogno emerge**, che è l'unico momento in cui è conoscibile. Nessuno deve indovinare in anticipo.

**Due regole che ne discendono:**
- ⭐ **La `description` si scrive nella forma «usa quando stai per…», non «questa skill parla di…».** Una descrizione scritta male produce una skill perfetta che non viene mai aperta.
- **Il corpo si carica per intero quando scatta**, e si paga a ogni risveglio di ogni agent che ce l'ha: `SKILL.md` corto, profondità in `references/`.

⚠️ **La debolezza dichiarata:** il livello 3 funziona se l'agent *pensa* a guardare. Due argini: la skill del mestiere dice esplicitamente *«prima di toccare X, controlla se c'è una nota su Y»*, e **il revisore fa da rete** citando le note per numero — così quando una non è stata consultata si vede a valle.

### 5.3 Due tipi di skill, due processi

| | **Tipo A — Conoscenza** | **Tipo B — Trascrizione** |
|---|---|---|
| **Cosa sono** | Competenza vera, da ricercare e verificare | Testo che esiste già nel repository, da riformattare |
| **Chi le fa** | **Jacopo, in `ai-skill-lab`, col processo pieno** (ricerca, fonti tracciabili, casi negativi, set di valutazione, misura dell'esito) | **Uno script nel repository**, che le genera dalla fonte |
| **Perché così** | È conoscenza nuova: senza lo standard del lab esce mediocre | ⭐ **Generarle invece di scriverle rende impossibile la divergenza.** La fonte resta una sola, la skill è una proiezione. Stesso schema della mappa |

**Perché non le scrive un agent dentro Paperclip:** è un problema di avvio circolare — le skill *sono* la qualità degli agent, quindi farle scrivere agli agent significa usare la versione scadente del sistema per produrre ciò che ne determina la qualità, con l'errore che non si vede. In più lo standard del lab (fonti tracciabili, **asserzioni negative trattate come affermazioni da provare**, casi positivi e negativi a pari peso, misura dell'esito) richiede script di verifica che dentro Paperclip non girano: un agent a cui si dice «segui lo standard» **dichiarerà** di averlo seguito.

### 5.4 Skill di metodo e skill di questo CRM

Poiché la libreria delle skill vive **a livello di azienda** e in futuro ci saranno altri progetti oltre al CRM, la separazione si fa **da subito**:

- **`metodo-*`** — riutilizzabili ovunque: come si revisiona, come si parcheggia una decisione, come si scrive un passaggio di consegne, come si lavora in due a staffetta.
- **`crm-*`** — solo qui: la catena dei permessi di questo CRM, i suoi token colore, le sue convenzioni di modulo, la sua bussola di design.

Costa niente adesso, molto dopo.

### 5.5 L'elenco delle skill da costruire

| Skill | Tipo | Chi la riceve |
|---|---|---|
| `metodo-costituzione` | B — da `CLAUDE.md` | tutti |
| `metodo-revisione` | B — da `.claude/agents/revisore.md` | revisore |
| `metodo-esplorazione` | B — da `.claude/agents/esploratore.md` | esploratore |
| `metodo-parcheggiare-decisione` | B — da `/vado` §5 | tutti |
| `metodo-passaggio-consegne` | B — da `/handoff` | cronista |
| `metodo-valutazione-team` | B — da `architetto.md` (con la correzione «Max 20x») | capo del personale |
| `crm-regole-codice` | B — da `CLAUDE.md` | i due sviluppatori, revisore, guardiano |
| `crm-note-operative` | B — da `note-operative-ai.md`, filtrate | tutti, per mestiere |
| **`crm-permessi-e-sicurezza`** | **A** | **guardiano** |
| **`crm-design-frontend`** | **A** | **sviluppatore frontend** |
| **`crm-pianificazione`** | **A** | **capocantiere** |
| **`crm-collaudo-generazioni-ai`** | **A** | **collaudatore AI** |

**Quattro da scrivere nel lab, otto generate.** Le istruzioni per le quattro stanno in `paperclip/consegna-ai-skill-lab.md`.

### 5.6 Cosa delle note si porta e cosa no

**✅ Si portano:** il formato *Contesto → Errore → Modo corretto* · la numerazione e la citazione per numero · le trappole del progetto (il lucchetto di Prisma, le migrazioni non interattive, «un parametro nuovo va collegato a *tutte* le rotte», rinominare un file, i dizionari letti dall'enum, lo schema che deve elencare i campi, distinguere «AI usata» dal ripiego silenzioso, i costi reali delle suite) · le note di metodo.

**❌ Non si portano:** tutto quello sull'anteprima di Claude Code — ⚠️ **ma non si buttano: si riscrivono per il collaudatore**, perché il problema che descrivono è reale e cambia solo lo strumento · le note su Git Bash, PowerShell e gli script `.ps1` (la VPS è Linux) — **si archiviano, non si cancellano**, perché voi due continuate a lavorare su Windows · le note di contabilità di Claude Code.

⚠️ **Di una il principio sopravvive e va riscritto:** *ogni skill iniettata si paga a ogni risveglio di ogni agent che la porta.* È la regola che impedisce all'azienda di diventare lenta senza che nessuno capisca perché.

### 5.7 Come una nota nasce e si corregge

**Nasce come candidata attaccata al compito**, da quattro sorgenti: **l'agent stesso** quando si accorge di aver fatto una cosa storta (segnale più alto); **il revisore** quando il difetto è di metodo e non di codice; **voi due** quando correggete approvando; **il termometro** quando un compito costa molto più di compiti simili — un costo anomalo *è* il sintomo di un metodo sbagliato.

**La promuove il cronista, unico a scrivere nell'archivio.** Tre problemi risolti insieme: un solo scrittore quindi niente divergenza; chi propone non è chi registra, quindi c'è un secondo parere; la promozione avviene **fuori dalla sessione usa e getta**, quindi la lezione sopravvive.

**Si corregge sui numeri.** Poiché le note si citano per numero, si può **contare quante volte una nota viene citata**. Una nota **mai citata** è inutile o scritta male; una nota **citata con l'errore che succede lo stesso** è scritta male di sicuro. Le legge il capo del personale e propone. **È il primo meccanismo di autocorrezione che si regge su un numero invece che su un'impressione.**

**Il filtro, oggi implicito e da rendere esplicito:** una nota si scrive solo se **verrà riletta da qualcuno che altrimenti ripeterebbe l'errore**.

---

## 6. Cosa si porta dietro dal metodo attuale — il censimento completo

Il criterio applicato è uno solo: **quella regola risolveva un problema che su Paperclip esiste ancora?** Se sì si porta, eventualmente cambiando forma. Se il problema lo risolve Paperclip da solo, si lascia: tenerla sarebbe una seconda copia che diverge in silenzio.

**Legenda:** ✅ identica · ♻️ declinata · 🔁 rovesciata (cambia soggetto o significato) · ❌ esclusa · ⚠️ decaduta · ❓ dipende da una decisione aperta

### A — Documenti e fonti di verità

| Cosa | | Come |
|---|---|---|
| **`CLAUDE.md`** | ♻️ | Resta l'originale; se ne generano le skill. Se divergono vince il file |
| **La bibbia** (brief operativo) | ✅ | Fonte di verità del prodotto. La legge il capocantiere |
| **La roadmap in V** | ♻️ | Diventa le **Iniziative**. Il file resta la fonte: Paperclip ne è la proiezione |
| **Il piano della release** | ♻️ | Diventa un'Iniziativa con i suoi Traguardi |
| **L'archivio delle alternative scartate** | ✅ | **Da non perdere.** È ciò che impedisce di ridiscutere ogni tre mesi le stesse cose. Ci finiscono anche le alternative scartate di questo passaggio |
| **Il registro delle decisioni** | ✅ | Più prezioso di prima: le decisioni le prendono in due, su due turni |
| **Le note operative** | ♻️ | §5.6 e §5.7 |
| **La bussola del design Apple** | ♻️ | Diventa `crm-design-frontend`, **arricchita**: da documento di principi a ricettario applicabile |
| **Il riferimento dei token colore** | ✅ | Dentro la stessa skill |
| **`installazione-e-avvio.md`** | ♻️ | Va riscritto per la VPS |
| **Il resoconto di avanzamento in HTML** | ✅ | Il cruscotto mostra i compiti; non racconta l'avanzamento a un umano che non c'era |
| **`rapporto-al-rientro.md`** | 🔁 | Da «cosa ho fatto mentre eri via» a **riepilogo di giornata**, tutti i giorni |

### B — I due rituali

| Cosa | | Come |
|---|---|---|
| **`/handoff`** | 🔁 | Si spezza in tre: (a) Jacopo→Jacopo **rinasce come passaggio di sessione** anti-saturazione (§4.3); (b) Jacopo→Claudio **resta** come passaggio del testimone (§7.2); (c) la parte su server e calibrazione **decade** |
| ↳ **La regola anti-scorie** | ✅ | *Niente si dichiara in sospeso senza averlo verificato adesso.* Vale di più di prima |
| ↳ **La rotazione a 3 versioni** | ❌ | Era per non accumulare file. Paperclip conserva da sé |
| ↳ **Niente report didattico** | ✅ | Regola di scrittura per tutto ciò che scrive il cronista |
| **`/vado`** | 🔁 | **Diventa la costituzione**: non l'eccezione da accendere, ma il modo normale di lavorare |

### C — Il team

| Cosa | | Come |
|---|---|---|
| **Esploratore** | ✅ | Mandato quasi identico. Cade solo la ragione economica, resta quella vera |
| **Revisore** | ✅ | **Guadagna**: da buona abitudine a stato obbligatorio del compito |
| **Architetto → Capo del personale** | ♻️ | Nome nuovo, metro nuovo: costo per compito e giri di revisione |
| **«Li chiama l'assistente, non l'utente»** | 🔁 | Diventa **automatico**: la catena la esegue il sistema, non la ricorda qualcuno |
| **Le condizioni verificabili di chiamata** | ✅ | Restano parola per parola: erano scritte apposta per applicarsi senza interpretazione |
| **Il piano di estrazione per i file-mostro** | ✅ | Serve tale e quale per la V13 |

### D — Gli strumenti automatici

| Cosa | | Come |
|---|---|---|
| **`npm run mappa`** | ✅ | **Vale di più**: con «un compito, una sessione» ogni agent riparte da zero ogni volta, quindi il costo di non averla si moltiplica per il numero di ripartenze. Ed è uno script: costa zero |
| **L'hook che rigenera la mappa** | ♻️ | Stessa idea, sulla VPS |
| **`npm run consumi`** | ⚠️♻️ | Serve **finché siete su abbonamento**: Paperclip conta i soldi, e su abbonamento i soldi sono zero. Da rifare per leggere i registri degli agent. **Si ritira il giorno del passaggio alle API** |
| **`npm run consumi:compito`** | ♻️ | Paperclip registra durata e costo. Resta da portare ciò che non ha: **quali agent sono serviti e quanti giri di revisione** — che è anche il termometro del §4.3 |
| **`calibrazione.json`** e la lettura di `/usage` | ❌ | Contabilità di Claude Code |
| **`lint`, `lint:css`, `lint:colors`** | ✅ | Passaggi obbligati prima della revisione. Costo in token: zero |
| **`test:backend`, `test:frontend`** | ✅ | Idem |
| **`security:vault-hygiene`** | ✅ | Diventa uno strumento del guardiano |

### E — Regole di codice e di prodotto

| Cosa | | Nota |
|---|---|---|
| **① Il permesso nasce insieme al pezzo di CRM** | ✅ | Voce della lista che il guardiano spunta |
| **①-bis I ruoli predefiniti si aggiornano insieme** (+ migrazione per i personalizzati) | ✅ | La più facile da dimenticare e la più costosa |
| **② Naming italiano per ciò che l'utente legge** | ✅ | |
| **②-bis Le chiavi tecniche seguono la convenzione dell'elenco** | ✅ | Nata da un guasto vero del 18/8 |
| **Il metodo di re-naming** (prima l'area, poi il ventaglio di nomi) | 🔁 | **Non delegabile.** Diventa un cancello: i nomi li propone il capocantiere, li sceglie il consiglio |
| **Migrazioni tracciate, mai `db push`** | ✅ | E diventa cancello rosso |
| **Mai riscrivere migrazioni già applicate** | ✅ | |
| **Token colore** (+ eccezione stampa commentata) | ✅ | |
| **Soglie 500 / 800 righe** | ✅ | |
| **⚠️ I file fuori norma hanno un momento già assegnato: non si sistemano di iniziativa** | ✅ | **La più importante da portare.** Su Paperclip un agent zelante fa più danno di un assistente in conversazione: vede un file grosso e lo spezza «già che c'era» |
| **Il codice nuovo nasce col suo test** | ✅ | |
| **Quali test lanciare e quando** | ♻️ | Il principio resta, le soglie vanno rimisurate sulla macchina nuova |
| **I warning non si zittiscono** | ✅ | |
| **Design Apple-style a sottrazione** | ✅ | |

### F — Metodo e collaborazione

| Cosa | | Nota |
|---|---|---|
| **La staffetta** | ♻️ | Resta, ma non ferma il lavoro: **stabilisce chi approva** |
| **«Si pusha sempre su `main`»** | ⚠️ | **Decaduta** per decisione di Jacopo del 19/8/2026. ✅ Già riscritta in `CLAUDE.md`, `handoff.md` e `vado.md` |
| **Regola sui conflitti fra voi due** | ✅ | **Diventa un cancello giallo esplicito.** Oggi dipende dal fatto che l'assistente se ne accorga |
| **Le cose trovate per strada vanno in roadmap** | ✅ | Prende un proprietario: il cronista |
| **Le domande che meritano una decisione vanno in roadmap, non in chat** | ✅ | Il pericolo è identico: la bacheca scorre come scorreva la chat |
| **Ciclo di vita dei dev server** | ❌ | Nasceva dai server orfani fra sessioni. Su una macchina sempre accesa non ci sono orfani |
| **Una sola sessione con i server accesi (lucchetto Prisma)** | ❓ | **Dipende dalla decisione ancora aperta** su dove vive l'ambiente di sviluppo |
| **Auto-miglioramento delle note** | 🔁 | §5.7 |
| **Jacopo ha pieno potere decisionale in sessione** | ✅ | Diventa: entrambi consiglio, entrambi decidono nel proprio turno |
| **Pianificazione ≠ via libera al codice** | ✅ | **Da rendere esplicita**, perché su Paperclip è più insidiosa: un compito *creato* non è un compito *approvato* |

### G — Misura e giudizio

| Cosa | | Nota |
|---|---|---|
| **Le due famiglie di agent e i due metri** | ♻️ | Il ragionamento resta, ma **la famiglia A sparisce**: nessuno esiste più per «tenere fuori contesto». Restano tutti di famiglia B, giudicati su *fa il lavoro per cui esiste?* |
| **Il bilancio controfattuale** (costo vs riletture evitate) | ❌ | Misurava un'economia di Claude Code che su Paperclip non esiste |
| **Il confronto a parità di compito** | ✅ | **Diventa il metro principale** |
| **La velocità non si usa per giudicare gli agent** | ✅ | Su Paperclip vale doppio: col parallelismo vero le unità/minuto salgono anche quando il lavoro peggiora |
| **L'archivio delle alternative è consultazione, non vincolo** | ✅ | La formula esatta è buona e va conservata |

> **In sintesi: su 57 meccaniche, 33 si portano identiche, 13 declinate, 5 rovesciate, 5 escluse, 1 decaduta, 1 dipende da una decisione aperta.** Quasi niente si butta: cambia il contenitore, non il contenuto.

---

## 7. Lavorare in due

### 7.1 I tre livelli di separazione

Il software ne copre due, il terzo lo coprite voi.

**① Il compito — lo garantisce Paperclip.** Due agent non possono lavorare sullo stesso compito: la presa in carico è un'operazione atomica del database. Chi tenta di prendere un compito già preso riceve un rifiuto secco. Non è una convenzione, è impossibile per costruzione. **Già risolto, non richiede niente da voi.**

**② Il codice — lo garantiscono i rami.** Un compito, un ramo. L'agent lavora lì, committa lì, e `main` si tocca solo con la vostra approvazione. Due lavori paralleli non si vedono finché non si uniscono, e quando si uniscono il conflitto è visibile e normale invece che invisibile e distruttivo.

⚠️ È il livello che **oggi non esiste** — si pusha sempre su `main` — ed è il cambiamento più profondo del passaggio. Serve comunque per la messa online: non è un costo di Paperclip, è un costo della release che Paperclip rende utile due volte.

**③ La direzione — non lo garantisce niente.** Nessun software impedisce che uno di voi approvi una cosa il venerdì sera e l'altro ne approvi una incompatibile il sabato mattina. Il rimedio è il testimone.

### 7.2 Il testimone

Il principio resta il vostro: si lavora uno alla volta e chi finisce passa il testimone. Cambia che **il testimone non ferma il lavoro** — gli agent continuano — ma **stabilisce chi risponde alle approvazioni**.

**In Paperclip è un compito permanente chiamato «Testimone»**, il cui assegnatario è la persona di turno. Chi lo ha addosso approva, rifiuta e riordina. L'altro vede tutto e può prenderlo — ma **prenderlo è un gesto esplicito**, non una cosa che succede per distrazione.

**Il passaggio, in tre gesti:**

1. **Chi lascia** chiede al cronista il passaggio del testimone. Il cronista scrive un documento breve: cosa è stato deciso in questo turno e perché, cosa è stato provato e scartato, di cosa diffidare, cosa è in attesa di approvazione. **Non** cosa è stato fatto: quello si vede dalla bacheca.
2. **Chi lascia** decide cosa resta acceso.
3. **Chi prende** si assegna il compito «Testimone».

**Il vuoto fra un turno e l'altro.** Con le approvazioni a scadenza di 12 ore, il venerdì sera non è più un muro: i gialli procedono da soli con l'opzione raccomandata, i rossi aspettano. E poiché arrivano su Discord con i pulsanti, sbloccare un rosso dal telefono costa cinque secondi. **Quindi l'azienda resta accesa anche quando il testimone non è di nessuno** — con la sola avvertenza che chi rientra deve **leggere cosa è stato deciso in automatico**, e il riepilogo del cronista lo elenca in cima.

### 7.3 Il flusso git

```
main                     ← protetto. Ci si arriva solo per approvazione del consiglio
 └── compito/PC-123-…    ← un ramo per compito, creato dall'agent
```

- **un compito, un ramo, un'unione.** Se un compito genera più di un'unione, era due compiti;
- l'agent **non unisce mai**: apre la richiesta e aspetta;
- il ramo si cancella dopo l'unione;
- ⚠️ **una migrazione del database non sta mai su un ramo lungo.** È la trappola classica: due rami con due migrazioni si uniscono e il database non sa più in che ordine applicarle. Le migrazioni si uniscono per prime e in fretta — un motivo in più per cui sono un cancello rosso;
- il messaggio di commit resta nello stile del progetto: in italiano, dice **cosa cambia per chi usa il CRM**, non quali file sono stati toccati.

### 7.4 Discord

**Scelto il 19/8/2026.** Manda avvisi per compiti creati, completati, in attesa di approvazione, errori degli agent e ciclo di vita. Ha **i pulsanti «approva / rifiuta» dentro la notifica**; le risposte tornano dentro Paperclip come commenti sul compito; ha quindici comandi rapidi (`/clip approve`, `/clip budget`, `/clip issues`, `/clip digest`…) e il riepilogo giornaliero.

**Perché Discord e non Telegram, a parità di funzioni:** i pulsanti passano dal collegamento diretto di Discord, quindi **non serve esporre nessun indirizzo pubblico della VPS**. È un buco di sicurezza in meno.

⚠️ **Tre avvertenze.** La parità con Telegram è stata raggiunta nella versione 0.3.0 colmando quattordici differenze: **va verificata la versione all'installazione**. Il permesso Discord per leggere il contenuto dei messaggi serve **solo** alla funzione di «intelligenza di comunità», che a voi non serve: **non va concesso**. E soprattutto: **se una chat può approvare, quella chat è una porta d'accesso** — canale privato, solo voi due, e **i cancelli rossi restano fuori da Discord**, si approvano dal cruscotto dove si vedono le differenze del codice per intero.

**Email:** Paperclip **non ha nessun sistema di avviso nativo verso l'esterno** — c'è una richiesta aperta. Se servirà, si ottiene con una routine che sveglia un agent avvisatore. Per ora non serve.

### 7.5 Cosa questo NON risolve

- **Non risolve due persone che vogliono cose diverse.** Lo rende visibile prima, ed è già molto.
- **Non risolve la contesa sull'ambiente di sviluppo**, se database e server finiscono sulla VPS.
- **Non risolve il serbatoio condiviso.** Se lavorate insieme lo consumate insieme.

---

## 8. La roadmap e il suo innesto

> **Premessa, decisa da Jacopo il 19/8/2026:** *«sia la release che qualunque altra cosa devi considerarla ormai lavoro da fare su Paperclip»*. Non esiste più una parte che resta col metodo vecchio. E la data di metà settembre **non è un patto incontrovertibile: si può sforare con ragionevole margine.** Le date qui sotto sono quindi **indicative dell'ordine**, non scadenze contrattuali.

### 8.1 Dove siamo

| | Stato |
|---|---|
| **V1** Shell Apple-style · **V2** Console, ruoli, reparti · **V3** Anagrafica, campi personalizzati, integrazioni | ✅ fatte |
| **V4** Chat AI e messaggistica | ✅ chiusa il 22/7/2026 |
| **V5** Motore AI context-aware | 🟡 **spezzata**: iniziata, interrotta, si completa dopo |
| **V6** Reportistica multi-sorgente | 🟡 **iniziata**: serbatoio dati, dashboard e via Excel/AI fatti il 28/7 |
| **V7 → V13** | ⚪ da fare |
| **🚩 Release di settembre** | 🔴 **in corso, priorità su ogni V** |

### 8.2 La traduzione

| Livello Paperclip | Da noi | Esempio |
|---|---|---|
| **Iniziativa** | La commessa o la V | «Release settembre 2026» |
| **Progetto** | L'area | «Clienti», «Registro attività», «Cestino» |
| **Traguardo** | La voce dell'ordine di lavorazione | «② Cambio e recupero password» |
| **Compito** | Il pezzo committabile | «Maschera di cambio password nel Profilo» |
| **Sotto-compito** | Il dettaglio, se serve | «Test del vincolo di robustezza» |

**Il guadagno concreto:** ogni costo viene marcato col codice del suo traguardo, e i codici risalgono la catena. Alla fine si può chiedere **«quanto è costata la release, dall'inizio alla fine»** e avere una risposta vera. Oggi quella domanda non ha risposta.

### 8.3 La release, voce per voce

Iniziativa **«Release settembre 2026»**, undici traguardi nell'ordine già deciso — sequenza pensata perché **degradi bene**: se il tempo stringe, resta indietro l'ultimo della lista, non un pezzo che blocca gli altri.

| # | Traguardo | Chi ci lavora | Cancello |
|---|---|---|---|
| **1** | Server di posta (coda) + invito Team | backend + esploratore | 🔴 invio email reale · 🟡 i due punti aperti sulla «Prova connessione» sono decisioni di prodotto |
| **2** | Cambio e recupero password | backend + esploratore + 🛡️ | 🔴 migrazione · ⚠️ **qui dentro va chiuso il punto 7 del §7.7**: da quando esiste il recupero, chi ha `mail.manage` può dirottare le email di reset di chiunque |
| **3** | Controllo automatico dei permessi, metà 1 | backend | 🟢 |
| **4** | Le due correzioni rosse dei Messaggi | backend + frontend | 🟢 · ⚠️ la prima **deve** precedere il traguardo 6, o il Registro attività nasce illeggibile |
| **5** | Clienti (campi, import, campi personalizzati) | backend + frontend + esploratore | 🟡 nomi ed etichette dei campi nuovi |
| **6** | Registro attività | backend + esploratore | 🔴 **bloccato in partenza**: la collocazione a menu richiede un confronto, ed è già scritto che non si decide da soli |
| **7** | Cestino sulle entità in perimetro | backend + frontend + esploratore + 🛡️ | 🔴 migrazione su più entità · ⚠️ **il rischio numero uno della release** |
| **8** | Allegati ai messaggi + rifiniture | backend + frontend + 🛡️ | 🔴 conservazione file · ⚠️ gli allegati **non sono una rifinitura**: vanno affrontati per primi dentro questo traguardo |
| **9** | Riordino del menu | frontend | 🟡 decisione di prodotto |
| **10** | Spegnimento dei moduli fuori perimetro | frontend | 🟡 decide il consiglio cosa si spegne |
| **11** | Audit di sicurezza | 🛡️ guardiano, in modalità estesa | 🔴 a codice fermo, per definizione ultimo |

**Cosa si legge da questa tabella:** su undici traguardi, **sei hanno un cancello rosso e cinque uno giallo**. Due su tre richiedono un intervento umano. Non è un difetto del piano: è la natura di questa release, che tocca permessi, migrazioni ed email.

> **L'aspettativa giusta da avere: su questa release l'azienda non lavorerà da sola per giorni.** Vi toglierà il lavoro meccanico e vi lascerà le decisioni. L'autonomia piena arriva dopo, sulle V, dove i cancelli rossi sono molti meno.

### 8.4 La linea del tempo, indicativa

Da oggi a metà settembre ci sono **20 giorni lavorativi** più **8 di weekend**. Distribuzione ricavata dall'ordine di lavorazione e dal vincolo già scritto nel piano (*arrivare al cestino con dieci giorni davanti, non con tre*):

| Periodo | Traguardi |
|---|---|
| **19 → 31 agosto** | 1 · 2 · 3 · 4 · 5 · 6 |
| **1 → 11 settembre** | 7 (cestino) · 8 (allegati) — le due pesanti |
| **14 → 15 settembre** | 9 · 10 · 11 |

⚠️ **Il primo periodo è il più carico** e contiene la voce 5, che sono tre lavori distinti, e la 6, che è bloccata in partenza da un confronto non ancora avvenuto. **Se scivola, mangia i giorni del cestino.** Il piano chiede di segnalarlo subito, non alla vigilia — e su Paperclip il segnale arriva da solo: basta guardare se i traguardi 1-6 sono chiusi il 31.

### 8.5 Dopo la release

Le V riprendono nell'ordine stabilito: completamento della **V5** (motore AI) — ed è il momento in cui si accende il **collaudatore AI** — poi **V6** (reportistica, già iniziata), **V7** (produzione AI: Web & ADV, generazione visiva, audit SEO), fino alla **V13** (pulizia finale dei file grossi, dove serve il piano di estrazione dell'esploratore). Salvo nuove commesse con nuova scadenza, che avrebbero a loro volta la precedenza.

---

## 9. Come si costruisce l'azienda

⭐ **La scoperta che cambia il piano di impianto:** esiste un'estensione che espone l'API di Paperclip come strumenti dentro Claude Code. **Quindi l'azienda non si costruisce a mano cliccando: si costruisce da una sessione di lavoro, leggendo questo piano.**

### 9.1 Quello che resta manuale — poco

| Cosa | Chi |
|---|---|
| Creare la VPS e installarci Paperclip | Jacopo |
| Installare e **autenticare Claude Code** sulla macchina (deve essere eseguibile nel percorso di sistema) | Jacopo |
| Clonare il repository sulla macchina | Jacopo |
| Generare la chiave dell'API e metterla nella configurazione dell'estensione, **sul computer locale** | Jacopo |
| Creare il bot Discord e collegarlo | Jacopo |
| Installare Chrome o Chromium per il collaudatore | Jacopo |

**Mezza giornata, una volta sola.**

### 9.2 Quello che si costruisce dal collegamento — molto

Agent con i loro mandati · budget · battiti · gerarchia · assegnazione delle skill · le Iniziative, i Progetti, i Traguardi e i Compiti generati dai documenti di piano · il compito permanente «Testimone».

**E le skill non si trasferiscono a mano:** viaggiano **dentro il repository**. Si scrivono nel lab, finiscono in `paperclip/skills/`, si committano, la VPS fa `git pull`. Sono già sulla macchina: installarle è indicare un percorso.

⚠️ **Due regole non negoziabili su questo:**

1. **La chiave dell'API è una credenziale.** Va nella configurazione locale dell'estensione — **mai in chat, mai nel repository**. In questo progetto una password è già transitata in chat una volta ed è finita nelle trascrizioni salvate sul disco.
2. **Fra gli strumenti dell'estensione c'è la facoltà di approvare.** Non va usata: le approvazioni sono la funzione del consiglio, e tutto l'impianto dei cancelli perde senso se le firma un assistente. Se Paperclip permette chiavi con poteri limitati, quella usata per l'impianto **non deve avere diritto di approvazione**.

### 9.3 Le quattro fasi

**Fase 0 — La macchina** *(mezza giornata)*
Paperclip in **modalità autenticata**, non fidata: è raggiungibile da internet, e senza autenticazione chi trova la porta comanda gli agent. Due utenti. Claude Code autenticato. Repository clonato. Chromium installato.
✅ **Fine fase:** un agent di prova si sveglia, esegue un comando innocuo, e lo vedete succedere da due computer diversi.

**Fase 1 — Il mestiere singolo** *(un giorno)*
Si accende **solo lo sviluppatore backend**, senza battito, a chiamata. Un compito piccolo, vero, già scritto in roadmap, senza migrazioni né permessi.
✅ **Fine fase:** un compito chiuso, un ramo, un commit, una vostra approvazione.
🛑 **Se questa fase non riesce, ci si ferma qui**: tutto il resto poggia su questo.

**Fase 2 — La catena** *(due-tre giorni)*
Si accendono esploratore, revisore, guardiano e collaudatore. Si passa un compito che tocca un permesso, così la catena viene provata sul suo caso peggiore. Si installano le skill.
✅ **Fine fase:** il revisore ha rimandato indietro almeno un lavoro **da solo**, e aveva ragione; il collaudatore ha allegato uno screenshot che mostra la cosa giusta.
📌 **È il punto di controllo.** Se qui la catena non regge — il revisore non trova niente, o trova cose false, o gli agent si incastrano — **non si prosegue accumulando**: si torna alla fase 1 e si capisce perché. Fissarlo adesso costa una riga; accorgersene a settembre costa la consegna.

**Fase 3 — L'azienda** *(due giorni)*
Si accendono capocantiere e cronista, si impostano i battiti, si collega Discord, si costruisce il freno sul serbatoio, si carica la roadmap.
✅ **Fine fase:** una giornata intera in cui l'azienda produce lavoro e voi solo approvate.

**Fase 4 — Il regime** *(dalla terza-quarta settimana)*
Si accende il capo del personale, si misura, si tara. Da qui il team si modifica sui numeri, non sulle impressioni.

---

## 10. Cosa serve alla macchina — la conseguenza, non la premessa

> Questo capitolo è **un'uscita del piano**, non un vincolo che l'ha ridotto. L'organigramma è quello che serve; qui c'è cosa costa farlo girare, così potete decidere sapendo.

### 10.1 La memoria

Ogni agent al lavoro è un processo Claude Code vero. Il conto, per ordini di grandezza:

| Voce | Memoria |
|---|---|
| Paperclip più il suo database | 0,5 – 1 GB |
| Ogni agent che lavora **nello stesso momento** | 0,3 – 0,8 GB l'uno |
| Chromium del collaudatore, per scheda aperta | 0,3 – 0,5 GB |
| L'ambiente di sviluppo del CRM, **se sta lì** (PostgreSQL + API + Vite + compilazioni) | 1 – 1,5 GB |

**Il KVM 1 ha 4 GB e un processore.** Ci gira l'azienda con **un agent alla volta** e senza l'ambiente di sviluppo sulla macchina. Con due o tre agent insieme, il collaudatore che apre il browser e l'ambiente del CRM, la misura naturale è il **KVM 4** (4 processori, 16 GB).

**Il sintomo, quando arriverà, non darà un errore chiaro:** compilazioni che muoiono senza spiegazione, test interrotti a metà, la macchina che rallenta invece di protestare. **È memoria esaurita, non codice rotto** — riconoscerlo subito evita di rincorrere fantasmi.

### 10.2 Il serbatoio

Il tetto vero non è la macchina, è la finestra di cinque ore dell'abbonamento — **che è dell'account**: ci pescano gli agent sulla VPS più voi due dai vostri computer.

**Un ordine di grandezza dai vostri numeri reali:** il picco storico misurato è 194 unità in una finestra, pari al 47% del limite; un compito del registro costa fra 20 e 90 unità comprensive di tutto. **Ne segue un tetto dell'ordine di quattro-otto compiti chiusi per finestra da cinque ore.**

⚠️ **Quel numero è un tetto massimo e la realtà sarà migliore**, perché quei costi vengono da Claude Code dove il 49% del consumo è *rileggere quello che è già stato detto* — e su Paperclip, con contesti separati e sessioni usa e getta, quella voce crolla. Ma il soffitto resta, e va sorvegliato: è il §3.5 punto 1.

---

## 11. Più fornitori AI via API — il passaggio futuro

> Si comincia con l'abbonamento, come deciso. Questo capitolo sta qui perché due scelte d'impianto — come si marcano i costi e dove stanno le chiavi — è molto più facile farle giuste da subito che rifarle dopo.

### 11.1 Perché ci si passerà

**① Il tetto del serbatoio.** L'abbonamento non è caro: è **rigido**. Con le API il vincolo diventa il denaro, che è **elastico e governabile**.

**② Il nodo dei termini d'uso.** Paperclip fa girare **il binario ufficiale di Claude Code**, che si autentica direttamente: non è uno degli strumenti riscritti da terzi a cui l'abbonamento è stato chiuso ad aprile 2026. Però i manutentori stessi, interrogati sul punto, hanno risposto che **non hanno conferma scritta da Anthropic che sessioni non presidiate e programmate a orario rientrino nei termini per privati**, e per un uso a flotta consigliano le chiavi API — che ricadono sotto i termini commerciali, scritti apposta per l'uso automatico. **Il passaggio non è solo un'ottimizzazione: è la strada che toglie l'ambiguità.**

**③ Il modello giusto al mestiere giusto.** Con l'abbonamento tutti girano sullo stesso motore, ma i mestieri hanno bisogni molto diversi.

**Quando:** quando il serbatoio si esaurisce con regolarità e vi blocca; o quando si vuole accendere un secondo sviluppatore per mestiere; o quando si decide di togliersi il dubbio del punto ②.

### 11.2 Quale motore a quale mestiere

Paperclip tiene la configurazione del motore **per singolo agent**, in un campo libero: si cambia motore a un mestiere senza toccare gli altri.

Il criterio è **due domande, non una**: *quanto deve ragionare?* e *quanto deve leggere?* Sono indipendenti, e confonderle è il modo più facile di spendere male.

| Mestiere | Fascia | Perché |
|---|---|---|
| 🧭 **Capocantiere** | **Alta** | Sbaglia in silenzio e fa sbagliare tutti gli altri. Il posto sbagliato dove risparmiare |
| 🗺️ **Esploratore** | **Economica ad ampio contesto** | Cerca ed elenca, non giudica. Massimo risparmio, minimo rischio |
| 🔨🎨 **Sviluppatori** | **Alta**, specializzata sul codice | Un modello scarso qui costa in giri di revisione più di quanto risparmi |
| 🔍 **Revisore** | **La più alta** | Deve trovare ciò che lo sviluppatore non ha visto |
| 🛡️ **Guardiano** | **Alta** | Legge una catena delimitata ma non può sbagliarla |
| 🖥️ **Collaudatore** | **Media** | Esegue e riferisce, non interpreta |
| 📋 **Cronista** | **Media o economica** | Non deve scoprire niente: deve scrivere bene cose già decise |
| 📊 **Capo del personale** | **Alta** | Gira una volta a settimana: il costo è trascurabile e la qualità conta |
| 🧪 **Collaudatore AI** | **Economica**, obbligatoriamente | ⚠️ È l'unico che fa chiamate vere **in aggiunta** al proprio ragionamento |

⭐ **Una raccomandazione contro-intuitiva ma solida:** non date a sviluppatore e revisore lo stesso identico modello. Non per costo — per **indipendenza**. Un secondo paio d'occhi che ragiona esattamente come il primo non è un secondo paio d'occhi.

⚠️ **I motori concreti — quali fornitori, quali versioni — si scelgono al momento**, verificando prezzi e modelli disponibili allora: cambiano di mese in mese, e un elenco scritto oggi sarebbe sbagliato fra sei settimane. Il criterio qui sopra invece regge.

### 11.3 Il monitoraggio dei costi

Tre pezzi che Paperclip ha già, da usare insieme:

1. **Il registro dei costi** — ogni chiamata scrive fornitore, modello, token, compito d'origine e **codice di addebito**. In sola aggiunta: la storia non si riscrive.
2. **I codici che risalgono la catena** — quando il capocantiere delega, il costo dello sviluppatore è marcato col codice del compito di partenza. È ciò che permette la domanda *«quanto è costata la release?»* o *«quanto costa in media una voce dei Clienti contro una del Registro attività?»*.
3. **I budget, che sono duri** — tetto mensile per agent, avviso all'80%, **pausa automatica al 100%** con i compiti nuovi rifiutati. Voi potete sempre alzare il tetto.

**Come impostarli:**

| | Proposta |
|---|---|
| **Tetto del primo mese** | Una cifra che siete disposti a perdere, non una stima del giusto. Il primo mese serve a misurare |
| **Ripartizione** | Sviluppatori la fetta maggiore; esploratore, cronista e collaudatore fette piccole; **il revisore non deve avere la fetta più piccola** — è quello su cui si è tentati di risparmiare, ed è dove risparmiare costa di più |
| **Cosa guardare la prima settimana** | Non il totale: il **costo medio per compito chiuso** e il **numero di giri di revisione**. Il totale dice solo se il tetto è tarato; questi due dicono se l'azienda funziona |
| **Il segnale d'allarme** | Un mestiere che consuma **fra un compito e l'altro**: battito troppo frequente o istruzioni vaghe. È il modo documentato in cui i costi esplodono su Paperclip |

**Cosa costruire in più:** Paperclip vi dirà che il mese è costato X, non se X è tanto o poco. Il metro sensato ce l'avete già: **costo per compito chiuso, confrontando lavori simili fra loro** — mai periodi diversi, che è l'errore già annotato nel metodo attuale.

### 11.4 Le chiavi

Paperclip ha un deposito dei segreti e, dalla versione di luglio 2026, consegna le chiavi all'agent **legate alla singola esecuzione** invece di lasciarle nel suo ambiente. È il comportamento giusto e va usato.

1. **Una chiave per mestiere, mai una per tutti.** Se il cronista non deve chiamare il modello caro, non deve avere la chiave per farlo. **Il controllo dei costi fatto con i permessi è più solido di quello fatto con i budget**, perché non arriva a cose fatte.
2. ⚠️ **Le chiavi AI del CRM non si mescolano con quelle degli agent.** Il CRM chiama i modelli per conto dei clienti dell'agenzia, gli agent per costruire il CRM: stessi fornitori, contabilità che non deve mai confondersi.
3. **Nessuna chiave nei messaggi di sistema o nei registri.**

### 11.5 Il piano di attivazione

Un mestiere alla volta, partendo da quello che rischia meno:

1. **L'esploratore.** Legge tantissimo, risponde corto, e se sbaglia se ne accorge subito il revisore.
2. **Il cronista e il collaudatore.** Rischio ancora minore: se scrivono male un riepilogo lo si vede leggendolo.
3. **Il revisore e il guardiano.** Qui si **sale** di fascia, non si scende: l'obiettivo non è risparmiare, è **l'indipendenza dal motore degli sviluppatori**.
4. **Gli sviluppatori per ultimi.** Producono il valore, e le regressioni sono le più costose.
5. **Il capocantiere resta dov'è più a lungo di tutti**, perché sbaglia in silenzio.

⚠️ **Quando l'ultimo mestiere è passato, il monitor del serbatoio smette di essere il vincolo e diventa un'informazione. È il momento di ritirarlo** — non prima — e questo documento va aggiornato quando succede.

---

## 12. Rischi e punti aperti

### 12.1 I rischi

🔴 **1. Il serbatoio condiviso, e il freno che non esiste ancora.** Il cruscotto vi mostrerà un'azienda che spende zero mentre il serbatoio si svuota, e il primo sintomo sarà che vi bloccate voi. **Il freno va costruito, non configurato.** Finché non c'è, battiti lenti e agent spenti quando non servono.

🔴 **2. Un solo abbonamento, due persone, agent non presidiati.** Due questioni distinte: i termini d'uso sulle sessioni programmate (§11.1 punto ②) e la condivisione dell'account fra due persone. Il rimedio strutturale a entrambe è il passaggio alle API.

🟠 **3. La macchina.** §10. Scelta consapevole di partire dal taglio piccolo.

🟠 **4. Il collaudatore darà falsi allarmi il primo mese.** Con la definizione di «fatto» scelta — chiusura senza sguardo umano obbligatorio — un falso verde è più insidioso di un falso rosso. **Il campione quotidiano è la contromisura, e va guardato davvero.**

🟠 **5. L'ambiente di sviluppo del CRM: dove sta.** Decisione ancora aperta, per scelta. Se va sulla VPS, il vecchio problema del lucchetto di Prisma torna identico; se resta locale, gli agent non possono far girare parte dei test. **Non c'è una risposta gratis.**

🟡 **6. Paperclip è giovane.** Nato a marzo 2026, con migrazioni di schema attese a ogni aggiornamento. **Non aggiornare durante la settimana della consegna.**

🟡 **7. Gli agent lavoreranno senza chiedere permesso sui file.** L'adapter, girando senza nessuno che clicchi «consenti», salta la conferma per costruzione. Gli argini — ramo separato, `main` protetto, revisione obbligatoria — vanno messi **prima** del primo compito.

🟡 **8. Il salvataggio dei dati di Paperclip.** Il codice sta su git e si recupera. **La storia dei compiti, le decisioni e la traccia delle attività stanno solo sulla VPS**: se la macchina si perde, si perde la memoria dell'azienda — cioè proprio la cosa che state costruendo per non perdere. Va previsto un salvataggio periodico.

🟡 **9. Le estensioni Discord e `agent-browser` sono di terze parti.** Paperclip le fa girare fuori dal processo principale con permessi dichiarati, il che è la cosa giusta. Ma vanno trattate come codice non vostro: versione fissata, permessi minimi, e **la chat che può approvare è una porta d'accesso**.

🟢 **10. I bug su Windows non vi riguardano.** Il repository di Paperclip ha problemi aperti sull'installazione dei plugin e sul caricamento degli adapter su Windows. **La VPS è Linux.** Restano un ostacolo solo se qualcuno provasse a far girare Paperclip anche sul proprio portatile — cosa fuori programma.

### 12.2 Le decisioni ancora aperte

| # | Cosa | Quando serve |
|---|---|---|
| 1 | **Dove sta l'ambiente di sviluppo del CRM** | Da provare sul campo, ma **presto** |
| 2 | **La soglia del freno sul serbatoio** | Prima della fase 3 |
| 3 | **Il tetto di spesa del collaudatore AI**, anche se nasce spento | Prima che venga acceso |
| 4 | **La collocazione a menu del Registro attività** | Blocca il traguardo 6 della release |

### 12.3 Le correzioni nei documenti esistenti — ✅ FATTE il 19/8/2026

1. ✅ **`.claude/agents/architetto.md` dichiarava un abbonamento «MAX 5x»**: corretto in Max 20x, con la nota che nei documenti più vecchi il «5x» era un errore.
2. ✅ **La regola «si pusha sempre su `main`, niente branch» è stata riscritta** in **tre** file, non due: `CLAUDE.md`, `.claude/commands/handoff.md` e — trovato durante la correzione — `.claude/commands/vado.md`, che vietava esplicitamente di creare rami e diceva di committare su `main`. Adesso quel comando dice di committare **sul ramo del lavoro in corso**, e che **unire a `main` non è mai una decisione dell'assistente**: al rientro l'utente trova il ramo pronto e sceglie lui.
3. ✅ **Registrato in `team-agenti.md`**, registro delle decisioni: il passaggio a Paperclip, la caduta della regola sui rami, e la conseguenza sull'archivio delle alternative — **il primo dei tre motivi per cui la configurazione «Fabbrica» era stata scartata il 23/7/2026 non vale più**. La riga originale del §5.1 non è stata riscritta: registra il ragionamento di allora e si legge insieme alla nuova.

---

*Documento scritto il 19 agosto 2026 confrontando la documentazione di Paperclip (sito, repository, documentazione tecnica, segnalazioni e discussioni dei manutentori, catalogo delle estensioni) con il metodo di lavoro del progetto: `CLAUDE.md`, `.claude/agents/`, `.claude/commands/`, `team-agenti.md`, `03-roadmap-confronto-e-build.md`, `decisioni-cliente-e-menu-2026-08-07.md`, `note-operative-ai.md`, il registro dei compiti e il monitor dei consumi.*
