# Sviluppo 1.0 — le opzioni sul tavolo, con lo stato reale del codice sotto

> **Scritto il 9 settembre 2026** per la richiesta di Jacopo (compito CRMA-23): *«rileggi i documenti
> relativi ai prossimi step di sviluppo ed esponimi quali opzioni abbiamo come prossimi passi di
> sviluppo vero e proprio del CRM»*.
>
> **Come è stato costruito:** rilette la roadmap (`03-roadmap-confronto-e-build.md`), il piano della
> release (`decisioni-cliente-e-menu-2026-08-07.md`, Parte Seconda), il piano della fase B del
> re-naming, il censimento dei file-mostro, l'ultimo handoff (26/8) — e poi **verificato nel codice**
> quello che i documenti dichiarano, perché su tre punti i documenti erano indietro rispetto al
> repository.
>
> ⚠️ **Verifica di sola lettura del codice, non a schermo.** Dove qui è scritto *«risulta costruito»*
> significa che il codice esiste ed è collegato, non che si comporta bene aprendo le pagine.

---

## 0. La cosa da sapere prima delle opzioni: c'è lavoro finito che non è arrivato su `main`

Questa non è un'opzione, è un fatto che condiziona tutte le opzioni.

Sul remoto ci sono **nove rami di lavoro della release di settembre che non sono uniti a `main`**.
Non sono abbozzi: portano funzionalità complete, con i loro test.

| Ramo | Cosa porta | Migrazione DB |
|---|---|:---:|
| `crm-31-cambio-password-proprio` | Chi è dentro il CRM può cambiare la propria password | — |
| `crm-30-token-reimpostazione-password` | Il database conserva i link di reimpostazione (recupero via email) | ⚠️ **sì** (`20260831170847`) |
| `crm-35-controllo-permessi-catalogo` | Il controllo automatico «ogni permesso usato esiste nel catalogo» (8 commit) | — |
| `crm-48-import-clienti-allegato` | L'import clienti riceve il file come allegato vero e legge gli Excel | — |
| `crm-50-import-clienti-anteprima` | L'anteprima prima di confermare l'import (contiene anche `crm-48`) | — |
| `crm-51-campi-personalizzati-onboarding` | Il campo personalizzato si crea mentre si registra il cliente | — |
| `crm-28-prova-connessione-rete-privata` | La «Prova connessione» della posta non sonda più la rete interna | ⚠️ **sì** (`20260901101956`) |
| `crm-56-interruttore-rete-interna` | L'interruttore che autorizza un server di posta interno | — |
| `crm-27-avviso-prova-configurazione-salvata` | L'avviso che la prova collauda la configurazione **salvata** | — |

🔴 **Il punto urgente: due di questi rami portano una migrazione del database, e sono lì dal 31
agosto e dal 1° settembre.** `CLAUDE.md` lo vieta esplicitamente — *«una migrazione del database non
sta mai su un ramo lungo: due rami con due migrazioni si uniscono e il database non sa più in che
ordine applicarle»*. Sono esattamente due rami con due migrazioni. **Più aspettano, più costano**, e
il costo non cresce piano: cresce nel momento in cui qualcuno ne scrive una terza.

Tradotto: **qualunque opzione si scelga, il passo zero è lo stesso** — mettere in fila e unire questi
nove rami, migrazioni per prime. Non è una scelta, è manutenzione dovuta. È anche la cosa che rende
onesto il resto di questo documento: senza, si rischia di riaprire un lavoro già fatto.

---

## 1. Dove siamo davvero sulla release di settembre

La release di settembre è dichiarata **priorità assoluta su ogni V** finché non è consegnata
(roadmap, riquadro in testa alla Parte C). La data è **metà settembre 2026** — cioè adesso.

L'ordine di lavorazione è di undici punti (§7.5 del piano). Questo è lo stato verificato oggi, dove
«su `main`» significa consegnabile e «su ramo» significa costruito ma non unito:

