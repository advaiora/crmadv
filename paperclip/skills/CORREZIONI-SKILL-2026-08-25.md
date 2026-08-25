# Correzioni alle quattro skill — analisi di raccordo del 25 agosto 2026

> **Chi l'ha scritto:** la sessione che lavora in `crmadv`, eseguendo il §4 di
> `RESOCONTO-SVILUPPO-SKILL.md`.
> **A chi va:** Jacopo, che lo riporta nel lab.
>
> **Come si divide il lavoro, e non c'è una terza possibilità:**
> - **Parte 1 — C1…C6: da eseguire nel lab**, in una sessione unica, mai da dentro `crmadv`.
> - **Parte 2 — L1…L3: già eseguiti in `crmadv` il 25/8/2026.** Sono qui **per informazione**, non
>   come compiti: **non vanno rifatti, e il lab non scrive in `crmadv`.** La regola della commessa
>   resta intatta in entrambe le direzioni.
> **Esito in una riga:** 🟢 **le quattro skill reggono.** **Sei correzioni** — nessuna 🔴: C1-C3 trovate
> confrontando le quattro skill fra loro, C4-C6 conseguenti ai tre lavori che nel frattempo sono stati
> eseguiti in `crmadv` (Parte 2, ✅ **tutti chiusi il 25/8/2026**).
>
> ⚠️ **C4-C6 esistono solo perché la Parte 2 è stata fatta.** Sono punti dentro le skill che
> descrivono come *ancora aperte* tre divergenze di `crmadv` che adesso sono chiuse. Se per qualsiasi
> ragione la Parte 2 venisse annullata, **C4-C6 vanno ignorate**.

---

## Parte 1 — Le correzioni da eseguire nel lab

### C1 — Il modello del parcheggio è in inglese in una skill su quattro

- **Skill:** `crm-collaudo-generazioni-ai`
- **File e punto:** `references/05_reporting-and-gates.md`, `## PART 4 — THE PARKING FORMAT
  [F05:PARKING_FORMAT]`, i cinque punti alle righe 105-109.
- **Cosa dice adesso:**
  > 1. **what I was doing**, and how far I had got;
  > 2. **what stopped me**, in one sentence;
  > 3. **the concrete options** — two or three, each with its consequence;
  > 4. **which one I would choose, and why**;
  > 5. **what stays blocked** until it is decided.
- **Cosa dovrebbe dire:** le stesse cinque intestazioni **in italiano**, come nelle altre tre skill —
  «cosa stavo facendo» · «cosa mi ha fermato» · «le opzioni concrete» · «quale sceglierei io e
  perché» · «cosa resta bloccato». La glossa esplicativa può restare in inglese.
- **Perché:** è la convenzione già adottata dalle altre tre e dichiarata dal resoconto stesso
  (riga 468): *«I due modelli da copiare — descrizione di un compito e parcheggio a cinque punti —
  sono scritti in italiano dentro documenti inglesi, perché sono testo da copiare, non
  spiegazioni.»* Riscontri: `crm-pianificazione/references/05_cancelli-e-parcheggio.md:137-152`
  (modello completo in italiano), `crm-permessi-e-sicurezza/references/00_context.md:109-113`,
  `crm-design-frontend/references/07_gates_and_parking.md:184-188`. Fonte della regola:
  `piano-paperclip-2026-08-19.md` §3.3.
- **Gravità:** 🟡 incoerenza fra skill.
- **Se non si corregge:** la stessa skill 4 impone *«everything you produce — findings, task
  comments, parked decisions — is Italian»* (`SKILL.md`, Identity) ma **le dà un modello inglese da
  copiare**. Un agent non presidiato alle tre di notte copia il modello, non l'istruzione: le
  decisioni parcheggiate del collaudatore arrivano al consiglio con le intestazioni in inglese,
  mentre quelle degli altri tre arrivano in italiano. È esattamente la bacheca bilingue che il §4.1
  del resoconto elenca fra le cose da evitare.

---

### C2 — L'esempio di segnalazione del guardiano cita un `file:riga` reale con un'affermazione falsa

- **Skill:** `crm-permessi-e-sicurezza`
- **File e punto:** `references/05_reporting_cases.md`, PART 1, **«Worked example, in the output
  language»**, secondo punto dell'esempio (righe 32-36).
