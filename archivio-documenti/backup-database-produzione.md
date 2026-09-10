# Backup del database di produzione — stato, proposta, procedura di ripristino

> **Stato: PROPOSTA, in attesa di approvazione di Jacopo.** Niente di quanto è descritto
> qui è stato messo in produzione. La prova di ripristino (capitolo 4) invece **è già
> stata fatta davvero**, su un database usa-e-getta, e i numeri che leggi sono misurati.
>
> Compito CRMA-70. Scritto il 9/9/2026 dal Guardiano.
>
> **Aggiornato il 10/9/2026** con le risposte di Jacopo (§2.3). La più importante cambia
> il senso di tutto il documento: il progetto Supabase è sul **piano gratuito**, che non
> fa backup di nessun tipo. Quindi quello proposto qui non è *un secondo* backup — è
> **l'unico**, e oggi al suo posto non c'è niente.

---

## 1. La cosa da sapere per prima

**Il database di produzione del CRM non ha nessun backup.** Non «nessuno che io sia
riuscito a trovare»: dal 10/9/2026 è una cosa accertata, non un sospetto — il progetto
Supabase è sul piano gratuito, e il piano gratuito non fa backup (§2.3 e §3). Il CRM è
online e funzionante, e i dati veri stanno tutti in un posto solo.

**Cosa significa in pratica, senza girarci intorno:** se domani il database di produzione
si perde — per un guasto, per una cancellazione sbagliata, per un accesso finito nelle
mani sbagliate — **non c'è niente da cui ripartire**. Non un file, non uno snapshot, non
un pannello da cui premere «ripristina». Si ricomincia dal database vuoto che le 67
migrazioni sanno ricostruire: la forma del CRM tornerebbe, i dati dell'agenzia no.

C'è una cosa peggiore della mancanza in sé, ed è che **un documento del progetto dà già
per scontato che il backup esista**. In `recap-A1-release-settembre.md` (riga 118), a
proposito di una cancellazione per errore, si legge:

> «l'unico rimedio è un backup del database — cioè una richiesta a un tecnico»

Quel rimedio oggi non c'è. Chi leggesse quella riga durante un guaio concluderebbe che
c'è una strada da tentare, e perderebbe tempo prezioso a cercarla.

✅ **Corretta.** Compito CRMA-72, commit `ce45bbf` sul ramo
`cronista/crma-72-recap-backup-cestino`: adesso quella riga dice la verità («oggi non
esiste un backup del database di produzione»). ⚠️ Il commit è **su un ramo, non ancora
unito a `main`**: finché l'unione non avviene, la versione del recap che si legge su
`main` promette ancora il backup inesistente.

---

## 2. Stato attuale: cosa ho accertato e cosa no

Divido le due cose, perché la differenza conta: quello che ho verificato regge, quello
che non ho potuto verificare va controllato da chi ha gli accessi **prima** di dare per
buona questa proposta.

### 2.1 Accertato (con la prova accanto)