| # | Punto | Stato al 9/9/2026 |
|:--:|---|---|
| 1 | Server di posta + invito Team | ✅ **su `main`**. Resta la password della casella nel `.env` → la mette **Jacopo o Claudio sulla macchina**, nessun agent può farlo. Le tre rifiniture della posta sono **su ramo** (`crm-27`, `crm-28`, `crm-56`) |
| 2 | Cambio password + recupero via email | 🟡 **su ramo** (`crm-31`, `crm-30`) |
| 3 | Controllo automatico dei permessi, metà 1 | 🟡 **su ramo** (`crm-35`) |
| 4 | Due correzioni rosse dei Messaggi (inondazione del registro, ripiego sulla Chat AI) | ❌ **non iniziato** |
| 5 | Clienti | 🟡 **metà su ramo**: import allegato + anteprima + Excel (`crm-48`, `crm-50`) e campi personalizzati nell'onboarding (`crm-51`). ❌ **Mancano i campi nuovi** — PEC, codice SDI, sito web, referente: verificato, in `schema.prisma` non ci sono |
| 6 | Registro attività (intercettore automatico + login) | ❌ **non iniziato**. La collocazione a menu è però **decisa** dal 24/8 (Impostazioni, prima voce) |
| 7 | Cestino (soft-delete) | ❌ **non iniziato** — verificato: zero `deletedAt` in tutto lo schema. È il **rischio numero uno dichiarato** della release |
| 8 | Rifiniture gialle di Messaggi e Profilo **+ allegati ai messaggi** | ❌ **non iniziato** |
| 9 | Riordino menu (gruppo Impostazioni, Reparti sotto Team, due voci ridondanti) | ❌ **non iniziato** — verificato: in `SidebarMenu.jsx` la voce si chiama ancora «Audit» sotto «Sicurezza», il gruppo «Impostazioni» non esiste |
| 10 | Nascondere i moduli fuori perimetro | ❌ **non iniziato** |
| 11 | Audit di sicurezza pre-lancio | ❌ **non iniziato** (per definizione ultimo, a codice fermo) |

**Il conto, senza addolcirlo:** su undici punti, **uno è consegnato**, **tre e mezzo sono costruiti ma
non uniti**, **sei e mezzo non sono iniziati** — e fra quelli non iniziati ci sono i due più pesanti
della lista (cestino e registro attività) e l'unico che per definizione va fatto per ultimo (audit di
sicurezza).

Con la data di metà settembre già arrivata, **il perimetro pieno non ci sta**. Questa non è una
proposta di tagliare: è il dato con cui la scelta va fatta, ed è di Jacopo — il §7.11 aveva già
affrontato la stessa domanda il 18/8 e aveva deciso di tenere dentro tutto spostando la data.

---

## 2. Le opzioni

Ognuna comincia dal **passo zero** del §0 (unione dei nove rami). Cambia cosa viene dopo.

---

### 🅰️ Opzione A — Chiudere la release di settembre

È la strada che i documenti impongono: finché la release non è consegnata, viene prima di qualunque
V. Si differenzia solo per **cosa sta dentro il perimetro**.

#### A1 — Perimetro pieno, data che si sposta

Tutti gli undici punti, cestino e allegati compresi. È la decisione già presa il 18/8 (§7.11: *«dentro
entrambe, data spostata a metà settembre»*), portata avanti senza cambiarla.

- **Cosa consegna:** il CRM che è stato promesso, per intero.
- **Cosa costa:** i punti 6 e 7 (registro attività e cestino) sono i due lavori grossi, e il 7 tocca
  **tutte le letture** delle entità in perimetro più i collegamenti che oggi cancellano a catena nel
  database. Il piano stesso lo dichiara *«il punto più pesante della lista»*. La data si sposta di
  nuovo, e stavolta di più di una settimana.
- **Quando ha senso:** se la data di metà settembre non è un impegno preso con qualcuno fuori, ma un
  traguardo interno.

#### A2 — Perimetro ridotto: fuori il cestino, dentro tutto il resto ⭐ *(la mia raccomandazione)*

Il cestino esce dalla release e diventa il primo lavoro **dopo** la consegna. Tutto il resto resta.

- **Perché proprio il cestino, e non altro:** è **la voce che i documenti stessi indicano** come
  quella da guardare per prima se il tempo stringe (*«se qualcosa deve slittare, guardare prima
  qui»*), ed è l'unica di cui è scritto che *«un cestino a metà il giorno prima della consegna è
  peggio di nessun cestino»*. È anche l'unica il cui rinvio **non rompe nient'altro**: è un
  meccanismo additivo, il resto del CRM non lo aspetta.
