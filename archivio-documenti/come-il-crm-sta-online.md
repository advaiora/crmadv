# Come il CRM sta online

Questo documento risponde a una domanda sola: **dove gira il CRM quando qualcuno lo
apre dal browser, e cosa succede quando uniamo qualcosa a `main`.**

E' scritto in linguaggio semplice: non serve essere sviluppatori per leggerlo.

Ultima verifica sul campo: **8/9/2026**. I controlli sono descritti in fondo, cosi'
chiunque puo' rifarli e capire se qualcosa e' cambiato.

---

## 1. Il quadro in cinque righe

Il CRM non sta su una macchina sola: sta su **tre** servizi diversi, ognuno con un
compito preciso.

| Pezzo | Chi lo ospita | Indirizzo |
|---|---|---|
| Le **pagine** che vedi nel browser | Vercel | `https://crm.advaiora.com` |
| L'**API**, cioe' il motore che risponde alle domande delle pagine | Un server nostro (VPS Hostinger) | `https://api.advaiora.com` |
| Il **database**, dove stanno davvero i dati | Supabase | non ha un indirizzo pubblico |

Il giro completo di una richiesta e' questo:

```
il tuo browser
   → crm.advaiora.com   (Vercel: consegna le pagine)
   → api.advaiora.com   (il nostro server: esegue la richiesta)
   → Supabase           (il database: conserva i dati)
```

---

## 2. Chi serve le pagine del frontend

Le pagine stanno su **Vercel**. Vercel prende il codice del repository, lo compila
(`npm run build`, che produce la cartella `dist/`) e pubblica il risultato.

Due cose importanti da sapere:

- Il file `vercel.json`, nella radice del progetto, contiene **solo** una riscrittura:
  ogni indirizzo viene mandato alla pagina iniziale. Serve perche' il CRM e' una
  "applicazione a pagina singola" — e' il codice nel browser a decidere cosa mostrare,
  non il server. **Quel file non dice niente su dove sta l'API**: e' per questo che
  leggendo solo il repository non si capiva come il CRM stesse online.

- L'indirizzo dell'API (`VITE_API_URL`) viene **inciso dentro il pacchetto al momento
  della compilazione**, non letto mentre gira. Cambiarlo richiede un nuovo deploy: non
  basta modificare un'impostazione.

  ⚠️ Se `VITE_API_URL` manca, il CRM non da' un errore chiaro. Per via della riscrittura
  qui sopra, le chiamate all'API ricevono **la pagina iniziale con esito "tutto bene"**;
  il codice prova a leggerla come dati e si ferma. Il sintomo e' una schermata bianca o
  un errore che sembra puntare all'API, mentre l'API sta benissimo.

## 3. Chi serve l'API

L'API gira su un **VPS Hostinger** (un server nostro, sempre acceso), raggiungibile
all'indirizzo `https://api.advaiora.com`.

Sul server:

- Il progetto sta nella cartella `/srv/crmadv`.
- L'API e' un **servizio di sistema** (`systemd`) che si chiama **`crmadv-api`**. Si
  riavvia da solo se cade, e riparte da solo se il server viene riavviato.
- Non c'e' una fase di compilazione per l'API: il servizio esegue direttamente i file
  TypeScript con `tsx`.
- L'API **non e' esposta direttamente su internet**: ascolta solo in locale sulla porta
  **3001**, e davanti c'e' un **proxy (Traefik)** che si occupa del certificato HTTPS e
  gira le richieste. ⚠️ Quello stesso proxy serve anche **Paperclip**, cioe' la bacheca
  su cui lavoriamo: non va mai riavviato alla leggera.

> ⚠️ **La porta 3001 vale solo online.** In locale l'API sta sulla **4000**: e' il valore
> predefinito del codice. Non copiare 3001 nel tuo `.env`.

## 4. Quale database usa

Il database e' **PostgreSQL ospitato su Supabase**. Non e' raggiungibile da internet in
modo pubblico: solo l'API ci parla, usando la variabile `DATABASE_URL`.

