# A1 in parole semplici — cos'è la release di settembre, punto per punto

> **Scritto il 9 settembre 2026** su richiesta di Jacopo, che ha scelto **A1 (perimetro pieno)** e ha
> chiesto un ripasso prima di partire: *«non ricordo il cestino cos'era e a cosa serviva… devo
> rinfrescarmi la memoria»*.
>
> Qui non ci sono decisioni nuove. È il piano già deciso (`decisioni-cliente-e-menu-2026-08-07.md`,
> Parte Seconda) raccontato senza gergo, con accanto lo stato verificato oggi nel codice.

---

## La cosa da capire per prima: cos'è "la release di settembre"

Non è una lista di miglioramenti sparsi. È una promessa precisa, decisa il 17 agosto:

> **Sei aree del CRM devono funzionare al 100%. Tutto il resto viene nascosto al lancio.**

Le sei aree sono: **Clienti · Team · Messaggi · Ruoli e permessi · Profilo · Registro attività**.

Tutto il resto — Produzione AI, Pipeline, Preventivi, Siti in gestione, Credenziali, Calendario, Memo
Operativi — **non viene cancellato: viene spento** da *Gestione Moduli*, che sa già farlo. Zero
sviluppo. Si riaccende quando è pronto.

**Perché è fatta così:** meglio consegnare sei aree che funzionano davvero che quindici aree a metà.
Chi riceve il CRM deve poter lavorare, non esplorare.

**A1 vuol dire: consegniamo tutte e undici le voci del piano, senza toglierne nessuna, e la data si
sposta di conseguenza.** È la decisione già presa il 18/8; sceglierla oggi significa confermarla.

---

## Le undici voci, in ordine di lavorazione

L'ordine non è casuale: è costruito perché **se qualcosa resta indietro, sia l'ultimo della lista e
non un pezzo che blocca gli altri**.

### 1 · Server di posta + invito nel Team ✅ *fatto, su `main`*

Il CRM sa mandare email (inviti, e più avanti il recupero password) e la configurazione del server si
cambia da dentro il CRM, non da un file.

⚠️ **Resta una cosa che nessun agent può fare:** la **password della casella** va scritta nel file
`.env`, che sta fuori dal repository, sulla macchina. Finché non c'è, **la posta non parte** — e il
punto 2 dipende da questo.

### 2 · Cambio password e recupero password 🟡 *era su ramo, ora unito oggi*

Oggi nel CRM **non si può cambiare la propria password**, da nessuna parte. È il difetto più grave
trovato in agosto, per due motivi: chi ha una password compromessa non può sostituirla, e **chi la
dimentica non rientra più** — nemmeno un amministratore può aiutarlo.

Comprende due cose: cambiare la propria password da dentro, e il **recupero via email** per chi è
rimasto fuori (il link "password dimenticata").

### 3 · Controllo automatico dei permessi 🟡 *era su ramo, ora unito oggi*

Una regola del progetto dice che ogni funzione nuova nasce con il suo permesso. Finora la rispettava
**una persona**; adesso la verifica **una macchina**, con uno script che si arrabbia da solo.

Chiude un difetto reale: solo 4 moduli su 16 prendevano i permessi dall'elenco centrale, gli altri li
riscrivevano a mano nel proprio file, senza nessun controllo che i due elenchi coincidessero.

### 4 · Le due correzioni rosse dei Messaggi ❌ *non iniziato*

I Messaggi funzionano bene nel loro cuore. Due cose però sono rotte in modo serio:

1. 🔴 **Il registro delle attività viene inondato.** Ogni volta che il pannello ricontrolla una
   conversazione segna i messaggi come letti — **anche nei controlli automatici silenziosi**. Risultato:
   una riga di registro **ogni 1,5 secondi** per ogni conversazione aperta, anche se non è successo
   niente. ⚠️ **Va corretto prima del punto 6**, altrimenti il Registro attività nasce già illeggibile:
   si costruirebbe un registro che nessuno riesce a consultare perché è pieno di rumore.
2. 🔴 **Un ripiego pericoloso.** Se la chiamata al profilo utente fallisce per un attimo, la casella dei
   messaggi mostra **la Chat AI** al suo posto. Ma la Chat AI al lancio è **nascosta**: un errore
   momentaneo di rete farebbe comparire un'area che non deve esistere.

### 5 · Clienti 🟡 *metà unito oggi, metà da fare*

Tre lavori:

- **Import massivo** *(unito oggi)* — caricare un elenco di clienti da un file. Prima il file viaggiava
  dentro il corpo della richiesta con un tetto di circa 1 MB, quindi **i file grossi fallivano**. Ora
  viaggia come allegato vero, si accettano anche gli **Excel**, e prima di confermare si vede
  un'**anteprima**: quante righe entrano, quali no e perché.
- **Campi personalizzati nel percorso giusto** *(unito oggi)* — la funzione era più completa di come
  appariva (sei tipi di campo), ma stava in una pagina separata da cercare. Ora si crea un campo
  **mentre si registra il cliente**.
- ❌ **I campi nuovi — questo manca ancora.** PEC, **Codice destinatario SDI**, sito web, **referente**.
  Ho verificato: in `schema.prisma` non ci sono. I primi due servono alla **fatturazione elettronica**:
  le fatture passano dal sistema statale, e un cliente senza PEC né codice SDI è **un cliente a cui non
  si può fatturare**. Il "referente" serve perché oggi esiste solo il nome dell'azienda, non la persona.

### 6 · Registro attività ❌ *non iniziato*

**Cos'è:** la pagina che risponde alla domanda *«chi ha fatto cosa, e quando»*. Oggi si chiama *Audit*;
il nome nuovo deciso è **«Registro attività»**.

**L'impianto esiste già** (la tabella, i filtri, la pagina). **Manca la copertura**: oggi le
registrazioni sono scritte **a mano**, sparse in una ventina di file — quindi tutto ciò che nessuno si
è ricordato di annotare semplicemente non compare. Scoperti per intero: l'area Produzione AI, le
conversazioni AI, le opportunità, gli avvisi, **e il login** (oggi non risulta chi è entrato e quando).

**La soluzione decisa è ibrida:** un **intercettore automatico** che registra da sé ogni scrittura
sulle entità principali — così il codice nuovo risulta tracciato *per costruzione*, senza che nessuno
debba ricordarsene — **più** le annotazioni scritte a mano dove serve un significato ricco (*«ha
inviato il preventivo al cliente»* dice più di *«ha modificato una riga»*).

**Dove va a menu:** deciso il 24/8 — dentro il gruppo **Impostazioni**, come **prima voce**. Prima e
non ultima perché è l'unica delle voci del gruppo che **si consulta** invece di configurarsi: le altre
si toccano una volta e si dimenticano, questa la si cerca di fretta quando è appena successo qualcosa.

### 7 · Cestino ❌ *non iniziato* — **la voce che avevi chiesto di rinfrescare**

**Cos'è, in una riga:** oggi nel CRM **quando cancelli, hai cancellato**. Non c'è ripensamento, non c'è
ripristino, non c'è un posto dove va a finire la roba buttata. Il cestino è quel posto.

**A cosa serve davvero.** È la rete di sicurezza contro l'errore umano più banale e più frequente: uno
che cancella il cliente sbagliato, o cancella qualcosa senza sapere cosa ci fosse attaccato. Senza
cestino, una cancellazione è definitiva: **oggi non esiste un backup del database di produzione**
da cui recuperare (vedi CRMA-70), quindi non c'è nessun rimedio successivo. Il cestino non è una
comodità: è l'unica rete di sicurezza contro l'errore umano.

**Come funziona (in gergo si chiama "soft-delete", cancellazione morbida).** Invece di togliere davvero
la riga dal database, la si **marca come cancellata**. La riga resta lì, ma sparisce dalla vista. Poi
c'è una **pagina Cestino** dove si può navigare fra le cose cancellate e o **ripristinarle** o
**cancellarle per davvero**.

**Perché è il lavoro più pesante della lista, ed è importante che tu lo sappia scegliendo A1.** Non è
"aggiungere un pulsante". Sono tre lavori, e il secondo e il terzo sono quelli che costano:

1. Aggiungere lo stato "cancellato" alle entità in perimetro. *(La parte facile.)*
2. **Ogni singola lettura di quelle entità deve escludere i cancellati.** Ogni elenco, ogni ricerca,
   ogni conteggio, ogni menu a tendina, ogni report. Se ne dimentichi **una**, il cliente cancellato
   ricompare in un punto solo del CRM — ed è il tipo di difetto che nessun test trova, perché il codice
   funziona: sta solo rispondendo a una domanda che nessuno ha aggiornato.
3. **I collegamenti che oggi il database cancella a catena vanno gestiti a mano.** Oggi cancellando un
   cliente il database porta via da sé le cose attaccate. Con il cestino non va più bene: se il
   database le ha già distrutte, **il cliente ripristinato torna svuotato** — c'è il nome, ma i suoi
   progetti, contatti e documenti no. Il piano ha contato **97 cancellazioni a catena, di cui ~35 sulle
   entità principali**.

