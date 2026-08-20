# Consegna a `ai-skill-lab` — le skill per l'azienda Paperclip del CRM

**Scritto il:** 19 agosto 2026
**Per:** l'assistente che lavora nel progetto `ai-skill-lab`
**Da mettere in:** `ai-skill-lab/`, e da fornire **identico a ogni nuova sessione** che sviluppa una di queste skill.

---

## ⚠️ LEGGI QUESTE DUE COSE PRIMA DI TUTTO IL RESTO

### 1. Chiedi quale skill si sviluppa in questa sessione

Le skill di questo elenco si sviluppano **una per sessione**, in sessioni diverse e in giorni diversi. Questo documento viene fornito uguale a ognuna, quindi **tu non sai a quale stiamo lavorando adesso.**

> **La prima cosa che fai è chiedere a Jacopo quale skill dell'elenco (§6) si sviluppa in questa sessione. Non cominciarne una che non ti sia stata nominata**, nemmeno se lo stato scritto qui sotto sembra suggerirla: quello stato può essere vecchio di giorni.

Quando la skill è finita, **aggiorna la colonna «stato» della tabella §6 in questo documento**, così la sessione successiva sa a che punto è il lavoro senza dover rileggere niente.

### 2. Fai la ricerca su Paperclip prima di scrivere

Questo documento ti dice cosa sapere su Paperclip, ma è stato scritto il 19 agosto 2026 da un'altra sessione, su un prodotto che si muove in fretta. **Prima di scrivere una riga, verifica** su:

- **`https://paperclip.ing/`** — il sito
- **`https://github.com/paperclipai/paperclip`** — il repository

**Cerca tre cose precise, non tutto**, perché una ricerca a tappeto costa tempo e non aggiunge niente a ciò che è già scritto qui:

1. **il formato delle skill** — la struttura della cartella, il file `SKILL.md`, la sua intestazione, dove va il materiale di supporto;
2. **come funziona il campo `description`** — se è ancora la logica di instradamento descritta al §3;
3. **il ciclo del battito** — come e quando un agent si sveglia e lavora, perché è ciò che spiega **per chi** stai scrivendo.

> **Se trovi che qualcosa scritto in questo documento è sbagliato o superato, quello che trovi tu vince.** Segnalalo a Jacopo e annotalo qui, così la sessione dopo non ripete la verifica a vuoto.

---

## 1. A cosa servono queste skill

Il progetto CRM (`C:\Users\jacop\Documents\crmadv`) sta passando da Claude Code a **Paperclip**, una piattaforma su cui più agent con un mestiere preciso lavorano su una bacheca di compiti, svegliandosi da soli a orari stabiliti.

Il team è di **dieci mestieri**: un capocantiere che pianifica, un esploratore che mappa, due sviluppatori (backend e frontend), un revisore, un guardiano dei permessi e della sicurezza, un collaudatore che apre il browser, un cronista che tiene la memoria, un capo del personale che valuta la squadra, e un collaudatore delle generazioni AI che nasce spento.

**Paperclip non genera nessuna conoscenza da solo.** Fornisce solo skill che spiegano come si usa Paperclip. Tutto il resto — cioè tutto ciò che determina se quegli agent lavorano bene o male — **è quello che scriviamo noi qui.**

Il piano completo dell'azienda sta in `crmadv/archivio-documenti/piano-paperclip-2026-08-19.md`. Leggine il capitolo del mestiere a cui la skill è destinata prima di scriverla.

---

## 2. ⭐ La differenza che cambia tutto rispetto alle skill già fatte

Le dodici skill già prodotte in questo lab servono a **una conversazione guidata da una persona**: se l'assistente ha un dubbio, chiede; se sbaglia, qualcuno se ne accorge e corregge subito.

**Queste no. Queste sono per un agent che lavora solo, di notte, senza nessuno a cui chiedere.**

Tre conseguenze concrete sul modo di scriverle:

1. **Niente ripieghi del tipo «chiedi all'utente».** Non c'è nessuno. Ogni istruzione deve portare a un'azione eseguibile o a un modo dichiarato di fermarsi.
2. **Ogni skill deve dire quando fermarsi**, non solo cosa fare. La forma è: *«se ricorre X, non decidere: scrivi le opzioni e aspetta»*. Nell'azienda esistono tre livelli — verde (decide l'agent), giallo (parcheggia con le opzioni già istruite, e dopo 12 ore procede con quella raccomandata), rosso (si ferma e aspetta, sempre). Il capitolo §3 del piano ha la tabella completa: **le skill devono essere coerenti con quella, non inventarne una propria.**
3. **Le asserzioni vaghe fanno più danno del solito.** «Valuta con attenzione» in una conversazione produce una domanda; qui produce una decisione arbitraria presa alle tre di notte che nessuno rivedrà.

