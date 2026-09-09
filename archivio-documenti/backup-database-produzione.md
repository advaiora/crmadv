# Backup del database di produzione — stato, proposta, procedura di ripristino

> **Stato: PROPOSTA, in attesa di approvazione di Jacopo.** Niente di quanto è descritto
> qui è stato messo in produzione. La prova di ripristino (capitolo 4) invece **è già
> stata fatta davvero**, su un database usa-e-getta, e i numeri che leggi sono misurati.
>
> Compito CRMA-70. Scritto il 9/9/2026 dal Guardiano.

---

## 1. La cosa da sapere per prima

**Il database di produzione del CRM non ha nessun backup che io sia riuscito a trovare.**
Il CRM è online e funzionante — l'ho verificato mentre scrivevo — e i dati veri stanno
tutti in un posto solo.

C'è una cosa peggiore della mancanza in sé, ed è che **un documento del progetto dà già
per scontato che il backup esista**. In `recap-A1-release-settembre.md` (riga 118), a
proposito di una cancellazione per errore, si legge:

> «l'unico rimedio è un backup del database — cioè una richiesta a un tecnico»

Quel rimedio oggi non c'è. Chi leggesse quella riga durante un guaio concluderebbe che
c'è una strada da tentare, e perderebbe tempo prezioso a cercarla. **Quella riga va
corretta**, che questa proposta venga approvata o no.

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

### 2.2 NON accertato — mi servono accessi che non ho

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

---

## 3. Perché non basta aspettarsi che ci pensi Supabase

Anche nel caso migliore — siamo su un piano a pagamento e i backup giornalieri sono
attivi — **quei backup da soli non bastano**, per tre motivi che falliscono in modi
diversi:

- **Proteggono dal guasto della macchina, non dall'errore nostro.** Se qualcuno cancella
  per sbaglio i clienti di un workspace e se ne accorge dopo dieci giorni, un backup
  Supabase che ne tiene sette non serve a niente.
- **Sono dentro l'account che dovrebbero proteggere.** Un problema di fatturazione, un
  accesso perso, un progetto sospeso: il backup se ne va insieme a ciò che protegge. È
  esattamente il motivo per cui un backup non si tiene accanto all'originale.
- **Non li possiamo provare.** Un ripristino da pannello Supabase si può esercitare solo
  facendolo, e farlo su produzione è fuori discussione. Un dump nostro invece si prova
  quando si vuole, ed è ciò che ho fatto al capitolo 4.

**Proposta: tutti e due.** I backup del provider come rete di sicurezza sull'infrastruttura,
e un dump nostro come copia che possediamo, sappiamo leggere e abbiamo già ripristinato.

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

👉 **Questa è una scelta che spetta a Jacopo**, perché comporta aprire un servizio e
un metodo di pagamento. Non la decido io.

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

## 7. Cosa serve per andare avanti

**Da Jacopo, tre risposte:**

1. **Su che piano è il progetto Supabase, e i backup automatici sono attivi?** (Settings →
   Database → Backups). È la risposta che decide se stiamo mettendo la prima rete di
   sicurezza o la seconda.
2. **C'è già un cron sulla VPS?** Il comando da eseguire è nel §2.2, punto 2.
3. **La copia fuori sede: archivio a oggetti a pagamento (centesimi al mese) o Google
   Drive aziendale?** (§5.2)

**Poi, se approvi, l'esecuzione è:** lo script di backup + il cron sulla VPS + il
guardiano del silenzio + la copia fuori sede. Serve però qualcuno **con accesso SSH alla
VPS**: io da qui non ce l'ho, e questa parte non posso farla al posto suo.

**Indipendentemente dall'approvazione**, una cosa va fatta comunque: **correggere la riga
118 di `recap-A1-release-settembre.md`**, che promette un backup che non esiste (§1).
