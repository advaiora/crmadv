# Istruzioni operative — costruire l'azienda da questo pacchetto

> **Chi legge questo file e' l'agent incaricato.** Il consiglio (Jacopo e Claudio) ti ha
> assegnato un compito con questo pacchetto allegato. Qui c'e' cosa fare, in che ordine, e
> soprattutto **dove fermarti**.

## Il mandato, in una frase

**Crea in Paperclip i dieci agent descritti in `agents/`, installa le quattro skill di `skills/`,
crea il progetto di `projects/`, e non accendere niente.**

---

## 🛑 I limiti, che vengono prima del lavoro

Leggili adesso, non dopo:

1. **Non accendere nessun risveglio automatico.** Ogni agent nasce con
   `heartbeatEnabled: false`. Se il campo non fosse impostabile, crealo comunque spento e
   **segnalalo nel compito**.
2. **Non approvare niente.** Se Paperclip mette le assunzioni in una coda di approvazione,
   lasciale li': **le firma il consiglio**, non tu. Elencare cosa e' in attesa e' utile;
   approvarlo no.
3. **Non toccare il codice, il repository, git, il database.** Questo compito e' di sola
   configurazione.
4. **Non inventare mestieri, nomi o istruzioni.** Se un dato non c'e' nel pacchetto, **non
   dedurlo**: scrivilo fra le cose mancanti e vai avanti con il resto.
5. **Non cancellare niente di gia' esistente** — ne' agent, ne' progetti, ne' compiti. Se trovi
   un conflitto (per esempio un agent che occupa gia' la casella di CEO), **fermati su quel
   punto, scrivilo, e prosegui con gli altri.**

---

## Passo 0 — Verifica di poter fare il lavoro

Prima di tutto controlla di avere il diritto di creare agent (`can_create_agents`, o accesso da
membro del consiglio):

```sh
curl -sS "$PAPERCLIP_API_URL/api/agents/me" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

🛑 **Se non ce l'hai, fermati subito.** Scrivi nel compito, in italiano e in chiaro: *"Non ho il
permesso di creare agent"*, e indica cosa servirebbe. **Non cercare strade alternative.**

## Passo 1 — Leggi lo schema vero, non fidarti del mio

Le intestazioni YAML dei file `agents/*/AGENTS.md` usano i nomi di campo che risultavano
corretti quando il pacchetto e' stato scritto. **Possono non combaciare con la tua versione di
Paperclip.**

Chiedi a Paperclip com'e' fatto davvero un agent:

```sh
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration.txt" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

**Quello e' lo schema autorevole. Il mio e' una traduzione.** Se i due divergono, vince il suo:
prendi i **valori** dal pacchetto e mettili nei **campi** che lui dichiara.

## Passo 2 — Installa le quattro skill

In `skills/` ci sono quattro cartelle, ognuna con `SKILL.md` e una cartella `references/`.
**Sono vendorizzate**, cioe' il contenuto e' li' per intero: non vanno scaricate da nessuna
parte.

Installale nella libreria delle skill dell'azienda **prima** di creare gli agent, cosi' quando
crei un agent la sua skill esiste gia' e puo' essergli attaccata.

## Passo 3 — Crea il progetto

Da `projects/sviluppo-crm/PROJECT.md`. Nome: **Sviluppo CRM**.

## Passo 4 — Crea i dieci agent, in quest'ordine

⚠️ **L'ordine non e' arbitrario:** Paperclip impone che il primo agent sia il CEO, e gli altri
nove dichiarano `reportsTo: Capocantiere`, che quindi deve esistere prima.

1. **Capocantiere** (ruolo `CEO`)
2. Esploratore
3. Sviluppatore backend
4. Sviluppatore frontend
5. Revisore
6. Guardiano
7. Collaudatore
8. Cronista
9. Capo del personale (ruolo `manager`)
10. Collaudatore AI

Per ognuno, da `agents/<cartella>/AGENTS.md`:

- **l'intestazione YAML** da' i campi della scheda: nome, titolo, ruolo, a chi risponde,
  adattatore, cartella di lavoro, modello, risveglio, skill desiderate;
- **il testo sotto l'intestazione** e' il suo `AGENTS.md`, cioe' le sue istruzioni permanenti.
  **Va copiato integralmente**, non riassunto.

⚠️ Il campo `accendere_in_fase` **non e' di Paperclip**: e' un'annotazione nostra che dice a che
fase quell'agent andra' acceso. Non provare a mapparlo su un campo dell'API — ignoralo, o
riportalo come nota.

⚠️ Se **esiste gia'** un agent con ruolo CEO: **non cancellarlo e non sovrascriverlo.** Scrivi
nel compito cosa hai trovato e chiedi al consiglio come procedere. Nel frattempo puoi creare gli
altri nove solo se il campo `reportsTo` accetta quel CEO gia' esistente; altrimenti fermati.

## Passo 5 — Riferisci, in italiano

Scrivi un commento sul compito con:

- **cosa hai creato**, elencato;
- **cosa e' in attesa di approvazione**, se qualcosa lo e';
- **cosa non sei riuscito a fare**, e l'errore testuale esatto — non la tua interpretazione;
- **cosa resta da fare a mano al consiglio**: tetti di spesa, chiavi, risvegli.

---

## Come si capisce che il lavoro e' riuscito

Nell'organigramma ci sono **dieci agent**, tutti con il risveglio spento, il Capocantiere in
cima e gli altri nove che rispondono a lui. Le quattro skill sono nella libreria. Il progetto
"Sviluppo CRM" esiste.

**Se una sola di queste cose non e' vera, il lavoro non e' riuscito a meta': e' da riferire.**