---

## 3. Il formato che Paperclip impone

**Una skill è una cartella:**

```
nome-della-skill/
  SKILL.md          ← obbligatorio
  references/       ← documentazione di approfondimento
  scripts/          ← eseguibili (alzano il livello di fiducia richiesto)
  assets/           ← immagini e file
```

**`SKILL.md` comincia con l'intestazione:**

```yaml
---
name: crm-permessi-e-sicurezza
description: Usa quando stai per aggiungere o modificare un permesso, una rotta o un ruolo nel CRM
---
```

### ⭐ Il campo `description` è il pezzo più importante, e il lab oggi non lo tratta come tale

In Paperclip la `description` **è la logica di instradamento: è la prima cosa che l'agent legge**, ed è quella che decide se il corpo della skill viene caricato oppure no.

- ✅ **Si scrive così:** *«Usa quando stai per aggiungere o modificare un permesso, una rotta o un ruolo»*
- ❌ **Non così:** *«Questa skill descrive il sistema dei permessi del CRM»*

**Una descrizione scritta male produce una skill perfetta che non viene mai aperta.** Trattala come il titolo di una nota operativa: deve dire **quando si applica**, non di cosa parla.

### La regola del costo

Il corpo di `SKILL.md` **si carica per intero** quando la skill scatta, e **si paga a ogni risveglio di ogni agent che ce l'ha**. Quindi:

- **`SKILL.md` corto** — quanto serve a operare, non tutto quello che si sa;
- **la profondità va in `references/`**, che si aprono solo quando servono.

Il formato che questo lab già produce — `SKILL.md` più i documenti numerati — fa già la cosa giusta. **Qui cambia solo che è un vincolo, non uno stile:** i documenti numerati vanno dentro `references/`.

---

## 4. Lo standard di qualità resta quello del lab

Nessuno sconto su `STANDARD.md`: rimandi incrociati risolvibili, tracciabilità delle fonti, **asserzioni negative trattate come affermazioni da provare**, casi positivi e negativi a pari peso, ricerca prima della stesura, criterio di completamento, autocontrollo meccanico, misura dell'esito. Set di valutazione compreso.

⚠️ **Anzi, qui serve più del solito**, per la ragione del §2: l'errore di una skill destinata a un agent non presidiato **non viene intercettato da nessuno**. Nel lab il set di valutazione è una buona pratica; qui è l'unico controllo che esiste prima della produzione.

---

## 5. Dove consegnare

```
ai-skill-lab/
  revisioni/<nome-skill>/     ← lavorazione, come sempre
  dist/<nome-skill>.zip       ← pacchetto versionato, come sempre

crmadv/paperclip/skills/<nome-skill>/    ← ⭐ la copia finale va QUI
```

La cartella `crmadv/paperclip/skills/` esiste già. Da lì le skill viaggiano **dentro il repository del CRM** fino alla macchina di Paperclip: nessun trasferimento manuale di file.

⚠️ **Non toccare nient'altro dentro `crmadv`.** Quel repository ha regole proprie e un lavoro in corso: la cartella `paperclip/skills/` è l'unico punto di consegna.

---

## 6. Le skill da costruire

Solo queste quattro si scrivono qui. **Le altre otto sono trascrizioni** di documenti che esistono già nel CRM, e le genera uno script: non riguardano questo lab.

| # | Skill | Per chi | Stato |
|---|---|---|---|
| 1 | `crm-permessi-e-sicurezza` | 🛡️ Guardiano | ⚪ da fare |
| 2 | `crm-design-frontend` | 🎨 Sviluppatore frontend | ⚪ da fare |
| 3 | `crm-pianificazione` | 🧭 Capocantiere | ⚪ da fare |
| 4 | `crm-collaudo-generazioni-ai` | 🧪 Collaudatore AI | ⚪ da fare |

> **Aggiorna questa colonna quando finisci.** Stati: ⚪ da fare · 🟡 in corso · ✅ fatta.

---

### 1 · `crm-permessi-e-sicurezza` — per il guardiano

**Chi la riceve:** l'agent che controlla che permessi e sicurezza siano a posto. **Segnala e basta: non modifica niente, non concede poteri a nessuno.**

