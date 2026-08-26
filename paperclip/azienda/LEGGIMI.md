# Cosa c'e' in questo pacchetto, e cosa succede quando lo usi

> **Per Jacopo e Claudio.** Scritto in italiano perche' lo leggete voi. Gli altri file del
> pacchetto li legge Paperclip.

## In una riga

Questo pacchetto contiene **l'azienda di agent al completo**: dieci mestieri, le loro istruzioni,
le quattro basi di conoscenza e il progetto su cui lavoreranno. **Nasce tutto spento.**

## Cosa c'e' dentro

| Cartella o file | Cosa contiene |
|---|---|
| `COMPANY.md` | Chi comanda (voi due), il principio che regge l'azienda, le sei regole non negoziabili |
| `agents/` | **Dieci cartelle, un mestiere ciascuna.** Dentro ognuna, `AGENTS.md`: la scheda dell'agent e le sue istruzioni |
| `skills/` | Le **quattro basi di conoscenza** gia' scritte, per intero |
| `projects/sviluppo-crm/` | Il progetto sotto cui nasceranno i compiti veri |
| `.paperclip.yaml` | La configurazione tecnica |
| `ISTRUZIONI-PER-AGENT.md` | Cosa deve fare l'agent che riceve questo pacchetto, in che ordine, e **dove fermarsi** |
| `PROMPT-DA-INCOLLARE.md` | Il testo da incollare nella descrizione del compito |

## I dieci mestieri, e quando si accendono

| Mestiere | Cosa fa | Scrive codice | Si accende alla fase |
|---|---|---|---|
| **Capocantiere** | Decide cosa si fa dopo | no | 3 |
| **Esploratore** | Dice dove si mette mano | no | 2 |
| **Sviluppatore backend** | Server, database, permessi | si', sul suo ramo | **1 — il primo** |
| **Sviluppatore frontend** | Interfaccia e aspetto | si', sul suo ramo | 2 |
| **Revisore** | Cerca gli errori tipici del progetto | no | 2 |
| **Guardiano** | Permessi e sicurezza | no | 2 |
| **Collaudatore** | Apre la pagina e la prova | no | 2 |
| **Cronista** | Tiene memoria e documenti | no | 3 |
| **Capo del personale** | Guarda la squadra, non il prodotto | no | 4 |
| **Collaudatore AI** | Misura le generazioni AI | no | **mai, per ora** |

## 🛑 Tre cose da sapere prima di lanciare

**① Nascono tutti col risveglio automatico SPENTO.** Non e' una svista. Un'azienda intera che si
sveglia da sola su una macchina da 4 GB si accorge del problema di memoria nel momento peggiore.
Si accendono **uno alla volta**, seguendo la colonna "fase" della tabella.

**② Il Capocantiere occupa la casella di CEO, ma non comanda.** Paperclip obbliga il primo agent
a essere CEO e non si aggira. Il vertice vero dell'azienda siete **voi due**: nessun agent puo'
approvare.

**③ Tre cose non entrano in un pacchetto, mai, e vanno messe a mano dopo:**

- **I segreti** — chiavi API e password. Non passano dal pacchetto, non passano dal repository,
  non passano dalla chat.
- **I tetti di spesa** di ogni agent.
- **Il risveglio automatico**, che va lasciato spento e acceso a fasi.

⚠️ Il **Collaudatore AI** e' l'unico che fa chiamate **a pagamento**. Ha bisogno di un fusibile
da 10 dollari al giorno sulla sua utenza dedicata, **impostato prima di accenderlo**.

## Se qualcosa non torna

**Fermati prima di lanciare il compito, non dopo.** Correggere il pacchetto costa un minuto;
disfare un'azienda costruita storta, molto di piu'.