- **Cosa dice adesso:**
  > 2. **`src/layout/Mobile/MobileBottomNav.jsx:31` — la voce Pipeline chiede `projects.view` mentre la
  >    sidebar chiede l'array `['projects.view', 'projects.view_all']`.**
  >    Chi ha solo `projects.view_all` vede la Pipeline da desktop e non da telefono.
- **Cosa dovrebbe dire:** o un **segnaposto** al posto del percorso reale (`percorso/file.jsx:NN`),
  oppure la stessa struttura costruita su una divergenza che esiste davvero. In alternativa, la
  correzione minima: **spostare accanto all'esempio** la dichiarazione che oggi sta in fondo al file.
- **Perché — verificato sul codice oggi:**
  - `src/layout/Mobile/MobileBottomNav.jsx:31` è `label: 'Clienti'`. La voce Pipeline sta alla
    **riga 39**, e il suo `requiredPermission: 'projects.view'` alla **riga 43**.
  - `src/layout/Sidebar/SidebarMenu.jsx:225` porta `requiredPermission: "projects.view"` — **una
    stringa semplice, non un array**. Nessun `projects.view_all` compare in nessuno dei due file.
  - Quindi sono false **sia la riga sia la divergenza**. Il file lo dichiara — *«The two worked
    examples in PART 1 are illustrations built on real code shapes; they are not real findings from a
    real diff»* — ma quella riga sta al **rigo 212**, cioè 180 righe dopo l'esempio, dentro il blocco
    VERIFY-ON-FIELD che un agent apre solo se ci arriva.
- **Gravità:** 🟡 incoerenza fra skill *(non 🔴 solo perché la dichiarazione esiste, per quanto
  lontana)*.
- **Se non si corregge:** il guardiano è addestrato a citare `percorso/file:riga` e a riconoscere
  forme ricorrenti. Un esempio che ha l'aspetto esatto di una segnalazione vera, su un file vero, è
  il modo più diretto per produrre **un falso allarme perfetto** — proprio ciò che
  `[F05:NEGATIVE_CASES]` esiste per impedire, e che la stessa skill dichiara essere il modo in cui un
  guardiano *«stops being believed»*.

---

### C3 — Due convenzioni diverse per i nomi dei file di reference

- **Skill:** tutte e quattro (è una divergenza, non un difetto di una).
- **File e punto:** i nomi dei file dentro `references/`.
- **Cosa dice adesso:**
  - trattino basso + inglese → `crm-permessi-e-sicurezza` (`01_permission_chain.md`) e
    `crm-design-frontend` (`01_design_compass.md`);
  - trattino + inglese → `crm-collaudo-generazioni-ai` (`01_when-to-test.md`);
  - trattino + **italiano** → `crm-pianificazione` (`01_fonti-del-lavoro.md`).
- **Cosa dovrebbe dire:** una convenzione sola. Suggerita: **trattino basso e inglese**, che è quella
  di due skill su quattro e coerente col fatto che i corpi sono in inglese.
- **Perché:** il §4.1 chiede che le convenzioni coincidano. Nessuna fonte impone una delle due, quindi
  **questa è la voce meno solida del documento** e la marco come tale: è una scelta di uniformità, non
  un errore accertato.
- **Gravità:** ⚪ rifinitura.
- **Se non si corregge:** non succede niente di funzionale. Cambiarli però **costa zero adesso e
  qualcosa dopo**, perché ogni rinomina di file trascina i rimandi `[Rnn]`/`[Fnn]` che li citano.
  Se si decide di lasciar perdere, va bene: è l'unica voce di questo documento per cui «no» è una
  risposta ragionevole.

---

### C4 — Il guardiano avverte di una sovrapposizione che non esiste più

- **Skill:** `crm-permessi-e-sicurezza`
- **File e punto:** `references/04_gate_compliance.md`, **due punti**: il paragraph ⚠️ in apertura di
  `## PART 4 — THE BOUNDARY WITH THE REVIEWER [F04:BOUNDARY_WITH_REVIEWER]` (righe 226-231) e il
  **primo elemento del blocco VERIFY-ON-FIELD** in fondo al file.