**Deve coprire:**
- **La catena dei permessi di questo CRM, per intero e in ordine**: `server/auth/rbac-catalog.ts` (sia l'elenco dei permessi sia i ruoli che li ricevono, che sono punti diversi dello stesso file) → il `policies.ts` del modulo → le costanti del frontend, che sono **copiate a mano** → il menu laterale → la navigazione mobile.
- **La regola ①:** una funzione nuova nasce col suo permesso, nello stesso lavoro. Un permesso dimenticato **non è un difetto estetico: è una funzione che nessun ruolo può governare.**
- **La regola ①-bis:** i cinque ruoli di sistema si rivedono nello stesso lavoro; e se il permesso deve arrivare anche ai **ruoli personalizzati** già esistenti serve una **migrazione dati** di riporto, con inserimenti idempotenti.
- **La trappola della terminazione del permesso**, con il caso vero che l'ha originata: una pagina del CRM riconosce l'accesso a un modulo guardando **come finisce** il nome del permesso. Un permesso con una terminazione fuori convenzione non combacia, e la pagina dichiara «non accessibile» **anche a un Superadmin**, senza dare errore.
- **La sicurezza:** ogni interrogazione filtrata per workspace (in multi-azienda è *il* rischio); gli indirizzi forniti dall'utente che devono passare da `server/core/net-guard.ts`; le chiavi che restano cifrate e fuori dai registri.
- **Come si verifica che i cancelli dell'azienda siano stati rispettati:** nessuna unione al ramo principale senza approvazione, nessuna migrazione senza cancello rosso, nessun agent fuori dal suo ramo.
- **Il formato della segnalazione:** percorso e riga, cosa manca in una frase, **cosa può succedere in concreto** se resta così, e se è un dubbio dirlo. Se non trova niente, **lo dice in una riga e si ferma** — un revisore che trova sempre qualcosa smette di essere creduto.

**Deve NON coprire:** come si scrive il codice; come si corregge ciò che trova (non modifica niente); teoria generale di sicurezza web non applicabile a questo progetto.

**Fonti da leggere nel CRM:** `server/auth/rbac-catalog.ts`, un `policies.ts` di esempio, `CLAUDE.md` (sezione «Come nasce una cosa nuova: il nome e il permesso»), `.claude/agents/revisore.md`, `archivio-documenti/mappa/mappa-progetto.md` §3.

---

### 2 · `crm-design-frontend` — per lo sviluppatore frontend

**Chi la riceve:** l'agent che scrive l'interfaccia. È la skill **più ricca del team**, perché il costo lo paga solo lui.

**Deve coprire:**
- **Il linguaggio Apple a sottrazione, trasformato da principi in ricettario applicabile.** Il documento di partenza è `archivio-documenti/design-linguaggio-apple-web.md`; il salto da fare è **da aggettivi a numeri**: valori esatti, ricette per componente, esempi prima/dopo, non «gerarchia netta» ma quali dimensioni e quali pesi.
- **I token del tema**, con la regola d'oro: mai colori scritti a mano (`#hex`, `rgb`, `rgba`), nemmeno negli stili in linea. Riferimento: `archivio-documenti/design-system-temi.md`.
- **L'unica eccezione, e perché esiste:** dentro `@media print` i colori si scrivono a mano, perché i token seguono chiaro/scuro e stampando da tema scuro darebbero un foglio nero. **Va accompagnata da un commento che dica perché**, altrimenti la revisione successiva la segnala di nuovo come violazione.
- **Le regole di manutenzione del frontend:** soglie di dimensione dei file; il codice nuovo nasce col suo test; quali test lanciare durante il lavoro e quali una volta sola; i warning che non si zittiscono con una direttiva di esclusione.
- ⚠️ **La regola che vale più di tutte, perché un agent zelante la viola per zelo:** i file già fuori norma **hanno un momento già assegnato in cui verranno spezzati, e non si sistemano di iniziativa.** Trovarne uno lavorando ad altro **non** è il momento di spezzarlo.

**Deve NON coprire:**
- ⛔ **Le decisioni di prodotto**: nomi, etichette, cosa vede l'utente. Sono cancello giallo, si parcheggiano.
- ⛔ **Il permesso di cambiare il linguaggio di design.** L'agent può **proporre** un arricchimento; **non può riscriversi la bussola**. Se lo facesse, deriverebbe verso ciò che è comodo per lui, e la deriva nel design non si vede su una schermata sola: si vede quando se ne guardano dieci insieme, cioè troppo tardi.

**Un'avvertenza sul «più ricco»:** il principio di questo prodotto è *a sottrazione*. Una base di conoscenza che cresce senza limite contraddice la cosa stessa che descrive. **Il verso giusto è più concreto, non più voluminoso.**

---

### 3 · `crm-pianificazione` — per il capocantiere

**Chi la riceve:** l'agent che decide cosa si fa dopo. È quello con più potere di far danno, perché **sbaglia in silenzio**: un capocantiere che mette in fila i compiti sbagliati fa lavorare benissimo tutti gli altri nella direzione sbagliata, per giorni.

**Deve coprire:**
- ⭐ **Come si dimensiona un compito.** La regola fondativa, ereditata dal comando `/vado`: *«l'unità di lavoro è il pezzo, non il minuto; il tempo non taglia un pezzo, decide solo se cominciarne un altro»*. **Un compito è ben fatto solo se si chiude in uno stato committabile.** Se non è divisibile così, è un compito solo; se è troppo grosso per un giro, va spezzato **prima** di cominciare.
- **Dove pesca il lavoro, in ordine di precedenza**, e da nessun'altra parte: il piano della release, la roadmap, le voci già scritte come debito tecnico.
- **Cosa non può fare mai:** inventare lavoro; iniziare una V nuova per riempire il tempo; toccare schema o permessi di sua iniziativa; decidere un nome o un'etichetta.
- **La regola delle cose trovate per strada:** non si aprono lì per lì e non si aggiungono al lavoro in corso — si segnalano al cronista perché le collochi in roadmap, e si torna subito all'obiettivo.
- **Come si scrive un compito** perché sopravviva alla sessione che lo esegue: mandato, criterio di completamento, e i riferimenti al piano da cui viene. Sta qui il cardine dell'azienda — **la memoria è il compito, non la sessione**.
- **Quando attaccare la richiesta di mappa all'esploratore:** le condizioni sono verificabili e stanno nel piano §2.2. Se non ricorre nessuna, si salta.
- **Come si scala una decisione:** il formato a cinque punti (cosa stavo facendo, cosa mi ha fermato, le opzioni concrete con le conseguenze, quale sceglierei e perché, cosa resta bloccato). **Mai «cosa vuoi fare?».**

**Deve NON coprire:** come si scrive il codice; il contenuto delle decisioni di prodotto.

---

### 4 · `crm-collaudo-generazioni-ai` — per il collaudatore AI

**Chi la riceve:** l'agent che verifica la qualità di ciò che l'intelligenza artificiale **dentro al CRM** produce per i clienti dell'agenzia — Discovery, contenuti Web e ADV, audit SEO, report. **Nasce spento** e si accende quando riapre la V5.

⚠️ **È l'unico agent del team che fa chiamate vere a pagamento**, perché per collaudare una generazione deve farla partire davvero. La skill deve contenere la disciplina di costo, non solo i criteri di qualità.

**Deve coprire:**
- **I criteri di dominio per giudicare l'uscita.** ⚠️ **Questi li scrivono Jacopo e Claudio**, perché il mestiere è il loro: la skill è il contenitore, non l'autore. Chiedili prima di scrivere il capitolo. Un esempio già noto di ciò che va colto: la Discovery marca «Target non definito» invece di inferirlo, dove la cosa giusta sarebbe un'ipotesi dichiarata come da validare.
- ⭐ **Come si distingue una generazione vera da un ripiego silenzioso.** È il dolore documentato che ha fatto nascere questo mestiere: il risultato va giudicato dal **contenuto**, non dal contrassegno di modalità; un contenuto vuoto è un fallimento anche se il sistema lo registra come riuscito.
- **La verifica dello schema di uscita strutturata:** deve **elencare davvero i campi attesi**, altrimenti torna un oggetto vuoto che il sistema registra come «AI usata» — una bugia silenziosa, peggio del ripiego dichiarato.
- **La disciplina di costo:** modelli economici obbligatori, dati di prova e non reali, tetto di spesa, e cosa fare quando il tetto si avvicina.

**Deve NON coprire:** ⛔ **il giudizio sul prodotto.** Non è un esperto di marketing che dice come dovrebbe essere fatto il CRM: **gli esperti sono Jacopo e Claudio.** Misura l'uscita contro criteri dati, non esprime opinioni sul disegno.

---

## 7. Come si chiamano

Il prefisso conta, perché in Paperclip la libreria delle skill è condivisa da tutta l'azienda e in futuro ci saranno altri progetti oltre al CRM:

- **`crm-…`** → vale solo per questo CRM. **Tutte e quattro quelle di questo elenco.**
- **`metodo-…`** → riutilizzabile su qualunque progetto. Non ce ne sono qui: sono tutte trascrizioni generate.

Se scrivendo ti accorgi che un pezzo di una skill `crm-` vale in realtà per qualsiasi progetto, **segnalalo invece di spostarlo**: è una decisione di Jacopo, non tua.
