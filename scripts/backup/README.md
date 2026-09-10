# Backup del database di produzione — come si installa

> **Il perché di ogni scelta** (cadenza, rotazione, dove finiscono i file, la prova di
> ripristino con i tempi misurati) sta in
> `archivio-documenti/backup-database-produzione.md`. Qui c'è solo il **come**: i comandi
> da incollare sulla VPS, nell'ordine giusto. Compito CRMA-70, piano approvato da Jacopo
> il 10/9/2026.
>
> ⚠️ **Nessuno di questi comandi tocca il database di produzione in scrittura.** Il backup
> lo legge soltanto.

**Cosa c'è in questa cartella**

| File | Cos'è |
|---|---|
| `backup-crmadv.sh` | Lo script che gira ogni notte. Va copiato sulla VPS |
| `crmadv-backup.env.example` | Il modello della configurazione. La copia riempita **resta sulla VPS**, non torna qui |

⚠️ **Il repository è pubblico.** Password, chiavi e stringhe di connessione non entrano in
nessuno dei due file qui dentro, mai — nemmeno "solo per provare".

---

## Passo 1 — Controllare che un backup non ci sia già (obbligatorio)

Serve a non ritrovarsi due backup che si sovrascrivono a vicenda. È il passo che la
risposta «non riesco a controllarlo adesso» del 10/9 rende obbligatorio.

```bash
sudo crontab -l; crontab -l
ls -la /etc/cron.d/ /etc/cron.daily/
systemctl list-timers | grep -i backup
```

Se salta fuori qualcosa che assomiglia a un backup del database, **fermarsi qui** e
segnalarlo sul compito prima di installare altro.

## Passo 2 — Preparare macchina, utente e cartelle

Il backup non gira come `root`: gli serve solo leggere il database e scrivere in una
cartella.

```bash
# Client PostgreSQL: la versione dev'essere >= a quella del server Supabase.
# Un pg_dump più vecchio del server si rifiuta di lavorare.
sudo apt update && sudo apt install -y postgresql-client-17 rclone curl

sudo useradd --system --home /var/lib/crmadv-backup --shell /usr/sbin/nologin crmadvbackup
sudo mkdir -p /var/backups/crmadv /var/lib/crmadv-backup
sudo touch /var/log/crmadv-backup.log
sudo chown -R crmadvbackup:crmadvbackup /var/backups/crmadv /var/lib/crmadv-backup /var/log/crmadv-backup.log
sudo chmod 700 /var/backups/crmadv
```

## Passo 3 — Installare lo script e la configurazione

```bash
sudo install -m 755 -o root -g root backup-crmadv.sh /usr/local/bin/backup-crmadv.sh
sudo install -m 600 -o crmadvbackup -g crmadvbackup crmadv-backup.env.example /etc/crmadv-backup.env
sudo -e /etc/crmadv-backup.env     # e si riempie
```

I valori del database si prendono da **Supabase → il progetto → Connect**:

- ⚠️ **Se la VPS non ha IPv6**, il collegamento diretto `db.<progetto>.supabase.co` non è
  raggiungibile: è solo IPv6. Va usato il **pooler in modalità sessione**, che ha un
  indirizzo IPv4 — quello sulla **porta 5432**.
- ⚠️ **La porta 6543 non va bene**: è il pooler in modalità transazione, e `pg_dump` con
  quello non funziona.

## Passo 4 — La password, che non si scrive nel cron

Va nel `~/.pgpass` dell'utente del backup. `pg_dump` lo legge da solo, e così la password
non compare né nella riga di comando (dove chiunque la leggerebbe con un `ps`) né nel
registro.

```bash
sudo -u crmadvbackup tee /var/lib/crmadv-backup/.pgpass >/dev/null <<'EOF'
<host>:5432:postgres:<utente>:<password>
EOF
sudo chmod 600 /var/lib/crmadv-backup/.pgpass
sudo chown crmadvbackup:crmadvbackup /var/lib/crmadv-backup/.pgpass
```

> Il file va scritto con l'heredoc quotato (`<<'EOF'`) e non con `echo`: così una password
> che contiene `$` o `!` non viene interpretata dalla shell.
> Se la casa dell'utente non è `/var/lib/crmadv-backup`, si aggiunge
> `PGPASSFILE=/var/lib/crmadv-backup/.pgpass` in `/etc/crmadv-backup.env`.

## Passo 5 — L'archivio a oggetti (la copia fuori sede)

Scelta di Jacopo il 10/9/2026. Sul fornitore (Backblaze B2 o storage a oggetti Hostinger):

1. creare un **contenitore privato** dedicato, per esempio `crmadv-backup`;
2. generare una chiave **di sola scrittura** su quel contenitore soltanto. È il punto che
   conta: chi entrasse nella VPS troverebbe una chiave che **non può cancellare niente**,
   quindi non può portarsi via anche le copie;
3. impostare sul contenitore una **regola di ciclo di vita** che cancelli da sola i file
   più vecchi di ~35 giorni. La scadenza la decide l'archivio, non lo script — proprio
   perché lo script non ha il permesso di cancellare;
4. se il fornitore lo offre, attivare il **blocco della cancellazione** (object lock) per
   7 giorni.

```bash
sudo -u crmadvbackup rclone config --config /etc/crmadv-rclone.conf   # nome del remoto: crmadv
sudo chmod 600 /etc/crmadv-rclone.conf
sudo chown crmadvbackup:crmadvbackup /etc/crmadv-rclone.conf
# poi in /etc/crmadv-backup.env:  RCLONE_REMOTE=crmadv:crmadv-backup
```

## Passo 6 — La sorveglianza