- **Cosa dice adesso:**
  > ⚠️ **The Reviewer's own brief still overlaps with yours**, because it was written when there was no
  > Guardian: `.claude/agents/revisore.md` lists the permission chain as its error #1 and security as
  > its point #6. […] Until that brief is corrected at its source, expect the overlap to show up in
  > practice.

  e, nel VERIFY:
  > **The division of labour in PART 4 rests on a quoted rule** (plan §1.2), but
  > `.claude/agents/revisore.md` has **not** been aligned to it […] If that happens, raise it with the
  > council — do not resolve it by dropping your own check.
- **Cosa dovrebbe dire:** che l'allineamento **è stato fatto il 25/8/2026**, e che quindi la
  sovrapposizione non è più attesa. La tabella della divisione (righe 233-245) **resta esattamente
  com'è**: è la fonte da cui l'allineamento è stato trascritto, non una copia da aggiornare. Il
  **primo elemento del VERIFY va rimosso**, perché quel controllo è chiuso.
- **Perché:** `.claude/agents/revisore.md` è stato corretto — dettaglio in Parte 2, L1. La catena dei
  permessi e la sicurezza sono state tolte al revisore; le rotte, le migrazioni, le generazioni AI, i
  colori, le convenzioni e i test gli restano, **voce per voce come dice la tabella di questo stesso
  file**. La numerazione degli errori **non è stata toccata** (il #6 è stato svuotato invece che
  rimosso) proprio perché quella tabella li cita per numero: `#2`, `#3`, `#4`, `#5`, `#7` puntano
  ancora dove puntavano.
- **Gravità:** 🟡 incoerenza fra skill.
- **Se non si corregge:** il guardiano è istruito ad **aspettarsi** il doppione e, se lo vede, a
  *«raise it with the council»*. Andrebbe a sollevare al consiglio un problema che non esiste — cioè
  il tipo di falso allarme che, ripetuto, fa smettere di leggerlo.

---

### C5 — Il frontend segnala come superata una nota che è stata corretta

- **Skill:** `crm-design-frontend`
- **File e punto:** `references/02_tokens_and_themes.md`, blocco SOURCE_NOTES, righe 309-311.
- **Cosa dice adesso:**
  > ⚠️ **This contradicts operating note #14**, which lists `Alert variant="light"` among the
  > uncovered cases. The code wins; the note is stale on that point, and the divergence is reported
  > rather than corrected here (→ [F00:SKILL_LEVEL_ERRORS]).
- **Cosa dovrebbe dire:** che la nota **è stata corretta alla fonte il 25/8/2026** e che adesso
  descrive lo strato `--hk-*`. Il fatto tecnico (`.alert-light` è tematizzato) **non cambia di una
  virgola**: cambia solo che le due fonti non si contraddicono più.
- **⚠️ Cosa NON va tolto**, e vale più della correzione stessa: la voce di VERIFY-ON-FIELD *«Operating
  note #14's list of uncovered cases should be treated as a lead, not as a finding»* **resta valida** —
  è stata verificata una voce sola, le altre no. E resta valida l'istruzione generale di
  `[F00:SKILL_LEVEL_ERRORS]`: quando documento e codice divergono, vince il codice.
- **Perché:** `note-operative-ai.md` #14 è stata corretta (Parte 2, L2). Contava farlo alla fonte
  perché da quel file viene **generata** `crm-note-operative`, che il piano §5.5 dà **a tutti gli
  agent**.
- **Gravità:** ⚪ rifinitura.
- **Se non si corregge:** niente di rotto. Solo un agent che diffida di una nota ormai giusta e
  rifà una verifica già fatta.

---

### C6 — La bussola non diverge più dal codice sull'animazione

- **Skill:** `crm-design-frontend`
- **File e punto:** `references/01_design_compass.md`, secondo elemento del blocco VERIFY-ON-FIELD.
- **Cosa dice adesso:**
  > **The compass and the code have already diverged once**, on the animation technique of
  > `CollapsibleSection` (→ [F04:COLLAPSIBLE_SECTION]). Treat every implementation detail in the
  > compass as a claim to check against the code, not as a specification.
