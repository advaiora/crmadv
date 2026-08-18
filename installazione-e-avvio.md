# Installazione e avvio della web application

Questa guida spiega i comandi principali per preparare il progetto in locale e avviare la web application.

## 1. Prerequisiti

Installa prima questi strumenti sul computer:

- Node.js 20.19 o superiore
- npm
- PostgreSQL

Per verificare che siano disponibili, apri un terminale nella cartella del progetto e lancia:

```powershell
node -v
npm -v
psql --version
```

Se uno di questi comandi non funziona, installa lo strumento mancante prima di continuare.

## 2. Entra nella cartella del progetto

Da PowerShell:

```powershell
cd "C:\Users\claud\Downloads\Advaiora\Advaiora\APP Advaiora\CRM Advaiora"
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

## 4. Prepara il database PostgreSQL

Crea un database locale per l'applicazione. Esempio:

```powershell
createdb crm_advaiora
```

Se `createdb` non e' disponibile, puoi entrare in PostgreSQL e creare il database da `psql`:

```powershell
psql -U postgres
```

Poi, dentro `psql`:

```sql
CREATE DATABASE crm_advaiora;
\q
```

## 5. Configura il file `.env`

Nella root del progetto deve esistere un file `.env`.

Se non esiste, crealo copiando questo esempio e sostituendo i valori tra parentesi:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/crm_advaiora"
API_HOST=0.0.0.0
API_PORT=4000

AUTH_JWT_SECRET="inserisci-una-stringa-segreta-di-almeno-16-caratteri"
AUTH_JWT_EXPIRES_IN_SECONDS=604800

ENCRYPTION_KEY="inserisci-una-chiave-di-32-caratteri"

VITE_API_URL="http://localhost:4000"
VITE_API_BASE_URL="/api"

GOOGLE_CLIENT_ID=""
VITE_GOOGLE_CLIENT_ID=""

SMTP_HOST="mail.esempio.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="noreply@esempio.com"
SMTP_PASS="(la password della casella)"
EMAIL_FROM="noreply@esempio.com"

APP_BASE_URL="http://localhost:5173"
```

Per generare una `ENCRYPTION_KEY` valida in PowerShell puoi usare:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia il valore generato dentro `ENCRYPTION_KEY`.

Nota: se non usi il login Google in locale, puoi lasciare vuoti `GOOGLE_CLIENT_ID` e `VITE_GOOGLE_CLIENT_ID`. L'API mostrera' un avviso, ma il server puo' comunque partire.

### Il server di posta (`SMTP_*`)

Da qui passano gli **inviti al Team** e le **notifiche dei preventivi** — e ci passera' il **recupero password** quando sara' costruito (non esiste ancora). Leggono tutti la stessa configurazione (`server/core/mail.ts`), quindi si configura una volta sola.

> ⚠️ **Dal 18/8/2026 queste variabili non sono piu' l'unico posto.** Dentro il CRM esiste la pagina **Profilo → Server di posta** (Superadmin e Admin; nel menu laterale sta sotto *Profilo*, accanto a «Gestione Moduli» e «Branding Workspace» — il gruppo «Impostazioni» non esiste ancora, arriva col riordino del menu della release di settembre), che salva gli stessi parametri **per workspace**, con la password cifrata a riposo. **Quella configurazione ha la precedenza**; le variabili qui sotto restano come ripiego per chi non ha ancora compilato la pagina — ed e' quello che serve al primo avvio, quando nel CRM non c'e' ancora niente. Chi mette in pausa la configurazione dalla pagina (interruttore *"Usa questo server per spedire"*) torna a queste variabili senza perdere quello che aveva scritto.

- **Se lasci `SMTP_HOST` vuoto e nessuno ha compilato la pagina, il CRM non spedisce niente**, e lo dice a schermo invece di far finta di aver spedito. In sviluppo ripiega su una casella finta (Ethereal) che restituisce un link per leggere il messaggio: utile per collaudare, non recapita nulla a nessuno.
- `SMTP_SECURE` va **`false`** sulla porta 587 (la cifratura parte dopo la connessione) e `true` sulla 465.
- `SMTP_PASS` e' la password della casella. Sta **solo qui**: `.env` e' escluso dal repository apposta, e non va copiata dentro nessun documento di progetto.
- `APP_BASE_URL` e' l'indirizzo pubblico a cui risponde il CRM: serve a comporre il link di accettazione degli inviti. In sviluppo, se manca, si usa `http://localhost:5173`; **in produzione senza questa variabile gli inviti non sono utilizzabili**.

## 6. Genera il client Prisma

```powershell
npm run db:generate
```

## 7. Applica le migrazioni al database

```powershell
npm run db:migrate
```

## 8. Inserisci i dati iniziali

Se vuoi caricare i dati di seed previsti dal progetto:

```powershell
npm run db:seed
```

### Dati demo per test (opzionale)

Per popolare il CRM con contenuti verosimili — utile per valutare le pagine
"piene" e per i test in generale — dopo il seed base puoi lanciare:

```powershell
npm run db:seed:demo
```

Crea nel workspace Demo: 12 clienti (persone/aziende con tag e contatti),
14 preventivi in tutti gli stati con voci e totali, 2 template preventivo,
6 membri team con ruoli e stati misti (password `demo123`) e 2 inviti.
È **ripetibile senza duplicare**: clienti e membri vengono aggiornati, i
preventivi demo ricreati da zero. Lo script è `prisma/seed-demo.ts`.

## 9. Avvia il backend API

Apri un primo terminale nella cartella del progetto e lancia:

```powershell
npm run dev:api
```

Di default l'API parte su:

```text
http://localhost:4000
```

## 10. Avvia il frontend Vite

Apri un secondo terminale nella cartella del progetto e lancia:

```powershell
npm run dev
```

Vite mostrera' un indirizzo simile a:

```text
http://localhost:5173
```

Apri quell'indirizzo nel browser per usare la web application.

## 11. Comandi utili

Build di produzione:

```powershell
npm run build
```

Anteprima della build:

```powershell
npm run preview
```

Aprire Prisma Studio:

```powershell
npm run db:studio
```

Eseguire i test backend:

```powershell
npm run test:backend
```

## Risoluzione problemi rapida

Se l'API non parte, controlla prima:

- `DATABASE_URL` nel file `.env`
- PostgreSQL avviato
- database `crm_advaiora` esistente
- `AUTH_JWT_SECRET` lungo almeno 16 caratteri
- `ENCRYPTION_KEY` valida da 32 byte

Se il frontend parte ma le chiamate API falliscono, verifica che anche `npm run dev:api` sia in esecuzione e che `API_PORT` sia `4000`.