**a) Il guardiano del silenzio** — è l'unica cosa che si accorge del backup che *non gira
affatto*: se il cron muore o la VPS è spenta, nessuno script può segnalare la propria
assenza. Su healthchecks.io (piano gratuito) si crea un controllo con periodo **1 giorno**
e tolleranza **6 ore**, si mette l'indirizzo in `HEALTHCHECK_URL`, e si controlla che
l'email di avviso arrivi a una casella che qualcuno legge davvero.

**b) Il compito su Paperclip quando il backup fallisce** — servono `PAPERCLIP_API_URL`,
una chiave, `PAPERCLIP_COMPANY_ID` e l'agente a cui assegnarlo
(`PAPERCLIP_ASSIGNEE_AGENT_ID`, di norma il Guardiano). Quando il backup **riesce** non
viene aperto niente: la sveglia arriva dal guasto, mai dalla routine.

## Passo 7 — La prova, prima di mettere il cron

```bash
sudo -u crmadvbackup /usr/local/bin/backup-crmadv.sh --verifica   # solo controlli, non scrive backup
sudo -u crmadvbackup /usr/local/bin/backup-crmadv.sh              # il primo backup vero
ls -lh /var/backups/crmadv/giornalieri/
sudo tail -n 20 /var/log/crmadv-backup.log
```

`--verifica` controlla che ci siano gli strumenti, che il database risponda, che le
versioni siano compatibili e che le cartelle siano scrivibili. **Se quello non passa, non
serve provare il resto.**

## Passo 8 — Il cron delle 03:30

```bash
sudo crontab -u crmadvbackup -e
```

e dentro:

```cron
CRON_TZ=Europe/Rome
MAILTO=<indirizzo che qualcuno legge>
30 3 * * * /usr/local/bin/backup-crmadv.sh
```

> ⚠️ **`CRON_TZ` non è un dettaglio.** Se la VPS è a UTC — e di norma lo è — senza quella
> riga il backup parte alle 05:30 italiane d'estate, non alle 03:30. Si controlla con
> `timedatectl`. (È lo stesso scivolone delle routine Paperclip, che sono in UTC.)
> Se il cron della macchina non supporta `CRON_TZ`, si scrive `30 1 * * *` e lo si annota.

## Passo 9 — Verificare che il backup si ripristini davvero

Un backup che nessuno ha mai ripristinato non è un backup, è un file. Da rifare **ogni tre
mesi** (§5.5 del documento). Su un database di prova, **mai sulla produzione**:

```bash
createdb -h <host-di-prova> -U <utente> crmadv_ripristino
pg_restore -h <host-di-prova> -U <utente> -d crmadv_ripristino -j4 --no-owner --no-privileges \
           /var/backups/crmadv/giornalieri/crmadv-<data>.dump
psql -h <host-di-prova> -U <utente> -d crmadv_ripristino -c \
  'select count(*) from "Client"; select count(*) from "Project";'
```

⚠️ La destinazione deve avere **pgvector** installato, altrimenti il ripristino si ferma a
metà: il CRM usa `vector(1536)` per gli embedding.

⚠️ E ricordarsi che **il dump da solo non rimette in piedi il CRM**: le credenziali delle
integrazioni sono cifrate con `ENCRYPTION_KEY`, che sta nel `.env` e **non** nel database.
Quella chiave e `AUTH_JWT_SECRET` vanno tenute in un gestore di password, **in un posto
diverso dai dump** — altrimenti chi si porta via la cartella dei backup si porta via anche
le chiavi per aprirli.

---

## Quando arriva l'allarme

1. `sudo tail -n 40 /var/log/crmadv-backup.log` — il motivo è scritto lì.
2. `sudo -u crmadvbackup /usr/local/bin/backup-crmadv.sh --verifica` — dice subito se è il
   database, le versioni o i permessi.
3. Rilanciare a mano: `sudo -u crmadvbackup /usr/local/bin/backup-crmadv.sh`.

**Un allarme ogni 20 ore al massimo**, anche se il guasto dura giorni (`ORE_FRA_DUE_ALLARMI`):
sette notti di guasto aprono un compito, non sette. Se il guasto è risolto ma vuoi
riabilitare l'allarme subito: `sudo rm -f /var/lib/crmadv-backup/ultimo-allarme`.

**Se l'allarme non arriva ma il backup non c'è** (il caso peggiore): il file più recente in
`/var/backups/crmadv/giornalieri/` dice fino a quando ha funzionato. Da lì si controlla
`systemctl status cron` e il registro.

---

## Cosa è stato provato davvero, e cosa no

Provato il 10/9/2026 su un PostgreSQL 17 usa-e-getta (`initdb`, cancellato a fine prova),
**senza mai toccare la produzione**:

| Cosa | Esito |
|---|---|
| `--verifica` e backup completo su un database da 200.000 righe | dump da 4,4 MB in 1 s |
| Il dump prodotto si ripristina | `pg_restore` in un database vuoto: 200.000 righe, zero errori |
| Rotazione con 10 giornalieri presenti | ne restano 7, i più recenti |
| Database irraggiungibile | uscita 1, motivo nel registro, segnale di guasto, nessun file monco lasciato in giro |
| Dump che crolla di dimensione (dati spariti, comando "riuscito") | bloccato: *«calo oltre il 50%»* — e **il backup buono di ieri non viene sovrascritto** |
| Secondo guasto entro 20 ore | *«allarme già aperto, non ne apro un altro»* |

**Non provato, perché richiede accessi che l'agente non ha:** la connessione vera a
Supabase, la copia con `rclone` verso l'archivio a oggetti, l'apertura reale del compito su
Paperclip (provata solo la strada del codice, contro un indirizzo che non risponde) e il
cron sulla VPS. Sono i passi 1-8 qui sopra: li fa chi ha SSH.