Due precisazioni che tolgono confusione:

- **Nel repository non ci sono mai stati i dati.** Nel repository c'e' lo *schema* (com'e'
  fatto il database) e i *seed* (i dati di esempio). I dati veri stanno solo dentro
  Supabase.
- **Supabase non ha richiesto nessuna modifica al codice.** Per il progetto e' un
  PostgreSQL come un altro: cambia solo l'indirizzo dentro `DATABASE_URL`.

### Le credenziali dentro il CRM sono cifrate due volte

Password del server di posta, chiavi AI e credenziali delle integrazioni non stanno in
chiaro nel database. Sono protette a due livelli:

1. ogni workspace ha una sua chiave, conservata **dentro il database**;
2. quella chiave e' a sua volta chiusa con la chiave madre **`ENCRYPTION_KEY`**, che sta
   nel file `.env` **fuori** dal database.

⚠️ **Conseguenza pratica, e vale anche per la tua postazione locale:** una copia del
database senza la `ENCRYPTION_KEY` corrispondente e' una copia in cui quelle credenziali
**non sono piu' leggibili**. Non si "recuperano": vanno reinserite a mano dentro il CRM.
E il modo in cui si presenta il guasto inganna — il CRM dice *"AI non configurata"*, che
sembra un dato mancante mentre e' un dato illeggibile.

---

## 5. Cosa succede quando si unisce qualcosa a `main`

**Qui sta la cosa piu' importante di tutto il documento**, perche' e' controintuitiva:

> ### ⚠️ Unire a `main` aggiorna il frontend da solo, ma NON aggiorna l'API.

- **Il frontend si aggiorna da solo.** Vercel si accorge dell'unione e ripubblica le
  pagine nel giro di un minuto o due. Non c'e' niente da fare a mano.
- **L'API no.** La cartella `/srv/crmadv` sul server resta ferma alla versione precedente
  finche' qualcuno non va a tirarla giu' a mano e non riavvia il servizio.

Quindi **ogni unione a `main` e' un aggiornamento a meta'** finche' non si aggiorna anche
il server: pagine nuove che parlano con un motore vecchio.

Il 8/9/2026 e' successo davvero: tre lavori uniti alle 12:39, frontend online alle 12:40,
API ferma alla versione precedente.

### Quando l'aggiornamento a meta' fa danni

Dipende da cosa e' cambiato:

- Se il frontend manda un **campo nuovo** che l'API vecchia non conosce, il campo viene
  ignorato in silenzio. Fastidioso, ma si sopravvive.
- Se il frontend manda un **valore nuovo in un elenco chiuso** (per esempio un nuovo
  fornitore AI), l'API vecchia lo **rifiuta** e l'intero salvataggio fallisce con un
  errore.

Regola pratica: se il lavoro unito aggiunge una voce a un elenco di valori ammessi,
l'aggiornamento del server non e' rimandabile.

### La procedura di aggiornamento del server

Due comandi, ed e' facilmente reversibile. Li esegue chi ha l'accesso al server.

1. Prima si guarda **cosa e' cambiato**: se non sono stati toccati ne' `package.json` /
   `package-lock.json` ne' la cartella `prisma/`, non servono ne' reinstallazione delle
   dipendenze ne' migrazioni del database.
2. Si porta la cartella `/srv/crmadv` alla versione nuova.
3. Si riavvia il servizio `crmadv-api`.

Per tornare indietro si riporta la cartella alla versione precedente e si riavvia di
nuovo: stessa fatica, in senso opposto.

Se invece **sono** cambiati `package.json` o `prisma/`, servono anche l'installazione
delle dipendenze e l'applicazione delle migrazioni, e non e' piu' un'operazione da due
comandi: va concordata.

### Come si verifica che l'aggiornamento sia andato

Un solo controllo, e va letto per intero:

```
https://api.advaiora.com/health
```

