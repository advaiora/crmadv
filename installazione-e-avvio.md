# Installazione e avvio della web application

Questa guida porta il progetto a funzionare **sul tuo PC Windows**, partendo dal
repository gia' clonato e arrivando fino all'accesso al CRM come Superadmin.

I comandi sono scritti per **PowerShell**.

> ⚠️ **Un comando per riga.** In Windows PowerShell 5.1 (quello che si apre di
> default) l'operatore `&&` **non esiste** e da' un errore di sintassi. In questa
> guida non compare mai: se ti capita di trovarlo altrove, spezza il comando in due
> righe separate.

> **Vuoi capire come sta online, invece che in locale?** Sta in un altro documento:
> `archivio-documenti/come-il-crm-sta-online.md`.

---

## 1. Prerequisiti

Installa prima questi strumenti sul computer:

- **Node.js 20.19 o superiore.** Se scegli la serie 22, serve la **22.12 o superiore**
  (le versioni dalla 22.0 alla 22.11 non bastano per lo strumento di build).
- **npm** (arriva insieme a Node.js)
- **PostgreSQL 17**
- **Git**

Per verificare che siano disponibili, apri PowerShell e lancia una riga per volta:

```powershell
node -v
npm -v
git --version
psql --version
```

> ⚠️ **Se `psql --version` non funziona, non vuol dire che PostgreSQL manchi.**
> L'installazione Windows di PostgreSQL **non aggiunge da sola** i suoi programmi al
> PATH. Li trovi in `C:\Program Files\PostgreSQL\17\bin`. Puoi richiamarli col
> percorso completo:
>
> ```powershell
> & "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
> ```
>
> Oppure aggiungere quella cartella al PATH **solo per la sessione corrente**:
>
> ```powershell
> $env:Path += ";C:\Program Files\PostgreSQL\17\bin"
> ```
>
> Il resto della guida da' per scontato che tu abbia fatto una delle due cose.

## 2. Entra nella cartella del progetto

Da PowerShell, con il percorso dove hai clonato il repository:

```powershell
cd "C:\Users\jacop\Documents\crmadv"
```

## 3. Installa le dipendenze Node

Il progetto contiene gia' `package-lock.json`, quindi per una installazione pulita usa:

```powershell
npm ci
```

Se `npm ci` fallisce perche' il lockfile non e' allineato, usa:

```powershell
npm install
```

> Il pacchetto `bcrypt` si compila durante l'installazione e richiede gli strumenti
> C++ di Visual Studio. Se l'installazione si ferma li', li installi al passaggio 5
> (servono comunque anche per pgvector) e poi rilanci `npm ci`.

## 4. Prepara il database PostgreSQL

Crea un database locale per l'applicazione:

```powershell
createdb -U postgres crm_advaiora
```

> ⚠️ L'opzione `-U postgres` non e' facoltativa: senza, `createdb` prova a usare il
> tuo nome utente di Windows, che nel database non esiste, e fallisce con un errore
> di autenticazione che sembra un problema di password.

Se preferisci, puoi creare il database da dentro `psql`:

```powershell
psql -U postgres
```

Poi, dentro `psql`:

```sql
CREATE DATABASE crm_advaiora;
\q
```

## 5. Installa pgvector

> ⚠️ **Questo passaggio non e' facoltativo e non si puo' rimandare.** Il progetto usa
> l'estensione **pgvector** per la vettorizzazione del modulo Fonti. Senza,
> l'applicazione delle migrazioni (passaggio 8) si ferma con l'errore:
>
> ```text
> ERROR: extension "vector" is not available
> ```
>
> pgvector **non e' incluso in PostgreSQL**: va aggiunto a parte.

Nel repository c'e' gia' uno script che fa tutto: scarica pgvector, lo compila,
lo installa e lo abilita sul database. Installa anche gli strumenti C++ di Visual
Studio se mancano.

1. Apri PowerShell **come amministratore** (tasto destro → *Esegui come amministratore*):
   serve per scrivere dentro `Program Files` e per riavviare il servizio PostgreSQL.
2. Consenti l'esecuzione degli script per questa sola sessione:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```

3. Spostati nella cartella del progetto e lancia lo script:

   ```powershell
   cd "C:\Users\jacop\Documents\crmadv"
   ```

   ```powershell
   .\scripts\install-pgvector-win.ps1
   ```