- **Cosa consegna:** password (cambio + recupero), permessi controllati da una macchina, i due difetti
  rossi dei Messaggi, i Clienti completi, il Registro attività che funziona davvero, il menu nella
  forma definitiva, i moduli fuori perimetro nascosti, l'audit di sicurezza fatto.
- **Cosa NON consegna:** nessun ripristino di ciò che si cancella. Va detto al cliente com'è: al
  lancio la cancellazione è definitiva.
- **Perché la preferisco:** è l'unica che consegna qualcosa di **finito** entro settembre invece di
  qualcosa di **quasi**. E il perimetro che resta è coerente: nessuna delle voci che restano dipende
  dal cestino.

#### A3 — Minimo consegnabile: fuori cestino **e** allegati ai messaggi

Come A2, ma escono anche gli allegati ai messaggi (punto 8), che il piano segnala **non essere una
rifinitura** — vogliono conservazione dei file, caricamento, scaricamento permessato, limiti.

- **Cosa consegna:** la data di metà settembre, o vicinissimo.
- **Cosa costa:** sono le due voci per cui la data era stata spostata dal 17 al 18 agosto. Toglierle
  entrambe significa disfare quella decisione, non solo rimandare un pezzo.
- **Quando ha senso:** solo se la data è un impegno esterno rigido.

---

### 🅱️ Opzione B — Riprendere le V, mettendo la release in pausa

⚠️ **Questa opzione va in conflitto con una scelta già scritta**, e per la regola dei conflitti di
`CLAUDE.md` la segnalo invece di procedere: la roadmap dichiara che la commessa di release **batte
qualunque altra pianificazione**. Scegliere qui è legittimo — è una decisione di Jacopo — ma è un
cambio di priorità dichiarato, non un ripiego.

Le due candidate reali, se si va di qui:

- **B1 — Chiusura della V5: l'arricchimento AI si ancora al cliente, non al progetto.** È l'*«atto di
  chiusura»* già deciso il 7/8 e approvato da Claudio. Il problema che risolve è vero e cresce:
  oggi un cliente con tre progetti richiede di caricare e vettorizzare il suo brand book **tre
  volte**. E ogni V successiva (V6 reportistica, V7 creatività, V8 validazione) aggiunge un
  consumatore dell'ancoraggio sbagliato. ⚠️ Qui si spostano **dati**, non stringhe: è la ragione per
  cui è scritto che rimandarlo costa di più che farlo.
- **B2 — Residuo della V4 + Discovery su RAG reale.** Più piccolo, ma il documento dice
  esplicitamente di farlo **dopo** B1, o si costruisce a livello progetto ciò che va poi rifatto a
  livello cliente.

⛔ **Nota su un vincolo che non si aggira:** l'area Produzione AI **al lancio sarà nascosta**. Quindi
tutto il lavoro di B **non arriva al cliente della release di settembre**. È valore vero, ma differito.

---

### 🅲 Opzione C — Fase B del re-naming tecnico (URL, file, cartella `agency-os`, chiavi permessi)

⛔ **La sconsiglio adesso, e non per gusto: è scritto nero su bianco che non si fa.** La roadmap dice
*«B NON precede la release di settembre: rinomina l'area Produzione AI, che al lancio sarà nascosta,
quindi anticiparla non porterebbe nulla alla consegna — e non è breve (`Agency` compare in oltre 60
file, e in B il revisore torna obbligatorio)»*.

La riporto qui solo perché il compito chiedeva di rileggere anche il documento del re-naming: il suo
piano esiste (`piano-fase-B-renaming-tecnico.md`) ed è pronto per quando sarà il momento. Il momento
non è questo.

---

### 🅳 Opzione D — Debito tecnico: spezzare i file-mostro

Il censimento (roadmap, *Debito tecnico*) divide i file fuori norma in tre destini. Quelli
**liberi**, cioè che nessuna V riaprirà:

- `src/views/WebAssets/index.jsx` — **2.706 righe**, il più grosso del frontend. Da solo vale più di
  una sessione.
- `src/views/Authentication/SignUp/Signup/index.jsx` — 920 righe. **L'unico mostro che si può fare
  subito**, dice la roadmap.
- I **14 file** fra 500 e 800 righe, e i **22 file backend** sopra 500.
- I **sei file morti** nella cartella del Calendario, da cancellare.

⚠️ **Attenzione a un caso che è già capitato e che tornerà:** `src/views/Team/index.jsx` è
**cresciuto** invece di essere spezzato (694 → 771 righe il 17/8), ed è ora a 29 righe dalla
soglia-mostro. Chi affronta il Team lo spezzi **prima** di aggiungerci altro.

