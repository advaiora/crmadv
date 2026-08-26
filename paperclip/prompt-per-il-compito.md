# Il testo da incollare nella descrizione del compito

> Copia tutto quello che sta fra le due righe di trattini, e incollalo nel campo
> **"Add description"** del nuovo compito. Non riassumerlo: è già corto apposta.

---

Ti allego il pacchetto che contiene l'azienda di agent da costruire: una cartella con dentro
`COMPANY.md`, `ISTRUZIONI-PER-AGENT.md`, `README.md` e le sottocartelle `agents/`, `skills/` e
`projects/`.

**Prima di tutto leggi `ISTRUZIONI-PER-AGENT.md`.** Contiene il mandato, l'ordine dei passi,
gli endpoint e i limiti. **Quel file comanda su questa descrizione:** se qualcosa qui sembra
dire il contrario, vale quello.

⚠️ **Comincia col dirmi cosa ti è arrivato davvero**: quanti file vedi, e se le sottocartelle
si sono conservate o è arrivato tutto appiattito in un elenco unico. Serve saperlo prima,
perché nel pacchetto ci sono dieci file che si chiamano tutti `AGENTS.md` e quattro che si
chiamano tutti `SKILL.md`: se i percorsi si sono persi, li distingui dal campo `name` scritto
nella loro intestazione, non dal nome del file. E se manca `.paperclip.yaml` — comincia con un
punto, e certi caricamenti saltano questi file — **non fermarti**: dillo e prosegui, quel file
non serve per creare gli agent.

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