- **Cosa dovrebbe dire:** la stessa cosa **al passato e con la data**: la divergenza c'era, è stata
  corretta il 25/8/2026, e `design-linguaggio-apple-web.md` §3.4 adesso descrive l'animazione via
  `transform` con il suo motivo e il suo compromesso.
- **⚠️ La seconda frase non si tocca.** *«Treat every implementation detail in the compass as a claim
  to check against the code, not as a specification»* è la lezione, ed è vera indipendentemente dal
  fatto che questo caso specifico sia stato chiuso. Toglierla sarebbe **la correzione sbagliata**: si
  perderebbe la regola per aver sistemato l'esempio.
- **Perché:** Parte 2, L3.
- **Gravità:** ⚪ rifinitura.
- **Se non si corregge:** niente. È la voce meno importante del documento.

---

## Parte 2 — ✅ ESEGUITA il 25/8/2026 — i lavori in `crmadv`

> Questi **non andavano nel lab**: erano documenti del CRM che contenevano affermazioni superate, e
> due dei tre alimentano skill generate — se fossero rimasti così, l'errore si sarebbe moltiplicato per
> il numero di agent che riceveranno quelle skill.
>
> ✅ **Eseguiti tutti e tre il 25/8/2026, in quest'ordine: L2, L3, L1.** Sono raccontati qui perché
> **C4-C6 esistono solo in conseguenza di questi**, e chi esegue nel lab deve poter verificare che
> siano davvero avvenuti prima di toccare le skill.
>
> 🛑 **Non sono compiti.** Nessuno di questi va rifatto, e **dal lab non si scrive in `crmadv`**.

### Il riassunto in una tabella — cosa è cambiato e come verificarlo in un gesto

I file toccati sono **tre**, e le modifiche sono **quattro**. Le sottosezioni qui sotto spiegano il
perché; questa tabella basta per sapere *cosa* è successo.

