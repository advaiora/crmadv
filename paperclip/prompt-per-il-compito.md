# Il testo da incollare nella descrizione del compito

> Copia tutto quello che sta fra le due righe di trattini, e incollalo nel campo
> **"Add description"** del nuovo compito. Non riassumerlo: è già corto apposta.

---

Ti allego un pacchetto (`azienda-crm.zip`) che contiene l'azienda di agent da costruire.

**Prima di tutto: aprilo e leggi `ISTRUZIONI-PER-AGENT.md`.** Contiene il mandato, l'ordine dei
passi, gli endpoint e i limiti. **Quel file comanda su questa descrizione:** se qualcosa qui
sembra dire il contrario, vale quello.

Il mandato in breve: installa le quattro skill di `skills/`, crea il progetto di `projects/`, poi
crea i dieci agent descritti in `agents/` — il Capocantiere per primo, perché gli altri nove
rispondono a lui. In azienda è già installata la skill `paperclip-create-agent`: usala.

I limiti, che valgono sopra ogni cosa:

1. **Non accendere nessun risveglio automatico.** Tutti gli agent nascono spenti
   (`runtimeConfig.heartbeat.enabled = false`).
2. **Non approvare niente.** Se le assunzioni finiscono in coda di approvazione è l'esito giusto,
   non un errore: le firma il consiglio.
3. **Non toccare codice, repository, git o database.** Questo compito è di sola configurazione, e
   la cartella `/root/crmadv` scritta negli agent non esiste ancora: va bene così, scrivila e vai
   oltre.
4. **Non inventare niente.** Se un dato non c'è nel pacchetto, non dedurlo: elencalo fra le cose
   mancanti. Unica eccezione dichiarata: l'icona di ogni agent, che scegli tu dall'elenco valido
   della nostra installazione.
5. **Non cancellare e non sovrascrivere niente di già esistente.**

Se l'API ti nega il permesso di creare agent, **fermati e scrivilo** invece di cercare strade
alternative. Se invece è solo l'ambiente a mancarti (una variabile vuota, l'API irraggiungibile),
dillo e **prova comunque** con gli strumenti che hai.

Alla fine scrivi un commento **in italiano** con: cosa hai creato, cosa è in attesa di
approvazione, cosa non sei riuscito a fare (con l'errore testuale esatto), e cosa resta da fare a
mano.

---
