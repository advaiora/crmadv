# CRM — l'azienda di agent, in un pacchetto

> **Per Jacopo e Claudio.** Scritto in italiano perché lo leggete voi. Gli altri file del pacchetto
> li legge Paperclip, o l'agent incaricato di costruire l'azienda.

## In una riga

Questo pacchetto contiene **l'azienda di agent al completo**: dieci mestieri, le loro istruzioni,
le quattro basi di conoscenza e il progetto su cui lavoreranno. **Nasce tutto spento.**

## Cosa c'è dentro

| Cartella o file | Cosa contiene |
|---|---|
| `COMPANY.md` | Chi comanda (voi due), il principio che regge l'azienda, le sei regole non negoziabili |
| `agents/` | **Dieci cartelle, un mestiere ciascuna.** Dentro ognuna, `AGENTS.md`: l'intestazione è la scheda dell'agent, il testo sotto sono le sue istruzioni permanenti |
| `skills/` | Le **quattro basi di conoscenza** già scritte, per intero (vendorizzate: niente da scaricare) |
| `projects/sviluppo-crm/` | Il progetto sotto cui nasceranno i compiti veri |
| `.paperclip.yaml` | La configurazione tecnica |
| `ISTRUZIONI-PER-AGENT.md` | Cosa deve fare l'agent che riceve questo pacchetto, in che ordine, e **dove fermarsi** |
| `README.md` | Questo file |

Il **prompt** da incollare nella descrizione del compito **non sta qui dentro**, e non è una
dimenticanza: serve prima di aprire il pacchetto, non dopo. Sta accanto allo zip, in
`paperclip/prompt-per-il-compito.md`.

La struttura ricalca quella di un pacchetto esportato da Paperclip, verificata su un export vero
del 26/8/2026: **cartella radice col nome dell'azienda** (`crm/`), `README.md` e `COMPANY.md` alla
radice, poi `agents/`, `projects/`, `skills/`. È fatta così di proposito, perché resti utilizzabile
anche dall'importazione automatica.

## I dieci mestieri, e quando si accendono

| Mestiere | Cosa fa | Scrive codice | Si accende alla fase |
|---|---|---|---|
| **Capocantiere** | Decide cosa si fa dopo | no | 3 |
| **Esploratore** | Dice dove si mette mano | no | 2 |
| **Sviluppatore backend** | Server, database, permessi | sì, sul suo ramo | **1 — il primo** |
| **Sviluppatore frontend** | Interfaccia e aspetto | sì, sul suo ramo | 2 |
| **Revisore** | Cerca gli errori tipici del progetto | no | 2 |
| **Guardiano** | Permessi e sicurezza | no | 2 |
| **Collaudatore** | Apre la pagina e la prova | no | 2 |
| **Cronista** | Tiene memoria e documenti | no | 3 |
| **Capo del personale** | Guarda la squadra, non il prodotto | no | 4 |
| **Collaudatore AI** | Misura le generazioni AI | no | **mai, per ora** |

## 🛑 Quattro cose da sapere prima di lanciare

**① Nascono tutti col risveglio automatico SPENTO.** Non è una svista. Un'azienda intera che si
sveglia da sola su una macchina da 4 GB si accorge del problema di memoria nel momento peggiore. Si
accendono **uno alla volta**, seguendo la colonna "fase" della tabella.

**② Il Capocantiere occupa la casella di CEO, ma non comanda.** Paperclip obbliga il primo agent a
essere CEO e non si aggira. Il vertice vero dell'azienda siete **voi due**: nessun agent può
approvare.

**③ Le assunzioni possono fermarsi in attesa di firma, ed è giusto.** La creazione di un agent
passa da una richiesta di assunzione che può richiedere l'approvazione del consiglio. Se
l'organigramma mostra dieci agent in `pending_approval`, **il lavoro è riuscito**: manca solo la
vostra firma. L'agent ha l'ordine esplicito di non approvarsi da solo.

**④ Tre cose non entrano in un pacchetto, mai, e vanno messe a mano dopo:**

- **I segreti** — chiavi API e password. Non passano dal pacchetto, non passano dal repository, non
  passano dalla chat.
- **I tetti di spesa** di ogni agent.
- **Il risveglio automatico**, che va lasciato spento e acceso a fasi.

⚠️ Il **Collaudatore AI** è l'unico che fa chiamate **a pagamento**. Ha bisogno di un fusibile da
10 dollari al giorno sulla sua utenza dedicata, **impostato prima di accenderlo**.

## Una cosa che noterete, e non è un errore

Tutti e dieci gli agent hanno come cartella di lavoro `/root/crmadv`, che **sulla macchina non
esiste ancora**: il repository del CRM si clona più avanti (passo 3 della lista di fase 0). Non è
un problema, perché nascono spenti — ma **non accendete il backend prima di aver clonato**, o
partirebbe in una cartella vuota.

## Se qualcosa non torna

**Fermatevi prima di lanciare il compito, non dopo.** Correggere il pacchetto costa un minuto;
disfare un'azienda costruita storta, molto di più.

## Come si rigenera il pacchetto

Se toccate i sorgenti in `paperclip/crm/`, **rigenerate lo zip**, altrimenti resta indietro e si
finisce per allegare la versione vecchia:

```
python paperclip/costruisci-pacchetto.py
```

Lo script rifà `paperclip/azienda-crm.zip` con la cartella radice giusta (`crm/`) e i fine-riga in
stile Unix. **Non usate `Compress-Archive` a mano**: sbaglia il nome della cartella radice, ed è già
successo.
