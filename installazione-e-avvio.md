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
```

Per generare una `ENCRYPTION_KEY` valida in PowerShell puoi usare:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia il valore generato dentro `ENCRYPTION_KEY`.

Nota: se non usi il login Google in locale, puoi lasciare vuoti `GOOGLE_CLIENT_ID` e `VITE_GOOGLE_CLIENT_ID`. L'API mostrera' un avviso, ma il server puo' comunque partire.

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