**La misura del problema:** oggi in **67 tabelle** non esiste **niente** di simile. Si parte da zero.

**Il perimetro è già stato ristretto** (decisione del 17/8): si costruisce il **meccanismo generale**,
ma lo si **accende solo sulle entità della release di settembre**. Il resto del CRM lo eredita dopo,
accendendolo, senza riprogettare niente.

⚠️ Il piano lo dichiara *«il punto più pesante della lista»* e *«quello con più probabilità di
sforare»*. **In A1 resta dentro.** È soprattutto questa voce che sposta la data.

### 8 · Rifiniture di Messaggi e Profilo **+ allegati ai messaggi** ❌ *non iniziato*

⚠️ **Attenzione a una trappola del piano:** gli allegati stanno in questo punto insieme alle
rifiniture, ma **non sono una rifinitura**. Vogliono una tabella nuova, il caricamento dei file, lo
scaricamento con i permessi giusti, i limiti di dimensione. Vanno affrontati **per primi** dentro questo
blocco, non per ultimi.

Le rifiniture vere sono: lo storico dei messaggi oltre 120 oggi è irraggiungibile (il server sa già
paginare, il client non lo usa); la barra in alto interroga il server ogni 2 secondi senza rallentare
mai; il tetto di 80-100 contatti; e nel Profilo la pagina **«Modifica Profilo» che mente** (dice che
nome, email e password non si possono cambiare — non è più vero) e **«Impostazioni Account» che non
contiene nessuna impostazione**.

### 9 · Riordino del menu ❌ *non iniziato*

Nasce un gruppo **Impostazioni** con dentro, in quest'ordine: **Registro attività · Ruoli e permessi ·
Server di posta · Branding Workspace · Gestione Moduli**. *Reparti* si sposta sotto *Team*. Spariscono
dal menu «Nuovo Cliente» e «Nuovo Preventivo» (restano i pulsanti negli elenchi).

Ho verificato oggi: nel codice la voce si chiama ancora «Audit» sotto «Sicurezza», e il gruppo
«Impostazioni» non esiste.

**Perché si fa adesso e non dopo:** la navigazione va consegnata nella **forma definitiva**. Spostare
le voci dopo che le persone le hanno imparate è il momento peggiore per farlo. **Nessuna rotta da
cambiare** — in questo CRM la posizione a menu e l'indirizzo sono indipendenti.

### 10 · Nascondere i moduli fuori perimetro ❌ *non iniziato*

Si spengono da *Gestione Moduli*. **Zero sviluppo.** ✅ Già verificato che il Superadmin non resta
chiuso fuori: il modulo *Gestione Moduli* è marcato come indispensabile e **non si può spegnere**, né
dal server né dall'interfaccia. Quindi si può sempre riaccendere tutto.

### 11 · Audit di sicurezza ❌ *non iniziato — per definizione l'ultimo*

Si fa **a codice fermo**, quando non si tocca più niente. La cosa principale da verificare: che **ogni
interrogazione al database sia filtrata per workspace**. In un sistema che ospita più aziende è *il*
rischio — un cliente che vede i dati di un altro. Più: robustezza di accessi e sessioni, chiavi API e
password cifrate, limiti alle richieste ripetute, token degli inviti, dipendenze con vulnerabilità
note, nessun segreto finito nel repository.

---

## Il conto di A1, in due righe

| | Voci |
|---|---|
| ✅ Consegnato | 1 |
| 🟡 Unito oggi (era fermo su ramo) | 2, 3, e metà della 5 |
| ❌ Da fare | 4, il resto della 5, 6, **7 (il cestino)**, 8, 9, 10, 11 |

**Il grosso che resta sono il 6 e il 7** — Registro attività e Cestino — più gli allegati dentro l'8.
Le voci 9 e 10 sono piccole. L'11 è breve ma non si può anticipare.

---

## Le due cose che restano a te o a Claudio, e che nessun agent può fare

1. **La password della casella di posta nel `.env`.** Il file sta fuori dal repository, sulla macchina.
   Senza, la posta non parte — e il recupero password del punto 2 non ha il suo prerequisito. *(In
   questo contenitore il `.env` non c'è affatto: è il motivo per cui 9 prove di integrazione su 12 non
   possono girare qui.)*
2. **La prova a schermo con utenti veri.** Le verifiche fatte finora leggono il codice: dicono che una
   cosa c'è ed è collegata, non che si comporta bene quando la usi.
