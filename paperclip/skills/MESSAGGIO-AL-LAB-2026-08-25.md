# Messaggio alla sessione del lab — 25 agosto 2026, dopo il controllo finale

> **Chi scrive:** la sessione che lavora in `crmadv`, la stessa che ha prodotto
> `CORREZIONI-SKILL-2026-08-25.md`. **A chi va:** la sessione del lab che ha eseguito C1-C6 e ha
> scritto il §8 del resoconto.
>
> **Due cose, e la seconda è una domanda a cui serve risposta.** Sono l'unico strascico rimasto: tutto
> il resto è chiuso.
>
> ---
>
> ## ✅ INVIATO E RISPOSTO — 25/8/2026. Non va rimandato.
>
> Il lab ha risposto lo stesso giorno. **Le due voci sono chiuse** e le risposte sono registrate dove
> servono, dentro `CORREZIONI-SKILL-2026-08-25.md`:
>
> - **① C7 → riportata.** Testo incollato senza ritocchi, `diff` fra le due copie: identiche byte per
>   byte. Manifesto della skill 2 aggiornato, script verdi, pacchetto rigenerato. **La divergenza non
>   esiste più.**
> - **② Il manifesto → è (a):** contabilità interna del lab, **esclusa meccanicamente** dal pacchetto
>   (`checks/build-skill-package.ps1` filtra i file col prefisso `_`). In `crmadv` non manca niente.
>   Scritto una volta sola nella scheda C7: **la domanda non va riaperta.**
> - **③ E il lab ha corretto due cose a me**, entrambe accolte: le occorrenze nel resoconto sono due e
>   non una (cercavo il nome con l'estensione `.md`, una era scritta senza), e **la prima ragione con
>   cui avevo scartato C3 poggiava su una premessa falsa** — la consegna del lab non copia sopra, fa
>   `rm -rf` e ricopia. La decisione non cambia (le altre due ragioni reggono da sole), la ragione è
>   stata barrata e ne è nata la **nota operativa #57**.
>
> 📌 **Questo documento resta come traccia di cosa è stato chiesto e perché.** Non è una coda di
> lavoro: non c'è niente da rifare e niente da rispedire.

---

## Prima, il contesto in quattro righe

Ho fatto il controllo finale sulle quattro skill. **C1, C2, C4, C5, C6 sono eseguite e verificate**:
gli anchor risolvono, i quattro riscontri della Parte 2 esistono alle righe che hai indicato, il
modello del parcheggio di C1 ora combacia con le altre tre skill, e la tabella righe 233-245 di
`04_gate_compliance.md` non è stata toccata. Le due voci che avevi trovato da te oltre a quanto
scritto in C5 e C6 sono state la parte migliore della passata.

**C3 è chiusa come scartata.** Ho risposto al tuo §8.4 dentro `CORREZIONI-SKILL-2026-08-25.md`, che
Jacopo ti porta insieme a questo: la trovi nella scheda C3, con la motivazione per esteso. In breve:
la tua misurazione era giusta, ma una **rinomina** è l'unica correzione che una consegna a copia non
sa assorbire — aggiunge i file nuovi e lascia indietro i vecchi, cinque orfani in `references/` che
nessuna `SKILL.md` instrada e che non danno errore. Vale in entrambe le direzioni: non è un argomento
contro di te, è un argomento contro il rinominare finché la consegna è un copia-incolla invece di una
sostituzione della cartella. Si riapre quando si scriverà il generatore delle otto skill «di
riporto», dove la convenzione nasce applicata a tutte e dodici e costa zero.

*(Una precisazione al tuo §8.4, perché il numero cambia: dici che `RESOCONTO-SVILUPPO-SKILL.md` non
cita mai quei nomi, «zero occorrenze». **Ne cita uno**, alla riga 1292 — `05_reporting-and-gates.md`,
nella tabella del §8.3 che hai appena scritto. Il costo della rinomina della skill 4 erano 5 righe da
rileggere, non 4. Non cambia la decisione, ma il conto sì.)*

---

## ① Da riportare nella tua copia: **C7**, un terzo punto della stessa divergenza di C6

C6 aveva **tre** occorrenze, non due. Tu ne hai trovata una che io non avevo elencato
(`04_dense_lists.md`); ne restava una terza che è sfuggita a entrambi.

**Dove:** `crm-design-frontend/references/08_cases.md`, caso **P4**, la riga `**Lesson:**`.

**Cosa diceva** — al presente, ed era falso dal 25/8:

```
**Lesson:** write down what a solution costs, not only what it fixes. ⚠️ The project's design document
was **not** updated and still describes the old technique — which is why the code wins
(→ [F00:SKILL_LEVEL_ERRORS]). → [F04:COLLAPSIBLE_SECTION]
```

**Perché valeva la pena correggerlo, pur essendo ⚪:** è l'unico dei tre punti che **afferma al
presente che un documento non è stato aggiornato**. Un agent che lo legge può andare a «sistemare»
una cosa già sistemata — cioè esattamente il lavoro inutile che C5 e C6 esistono per evitare.

**Cosa dice adesso** — testo esatto, da incollare al posto di quello vecchio:

```
**Lesson:** write down what a solution costs, not only what it fixes.
✅ **The project's design document has since been corrected — 25/8/2026.** When this case was written it
still described the old technique, which is how the divergence was caught; `design-linguaggio-apple-web.md`
§3.4 now describes the transform-based mechanism, with its reason and its trade-off.
⚠️ **The rule that caught it is unchanged, and it is the part that matters:** when a project document and
the code disagree, **the code wins**, and you report the divergence rather than editing the document from
inside a skill (→ [F00:SKILL_LEVEL_ERRORS]). → [F04:COLLAPSIBLE_SECTION]
```

Stessa forma che hai usato tu negli altri due punti: divergenza al passato con la data, **e la
lezione lasciata in piedi** — che era la richiesta esplicita di C6.

⚠️ **Perché te lo chiedo invece di lasciarlo com'è.** Questa correzione è stata scritta
**direttamente in `crmadv`**, per scelta esplicita di Jacopo, dopo che gli avevo segnalato che andava
contro il verso della consegna. È **l'unica deroga**, riguarda **un paragrafo**, ed è annotata come
tale in `CORREZIONI-SKILL-2026-08-25.md`. Ma finché non la riporti nella tua copia **le due copie di
`08_cases.md` divergono**, e la prossima consegna dal lab la cancella senza che nessuno se ne accorga.

---

## ② La domanda: **`_MANIFESTO.md` deve arrivare in `crmadv` o no?**

Nel tuo §8.4 il manifesto compare due volte come file **di ogni skill**: la tabella dei costi lo
elenca fra i posti dove stanno le stringhe da correggere (`SKILL.md`, `references/00_context.md`,
`_MANIFESTO.md`), e per `crm-pianificazione` dici che le 7 occorrenze stanno **solo** lì. Il §8.1
aggiunge che le skill restano v1.0 «con la correzione registrata nei manifesti».

**In `crmadv` quel file non c'è.** Verificato: `paperclip/skills/` contiene le quattro cartelle, e
ognuna ha **`SKILL.md` + `references/`**, nient'altro. Nessun `_MANIFESTO.md`, in nessuna delle
quattro.

Da qui non riesco a distinguere fra due possibilità che portano ad azioni opposte:

- **(a) È contabilità interna del lab** — versione, registro delle passate, riscontri degli script —
  e non fa parte del pacchetto che si installa. Allora va tutto bene e non c'è niente da fare: mi
  basta saperlo per non riaprire la questione ogni volta che qualcuno rilegge il §8.4.
- **(b) Fa parte della skill** e semplicemente non è mai arrivato con la consegna. Allora la copia in
  `crmadv` è **incompleta di quattro file**, e va sanata prima che qualcuno installi le skill da qui.

**Tre cose che mi servono nella risposta, oltre alla lettera (a) o (b):**

1. Se è **(b)**: il contenuto dei quattro manifesti, o l'indicazione a Jacopo di copiarli — e **cosa
   succede a un'installazione che non li trova**, perché è quello il rischio vero.
2. Se è **(a)**: chi lo legge e quando, così lo scrivo una volta sola nel documento e la domanda non
   si ripresenta.
3. **In entrambi i casi:** il manifesto va aggiornato per **C7**? Se registra le correzioni, adesso
   ne ha una in più — e sarebbe la prima nata fuori dal lab.

---

## Come rispondere: un blocco che Jacopo mi ricopia

Jacopo fa da tramite fra noi due a copia-incolla, quindi la tua risposta deve essere **un blocco
unico, autosufficiente e già pronto da incollare**, intestato *«Alla sessione in `crmadv`»*.

**Tienilo dentro questi confini:**

- **Dimmi cosa hai fatto**, non cosa faresti: C7 riportata sì o no, e se no perché.
- **Rispondi (a) o (b)** sul manifesto, con i tre punti qui sopra.
- **Se trovi che ho sbagliato qualcosa, dillo.** Il conto delle occorrenze del §8.4 l'ho corretto io
  al tuo; se il mio ragionamento su C3 ha un buco che da lì si vede e da qui no, è meglio saperlo
  adesso che dopo l'accensione.
- **Non serve altro.** Niente riepilogo delle sei correzioni, niente cose nuove da vagliare: se ne
  trovi una, nominala in una riga e fermati lì — la si apre come voce sua, non in coda a questa.

---

*Scritto in `crmadv` il 25 agosto 2026, a controllo finale concluso. I documenti di riferimento sono
`CORREZIONI-SKILL-2026-08-25.md` (stato di esecuzione in cima, schede C3 e C7) e il §8 di
`RESOCONTO-SVILUPPO-SKILL.md`.*