Lo script e' **ripetibile senza danni**: se pgvector risulta gia' installato, esce
subito senza fare niente. La prima volta puo' richiedere diversi minuti e alcuni GB,
perche' scarica gli strumenti di compilazione.

Se il tuo PostgreSQL non e' nel percorso standard, o il database ha un altro nome,
lo script accetta dei parametri:

```powershell
.\scripts\install-pgvector-win.ps1 -PgRoot "C:\Program Files\PostgreSQL\17" -Database "crm_advaiora"
```

## 6. Configura il file `.env`

Nella radice del progetto deve esistere un file `.env`. **Non e' nel repository**
(e' escluso apposta: contiene le tue chiavi), quindi la prima volta te lo crei tu.

Nella radice c'e' `.env.example`, che elenca **tutti** i nomi delle variabili con,
per ognuna, cosa fa e se e' obbligatoria. Contiene solo i nomi, nessun valore.
Parti da quello:

```powershell
Copy-Item .env.example .env
```

Poi apri `.env` con un editor di testo e riempi almeno queste voci — sono le sole
senza le quali l'API **non parte**:

```env
DATABASE_URL="postgresql://postgres:LA-TUA-PASSWORD@localhost:5432/crm_advaiora"
AUTH_JWT_SECRET=
TEAM_INVITE_TOKEN_SECRET=
ENCRYPTION_KEY=
```

E queste, che non sono obbligatorie ma rendono la vita piu' semplice in locale:

```env
API_HOST=0.0.0.0
API_PORT=4000
VITE_API_URL="http://localhost:4000"
APP_BASE_URL="http://localhost:5173"
```

### Le tre chiavi te le generi tu

⚠️ **Non copiare le chiavi di produzione.** Ti servono chiavi tue, diverse. Si
generano con un comando ciascuna, e vanno lanciati **dopo** essere entrato nella
cartella del progetto:

`AUTH_JWT_SECRET` (firma i token di accesso, minimo 16 caratteri):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`TEAM_INVITE_TOKEN_SECRET` (firma l'impronta dei link d'invito al Team, minimo 16
caratteri — stesso comando, valore diverso: sono due chiavi distinte apposta):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`ENCRYPTION_KEY` (cifra le credenziali salvate nel CRM, esattamente 32 byte):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia ogni valore prodotto dentro `.env`, accanto al nome corrispondente, fra
virgolette. Sono valori tuoi: non si condividono, non si incollano nei documenti e
non si committano.

> ⚠️ **Se il tuo database locale contiene gia' segreti cifrati con una chiave che hai
> perso**, una chiave nuova non li recupera: restano illeggibili per sempre. Password
> del server di posta, chiavi AI e credenziali delle integrazioni vanno **reinserite a
> mano** dalle pagine del CRM. Non e' un guasto: e' come funziona la cifratura.
> La spiegazione completa e' in `archivio-documenti/come-il-crm-sta-online.md`.

### Cosa puoi tranquillamente lasciare vuoto

- `GOOGLE_CLIENT_ID` e `VITE_GOOGLE_CLIENT_ID`: senza, l'API segnala un avviso
  all'avvio e parte lo stesso. Con email e password si entra normalmente. ⚠️ Il
  pulsante *Accesso Google* resta visibile e fallisce dopo il clic: e' atteso.
- `ALLOWED_ORIGINS`: in sviluppo, se manca, sono gia' ammessi `http://localhost:5173`
  e `http://127.0.0.1:5173`, che e' esattamente quello che ti serve.
- Le chiavi AI (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`): si inseriscono **dentro** il
  CRM, in *Impostazioni → AI e Ricerca Competitor*. ⚠️ Non metterci un segnaposto tipo
  `REPLACE_ME`: un valore finto ma non vuoto viene creduto valido e fa fallire le
  chiamate con l'errore del fornitore, che e' peggio di lasciarlo vuoto.

### Il server di posta (`SMTP_*`)

Da qui passano gli **inviti al Team** e le **notifiche dei preventivi** — e ci passera'
il **recupero password** quando sara' costruito (non esiste ancora). Leggono tutti la
stessa configurazione (`server/core/mail.ts`) e spediscono tutti dallo **stesso punto
d'uscita** (`server/core/send-mail.ts`), quindi si configura una volta sola.

> **Le sei variabili qui sotto sono tutto quello che serve.** Il giorno in cui arrivano
> le credenziali della casella `noreply`, si riempiono e si riavvia l'API: non c'e'
> nessun codice da scrivere e nessun file da toccare.

> ⚠️ **Dal 18/8/2026 queste variabili non sono piu' l'unico posto.** Dentro il CRM
> esiste la pagina **Profilo → Server di posta** (Superadmin e Admin), che salva gli
> stessi parametri **per workspace**, con la password cifrata a riposo. **Quella
> configurazione ha la precedenza**; le variabili restano come ripiego per chi non ha
> ancora compilato la pagina — ed e' quello che serve al primo avvio, quando nel CRM
> non c'e' ancora niente. Chi mette in pausa la configurazione dalla pagina
> (interruttore *"Usa questo server per spedire"*) torna a queste variabili senza
> perdere quello che aveva scritto.

- **In locale puoi lasciare `SMTP_HOST` vuoto.** In sviluppo il CRM ripiega su una
  casella finta (Ethereal) che restituisce un link per leggere il messaggio: utile per
  collaudare, non recapita nulla a nessuno. **Se Ethereal non risponde** (macchina
  scollegata, proxy) il messaggio viene scritto **nei log dell'API** — destinatario,
  oggetto e corpo per intero — e il lavoro va avanti lo stesso: cerca le righe che
  cominciano con `[Posta]`.
- **In produzione, invece, non si ripiega su niente.** Senza server configurato la
  posta non parte e nei log compare `[Posta] …: nessun server di posta configurato`,
  con chi stava spedendo e verso chi. ⚠️ **In nessuno dei due casi il CRM annuncia
  "email inviata"**: quando l'invito non parte, chi ha invitato si riprende il link
  d'invito nella risposta e fa entrare la persona a mano.
- `SMTP_SECURE` va **`false`** sulla porta 587 (la cifratura parte dopo la connessione)
  e `true` sulla 465.
- `SMTP_PASS` e' la password della casella. Sta **solo** nel `.env`, e non va copiata
  dentro nessun documento di progetto.
- Il mittente si chiama **`EMAIL_FROM`**, non `MAIL_FROM`: e' il nome con cui e' nata
  ed e' quello che il codice legge. Se manca, si ripiega su `no-reply@local`.
- `APP_BASE_URL` e' l'indirizzo a cui risponde il CRM: serve a comporre il link di
  accettazione degli inviti. In sviluppo, se manca, si usa `http://localhost:5173`.

## 7. Genera il client Prisma

```powershell
npm run db:generate
```

## 8. Applica le migrazioni al database

```powershell
npm run db:migrate
```

Applica in ordine tutte le migrazioni presenti in `prisma/migrations/` (a oggi sono
**64**) e rigenera il client Prisma da solo alla fine.

> ⚠️ Se qui compare `ERROR: extension "vector" is not available`, hai saltato il
> passaggio 5. Installa pgvector e rilancia questo comando.

## 9. Inserisci i dati iniziali

```powershell
npm run db:seed
```

> ⚠️ **Questo passaggio serve davvero, non e' facoltativo.** Le migrazioni creano il
> database **vuoto**: senza il seed non esiste nessun utente e non c'e' modo di
> entrare. E' il seed a creare il workspace `demo` e l'utenza **Superadmin**.

A fine esecuzione stampa cosa ha creato:

```text
Workspace: demo
User: superadmin@demo.local
User: admin@test.com
Modules: 17
Permissions: 73
```

Le due utenze e le loro password sono scritte in chiaro dentro `prisma/seed.ts`
(cerca `superadmin@demo.local`): sono credenziali di comodo per lo sviluppo in
locale, e non vanno mai usate su un ambiente raggiungibile da altri.

### Dati demo per test (opzionale)

Per popolare il CRM con contenuti verosimili — utile per valutare le pagine
"piene" e per i test in generale — dopo il seed base puoi lanciare:

```powershell
npm run db:seed:demo
```

Crea nel workspace Demo: 12 clienti (persone/aziende con tag e contatti),
14 preventivi in tutti gli stati con voci e totali, 2 template preventivo,
6 membri team con ruoli e stati misti e 2 inviti.
È **ripetibile senza duplicare**: clienti e membri vengono aggiornati, i
preventivi demo ricreati da zero. Lo script è `prisma/seed-demo.ts`.

## 10. Avvia i due server

> ⚠️ **Si accendono sempre tutti e due**, in due finestre di PowerShell separate. Il
> frontend da solo mostra il CRM **vuoto o in errore**, perche' i dati arrivano
> dall'API.
>
> ⚠️ **Prima controlla che le porte 4000 e 5173 siano libere.** Se sono occupate vuol
> dire che un'altra sessione le sta gia' tenendo: non avviare niente. Per vedere chi
> le occupa:
>
> ```powershell
> Get-NetTCPConnection -LocalPort 4000,5173 -State Listen -ErrorAction SilentlyContinue
> ```

**Prima finestra — il backend API:**

```powershell
npm run dev:api
```

Deve stampare, fra le altre righe:

```text
API listening on http://0.0.0.0:4000
```

**Seconda finestra — il frontend:**

```powershell
npm run dev
```

Vite mostrera':

```text
➜  Local:   http://localhost:5173/
```

## 11. Verifica di essere arrivato in fondo

Tre controlli, in quest'ordine. Se passano tutti, hai finito.

**1. L'API e' viva e vede il database.** In una terza finestra:

```powershell
curl.exe http://localhost:4000/health
```

Deve rispondere:

```text
{"status":"ok","db":"up"}
```

⚠️ Guarda il campo **`db`**, non solo il fatto che abbia risposto: l'API risponde
tranquillamente anche quando il database e' irraggiungibile, e in quel caso dice
`"db":"down"`. Se leggi `down`, il problema e' `DATABASE_URL` o PostgreSQL spento.

**2. Il CRM si apre.** Nel browser:

```text
http://localhost:5173
```

**3. Entri come Superadmin.** Usa l'indirizzo `superadmin@demo.local` con la password
che trovi in `prisma/seed.ts`. Dopo l'accesso devi trovarti nel workspace **Demo** con
il ruolo **Superadmin**.

## 12. Comandi utili

Build di produzione:

```powershell
npm run build
```

Anteprima della build:

```powershell
npm run preview
```

Aprire Prisma Studio (per guardare dentro il database):

```powershell
npm run db:studio
```

Eseguire i test backend:

```powershell
npm run test:backend
```

Eseguire i test frontend:

```powershell
npm run test:frontend
```

## Risoluzione problemi rapida

**`npm run db:migrate` si ferma su `extension "vector" is not available`**
Manca pgvector: torna al passaggio 5.

**L'API non parte.** Il messaggio di errore dice quasi sempre quale variabile manca.
Controlla in quest'ordine:

- `DATABASE_URL` nel file `.env` (deve iniziare con `postgresql://`)
- PostgreSQL avviato
- database `crm_advaiora` esistente
- `AUTH_JWT_SECRET` lungo almeno 16 caratteri
- `TEAM_INVITE_TOKEN_SECRET` lungo almeno 16 caratteri (dall'11/9/2026 e' obbligatorio:
  se il tuo `.env` e' piu' vecchio, questa riga non c'e' e l'API si ferma dicendolo)
- `ENCRYPTION_KEY` da 32 byte esatti (32 caratteri di testo, oppure 32 byte in base64)

**Il frontend parte ma le chiamate API falliscono.** Verifica che anche
`npm run dev:api` sia in esecuzione, che risponda su `http://localhost:4000/health`,
e che `API_PORT` nel `.env` sia `4000`.

**Il frontend parte su una porta diversa da 5173.** Hai una variabile `PORT`
impostata nell'ambiente: `npm run dev` la rispetta. Toglila, oppure ricordati la porta
che ti mostra Vite.

**`createdb` o `psql` "non riconosciuto".** Non sono nel PATH: vedi l'avvertenza al
passaggio 1.

**Una migrazione va in errore su un database gia' popolato.** Non riscrivere le
migrazioni gia' applicate. Su una postazione locale la via piu' rapida e' ripartire
puliti — ⚠️ **cancella tutti i dati locali**:

```powershell
npm run db:reset
```

> ⚠️ **Prima di una migrazione o di `prisma generate`, ferma l'API.** Gira con
> `tsx watch`, che tiene un blocco sulla libreria di Prisma: con l'API accesa le
> migrazioni si piantano. Fermi l'API, migri, riaccendi.
