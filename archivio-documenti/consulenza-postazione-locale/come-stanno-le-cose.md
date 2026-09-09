<!-- AMBITO-DOCUMENTO: consulenza-postazione-locale -->

> # ⛔ Questo documento non riguarda lo sviluppo del CRM
>
> **Vale solo per** le sessioni dell'assistente sul **PC Windows di Jacopo**, in ruolo di consulenza. **NON vale per** l'assistente che sviluppa dentro **Paperclip, sulla VPS**: se stai scrivendo codice o facendo commit su questo repository, **passa oltre** — non seguire, non applicare, non aggiornare, non citare.
>
> **Criterio meccanico:** Linux + VPS → ignora. Windows + `C:\Users\jacop\` → è per te. Spiegazione completa in `LEGGIMI.md`, in questa cartella.

---

# Come stanno le cose (aggiornato all'8/9/2026)

## Lo sviluppo è in mano a Paperclip

Il CRM lo sviluppa l'azienda di agent dentro **Paperclip**, sulla VPS. Jacopo ha creato l'azienda a partire dal pacchetto `azienda-prova` e da lì il lavoro prosegue: un lavoro, un ramo, unione a `main` per pull request. Su GitHub il repository è **`advaiora/crmadv`**.

Alla postazione locale resta un ruolo **consulenziale**: leggere il codice per rispondere a domande, ragionare sulle scelte, **preparare i testi dei compiti** da incollare in Paperclip, e verificare cosa è tornato indietro. Dalla postazione **non si sviluppa**: niente commit di codice, niente rami, niente unioni. Quando questo cambierà, il documento va riscritto.

I **documenti di metodo** fanno eccezione e li scrive l'assistente locale (poi Jacopo controlla e committa): far passare due paragrafi di documentazione attraverso un compito di Paperclip costa più di quanto renda.

## Sul PC ci sono tre cartelle, e solo una serve

| Cartella (sotto `C:\Users\jacop\OneDrive\Documents\`) | Cos'è |
|---|---|
| **`crmadv-online`** | **Il clone di lavoro.** Punta a `advaiora/crmadv`. È qui che si lavora, sempre |
| `crmadv` | Archivio del vecchio repository `claudiozollo/crmadv`, fermo al 1/9/2026 |
| `crmadv-ramo-postazione-locale` | Copia del solo ramo `crm-21`, scaricata l'8/9 per leggere la guida. Vicolo cieco: si può cancellare quando quel ramo è unito a `main` |

⚠️ Nella cartella-archivio la messa online e tutto ciò che è venuto dopo **non ci sono**: un'informazione letta lì va trattata come datata, mai come corrente.

**Il push da quella cartella è già disattivato** (8/9/2026): il remoto si chiama `archivio-vecchio` e il suo indirizzo di push è stato messo a un valore non valido. ⚠️ Attenzione, è controintuitivo: *rinominare* il remoto da solo **non protegge** — `git remote rename` aggiorna anche il riferimento del ramo e `git push` continua a funzionare. È la disattivazione dell'indirizzo di push a fare il lavoro. Per rimetterlo: `git remote set-url --push archivio-vecchio https://github.com/claudiozollo/crmadv.git`

## L'ambiente locale è installato e funziona (dall'8/9/2026)

Installato e verificato punto per punto: **PostgreSQL 17.11**, database `crm_advaiora`, **pgvector** attiva, **64 migrazioni** applicate, 69 tabelle, seed base più seed demo (12 clienti, 14 preventivi), `.env` compilato con chiavi generate da Jacopo.

- **Accesso:** `superadmin@demo.local` — la password sta in chiaro in `prisma/seed.ts` (cercare `bcrypt.hash(`). I sei membri del team hanno una password diversa, sempre lì.
- **I due server:** `npm run dev:api` (porta 4000) e `npm run dev` (porta 5173), in **due schede separate**, sempre accesi insieme. Si spengono con `Ctrl+C` a fine sessione.
- **PostgreSQL non è nel PATH.** In ogni scheda nuova dove servano `psql` o `createdb`: `$env:Path += ";C:\Program Files\PostgreSQL\17\bin"`