Deve rispondere `{"status":"ok","db":"up"}`.

⚠️ **Non basta che risponda.** Il campo che conta e' **`db`**: l'API puo' rispondere
benissimo mentre il database e' irraggiungibile, e in quel caso dice `"db":"down"`.
Guardare solo "ha risposto" fa concludere che vada tutto bene quando non e' cosi'.

---

## 6. Le chiavi della tua postazione locale te le generi tu

⚠️ **Non copiare le chiavi di produzione sul tuo PC.** Ti servono chiavi **tue**, diverse,
generate da te. Sono due, e si generano in PowerShell con un comando ciascuna.

**`AUTH_JWT_SECRET`** — firma i token di accesso, serve almeno 16 caratteri:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**`ENCRYPTION_KEY`** — la chiave madre che cifra le credenziali, esattamente 32 byte:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia ogni valore prodotto dentro il tuo `.env`, accanto al nome corrispondente. Sono
valori tuoi, per la tua macchina: non vanno condivisi, ne' incollati in un documento, ne'
committati.

> ⚠️ **Se il tuo database locale contiene gia' segreti cifrati con una chiave precedente
> che ormai hai perso**, generare una chiave nuova non li recupera: restano illeggibili
> per sempre. Quei segreti — password del server di posta, chiavi AI, credenziali delle
> integrazioni — vanno **reinseriti a mano dentro il CRM** dalle pagine che li gestiscono.
> Non e' un guasto e non c'e' niente da riparare: e' come funziona la cifratura.

Per il resto della configurazione locale: `.env.example` nella radice elenca **tutti** i
nomi delle variabili con cosa fanno, e `installazione-e-avvio.md` spiega passo per passo
come partire.

---

## 7. Trappole gia' costate tempo

Le lasciamo scritte perche' si ripresentano.

- **Qualsiasi indirizzo sotto `advaiora.com` risponde "tutto bene".** Esiste un record
  jolly, quindi anche un sottodominio mai configurato mostra una pagina. *"L'indirizzo
  risponde"* non ha mai dimostrato che una pubblicazione sia riuscita.

- **`crmadv.vercel.app` non e' il nostro CRM.** E' un'applicazione di qualcun altro: quel
  nome era gia' preso, e il nostro indirizzo automatico ha un suffisso. Non usarlo per
  fare prove.

- **Un dominio su Vercel puo' essere impostato per *rimandare* a un altro indirizzo
  invece di servire il sito, e sembra tutto a posto.** Il guaio e' che l'API accetta
  chiamate solo da `https://crm.advaiora.com`: se il browser finisce su un altro
  indirizzo, la pagina si carica perfettamente e **non recupera nessun dato**.

- **Il pulsante "Accesso Google" c'e' anche quando Google non e' configurato**, e
  fallisce solo dopo il clic. Con email e password si entra normalmente.

- **Non spostare mai i nameserver di `advaiora.com` su Vercel.** Vercel lo propone
  quando si aggiunge un dominio, ma non porterebbe con se' la configurazione della posta:
  `info@advaiora.com` smetterebbe di ricevere.

---

## 8. Come sono stati verificati questi fatti

Cosi' chiunque puo' rifare i controlli e accorgersi se qualcosa e' cambiato.

| Cosa | Come | Esito l'8/9/2026 |
|---|---|---|
| Il frontend e' su Vercel | Richiesta a `https://crm.advaiora.com` e lettura dell'intestazione `server` | Risposta 200, `server: Vercel` |
| L'API e' viva e vede il database | Richiesta a `https://api.advaiora.com/health` | `{"status":"ok","db":"up"}` |
| Il frontend e' una pagina singola | Lettura di `vercel.json` nel repository | Solo la riscrittura, nient'altro |

Il resto (cartella sul server, nome del servizio, porta 3001, proxy Traefik) proviene dal
lavoro di messa online del 4/9/2026 e dall'aggiornamento dell'8/9/2026.