| File in `crmadv` | Cosa è cambiato | Verifica in un gesto |
|---|---|---|
| `.claude/agents/revisore.md` | Tolte al revisore **la catena dei permessi** (errore #1, primo punto) e **la sicurezza** (punto #6). Aggiunta una sezione che dichiara la divisione e la domanda che scioglie i casi al confine. ⚠️ **Numerazione invariata:** il #6 è svuotato, non rimosso | cerca `Permessi e sicurezza sono del guardiano` |
| `archivio-documenti/note-operative-ai.md` | **Nota #14:** rimossa la frase falsa su `Alert variant="light"`; aggiunto come funziona davvero (strato `--hk-*` in `style.scss`) e che **i posti dove cercare sono tre, non due** | cerca `Correzione del 25/8/2026` |
| *(stesso file)* | **Nota #56, nuova:** un documento del progetto è una decisione datata, si cita come pista e si agisce dopo aver aperto il codice | cerca `## 56.` |
| `archivio-documenti/design-linguaggio-apple-web.md` | **§3.4:** `transition: height` → animazione via `transform`, con il motivo e il compromesso | cerca `Corretto il 25/8/2026` |

> 📌 **Se una di queste verifiche non torna**, la Parte 2 non è avvenuta come descritto: in quel caso
> **si eseguono solo C1-C3** e si lascia stare C4-C6, che perderebbero il presupposto.

### L1 — ✅ FATTO — `.claude/agents/revisore.md` allineato al piano

Il piano §1.2 assegna la sicurezza al **guardiano** e al revisore *«il resto»*. Il file del revisore
gli attribuiva ancora la catena dei permessi (errore #1) e la sicurezza (punto #6). La correzione è
stata fatta **alla fonte** e non nella skill, perché da quel file verrà **generata**
`metodo-revisione`: correggere la proiezione ricrea la divergenza che la generazione esiste per
impedire.

**Cosa è stato tolto al revisore:** la catena dei permessi (compreso il rimando alla §3 della mappa,
*«i permessi del catalogo che non risultano nelle costanti frontend»*) e la sicurezza per intero.
**Cosa gli resta:** rotte, parametro condiviso (nota #21), migrazioni, generazioni AI, colori,
convenzioni, test.

⭐ **Due scelte di esecuzione che conviene conoscere:**
1. **La divisione non è stata inventata: è stata trascritta** dalla tabella di
   `crm-permessi-e-sicurezza/references/04_gate_compliance.md` `[F04:BOUNDARY_WITH_REVIEWER]`, che la
   elenca voce per voce **compreso il lato del revisore**. Zero interpretazione.
2. **La numerazione degli errori non è stata toccata.** Il #6 è stato **svuotato**, non rimosso, con
   una riga che dice perché. Rinumerare avrebbe rotto la tabella del guardiano, che cita gli errori
   del revisore **per numero** (`#2`, `#3`, `#4`, `#5`, `#7`).

Aggiunta anche la domanda che scioglie i casi al confine: *cambia chi può fare cosa, o se un dato
attraversa un confine?* Sì → guardiano, no → revisore.

### L2 — ✅ FATTO — nota operativa #14 corretta alla fonte

La nota elencava `Alert variant="light"` fra i casi scoperti in tema scuro. **Falso, verificato:**
`src/styles/scss/style.scss:17889-17895` mostra la regola `&.alert-light` con i valori fissi
**commentati** e sostituiti da `var(--hk-text-secondary)` / `var(--hk-bg-secondary)` /
`var(--hk-border-tertiary)`, ognuno marcato `// <-- THEMED`.

⭐ **Nella correzione è stata scritta anche la lezione, che vale più del caso:** i posti dove cercare
un colore sono **tre**, non due — il JSX, `globals.css`, **e lo strato `--hk-*` dentro l'SCSS di
Jampack**, che è quello che si salta sempre perché è un file di terze parti da 18.000 righe. Le altre
voci della nota sono marcate come **piste da riverificare**, visto che una era sbagliata.

### L3 — ✅ FATTO — `design-linguaggio-apple-web.md` §3.4 corretto

Diceva *«altezza misurata in JS e animata con `transition: height`»*. Il codice dichiara l'opposto
nella propria intestazione (`src/components/ui/CollapsibleSection.jsx:6`) e anima `transform:
translateY`. Ora il documento descrive il meccanismo vero **con il motivo** (animare l'altezza
rifarebbe il layout a ogni frame e forzerebbe il re-raster del `backdrop-filter` della barra) **e con
il compromesso** (i vicini saltano alla posizione finale invece di crescere).

### La lezione che ha generato una nota nuova

> **T7, e vale più delle tre voci messe insieme:** un documento o una nota del CRM si cita **come
> pista**, e si agisce solo dopo aver aperto il codice.

Le quattro skill l'avevano già interiorizzata — `crm-design-frontend` segnala la divergenza su #14
invece di fidarsi. Le **fonti** no. È diventata la **nota operativa #56** di
`archivio-documenti/note-operative-ai.md`, con i due casi come prova e tre corollari: quando documento
e codice divergono si corregge **alla fonte**; un elenco «le N cose di tipo X» è un'istantanea mai una
definizione; **«non l'ho trovato» non è «non c'è»** — e il caso `.alert-light` è l'esempio, perché
cercando in due posti su tre la risposta era sbagliata.

---

## Parte 3 — I VERIFY-ON-FIELD consolidati *(§4.4)*

Raccolti dai **26 blocchi** in coda ai file di reference delle quattro skill, più il §7.7 del
resoconto. Deduplicati e ordinati per **quando diventano verificabili**. È la lista da tenere aperta
accanto a chi accende Paperclip.

### A · Alla prima installazione di una skill

| # | Cosa | Chi lo chiede |
|---|---|---|
| A1 | Che **non esista un tetto di caratteri sulla `description`**. Se l'installazione fallisse con un errore di validazione, il claim cade | resoconto §7.7 |
| A2 | **Quali costrutti YAML accetta il parser minimale.** Il frontmatter delle quattro è elementare apposta, ma va guardato | resoconto §7.7 |

### B · Alla configurazione dell'azienda

| # | Cosa | Chi lo chiede |
|---|---|---|
| B1 | **Nomi e forma esatti degli endpoint del battito**, prima di citarli in una skill | resoconto §7.7 · pianificazione `[R03]` |
| B2 | **Le chiavi dell'enum `priority`** oltre `medium` e `high` | resoconto §7.7 · pianificazione `[R03]` |
| B3 | **`goalId` sulla issue**: l'API lo espone e la skill di serie dice di impostarlo sempre; la guida dice che si eredita dal progetto | resoconto §7.7 · pianificazione `[R03]` |
| B4 | **Gli identificativi degli agent** per i `participants` dell'`executionPolicy`: esistono solo a azienda costruita | pianificazione `[R03]` |
| B5 | **`maxReviewRounds` è un blocco duro o un avviso?** Non è detto nella pagina letta; la skill lo tratta come segnale | pianificazione `[R06]` |
| B6 | **Il consiglio approva i rossi da una vista che mostra le differenze per intero?** La regola è nostra, l'affordance è della piattaforma | pianificazione `[R05]` |
| B7 | **Il cronista esiste e gira?** La skill 3 gli instrada le cose trovate per strada. Se l'azienda parte senza, vanno al consiglio e una riga cambia | pianificazione `[R01]` |
| B8 | **Approvare esegue davvero?** Cambia cosa deve dire il punto 5 del parcheggio | collaudo `[F05]` |

### C · Prima del primo compito reale

| # | Cosa | Chi lo chiede |
|---|---|---|
| **C1** | ⭐ **Che le approvazioni non abbiano scadenza, auto-approvazione o escalation.** È la più importante: ci poggia sopra un'intera regola aziendale (il giallo a 12 ore). Confidenza MEDIUM | resoconto §7.7 · pianificazione `[R05]` |
| C2 | **Che l'`executionPolicy` non copra git** — e quindi che gli argini lato repository (`main` protetto, un ramo per lavoro, revisione obbligatoria) **siano stati messi** | resoconto §7.7 · pianificazione `[R05]` |
| ~~C3~~ | ✅ **CHIUSO il 25/8/2026.** «Che `revisore.md` sia stato allineato»: fatto → Parte 2, L1. È il VERIFY che la correzione **C4** rimuove dalla skill del guardiano | permessi `[F04]` |

### D · Al primo collaudo AI *(dopo la release di settembre)*

| # | Cosa | Chi lo chiede |
|---|---|---|
| D1 | **Il tetto di 10 $/giorno e l'utenza CRM dedicata non esistono ancora.** Il passo 2 della procedura li intercetta: eseguirlo, non darli per fatti | collaudo `[F02]` |
| D2 | ⭐ **Dove gira la chiamata di giudizio e chi la paga** — è fuori dal fusibile del CRM. **Risposta qui sotto** | collaudo `[F04]` |
| D3 | **Il costo di `reporting.excelMapping` e della ricerca competitor non è stabilito**: `AGENCY_AI_ESTIMATABLE_FUNCTIONS` ne copre cinque. Non citare i 3-9 ¢ per quei due | collaudo `[F01]`, `[F02]` |
| D4 | **La finestra giornaliera è la mezzanotte locale del server?** Conta se l'agent lavora di notte | collaudo `[F02]` |
| D5 | **Il contratto d'uscita di `npm run tocca-ai`**, quando esisterà | collaudo `[F01]` |
| D6 | **Se l'indicizzazione degli embedding erode il budget delle generazioni** | collaudo `[F02]` |
| D7 | **Il percorso del campo `mode` cambia da generazione a generazione**: leggerlo nella risposta vera | collaudo `[F03]` |

### E · Istantanee che invecchiano — valgono sempre, non hanno un momento

Ogni `file:riga` in queste skill è una fotografia: **si naviga per nome di simbolo**. Invecchiano per
costruzione: l'elenco dei moduli con `ui/constants.js` (otto al 24/8) · il conto dei permessi a
catalogo (76 al 24/8) · la lista `exclude` dell'Admin · i tre suffissi accettati · l'elenco dei file
fuori norma (che vive **solo** in roadmap: mai tenerne una seconda copia) · le altre voci della nota
#14, da trattare come piste · i casi N6/N7/N8 non riverificati · la presenza di
`@testing-library/user-event` · i sei file morti del Calendario · la tabella d'ordine della release,
che **scade con la release stessa**.

---

## Parte 4 — Cosa ho confrontato e ho trovato coerente

> Il §5 chiede di dirlo esplicitamente. Questo è l'esito negativo, ed è un esito.

**Le cinque convenzioni del §4.1**

| Cosa | Esito |
|---|---|
| La tabella dei cancelli 🟢🟡🔴 | ✅ **Nessuna ne inventa una propria.** Tutte rimandano al piano §3.2 e ne declinano i casi del proprio mestiere. Il criterio di separazione è citato identico in tre skill: *«un agent si ferma quando la decisione è vostra, non perché la cosa è importante»* |
| Il parcheggio a cinque punti | ⚠️ Cinque punti, stesso ordine, stessa sostanza in tutte e quattro — **ma la lingua del modello diverge** → C1 |
| La lingua dell'output | ✅ Tutte e quattro impongono l'italiano per ciò che finisce dentro Paperclip, con i corpi in inglese |
| Le condizioni di chiamata dell'esploratore | ✅ **Verbatim.** Le quattro condizioni di `CLAUDE.md` compaiono identiche in `crm-pianificazione/03:197-200`, compresa la clausola *«Se non ricorre nessuna, si salta»*. Il guardiano non ne tiene una copia: cita |
| La citazione delle note per numero | ✅ **Tutti i numeri citati esistono e dicono ciò che le skill affermano.** Verificati #3, #8, #9, #14, #21, #22, #30, #41, #44, #46, #49, #50, #54 contro `note-operative-ai.md` |

**I quattro confini del §4.2** — ✅ tutti combaciano, e la passata intermedia si vede:

- **la condizione d'ingresso del guardiano** ha una sola proprietaria (`crm-pianificazione`
  `[R03:GUARDIAN_ENTRY]`) e il guardiano la **cita** invece di duplicarla, con le due regole
  asimmetriche («non puoi esimerti» / «non puoi allargarla da solo»);
- **le regole ①/①-bis** stanno nel guardiano, con la migrazione di riporto e le due domande esplicite;
  la pianificazione le scrive nel compito come vincolo, senza ridefinirle;
- **chi decide che una modifica tocca l'AI**: lo script, e il ripiego per script assente è **la
  stessa frase in entrambe le skill** — «*Script tocca-ai assente: collaudo eseguito per la clausola
  "in dubbio, si collauda"*» (`crm-pianificazione/03:176` e `crm-collaudo/01:32`);
- **i file fuori norma**: i tre casi di T10 compaiono con le stesse parole nelle tre skill che li
  nominano, e nessuna legittima un'eccezione propria.

**Le contraddizioni cercate attivamente (§4.3)**

1. **Due skill che descrivono lo stesso oggetto del CRM con dettagli diversi** — era «il caso più
   probabile». **Non ne ho trovato nessuno.** Il caso più esposto era la trappola del suffisso, che
   tre skill descrivono indipendentemente: `crm-design-frontend/06`, `crm-permessi-e-sicurezza/05` e
   `crm-pianificazione/07` dicono tutte `.view` · `.manage` · `.view_list`, *Impostazioni Account*,
   Superadmin, `.gestisci` → `mail`. **Verificato sul codice:**
   `src/views/Profiles/Account/index.jsx:32` (`MODULE_LABELS`), `:52` (`CORE_PERMISSIONS`), `:167-169`
   (i tre suffissi), col commento alla `:165` che racconta proprio quell'incidente. Tutte e tre hanno
   ragione, e nello stesso modo.
2. **Due skill che si rimandano a vicenda lasciando la cosa a nessuno** — non trovato.
3. **Una skill che riporta come vero qualcosa che il §2 ha corretto** — non trovato.
4. **Costo cumulato** — **nessun mestiere porta più di una di queste quattro skill** (piano §5.5),
   quindi la somma non si accumula. I corpi caricati a ogni innesco: `crm-permessi-e-sicurezza`
   11,9 KB (188 righe) · `crm-design-frontend` 8,1 KB (121) · `crm-pianificazione` 7,7 KB (133) ·
   `crm-collaudo-generazioni-ai` 4,2 KB (66). Il più pesante è sotto le 3.000 parole, e il corpo si
   carica **solo quando la `description` combacia**. Non c'è un problema di costo.

**Le citazioni di codice** — ✅ **44 percorsi su 44 esistono.** Delle citazioni con numero di riga ne
ho verificate 14 a campione, concentrandomi su `agency.service.ts` perché è il file da 10.000 righe e
quello più citato: **13 su 14 esatte** (`:3215` `useStructuredOutput`, `:2463` `stripJsonCodeFence`,
`:3321` `aiUsageRepository.create`, `:3985` «Target non definito…», `:9640`, `:9758`, `:6454`,
`:7064`, `schema.prisma:828` `AiUsageLog`, `:691` `AiBudget`, `excel-ingestion.service.ts:203`
`ai_structured`, `anthropic-json.ts:70` `isEmptyStructuredPayload`, `auth.route.ts:562`
`ensureWorkspaceSystemRoles`). L'unica sbagliata è quella di C2, che è dentro un esempio.

---

## Parte 5 — La proposta del §6.4 sulla classificazione di `metodo-revisione`

**Proposta:** `metodo-revisione` è classificata `metodo-*` (*«riutilizzabile ovunque»*) ma verrebbe
generata da un file quasi tutto specifico di questo CRM, violando alla nascita la separazione che il
piano §5.4 fa *«da subito»*.

**Verdetto: ✅ approvata nel principio, con una precisazione su quando si esegue.**

Il ragionamento è corretto e i riscontri ci sono. Ma la precisazione conta: **il generatore delle
otto skill di tipo B non esiste ancora** — è fra le cose da costruire. Quindi non c'è niente da
disfare, e la separazione si fa nel momento naturale, cioè **quando si scrive il generatore**,
decidendo lì dove finisce ogni pezzo di `revisore.md`.

**Ne segue una sequenza precisa**, di cui il primo passo è già stato compiuto:

1. ✅ **Fatto il 25/8/2026** — tolto al revisore ciò che il piano assegna al guardiano (permessi e
   sicurezza): è L1. Era il passo urgente, perché produceva rumore doppio a ogni compito.
2. ⏳ **Da fare quando si scrive il generatore** — separare ciò che è metodo (quando si chiama il
   revisore, che non si chiama su codice a metà, come si risponde, che non si inventano rilievi) da
   ciò che è specifico di questo CRM (`rbac-catalog.ts`, `SidebarMenu.jsx`, le note #21/#30/#32,
   `lint:colors`, `agency.service.ts`), che scende in `crm-regole-codice`.

Il secondo passo **non ha fretta**: il generatore delle otto skill di tipo B non esiste ancora, quindi
non c'è nessuna proiezione sbagliata già in circolazione da correggere.

---

## Cosa NON ho fatto, e perché

- **Non ho modificato nessuna skill** — nessuno dei file dentro `paperclip/skills/crm-*`. Il §0.3 lo
  vieta e la ragione è giusta: i controlli meccanici che le tengono in riga vivono nel lab, e una
  correzione fatta qui diverge in silenzio dalla sorgente. **Le uniche modifiche che ho fatto sono i
  tre documenti di `crmadv` della Parte 2**, che le skill non sono e che dal lab non si toccano.
- **Non ho rimisurato M7.** Il §6.7 spiega perché sarebbe sbagliato: rimisurare dopo aver aggiustato
  misura l'adattamento all'eval, non la skill.
- **Non ho verificato ciò che richiede Paperclip acceso.** Tutto quel materiale è nella Parte 3.
- **Non ho toccato `_CONSEGNA-PAPERCLIP.md`**, che vive nel lab: se qualcosa lì va aggiornato in
  conseguenza di questo documento, è una decisione di chi lavora là.

---

*Scritto il 25 agosto 2026 in `crmadv`, contro le quattro skill in `paperclip/skills/` **nella loro
versione uscita dalla passata intermedia del 25/8**, il `RESOCONTO-SVILUPPO-SKILL.md`,
`piano-paperclip-2026-08-19.md`, `CLAUDE.md`, `note-operative-ai.md`,
`design-linguaggio-apple-web.md` e il codice del CRM alla revisione `23c9428`.*

> 📌 **Stato del repository al momento della scrittura:** le modifiche della Parte 2 sono **nei file**
> ma **non ancora committate**. Chi le cercasse in `git log` non le troverebbe: si verificano
> **aprendo i file**, con le quattro ricerche della tabella qui sopra.