| Fatto | Come l'ho verificato |
|---|---|
| Il database di produzione è **PostgreSQL su Supabase**, non un Postgres sulla nostra VPS | `archivio-documenti/come-il-crm-sta-online.md` §4, verificato sul campo l'8/9/2026 |
| La produzione è viva e vede il database | `https://api.advaiora.com/health` → `{"status":"ok","db":"up"}`, il 9/9/2026 alle 17:34 UTC. Il campo letto è `db`, non lo stato complessivo (nota #68) |
| Il frontend risponde | `https://crm.advaiora.com` → HTTP 200 |
| **Nel repository non esiste nessuno script di backup** | `grep -rl "pg_dump" scripts/ server/ package.json` → nessun risultato. In `scripts/` ci sono solo `agenti/`, `security/`, `install-pgvector-win.ps1` |
| **Nessun documento del progetto descrive un backup** | Ricerca di `backup\|pg_dump\|snapshot\|ripristino` su tutti i `.md` di `archivio-documenti/`: le uniche occorrenze parlano d'altro (snapshot di metriche, cestino, snapshot della VPS da hPanel) |
| Il database ha **69 tabelle**, 261 indici, 152 vincoli di chiave esterna, e si ricostruisce da zero applicando le 67 migrazioni tracciate | Applicate tutte in ordine su un database vuoto, senza un solo errore (capitolo 4) |
| Il database usa l'estensione **pgvector**, e questa è una dipendenza del ripristino | La migrazione `20260713074114_project_source_chunks` fa `CREATE EXTENSION IF NOT EXISTS vector`; la colonna `ProjectSourceChunk.embedding` è di tipo `vector(1536)` |

### 2.2 Quello che il 9/9 non avevo potuto accertare — e cosa mi serviva

> **Da leggere insieme al §2.3**, che contiene le risposte arrivate il 10/9/2026. Questa
> sezione resta qui perché dice *perché* quelle domande erano necessarie, e cosa serve
> chiedere di nuovo il giorno in cui qualcosa cambia (un cambio di piano, un cambio di
> macchina).

Questi tre punti non sono opinioni: sono buchi veri, e due di essi possono ribaltare la
proposta. Li elenco nominando esattamente cosa mi serve, come chiede il compito.

1. **Se Supabase stia già facendo backup automatici, e su che piano siamo.**
   È il punto che pesa di più. La documentazione Supabase dice che i backup giornalieri
   ci sono **solo dai piani a pagamento** (Pro: ultimi 7 giorni; Team: 14; Enterprise:
   fino a 30), mentre per il piano gratuito raccomanda testualmente di esportarsi i dati
   da sé con `supabase db dump` e di tenere copie fuori sede. Il *Point-in-Time Recovery*
   è un componente aggiuntivo a pagamento (indicativamente da ~100 $/mese).
   **Non so su che piano sia il nostro progetto**, e da qui non posso saperlo.
   👉 *Mi serve:* una schermata (o anche solo la risposta) da **Supabase → il progetto →
   Settings → Database → Backups**, e il piano indicato in **Settings → Billing**.

2. **Se sulla VPS esista già un cron di backup che nessuno ha documentato.**
   Io giro dentro un contenitore, non sulla macchina: `/srv` è vuoto, `crontab` non esiste
   proprio come comando. Quindi **non posso escluderlo** — e "non l'ho trovato" non
   significa "non c'è" (nota #56).
   👉 *Mi serve:* qualcuno con accesso SSH alla VPS che esegua
   `sudo crontab -l; crontab -l; ls -la /etc/cron.d/ /etc/cron.daily/; systemctl list-timers | grep -i backup`
   e incolli il risultato.

3. **Dove stanno oggi le credenziali di produzione.**
   Nel contenitore in cui lavoro il `DATABASE_URL` punta a `127.0.0.1:5432` — cioè al
   database di sviluppo locale, senza nemmeno una password. **Le credenziali di produzione
   qui non ci sono**, e va bene così: non devo averle. Ma so, dal documento sulla messa
   online, che stanno nel file `.env` dentro `/srv/crmadv` sulla VPS.
   👉 *Mi serve saperlo confermato*, perché è da lì che il backup dovrà pescarle.

### 2.3 Le risposte di Jacopo — 10/9/2026

Arrivate rispondendo alla scheda di domande su CRMA-70. Due chiudono un buco, una resta
aperta di proposito.

| Domanda | Risposta | Cosa cambia |
|---|---|---|
| Piano Supabase e backup automatici | **Piano gratuito — nessun backup** | 🔴 Il caso peggiore fra quelli previsti. Non stiamo aggiungendo una seconda rete di sicurezza a una che c'è già: **stiamo mettendo la prima**, e oggi al suo posto non c'è niente |
| Cron di backup già attivo sulla VPS | **Non verificabile adesso** — si procede assumendo che non ci sia, e si controlla prima di attivare | Non cambia il piano. Aggiunge **un passo obbligatorio** all'esecuzione: il comando del §2.2 punto 2 va eseguito *prima* di installare il cron nuovo, per non ritrovarsi due backup che si pestano i piedi |
| Dove va la copia fuori sede | **Archivio a oggetti** (Backblaze B2 o Hostinger) | Scelta fatta: era l'opzione raccomandata al §5.2. Comporta aprire un servizio e un metodo di pagamento — pochi centesimi al mese con questi volumi |
| Approvazione della proposta | **«Aspetta — prima voglio vedere le risposte alle altre domande»** | Le altre risposte sono queste tre, e sono tutte qui. L'approvazione va richiesta di nuovo, con questo documento aggiornato davanti |

**Perché la prima risposta è quella grave.** Il 9/9 la mancanza di backup era un fatto
sul *nostro* lato: nessuno script, nessun documento. Restava però aperta la possibilità
che Supabase ci stesse coprendo le spalle senza che noi lo sapessimo. Quella possibilità
adesso è chiusa: **non ci copre nessuno.** Il CRM è in produzione, con dati di clienti
veri, e non esiste da nessuna parte una copia da cui ripartire.

---

## 3. Perché il piano gratuito non ci copre — e perché non basterebbe nemmeno se pagassimo

**Prima parte: il piano gratuito non fa backup.** Non è una nostra deduzione, è scritto
nella documentazione di Supabase, che al piano gratuito dice testualmente di arrangiarsi:

> «We recommend that free tier plan projects regularly export their data using the
> Supabase CLI `db dump` command and maintain off-site backups.»
> — *Supabase Docs, «Database Backups»* (letto il 10/9/2026)

E, sempre lì: «*Database backups are not available for download for Free Plan projects*».
I backup giornalieri partono dal piano Pro (7 giorni), Team (14), Enterprise (fino a 30).
**Quindi la proposta di questo documento è esattamente ciò che il fornitore stesso
raccomanda di fare al posto suo.**

⚠️ **Un rischio in più che il piano gratuito si porta dietro**, e che non riguarda i
backup ma va detto qui perché nasce dalla stessa risposta: la documentazione avverte che
«*We may pause applications on the Free Plan that exhibit low activity in a 7-day
period*». Un progetto sospeso si riattiva dal pannello, quindi non è una perdita di dati
— ma è un CRM di produzione che può smettere di rispondere senza che nessuno l'abbia
deciso. È un motivo in più per valutare il passaggio a un piano a pagamento, oltre ai
backup.

**Seconda parte: nemmeno passando a Pro il problema sarebbe chiuso.** Se domani il
progetto passasse a un piano con i backup giornalieri, **quei backup da soli non
basterebbero comunque**, per tre motivi che falliscono in modi diversi:

- **Proteggono dal guasto della macchina, non dall'errore nostro.** Se qualcuno cancella
  per sbaglio i clienti di un workspace e se ne accorge dopo dieci giorni, un backup
  Supabase che ne tiene sette non serve a niente.
- **Sono dentro l'account che dovrebbero proteggere.** Un problema di fatturazione, un
  accesso perso, un progetto sospeso: il backup se ne va insieme a ciò che protegge. È
  esattamente il motivo per cui un backup non si tiene accanto all'originale.
- **Non li possiamo provare.** Un ripristino da pannello Supabase si può esercitare solo
  facendolo, e farlo su produzione è fuori discussione. Un dump nostro invece si prova
  quando si vuole, ed è ciò che ho fatto al capitolo 4.

**Conclusione, aggiornata al piano reale.** Il dump nostro serve **in ogni caso**: oggi
perché è l'unica copia che esisterebbe, domani — se si passasse a un piano a pagamento —
perché copre i tre buchi qui sopra che i backup del provider non coprono. Il passaggio di
piano e il dump non sono alternative fra cui scegliere: **il dump va fatto comunque**, e
il piano a pagamento è una decisione separata, che riguarda anche la sospensione per
inattività.

---

## 4. La prova di ripristino — FATTA, con i tempi misurati

> Il compito dice che questo punto vale più di tutti gli altri, e sono d'accordo: *un
> backup che nessuno ha mai ripristinato non è un backup, è un file.* Quindi l'ho fatto
> prima di proporre qualsiasi cosa, invece di prometterlo.

**Dove:** un cluster PostgreSQL 17.11 usa-e-getta, creato con `initdb` dentro la cartella
temporanea del run, sulla porta 55432, spento e cancellato a fine prova.
**Il database di produzione non è stato toccato in nessun momento**, né letto né
interrogato: non ne ho nemmeno le credenziali.

### Come ho costruito un database realistico

1. Applicate **tutte e 67 le migrazioni tracciate** del progetto, in ordine, su un
   database vuoto → **69 tabelle, 261 indici, 152 vincoli di chiave esterna**, zero errori.
   *(Nota utile di suo: lo schema si ricostruisce da zero senza intoppi. Il problema
   "relation already exists" della migrazione `20260706085001` riguarda solo un database
   già allineato, non una ricostruzione pulita.)*
2. Caricato un insieme di dati sintetici ma della forma giusta, rispettando le chiavi
   esterne: 3 workspace, 5.000 clienti, 8.000 progetti, 6.000 fonti e **20.000 frammenti
   con embedding veri da 1536 dimensioni** — la parte pesante e quella che più rischia di
   rompersi in un ripristino.
   **Totale: 200 MB.**

### I numeri

| Operazione | Tempo | Risultato |
|---|---|---|
| Dump formato custom compresso (`pg_dump -Fc -Z6`) | **9,4 s** | file da **22,4 MB** (da 200 MB: circa 9 volte più piccolo) |
| Dump formato piano + gzip (quello che produce `supabase db dump`) | 8,8 s | 22,2 MB |
| **Ripristino in un database vuoto** (`pg_restore -j4`) | **12,5 s** | **zero errori, zero avvisi** |
| **Ripristino sopra un database già pieno** (`--clean --if-exists`) | **29,1 s** | zero avvisi, nessun dato duplicato |

Tradotto in velocità: si scrive il backup a circa **21 MB/s** e lo si rimette a circa
**16 MB/s**. Anche un database di produzione da 2 GB — molto più grande di quello che
verosimilmente abbiamo oggi — verrebbe salvato in circa **un minuto e mezzo** e
ripristinato in circa **due minuti**. *Il tempo di ripristino non è il problema di questa
storia.*

### La verifica: non ho contato le righe, ho confrontato i contenuti

Contare le righe non dimostra che i dati siano intatti. Ho confrontato origine e copia
ripristinata su tre livelli, e **coincidono tutti**:

| Controllo | Origine | Ripristinato |
|---|---|---|
| Righe (clienti / progetti / fonti / frammenti) | 5000 / 8000 / 6000 / 20000 | **identiche** |
| `md5` del contenuto della tabella Clienti | `7d74b4e9…de19b` | **`7d74b4e9…de19b`** |
| `md5` di **tutti i 20.000 vettori** di embedding | `abba8e23…81fb1` | **`abba8e23…81fb1`** |
| Struttura (tabelle / indici / chiavi esterne) | 69 / 261 / 152 | **69 / 261 / 152** |
| Estensioni | `plpgsql, vector` | **`plpgsql, vector`** |

Gli embedding sono la prova che mi interessava di più: sono il tipo di dato non standard
del progetto, ed è dove un backup fatto male perde pezzi in silenzio. Sono tornati
identici byte per byte.

### Due trappole che la prova ha fatto emergere

- **Il ripristino richiede che `pgvector` sia disponibile sulla macchina di destinazione.**
  Il dump se la porta dietro come dipendenza (nel suo indice compare
  `3079 … EXTENSION - vector`), ma se il Postgres di destinazione non ha il pacchetto
  installato, **il ripristino fallisce**. Su una macchina nuova, nel giorno del guaio, è
  esattamente il genere di sorpresa che non ci si può permettere: va installato *prima*.
- **Ripristinare sopra un database già pieno costa più del doppio** (29 s contro 12,5 s) e
  richiede `--clean --if-exists`. Funziona, ma la strada veloce e pulita è ripristinare in
  un database **nuovo e vuoto**.

---

## 5. La proposta, con i numeri

### 5.1 Cosa gira, quando, e dove finisce

| Domanda | Proposta | Perché |
|---|---|---|
| **Che comando** | `pg_dump -Fc -Z6` (formato custom compresso) | È il formato che ho provato. Permette il ripristino selettivo di una singola tabella, cosa che il formato piano non consente |
| **Ogni quanto** | Una volta al giorno, **03:30 ora italiana** | Ora di minimo utilizzo. Un CRM d'agenzia con pochi utenti non giustifica il costo di qualcosa di più fitto. Significa accettare di perdere al massimo **un giorno di lavoro** |
| **Da dove parte** | Dalla **VPS Hostinger**, con `cron` di sistema | È una macchina nostra, sempre accesa, e soprattutto **è un'altra macchina rispetto al database** (che sta su Supabase). Il requisito "non accanto a ciò che protegge" è già soddisfatto in partenza |
| **Dove finiscono i file** | `/var/backups/crmadv/` sulla VPS **+ copia fuori sede** | La VPS da sola resta un punto singolo. Vedi 5.2 |
| **Quanto si tengono** | **7 giornalieri + 4 settimanali + 3 mensili** = 14 file | I 7 giorni coprono l'errore che ci si accorge subito; i mensili coprono l'errore scoperto tardi — il caso che i backup del provider non coprono mai |
| **Quanto spazio** | **~320 MB** in tutto, con la misura di oggi | 14 file da ~23 MB. La produzione vera è quasi certamente più piccola del mio campione (che è gonfiato dai 20.000 embedding sintetici). È spazio irrilevante su qualsiasi VPS |

### 5.2 La copia fuori sede

Un backup solo sulla VPS protegge dal guaio su Supabase, ma non dalla perdita della VPS.
Serve un terzo posto. In ordine di quanto sono convinto:

1. **Raccomandata — `rclone` verso un archivio a oggetti** (Backblaze B2 o lo storage a
   oggetti di Hostinger). Costo reale con questi volumi: **pochi centesimi al mese**.
   Automatizzabile, e con la possibilità di rendere i file non cancellabili per N giorni
   — che protegge anche dal caso in cui qualcuno entri nella VPS e cancelli i backup.
2. **Ripiego semplice** — copia settimanale su Google Drive aziendale via `rclone`. Meno
   pulita (è uno spazio che le persone usano a mano, quindi qualcuno può cancellare per
   sbaglio), ma non costa niente in più e non richiede aprire un servizio nuovo.

✅ **Scelta fatta da Jacopo il 10/9/2026: l'archivio a oggetti** (opzione 1). Comporta
aprire il servizio e un metodo di pagamento — passo che spetta a lui, io non ho né posso
avere quelle credenziali.

⚠️ **Con il piano gratuito questa copia pesa il doppio di quanto pesasse ieri.** Quando
si pensava che Supabase tenesse comunque i suoi backup, la copia fuori sede era la terza
di tre. Adesso le copie totali sono **due** — la VPS e l'archivio a oggetti — e nascono
tutte e due dallo stesso comando. Se quel comando smette di girare, non resta niente:
è la ragione per cui la sorveglianza del §5.4 non è un accessorio.

### 5.3 Le credenziali — il capitolo che mi riguarda più da vicino

Tre regole, e nessuna è formale.

- **La password del database non va nel `crontab` e non va sulla riga di comando.**
  Chiunque sulla macchina la leggerebbe con un `ps`, e finirebbe nei log. Va in un file
  **`~/.pgpass`** dell'utente che esegue il backup, con permessi `600` — è il meccanismo
  che PostgreSQL prevede apposta, e `pg_dump` lo usa da solo senza che gli si dica niente.
  In alternativa un `/etc/crmadv-backup.env` con `chmod 600` letto dallo script.
- **Il backup non gira come `root`.** Un utente di sistema dedicato, che sappia leggere
  solo ciò che gli serve.
- **⚠️ Il punto che quasi tutti dimenticano: il dump da solo non basta a rimettere in
  piedi il CRM.** Il documento sulla messa online (§4) lo dice già, e vale qui in pieno:
  le password del server di posta, le chiavi AI e le credenziali delle integrazioni sono
  **cifrate con la chiave madre `ENCRYPTION_KEY`, che sta nel `.env` e non nel database**.
  Un dump ripristinato senza quella chiave è un CRM in cui quelle credenziali sono
  **illeggibili per sempre** — e il guasto si presenta con la scritta *"AI non configurata"*,
  che sembra un dato mancante mentre è un dato che non si riesce più ad aprire.

  👉 Quindi: **`ENCRYPTION_KEY` e `AUTH_JWT_SECRET` vanno messi al sicuro anche loro**, in
  un gestore di password (non in un file accanto ai dump, e mai nel repository).
  **E non nello stesso posto dei dump**: chi mettesse le due cose insieme darebbe a
  chiunque rubi quella cartella sia i dati sia le chiavi per leggerli. Vanno separati
  apposta.

### 5.4 La sorveglianza — e il guasto silenzioso

Il compito lo dice bene: un backup che smette di girare in silenzio è **peggio** di
nessun backup, perché dà una sicurezza falsa. Ci sono due modi di fallire, e vanno
coperti separatamente perché uno dei due non si vede.

**a) Il backup gira e fallisce.** Facile: lo script esce con un codice diverso da zero, e
*solo in quel caso* chiama l'API di Paperclip per aprire un compito assegnato a chi di
dovere. Nessun compito quando va bene — che è esattamente il vincolo posto dal compito:
la sveglia arriva dal guasto, non dalla routine.

**b) Il backup non gira affatto.** Questo è il caso cattivo, e la soluzione del punto (a)
**non lo copre**: se il cron è morto, o la VPS è spenta, non c'è nessuno script che possa
segnalare la propria assenza. Un guasto che si manifesta come silenzio non può essere
raccontato da chi tace.
Serve qualcosa **fuori dalla macchina** che si accorga del silenzio. La via più semplice e
gratuita è un servizio di "interruttore dell'uomo morto" (per esempio healthchecks.io,
piano gratuito): il backup, quando riesce, manda un segnale; se il segnale **non arriva**
entro il tempo previsto, è il servizio a mandare l'email. Costa zero e non richiede nessun
compito ricorrente su Paperclip.