⚠️ **Il file `.env` è prezioso e non va rigenerato alla leggera.** Le credenziali salvate dentro il CRM (chiavi AI, password del server di posta) sono cifrate **con la sua `ENCRYPTION_KEY`**: generarne una nuova le rende illeggibili per sempre e vanno reinserite a mano.

💡 Le chiavi AI stanno nel database (hanno la precedenza) ma possono stare **anche** in `.env` come ripiego. Metterle in tutti e due i posti le fa sopravvivere a un `db:reset`, che azzera il database ma non tocca i file.

## Come si guarda un ramo prima che venga unito

Verificato sul campo l'8/9/2026. **Su 23 rami, solo 2 toccano il database**: gli altri 21 sono solo codice. Non è un caso, è la regola del progetto che vieta migrazioni sui rami lunghi.

Dopo `git checkout <ramo>`, una riga dice cosa fare:

```powershell
git diff --name-only origin/main...HEAD -- prisma/
```

- **Non stampa niente** → ramo di solo codice: i server ricaricano da soli, basta ricaricare la pagina.
- **Elenca dei file** → spegni l'API (`Ctrl+C`), lancia `npm run db:migrate` (rigenera anche il client Prisma), riaccendi l'API.

⚠️ **Mai lanciare `db:migrate` o `db:generate` con l'API accesa:** tiene un blocco sulla libreria di Prisma e il comando si pianta senza spiegare perché.

**Il concetto che evita quasi tutti i reset:** il database deve essere **almeno avanti quanto il ramo, non uguale**. Roba in più — una tabella o una colonna che quel ramo non conosce — non dà fastidio: non viene usata. Rompe il contrario, cioè un ramo che si aspetta qualcosa che nel database non c'è. Quindi si lascia che il database accumuli, e tornare a rami più vecchi continua a funzionare.

## ⚠️ La verifica periodica che Jacopo chiede: «posso avviare senza reset?»

**Jacopo chiederà periodicamente conferma se può avviare il CRM locale così com'è, oppure se serve un `db:reset`**, tipicamente quando deve controllare a schermo uno sviluppo appena arrivato. È una richiesta ricorrente e attesa: va **certificata guardando lo stato vero**, mai risposta a intuito. Questo è il metodo.

1. `git fetch origin` — senza, si ragiona su un elenco di rami vecchio.
2. Farsi dire **quale ramo** vuole guardare, e metterlo a confronto con `origin/main`:
   `git diff --name-only origin/main...origin/<ramo> -- prisma/`
3. Leggere **cosa ha davvero il database locale**: collegarsi con le impostazioni del progetto (uno script `.mjs` temporaneo nella radice del progetto, con `import 'dotenv/config'` e `PrismaClient`, **rimosso subito dopo**) e interrogare `_prisma_migrations`. Così non si vede né si riporta nessuna password.
4. Confrontare le migrazioni che il ramo ha in `prisma/migrations/` con quelle risultate applicate.

**I tre verdetti possibili, e sono solo tre:**

| Situazione | Risposta |
|---|---|
| Il ramo non tocca `prisma/`, oppure tutte le sue migrazioni risultano già applicate | ✅ **Avvia pure, nessun reset** |
| Al ramo mancano una o più migrazioni nel database | ⚠️ **Niente reset: spegni l'API, `npm run db:migrate`, riaccendi** |
| Il database ha migrazioni che il ramo non conosce **e almeno una di quelle è distruttiva** (`DROP`, `RENAME`, cambio di tipo nel `.sql`) | 🔴 **Serve `db:reset`**, e poi `db:seed` più `db:seed:demo` |

Il terzo caso è raro: va confermato **aprendo i `.sql`** delle migrazioni in eccesso, non dedotto dal fatto che ce ne siano. Un database più avanti del ramo, di per sé, non è un problema.

⚠️ Dopo un reset le chiavi AI salvate nel CRM spariscono, a meno che non siano anche in `.env`.
