# Istruzioni operative — costruire l'azienda da questo pacchetto

> **Chi legge questo file è l'agent incaricato.** Il consiglio (Jacopo e Claudio) ti ha assegnato
> un compito con questo pacchetto allegato. Qui c'è cosa fare, in che ordine, e soprattutto
> **dove fermarti**.

## Il mandato, in una frase

**Crea in Paperclip i dieci agent descritti in `agents/`, installa le quattro skill di `skills/`,
crea il progetto di `projects/`, e non accendere niente.**

In azienda è già installata la skill **`paperclip-create-agent`**: è fatta esattamente per questo
lavoro. **Usala.** Se quello che c'è scritto lì contraddice questo file sui *dettagli tecnici*
(nomi dei campi, endpoint, forma delle richieste), **vince lei**: è aggiornata alla tua versione,
io no. Sui *limiti* qui sotto, invece, non vince niente e nessuno.

---

## 🛑 I limiti, che vengono prima del lavoro

Leggili adesso, non dopo:

1. **Non accendere nessun risveglio automatico.** Ogni agent nasce con
   `runtimeConfig.heartbeat.enabled = false`. Se il campo non fosse impostabile, crealo comunque
   spento e **segnalalo nel compito**.
2. **Non approvare niente.** La creazione di un agent passa da una richiesta di assunzione, che
   può finire in **approvazione del consiglio**: se la risposta contiene un campo `approval` o
   l'agent resta in stato `pending_approval`, **è l'esito giusto, non un errore**. Lascialo lì:
   **firma il consiglio**, non tu. Elencare cosa è in attesa è utile; approvarlo no.
3. **Non toccare il codice, il repository, git, il database.** Questo compito è di sola
   configurazione. In particolare **non fare `git clone` di niente**: la cartella di lavoro
   `/root/crmadv` che troverai scritta negli agent **non esiste ancora**, ed è giusto così — la
   prepara il consiglio più avanti. Scrivila come sta scritta e vai oltre.
4. **Non inventare mestieri, nomi o istruzioni.** Se un dato non c'è nel pacchetto, **non
   dedurlo**: scrivilo fra le cose mancanti e vai avanti con il resto.
   ⚠️ **Unica eccezione, ed è dichiarata: l'icona di ogni agent** (campo `icon`). Non è nel
   pacchetto perché l'elenco delle icone valide dipende dalla tua installazione. Leggi l'elenco
   ammesso e **scegline una coerente col mestiere**: qui scegliere è il lavoro, non un'invenzione.
5. **Non cancellare e non sovrascrivere niente di già esistente** — né agent, né progetti, né
   compiti, né skill. Se trovi un conflitto (per esempio un agent che occupa già la casella di
   CEO), **fermati su quel punto, scrivilo, e prosegui con gli altri.**

---

## Passo 0 — Verifica di poter lavorare, e distingui i due modi di non poterlo

Controlla di avere il diritto di creare agent:

```sh
curl -sS "$PAPERCLIP_API_URL/api/agents/me" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

⚠️ **Se il comando fallisce, prima di concludere qualsiasi cosa guarda *perché*.** Sono due
situazioni diverse che si somigliano, e confonderle manda il consiglio a cercare il problema dalla
parte sbagliata:

| Cosa vedi | Cosa significa | Cosa fai |
|---|---|---|
| `$PAPERCLIP_API_URL` o `$PAPERCLIP_API_KEY` sono **vuote**, oppure errori tipo *could not resolve host*, *connection refused*, *empty URL* | **Non è un problema di permessi.** È l'ambiente: non hai le variabili per parlare con l'API | Scrivi *«non riesco a raggiungere l'API: la variabile X è vuota»* e **prova comunque a fare il lavoro** con gli strumenti che hai, a partire dalla skill `paperclip-create-agent` |
| L'API risponde, ma con `401`, `403` o un messaggio di permesso negato | **Questo sì** è un problema di permessi | 🛑 Scrivi *«non ho il permesso di creare agent»*, indica cosa servirebbe, e **fermati** |

**Non cercare strade alternative** per aggirare un permesso negato. Cercarle per una variabile
d'ambiente vuota, invece, è esattamente quello che devi fare.

## Passo 1 — Leggi lo schema vero, non fidarti del mio

Le intestazioni YAML dei file `agents/*/AGENTS.md` usano i nomi di campo che risultavano corretti
quando il pacchetto è stato scritto. **Possono non combaciare con la tua versione di Paperclip.**

Chiedi a Paperclip com'è fatto davvero un agent:

```sh
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration.txt" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration/claude_local.txt" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
curl -sS "$PAPERCLIP_API_URL/llms/agent-icons.txt" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

**Quelli sono lo schema autorevole. Il mio è una traduzione.** Se i due divergono, vince il suo:
prendi i **valori** dal pacchetto e mettili nei **campi** che lui dichiara.

## Passo 2 — Installa le quattro skill

In `skills/` ci sono quattro cartelle, ognuna con `SKILL.md` e una cartella `references/`.
**Sono vendorizzate**, cioè il contenuto è lì per intero: non vanno scaricate da nessuna parte, e
non hanno una sorgente GitHub a cui puntare.

Installale nella libreria delle skill dell'azienda **prima** di creare gli agent, così quando crei
un agent la sua skill esiste già e può essergli attaccata.

📌 **Appuntati la chiave (`key`) con cui ogni skill risulta installata.** Serve al passo 4: il
campo `desiredSkills` degli agent vuole quelle chiavi, non i nomi che ho scritto io.

## Passo 3 — Crea il progetto

Da `projects/sviluppo-crm/PROJECT.md`. Nome: **Sviluppo CRM**.

## Passo 4 — Crea i dieci agent, in quest'ordine

⚠️ **L'ordine non è arbitrario:** Paperclip impone che il primo agent sia il CEO, e gli altri nove
dichiarano `reportsTo: Capocantiere`, che quindi deve esistere prima.

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

### Come si traduce un file del pacchetto in una richiesta di assunzione

L'endpoint, salvo quanto hai letto al passo 1:

```
POST $PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-hires
```

Ogni file `agents/<cartella>/AGENTS.md` è fatto di due parti, e vanno **in due posti diversi**:

| Da dove | Dove va |
|---|---|
| `name`, `title`, `role` dell'intestazione | campi omonimi della richiesta |
| `capabilities` dell'intestazione | campo `capabilities` |
| `adapterType`, `adapterConfig` (`model`, `cwd`) | campi omonimi |
| `runtimeConfig.heartbeat` (`enabled`, `wakeOnDemand`, `intervalSec`) | campo omonimo |
| `desiredSkills` | campo omonimo, **con le chiavi vere del passo 2** |
| **tutto il testo sotto l'intestazione** | `instructionsBundle.files["AGENTS.md"]` |
| *(non c'è nel pacchetto)* | `icon` — la scegli tu dall'elenco del passo 1 |

🛑 **Il testo sotto l'intestazione va copiato integralmente, non riassunto.** Sono le istruzioni
permanenti dell'agent: è la parte che conta di più di tutto il pacchetto.

### Le tre trappole di questo passo

**① `reportsTo` vuole un identificativo, non un nome.** Nel pacchetto ho scritto
`reportsTo: Capocantiere` perché per un umano è leggibile, ma l'API vuole l'**ID** dell'agent.
Quindi: crea per primo il Capocantiere, **tieni da parte l'ID che ti torna indietro**, e usa quello
per gli altri nove. Il Capocantiere ha `reportsTo: null` — non risponde a nessun agent, risponde al
consiglio.

**② Se una skill del passo 2 non si è installata**, crea lo stesso l'agent che la voleva, con
`desiredSkills` vuoto, e **scrivi nel rapporto quale agent è rimasto senza quale skill.** Un agent
senza la sua skill è recuperabile in dieci secondi; un agent mai creato no.

**③ `accendere_in_fase` non è un campo di Paperclip.** È un'annotazione nostra che dice a che fase
quell'agent andrà acceso dal consiglio. Non provare a mapparlo su un campo dell'API — ignoralo, o
riportalo come nota.

### Se la casella di CEO è già occupata

**Non cancellare e non sovrascrivere.** Scrivi nel compito cosa hai trovato e chiedi al consiglio
come procedere. Nel frattempo puoi creare gli altri nove **solo se** `reportsTo` accetta quel CEO
già esistente; altrimenti fermati e dillo.

## Passo 5 — Riferisci, in italiano

Scrivi un commento sul compito con:

- **cosa hai creato**, elencato;
- **cosa è in attesa di approvazione** — che, ricordo, è l'esito giusto, non un guasto;
- **cosa non sei riuscito a fare**, e l'errore testuale esatto — non la tua interpretazione;
- **cosa resta da fare a mano al consiglio**: tetti di spesa, chiavi, risvegli, e la cartella
  `/root/crmadv`.

---

## Come si capisce che il lavoro è riuscito

Nell'organigramma ci sono **dieci agent** (o dieci assunzioni in attesa di firma), tutti con il
risveglio spento, il Capocantiere in cima e gli altri nove che rispondono a lui. Le quattro skill
sono nella libreria. Il progetto "Sviluppo CRM" esiste.

**Se una sola di queste cose non è vera, il lavoro non è riuscito a metà: è da riferire.**