**Aggiungo un terzo controllo, perché i primi due non bastano:** un backup può girare,
riuscire, mandare il suo segnale — e produrre un file corrotto o vuoto. Lo script deve
verificare il file appena scritto con `pg_restore --list` (che lo apre e ne legge
l'indice) e controllare che la dimensione sia plausibile rispetto al giorno prima. Un
dump che passa da 23 MB a 40 KB è un backup fallito che si presenta come riuscito.

### 5.5 E la prova di ripristino, dopo?

Una volta sola non basta: le cose smettono di funzionare col tempo. Propongo di
**rifare la prova ogni tre mesi**, con la procedura del capitolo 6, misurando i tempi e
scrivendoli qui sotto. È mezz'ora, e si può affidare a un compito Paperclip ricorrente —
qui una routine ha senso, perché produce un risultato vero, non la lettura di un esito
positivo.

---

## 6. La procedura di ripristino

Questa è la procedura **provata**, quella del capitolo 4. Va letta prima che serva:
il giorno del guaio non è il momento per scoprire cosa fa il passo 3.

### 6.1 Prima di toccare qualsiasi cosa

1. **Non ripristinare sopra la produzione d'istinto.** Se il problema è una cancellazione
   per errore, ripristinare tutto il database riporta indietro *anche* il lavoro buono
   fatto dopo. Quasi sempre la mossa giusta è ripristinare in un database **separato**,
   guardare, e riportare indietro solo il pezzo che serve.
2. **Verificare che la destinazione abbia `pgvector`**, altrimenti il ripristino si ferma
   a metà (vedi capitolo 4).

### 6.2 I comandi

```bash
# 1. Preparare un database nuovo e vuoto (mai ripristinare in uno già usato)
createdb -h <host> -U <utente> crmadv_ripristino

# 2. Ripristinare. -j4 usa quattro processi in parallelo
pg_restore -h <host> -U <utente> -d crmadv_ripristino \
           -j4 --no-owner --no-privileges \
           /var/backups/crmadv/backup-AAAA-MM-GG.dump

# 3. Verificare che sia arrivato tutto (non fermarsi al fatto che il comando finisca)
psql -h <host> -U <utente> -d crmadv_ripristino -c \
  'select count(*) from "Client";  select count(*) from "Project";'
```

> `<host>` e `<utente>` sono quelli del database di destinazione, **non** segnaposto da
> lasciare così: vanno sostituiti prima di eseguire. Per il ripristino di prova sono
> quelli del database usa-e-getta; per un ripristino vero, quelli decisi al momento.

### 6.3 Tempi da aspettarsi

Sulla misura di oggi (200 MB): **circa 13 secondi**. Su un database da 2 GB: **circa due
minuti**. Se ci mette molto di più, qualcosa non va — non è normale che sia lento.

### 6.4 Dopo il ripristino, ricordarsi delle chiavi

Se il ripristino è su una macchina nuova, il CRM funzionerà ma dirà *"AI non configurata"*
e non manderà email finché non gli si rimette accanto la **`ENCRYPTION_KEY` giusta**
(§5.3). Non è un guasto del ripristino: è la cifratura che fa il suo mestiere.

---

## 7. Cosa serve per andare avanti — aggiornato al 10/9/2026

Le tre domande del 9/9 hanno avuto risposta (§2.3). Resta questo.

**① L'approvazione, che oggi manca.** Alla domanda «approvi la proposta?» la risposta è
stata «aspetta, prima voglio vedere le risposte alle altre domande». Adesso quelle
risposte ci sono e stanno nel §2.3. **La proposta è ferma qui**: nessuno ha installato
niente, e nessuno lo farà senza un sì esplicito.

**② L'esecuzione, che richiede un accesso che io non ho.** Se approvata, l'esecuzione è
in cinque passi, in quest'ordine:

1. **Controllare che sulla VPS non ci sia già un cron di backup** — è il passo che la
   risposta «non riesco a controllarlo adesso» rende obbligatorio. Comando nel §2.2,
   punto 2. Serve a non ritrovarsi due backup che si sovrascrivono a vicenda.
2. **Aprire l'archivio a oggetti** (Backblaze B2 o Hostinger) e generare le chiavi di
   accesso — solo scrittura, con i file resi non cancellabili per N giorni (§5.2).
3. **Installare lo script di backup e il `.pgpass`** sulla VPS, con i permessi del §5.3.
4. **Installare il cron delle 03:30** e la copia verso l'archivio a oggetti (§5.1, §5.2).
5. **Accendere la sorveglianza** — il guardiano del silenzio del §5.4, che è ciò che
   distingue un backup da un backup che ha smesso di girare senza dirlo a nessuno.

👉 **I passi 1-4 richiedono l'accesso SSH alla VPS e le credenziali del fornitore di
archiviazione. Io non ho né l'uno né le altre, e non devo averle.** Questa parte la fa
Jacopo, o chi ha quegli accessi. Io posso preparare lo script e il testo del cron perché
vengano incollati, e posso costruire la sorveglianza dal lato Paperclip.

**③ Una decisione separata, da non confondere con questa.** Il piano gratuito espone
anche alla sospensione per inattività (§3). Se il CRM è in produzione con clienti veri,
vale la pena valutare il passaggio a un piano a pagamento — ma è una decisione di costo
che **non sostituisce** il backup di questo documento e non va usata per rimandarlo.

### Cose già chiuse, che non aspettano più niente

- ✅ **La riga del recap che prometteva un backup inesistente** è stata corretta —
  CRMA-72, commit `ce45bbf`. ⚠️ Ancora su un ramo, non su `main` (§1).
- ✅ **La prova di ripristino** è stata fatta e misurata (§4), e la procedura è scritta
  (§6). Non era subordinata a nessuna approvazione, ed è la parte del compito che vale
  di più: se domani qualcuno dovesse ripristinare, troverebbe dei comandi già provati
  invece di una pagina bianca.