- **Quando ha senso:** come lavoro di riempimento parallelo, non come strada principale. Il valore è
  reale ma **non arriva al cliente**: nessuna di queste righe cambia cosa il CRM fa.
- **Nota di metodo:** `CLAUDE.md` vieta di spezzarli *di iniziativa mentre si fa altro*. Farlo come
  lavoro dichiarato, in una sessione dedicata, è invece esattamente il modo previsto.

---

## 3. Cosa raccomando, in tre righe

**Passo zero (dovuto, non opzionale): unire i nove rami, migrazioni per prime.** È il debito che
scade prima di tutti gli altri.

**Poi A2** — release di settembre col cestino fuori perimetro. È l'unica strada che consegna qualcosa
di finito invece di qualcosa di quasi, ed è la voce che i documenti stessi indicano come la prima da
sacrificare. Il cestino diventa il primo lavoro dopo la consegna, quando c'è tempo di farlo bene.

**B1 (ancoraggio al cliente) resta la cosa di più valore che il CRM abbia davanti**, ma dopo la
consegna: al lancio l'area AI è nascosta, quindi farla adesso non arriva a nessuno.

---

## 4. Come lavorerebbe la squadra, se si sceglie A2

Il team di agent è al completo e fermo: Esploratore, Sviluppatore backend, Sviluppatore frontend,
Revisore, Guardiano, Collaudatore, Cronista, Capocantiere. Questo è come li metterei al lavoro —
**in parallelo dove i lavori non si toccano, in fila dove si toccano davvero**.

| Onda | Lavoro | Chi | Note |
|---|---|---|---|
| **0** | Unione dei nove rami, migrazioni per prime | Backend + **Revisore** | In fila, non in parallelo: due migrazioni vogliono un ordine deciso da qualcuno |
| **1a** | Campi nuovi cliente (PEC, SDI, sito web, referente) | Backend + Frontend | Porta una migrazione → va **prima** che se ne aprano altre |
| **1b** | Due correzioni rosse dei Messaggi | Frontend | Indipendente. **Deve chiudersi prima dell'onda 2**, o il Registro attività nasce illeggibile |
| **2** | Registro attività: intercettore automatico + login | Backend + **Guardiano** | Il punto più delicato dopo il cestino |
| **3a** | Riordino menu + nascondere i moduli fuori perimetro | Frontend | Due righe in `SidebarMenu.jsx` per il grosso; la collocazione è già decisa |
| **3b** | Rifiniture gialle + allegati ai messaggi | Frontend + Backend | Gli allegati **per primi** dentro questo blocco: non sono una rifinitura |
| **4** | Audit di sicurezza pre-lancio | **Guardiano** | A codice fermo, per definizione ultimo |
| **sempre** | Prova a schermo di ogni onda | **Collaudatore** | La verifica di sola lettura non basta, e questo documento è la prova |
| **sempre** | Aggiornare i documenti nello stesso lavoro | **Cronista** | Regola di igiene del 17/8: chi cambia una cosa aggiorna il documento che la descrive |

**Due cose che nessun agent può fare, e che restano a Jacopo o Claudio:**
1. **La password della casella di posta nel `.env`** — il file è fuori dal repository. Finché non c'è,
   la posta non parte e il recupero password non ha il suo prerequisito.
2. **La prova a schermo con utenti veri** — l'invito Team esiste, ma nessuno l'ha ancora visto
   funzionare end-to-end.

---

## 5. Le domande aperte che questa scelta non chiude

Le lascio scritte perché non si perdano, non perché servano una risposta oggi:

- **I due dettagli della cancellazione messaggi** (§7.11): la traccia «messaggio eliminato» si lascia
  o no, e c'è un limite di tempo per cancellare o no.
- **La «Prova connessione» del server di posta** (§7.7 punto 7): la strada scelta sui rami `crm-28` e
  `crm-56` è la (b) — bloccare gli indirizzi privati con un interruttore che li autorizzi quando
  servono. **Va confermata unendo il ramo**, perché era una domanda aperta con tre risposte possibili.
- **La barra delle schede sul telefono** sotto i 768px: l'unica cosa rimasta della fase A del
  re-naming, ed è una verifica a schermo, non uno sviluppo.
