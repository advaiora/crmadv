# Resoconto di sviluppo — le quattro skill Paperclip del CRM

> **Stato del documento:** 🟢 **completo, in attesa che Jacopo dichiari la consegna.** I quattro
> contributi sono arrivati e sopra di essi è passata una **passata intermedia di correzione**
> (25/8/2026, §6), eseguita nel lab con le quattro skill sotto gli occhi. Regola di scrittura in
> **Appendice A**.
>
> **Contributi ricevuti:** ✅ skill 3 `crm-pianificazione` · ✅ skill 2 `crm-design-frontend` ·
> ✅ skill 4 `crm-collaudo-generazioni-ai` · ✅ skill 1 `crm-permessi-e-sicurezza`
> · ✅ **passata intermedia** (§6) · ✅ **correzioni di raccordo C1-C6** (§8)
>
> 📌 **Per la sessione in `crmadv`: c'è una cosa che aspetta te, ed è il §8.4.** Le correzioni C1-C6
> del tuo documento sono eseguite, tranne **C3**, dove misurando il costo è saltato fuori che gli
> anchor `[Rnn]`/`[Fnn]` **non si trascinano** in una rinomina — sono codici, non percorsi. Cambia la
> valutazione, e c'è una proposta da vagliare.
>
> ⚠️ **Leggi il §6 prima delle schede del §3.** Le schede sono state scritte prima della passata e
> alcune loro righe — in particolare i campi «cosa questa skill si aspetta dalle altre tre» — sono
> **domande a cui il §6 ha già risposto**. Il §6 dice quali.
>
> ⭐ **Se devi configurare l'azienda su Paperclip, il capitolo che ti serve è il §7.** Raccoglie come
> funziona **tecnicamente** la piattaforma — modello degli oggetti, bloccanti, execution policy,
> risveglio, formato e instradamento delle skill — e **le cinque premesse del piano tecnico che la
> ricerca ha rovesciato**, con campi, enum, endpoint e grado di confidenza. Il §2 dice *che cosa*
> cambia in una riga; il §7 dice *perché*, e cosa non dare per fatto.
>
> **Destinazione finale:** `crmadv/paperclip/skills/`, accanto alle quattro cartelle delle skill.
> ⚠️ Alla consegna il file si chiamerà `RESOCONTO-SVILUPPO-SKILL.md` (niente trattino basso, e
> **soprattutto** non `SKILL.md`: deve essere impossibile scambiarlo per una skill).

---

## 0. Cos'è questo documento

### 0.1 A chi parla

**A te, assistente che lavora dentro `crmadv`.** Le quattro skill che trovi in
`paperclip/skills/` sono state costruite altrove — nel progetto `ai-skill-lab`, in quattro sessioni
separate che non si vedevano fra loro — e sono arrivate qui come cartelle già finite. Questo
documento è ciò che quelle sessioni sapevano e che le cartelle da sole non dicono.

Serve a tre cose, in ordine di importanza:

1. **Dirti dove il terreno si è mosso.** Il documento di commessa (`_CONSEGNA-PAPERCLIP.md`, che vive
   nel lab) descriveva Paperclip e il CRM in un certo modo. Sviluppando, diverse di quelle
   descrizioni si sono rivelate **false o incomplete**, verificate contro la documentazione ufficiale
   e contro il codice. Il §2 le raccoglie: sono la parte che ti cambia il lavoro.
2. **Darti il raccordo fra le quattro skill.** Nessuna sessione ha visto le altre — è stata una regola
   esplicita, per non farle convergere per imitazione invece che per merito. Il prezzo è che
   **nessuno ha ancora guardato le quattro insieme.** Quel controllo tocca a te (§4).
3. **Farti produrre, se serve, la lista delle correzioni finali** (§5), che Jacopo riporterà nel lab e
   che verranno eseguite lì in una sola sessione.

### 0.2 Cosa questo documento NON è

- **Non è una skill.** Non ha frontmatter, non si installa, non si carica in Paperclip. Sta in quella
  cartella perché è lì che vivono le skill di cui parla.
- **Non sostituisce il piano.** La fonte di verità sull'azienda di agent resta
  `archivio-documenti/piano-paperclip-2026-08-19.md` più le decisioni del §12. Qui trovi solo ciò che
  è emerso *costruendo*.
- **Non è un giudizio sulle skill.** Dove una scelta è discutibile, il documento la dichiara e ti dà
  gli elementi; non la difende.

### 0.3 Cosa ti chiediamo di fare

Nell'ordine:

1. **Leggi il §2** (le correzioni trasversali). Se qualcosa lì contraddice ciò che tu vedi nel codice
   o nei documenti del CRM **oggi**, vince quello che vedi tu: annotalo, è un contributo.
2. **Leggi le quattro schede del §3** e poi le quattro skill vere in `paperclip/skills/`.
3. **Esegui l'analisi di coerenza del §4.** È il motivo per cui questo documento esiste.
4. **Se ne esce qualcosa, scrivi il documento del §5** e consegnalo a Jacopo. Se non ne esce niente,
   dillo — un «ho controllato e regge» è un esito, non un non-risultato.

⚠️ **Cosa NON fare:** non modificare le skill da dentro `crmadv`. Vivono qui ma **nascono nel lab**,
dove esistono i controlli meccanici che le tengono in riga (rimandi risolvibili, asserzioni negative
etichettate, blocchi fonti). Una correzione fatta qui diverge in silenzio dalla sorgente ed è
esattamente il tipo di guasto che tutto questo impianto esiste per evitare. Le correzioni si
**propongono** (§5) e si eseguono nel lab.

---

## 1. Come sono state costruite

### 1.1 Il vincolo che ha determinato tutto: l'agent non presidiato

Le skill già prodotte in quel lab servivano a una conversazione guidata da una persona: se
l'assistente ha un dubbio, chiede. **Queste no.** Servono a un agent che si sveglia da solo, di notte,
e non ha nessuno a cui chiedere. Tre conseguenze che ritroverai nella forma di tutte e quattro:

- **niente ripieghi del tipo «chiedi all'utente»**: ogni istruzione porta a un'azione eseguibile o a
  un **modo dichiarato di fermarsi**;
- **ogni skill dice quando fermarsi**, coerentemente con la tabella dei cancelli del piano §3.2 —
  nessuna ne inventa una propria;
- **le formule vaghe sono trattate come difetti**: «valuta con attenzione» in una conversazione
  produce una domanda, qui produce una decisione arbitraria che nessuno rivedrà.

### 1.2 Lo standard applicato, e cosa garantisce davvero

Ogni skill è passata per sette meccanismi, dichiarati attivi o non attivi caso per caso e registrati
nel proprio manifesto: rimandi incrociati risolvibili (M1), tracciabilità delle fonti con tier e
confidenza (M2), **asserzioni negative trattate come affermazioni da provare** (M2 §3.1), casi
positivi e negativi a pari peso (M3), ricerca prima della stesura (M4), definition-of-done (M5),
autocontrollo meccanico eseguibile (M6), misura dell'esito (M7).

**Cosa questo ti garantisce:** il *pavimento*. Forma coerente, rimandi che risolvono, fonti nominate
con la loro confidenza, nessun «X non ha Y» buttato lì senza averlo verificato.

**Cosa NON ti garantisce:** la *sostanza*. Che il contenuto sia giusto nel merito, completo per il
tuo caso d'uso, e coerente con le altre tre skill. **Quest'ultima cosa in particolare non è stata
misurata da nessuno** — è il §4.

### 1.3 Su M7, la misura dell'esito

Paperclip non è eseguibile dal lab, quindi la misura è stata fatta **per procura**: triggering con un
router cieco, e confronto della prestazione contro un baseline pulito, in Claude Code. È
un'approssimazione dichiarata: il meccanismo di instradamento è concettualmente lo stesso
(description letta per prima, corpo caricato solo se combacia), ma **non è il router di Paperclip**.
I numeri di ogni skill stanno nella sua scheda al §3.

---

## 2. Le correzioni trasversali al documento di commessa

> Come si legge questa tabella: la colonna «cosa diceva» riporta il documento di commessa o il piano;
> «cosa si è trovato» riporta la verifica, con la sua fonte. Tutte le voci marcate **T** (trasversale)
> valgono per tutte e quattro le skill, non solo per quella che le ha scoperte.

| # | Ambito | Cosa diceva la commessa | Cosa si è trovato | Chi l'ha trovata |
|---|---|---|---|---|
| T1 | Gerarchia degli oggetti | Iniziativa → Progetto → Traguardo → Compito → Sotto-compito (piano §8.2) | **Goal → Project → Issue** (+ `parentId`). «Iniziativa» e «Traguardo» **non esistono come oggetti**: si ottengono con **goal annidati** (`parentId` + `level`, enum `company\|team\|agent\|task`) | skill 3 |
| T2 | La scadenza del cancello giallo | «dopo 12 ore procede con l'opzione raccomandata», come se fosse un comportamento della piattaforma | **Nessun campo di scadenza, auto-approvazione o escalation** nelle approvazioni. È **disciplina che l'agent deve eseguire da sé**: scadenza scritta come orario assoluto nel compito, ricontrollata a ogni risveglio | skill 3 |
| T3 | Cosa fornisce Paperclip | «Paperclip non genera nessuna conoscenza di dominio» | Vero, **ma va letto stretto**: esistono skill di serie che insegnano il *craft generico* — **Task Planning**, `paperclip-converting-plans-to-tasks`, **Issue Triage**, **QA Acceptance**. Le nostre sono il **delta di dominio**, non la copertura totale del mestiere | skill 3 |
| T4 | Le dipendenze fra compiti | non trattate | `blockedByIssueIds` è di prima classe e **guida i risvegli** (*«wakes fire when all blockers reach `done`»*); i bloccanti annullati **non** contano come risolti; l'array **sostituisce** l'insieme; ⚠️ **il nesting padre/figlio NON blocca l'esecuzione** | skill 3 |
| T5 | Conflitto con la skill base | non previsto | La skill di serie contiene la **Critical Rule #1**: *«NEVER ASK A HUMAN TO DO WHAT AN AGENT COULD DO»*. Va **riconciliata esplicitamente** in ogni skill che prevede un cancello, o l'agent risolve da solo e in silenzio | skill 3 |
| T6 | Tooling di pacchettizzazione | — | `checks/build-skill-package.ps1` non vedeva il layout nativo Paperclip (`SKILL.md` + `references/`). **Risolto** il 24/8/2026 con patch additivo | skill 4 (segnalato) · skill 3 (risolto) |
| T7 | Autorità dei documenti e delle note del CRM | Note operative e documenti di progetto usati come fonte affidabile: il piano §5.6 dice che dalle note «si portano le trappole del progetto», e la commessa li tratta da riferimento | **Sono decisioni datate, non specifiche, e almeno due divergono dal codice oggi.** ① La **nota #14** elenca `Alert variant="light"` fra i casi scoperti in tema scuro: falso — `.alert-light` **è tematizzato**, attraverso lo strato `--hk-*` dentro l'SCSS di Jampack (valori fissi commentati, sostituiti con `var(--hk-text-secondary)`/`var(--hk-bg-secondary)`/`var(--hk-border-tertiary)`, marcati `// <-- THEMED`; le tre `--hk-*` sono definite due volte in `globals.css`, una per tema). ② `design-linguaggio-apple-web.md` §3.4 descrive `CollapsibleSection` come animato su `transition: height`; il codice anima il **`transform`**. → **Una nota o un documento si cita come pista, si agisce solo dopo aver aperto il codice.** Rilevante per tutte e quattro perché `crm-note-operative` sarà **generata da quel file e data a tutti gli agent** | skill 2 |
| T8 | Gli elenchi di dominio nel **piano** e nella **commessa** | Il piano §2.2 e la commessa §1/§7 elencano le uscite AI da collaudare, «audit SEO» compreso | **L'audit SEO non è una generazione AI** `[ABSENT-VERIFIED]`: `server/modules/web-assets/seo-analyzer.ts` dichiara in testa *«Nessuna rete, nessun DB, nessuna AI: e' deterministico e rule-based»* (protocollo: per sinonimo nel file · per catena da `web-assets/service.ts`, che non raggiunge scarichi a pagamento · per indice sui `functionName` enumerati). **È T7 un piano più su:** non solo le note operative, ma il **piano e la commessa stessi** contengono elenchi di dominio che il codice smentisce. → **Un elenco «le N cose di tipo X» si tratta come istantanea, mai come definizione**: il tipo si riconosce **strutturalmente**, enumerando dal codice (per l'AI: i punti che arrivano a uno scarico a pagamento) | skill 4 |
| T9 | `npm run tocca-ai` | Piano §12.6 B lo dà come il meccanismo che decide se un lavoro tocca l'AI; due skill lo citano come comando da eseguire | **Non è ancora implementato** `[ABSENT-VERIFIED]` (per sinonimo nella sezione `scripts` di `package.json`, di cui `mappa` e `lint:colors` sono gli analoghi nominati dal piano · per schema, `scripts` letto per intero · per indice, `grep -rn "tocca-ai"` restituisce solo menzioni documentali). Il piano lo colloca fra le cose «da fare all'accensione». → **Le due skill che lo nominano devono dichiarare lo stesso ripiego**, o l'assenza di uno strumento diventa un buco silenzioso. Quello adottato qui: **script assente = risposta «sì», si collauda, e lo si dichiara nel compito** (applica la clausola «in dubbio, si collauda» del piano §12.6 B) | skill 4 |
| T10 | I file fuori norma per dimensione | Piano §3.2 mette fra i cancelli **rossi** *«toccare un file fuori norma per dimensione non assegnato a quel compito»*; `CLAUDE.md` aggiunge che quei file *«non sono un arretrato da smaltire appena lo si nota»* | **La regola riguarda il RISTRUTTURARLI, non lo sfiorarli — e presa alla lettera produce falsi rossi.** ⚠️ **Misurato, non ipotizzato:** in una prova M7 con un diff che correggeva **un solo carattere** (un punto e virgola in un `import`) dentro un file da ~10.000 righe, **sei agent su sei** l'hanno escalato a cancello rosso o a blocco del merge — e alcuni dichiarandolo non chiudibile approvando il compito. → I tre casi da tenere distinti: **ristrutturare / estrarre / riscrivere** un file fuori norma non assegnato = 🔴 rosso · **sfiorarlo** con una modifica estranea di una riga = **nota di basso grado** («questo hunk non appartiene a questo ramo») · modifica che il compito richiedeva davvero = **niente**. Riguarda almeno la skill 1, la 2 (che ha una propria regola sulle soglie) e la 3 (che dichiara di non pescarli mai di iniziativa): **le tre non devono legittimare eccezioni diverse** — è il quarto punto del §4.2 | skill 1 |
| T11 | Come si legge la misura dell'esito (M7) **su questo CRM** | Commessa §4: il set di valutazione *«è l'unico controllo che esiste prima della produzione»*, quindi il suo numero è il criterio | **Il baseline è molto più forte del previsto, perché questo repository si documenta benissimo da solo**, e questo comprime il delta anche dove un vantaggio reale esiste. La storia di `posta.gestisci` sta in un **commento dentro `rbac-catalog.ts`**, le regole ①/①-bis/②/②-bis stanno in `CLAUDE.md`, il formato della segnalazione sta in `revisore.md`: un agent **senza** skill che può leggere `crmadv` ricostruisce quasi tutto da solo. Misurato: con il braccio di controllo abilitato alla lettura del repo — che è il controllo metodologicamente corretto — **quattro criteri su otto sono saturati a pieni voti su entrambi i bracci**, e il delta è uscito **+0,50/16, cioè zero**. → **Due conseguenze.** ① **Un delta piccolo su questo CRM non significa «skill inutile»**: significa quasi sempre task non discriminante. Non confrontare fra loro i delta delle quattro skill come se misurassero la stessa cosa. ② **Per ottenere un task discriminante bisogna puntare a ciò che non è scritto da nessuna parte**: qui è bastato il sesto anello della catena dei permessi, e il delta è salito a **+3,33/16** | skill 1 |

### 2.1 Le tre che cambiano davvero il lavoro

**T1 e T4 insieme** dicono una cosa sola e importante: **la struttura del lavoro e il suo ordine si
codificano in campi, non si raccontano in prosa.** Un piano scritto benissimo nella descrizione di un
compito non fa partire nessuno; una catena di bloccanti sì, perché è ciò che sveglia gli agent.

**T2** è la più insidiosa, perché è un'assenza. Nessuno sbaglierà scrivendo «scade fra 12 ore»: il
guasto è che **non succede niente** allo scadere, e non c'è errore da nessuna parte. Se
l'implementazione dell'azienda non prevede chi ricontrolla le scadenze, il giallo diventa un rosso
mascherato.

**T5** è il conflitto che un agent risolve male per costruzione: entrambe le regole sono ragionevoli,
e senza una riconciliazione scritta prevale quella che ha letto per ultima. La forma corretta della
riconciliazione: la regola di Paperclip vieta di **delegare la difficoltà**, i cancelli vietano di
**usurpare l'autorità**; il criterio che li separa è quello del piano §3.1 — *«ci si ferma quando la
decisione è vostra, non perché la cosa è importante»*.

---

## 3. Le quattro skill, una per una

> Ogni scheda segue lo stesso stampo, così sono confrontabili. Chi compila: **solo la sessione che ha
> sviluppato quella skill.**

### 3.1 `crm-permessi-e-sicurezza` — 🛡️ Guardiano

**Cosa contiene.** `SKILL.md` (154 righe) + sei documenti in `references/`: `[F00]` context operativo —
lingua, convenzione dei rimandi, **protocollo dell'assenza**, direttiva di lettura condizionale,
parcheggio a cinque punti, sette errori tipici del ruolo · `[F01]` **la catena dei permessi**, sei anelli
in ordine, più le regole ① e ①-bis e la migrazione di riporto · `[F02]` **le tre trappole silenziose**,
ognuna con caso reale, data, causa e risoluzione · `[F03]` i tre controlli di sicurezza · `[F04]`
i cancelli, le cinque verifiche a posteriori, quando si ferma il guardiano stesso, **il confine col
revisore** · `[F05]` formato della segnalazione, ordine di gravità a otto livelli, sei casi da segnalare
e **sette falsi allarmi**. Totale ~1.525 righe.

**Scopo.** Dare al guardiano la catena dei permessi **di questo CRM** — non l'RBAC in generale — le sue
trappole che non danno errore, i tre punti dove la sicurezza si rompe davvero, e la disciplina con cui si
scrive una segnalazione. Il ruolo, verbatim dal piano §2.2: *«segnala guardando indietro, non autorizza
guardando avanti»*.

**Perimetro negativo dichiarato.** Non scrive codice e **non modifica nessun file**. **Non descrive la
correzione**: nomina la lacuna e la conseguenza, non scrive la patch — un guardiano che detta i rimedi
comincia a essere eseguito invece che letto. Non concede né nega poteri a nessun agent (li fissa il
consiglio nella configurazione). Non fa la revisione generale del codice — nomi, struttura, colori
scritti a mano, convenzioni, test — che resta al revisore. Niente teoria di sicurezza web non applicabile
a questa codebase. E **non decide quale ruolo *dovrebbe* avere un permesso**: verificare che il diff una
decisione l'abbia presa è suo, quale sia quella decisione è un cancello giallo.

**Meccanismi attivi.** M1 · M2, con fonti **quasi tutte Tier 1 di prima mano** (il codice stesso, letto
al commit `3e3cb50`; le inferenze sono marcate Tier 3 e sono due) · M2 §3.1 con **una sola asserzione
negativa in tutto il deliverable**, etichettata `[NOT-FOUND]` e seguita dal divieto esplicito di
derivarne un rilievo · M3 **come asse portante, non come appendice** (vedi sotto) · M4 su due fronti —
piattaforma Paperclip da documentazione ufficiale e sorgenti del CRM letti direttamente · M5 · M6 · M7
per procura.

⚠️ **Sul perché M3 è l'asse portante, ed è la scelta di progetto più importante di questa skill:** il
modo tipico in cui questo mestiere fallisce **non è mancare un difetto, è segnalarne di finti** finché
il rilievo vero smette di essere letto. Perciò i casi negativi non sono esempi di codice sbagliato: sono
**sette falsi allarmi**, ognuno con la *causa dell'illusione* — cioè perché sembra un difetto. Sono a
pari peso dei sei casi positivi, e `[F05:NEGATIVE_CASES]` va letto **prima** di scrivere qualsiasi
segnalazione, non dopo.

**Scelte di forma.** `[F00]` è un context **separato** (a differenza della skill 3, che lo fonde in
`SKILL.md`): porta il protocollo dell'assenza e il formato del parcheggio, che servono anche quando non
si apre nessun altro reference. Corpo in inglese; **tutto ciò che l'agent scrive dentro Paperclip in
italiano**; chiavi, etichette a schermo e regole del CRM citate **verbatim in italiano fra virgolette**
(`mail.manage`, «Server di posta», «una funzione che nessun ruolo può governare») — una chiave tradotta
è una chiave che non si può cercare nel codice. Due decisioni da copiare, se si fanno altre skill
Paperclip:
- **`name:` NON versionato** (`crm-permessi-e-sicurezza`, non `-v1.0`). In Paperclip lo `slug` si deriva
  dal `name`: versionarlo creerebbe una skill **nuova** nella libreria a ogni revisione invece di
  sostituire quella esistente — e sostituire una skill è un cancello rosso proprio perché tocca tutti
  gli agent che la portano. La versione vive in intestazione e footer di ogni file.
- **Nessun `scripts/` né `assets/`.** Il livello di fiducia di una skill è il **massimo** della sua
  inventory (`markdown_only` < `assets` < `scripts_executables`): quelle cartelle non si creano «per
  completezza», o si alza il livello di fiducia richiesto per installarla senza guadagnarci nulla.

**Correzioni portate.** **T10** e **T11** del §2 nascono qui. Recepite **T5** e **T2** (dalla skill 3),
entrambe **dopo** che la skill era stata misurata e prima della consegna: la riconciliazione con la
Critical Rule #1 di Paperclip è scritta in **tre punti** — corpo di `SKILL.md`, `[F00]`, e per esteso in
`[F04:WHEN_THE_GUARDIAN_STOPS]` con la tabella «delega la difficoltà / usurpa l'autorità» — e la scadenza
di 12 ore è dichiarata **a carico dell'agent**: orario assoluto scritto nel compito, ricontrollo a ogni
risveglio, dichiarazione quando scade. Più una correzione **specifica di questa skill**, già al §9.4 di
`_CONSEGNA-PAPERCLIP.md`: ⭐ **la catena dei permessi ha SEI anelli, non i cinque della commessa §6.** I
due che si contano male: il catalogo è **due punti distinti dello stesso file** (`SYSTEM_PERMISSION_CATALOG`
= l'elenco, `SYSTEM_ROLE_DEFINITIONS` = chi lo riceve), e nel frontend le liste di stringhe-permesso
copiate a mano sono **due** — quella nota (`src/modules/<nome>/ui/constants.js`, citata nella mappa §4)
**e** `CORE_PERMISSIONS` in `src/views/Profiles/Account/index.jsx`, che non è citata da nessun documento
ed è proprio il file dove vive la trappola della terminazione.

**Esito dei controlli.** M6: **entrambi gli script verdi** — 33 rimandi risolti su 44 anchor definiti,
nessun rimando rotto; una sola asserzione negativa, etichettata, zero non etichettate. M7: triggering
**proxy** 8/8 should al **100%** e 8/8 near-miss allo **0%**, tre router con sedici righe identiche — e i
near-miss non sono finiti nel vuoto ma **nella skill corretta** (revisione → `metodo-revisione`, file da
spezzare → `crm-regole-codice`, colore → `crm-design-frontend`). Performance: **μ(con skill) 15,67 ± 0,58
contro μ(baseline) 12,33 ± 0,58 su 16**, **delta +3,33**, N=3 per braccio, **due** grader ciechi in
accordo su **48 caselle su 48**. Task = diff sintetico «Firma digitale» con **cinque difetti reali** e
**due trappole di sovra-segnalazione**.

**Difetti trovati dalla misura.** Due, entrambi corretti. ① **La migrazione di riporto usciva a −1,17,
cioè la skill faceva *peggio* del non averla**: una esecuzione prese 0, tutti e tre i baseline presero 2.
La regola era corretta ma **sepolta in fondo a un file lungo, e la procedura non la richiamava mai** →
è diventata un passo esplicito di `SKILL.md`, con le due domande della regola ①-bis scritte a chiare
lettere e il divieto di liquidarla con «il permesso è nuovo, nessuno lo aveva prima» (che risponde alla
prima domanda, non alla seconda). ② La regola sui file fuori norma, troppo letterale → **T10**.

⚠️ **Divergenza di metodo dichiarata, da leggere insieme alla scheda 3.3.** I numeri qui sopra sono
**post-correzione**: ho rimisurato dopo aver corretto. La sessione 3 ha fatto la scelta opposta e la
motiva bene — *«rimisurare dopo aver aggiustato sul risultato produce un numero che misura l'adattamento
all'eval, non la skill»*. **Non è una contraddizione da comporre, sono due rischi diversi**, e chi legge
deve sapere quale ha ciascuna scheda. Perché qui ho ritenuto il rischio accettabile, e come l'ho limitato:
la rubrica è cambiata su **due criteri su otto**, quindi il loro contributo è **in parte confondibile**;
sui **sei criteri a definizione invariata** il delta è **+1,67 su 12** ed è **identico nelle due tornate**,
su sei esecuzioni indipendenti. Perciò il delta totale va letto come **+1,67 riprodotto + 1,67 plausibile**,
mai come +3,33 secco. Il segnale che non dipende da nulla di tutto questo è il sesto anello:
`MobileBottomNav.jsx` **mancato da tre baseline su tre in entrambe le tornate e trovato da tre col-skill
su tre in entrambe** — sei contro sei, senza eccezioni.

**Cosa questa skill si aspetta dalle altre tre** *(il raccordo — vedi §4)*:
- ⭐ **Che sia il capocantiere a possedere la condizione di quando il guardiano entra, non questa skill.**
  Risponde al primo punto del §4.2: qui il guardiano **si sveglia sul compito** e non se li sceglie né
  pretende compiti dedicati — è compatibile con l'essere attaccato come **stadio di `executionPolicy`**,
  come fa la skill 3. Ma la condizione del piano §2.2 («il compito tocca permessi o sicurezza») **non è
  scritta come regola operativa in nessuna delle due**: se il capocantiere ne usa una più stretta o più
  larga, o il guardiano entra sempre o non entra mai. **Va deciso da fuori e scritto in una sola delle
  due.**
- **Che ①/①-bis abbiano una fonte sola.** Questa skill le possiede come **contenuto** e le verifica a
  posteriori (`[F01:RULE_ONE_SAME_WORK]`, `[F01:RULE_ONE_BIS_ROLES]`); la pianificazione le cita come
  vincolo da scrivere nel compito. Entrambe **citano `crmadv/CLAUDE.md`, non lo parafrasano** — è la
  condizione perché non divergano. Da verificare che sia vero anche nell'altra.
- ⚠️ **Che il confine col revisore venga deciso da fuori.** `[F04:BOUNDARY_WITH_REVIEWER]` è dichiarato
  **Tier 3 — una proposta ragionata, non una regola citata**: nessuno dei due documenti sorgente traccia
  la linea. E c'è un rischio concreto: se `metodo-revisione` viene generata da `.claude/agents/revisore.md`
  **as-is**, quel file rivendica ancora **la catena dei permessi come errore #1 e la sicurezza come punto
  #6** — cioè esattamente il perimetro di questa skill. **Sovrapposizione doppia garantita**, salvo
  intervento. È il caso più netto del §4.2.
- **Che la regola sui file fuori norma valga uguale** nelle skill 1, 2 e 3 → **T10**.
- **Che nessuna inventi una tabella di cancelli propria**, e che tutte trattino **il rosso come la fine
  normale di ogni compito** (unire a `main` è già rosso per tutto), **mai come un rilievo**. Questa skill
  lo dice esplicitamente in `[F04:GATES_TABLE]` perché un agent che legge solo la tabella deduce il
  contrario — e allora segnalerebbe ogni compito come anomalia.

**Cosa invecchia per primo.**
- **I numeri.** 76 permessi, ogni riferimento a riga, l'elenco degli otto moduli che hanno un
  `ui/constants.js`: sono istantanee del 24/8/2026. La skill lo dichiara e impone di **navigare per nome
  di simbolo, mai per numero di riga**, e stabilisce che **in caso di disaccordo vince il codice**.
- **La lista dei dieci permessi senza riscontro frontend** in `[F05]`: la rigenera `npm run mappa`, quindi
  la copia scritta nella skill è datata per costruzione. La skill impone di leggere **la mappa corrente**.
- **Il confine col revisore**, che dipende da come verrà generata `metodo-revisione` (vedi sopra).

**VERIFY-ON-FIELD aperti.**
① **alla prima installazione in Paperclip** — l'assenza di un tetto di caratteri sulla `description`
(`[ABSENT-VERIFIED]` a confidenza MEDIUM: lo schema `zod` del repo ha `description: z.string().nullable()`
**senza** `.max()`; se l'installazione fallisse con un errore di validazione, il claim cade). ⚠️ Da non
confondere col limite di 1024 del caricatore dell'account Claude, che è **di un'altra piattaforma**;
② **alla prima installazione** — quali costrutti YAML accetta davvero il parser minimale di Paperclip
(il frontmatter è stato tenuto elementare apposta);
③ **prima di citarla in una segnalazione reale** — la seconda porta dentro `server/modules/team/team.service.ts`
(~righe 416-419), che lascia la rimozione al solo Superadmin: è stata letta **attraverso un commento**
in `rbac-catalog.ts`, non aprendo il file;
④ **prima di asserire che una funzione passa da `net-guard`** — quali call site usino davvero `safeFetch`:
l'elenco (scansione SEO, healthcheck dei web asset, logo dei PDF) viene dal commento d'intestazione del
modulo, non da un'enumerazione sul codice;
⑤ **quando qualcuno tocca il catalogo** — se `team.manage` esista ancora: è `[NOT-FOUND]` dichiarato, e la
skill vieta di costruirci sopra qualsiasi rilievo;
⑥ ⭐ **decisione utile, non solo verifica** — **la classificazione dei dieci permessi senza riscontro
frontend.** Nessuno dei dieci è classificato «solo-backend» o «collegamento dimenticato», e questa è la
fonte di **un'intera classe di cancelli gialli** del guardiano. Classificarli una volta per tutte la
eliminerebbe;
⑦ **quando si decide la libreria delle skill** — il confine col revisore (Tier 3, vedi sopra).

### 3.2 `crm-design-frontend` — 🎨 Sviluppatore frontend

**Cosa contiene.** `SKILL.md` + nove documenti in `references/`: `[F00]` context operativo · `[F01]` il
linguaggio di design tradotto in decisioni · `[F02]` token, chiaro/scuro e la lacuna del lint · `[F03]`
superfici, bordo vetro e sistema flat · `[F04]` liste dense e riga espandibile · `[F05]` il pavimento di
accessibilità · `[F06]` dove va il file, convenzioni di modulo, soglie, test · `[F07]` cancelli e
parcheggio · `[F08]` casi riusciti e falliti.

**Scopo.** Trasformare la bussola di design del CRM da documento di principi a **ricettario applicabile**
(mandato esplicito del piano §2.2), ancorato al codice reale: come si costruisce o si modifica una
pagina, un componente o una lista in *questo* CRM perché esca giusta al primo colpo.

**Perimetro negativo dichiarato.** Non tocca il backend (Fastify, service, repository, Prisma,
migrazioni, rotte server); **non tocca il catalogo dei permessi né i ruoli predefiniti**; non decide
cosa si costruisce né in che ordine; non guida un browser né fa screenshot; non giudica un'uscita AI;
non scrive documenti di progetto; non unisce a `main`. In più, tre divieti di mestiere: non allarga mai
il compito (un file-mostro incontrato per strada non è suo), non zittisce un guardrail con
`eslint-disable`, non risolve di propria autorità una domanda che la skill dichiara aperta.
⚠️ **Il caso che sembra un'eccezione e non lo è:** quando il lavoro tocca un permesso, i **collegamenti
frontend** sono suoi (costanti di modulo, componente gate, voce di menu), la **voce di catalogo e i
ruoli** no — sono 🔴 rossi.

**Meccanismi attivi.** M1 (notazione `[F00]`…`[F08]`, anchor `[Fxx:ANCHOR]`) · M2 con flag propri
`[CODE]`/`[PROJECT-DOC]`/`[NORMATIVE]`/`[VERIFY]` — i due documenti operativi `[F00]` e `[F07]`
dichiarano l'esenzione dal blocco fonti · M2 §3.1 con tre `[ABSENT-VERIFIED]` e un `[NOT-FOUND]`
mantenuto tale · M3 (**8 casi falliti, 7 riusciti**, tutti da episodi datati di questo progetto) ·
**M4 mirata, con perimetro deliberato**: la ricerca esterna **non** è stata rifatta sul linguaggio di
design — l'autorità è il documento del CRM, ri-cercarlo avrebbe rischiato di contraddire una decisione
già presa — ma **sì** sulle asserzioni normative che l'agent applicherà alla cieca (W3C/WAI e MDN letti
sulle pagine ufficiali) · M5 · M6 · M7 per procura.
⚠️ **M4 ed M7 eseguiti senza subagent specializzato:** l'ambiente di sessione vieta l'`AgentTool` senza
richiesta esplicita, mentre il metodo del lab prescrive `ricercatore-skill`. La ricerca è stata svolta
direttamente con lo stesso protocollo; M7 solo dopo autorizzazione esplicita.

**Scelte di forma.** `00_context` **separato** in `references/`, non ripiegato dentro `SKILL.md`: così
si paga solo quando serve, mentre il corpo di `SKILL.md` si paga a ogni risveglio in cui la skill
scatta. ⚠️ **Divergenza dichiarata:** la skill 3 ha scelto l'opposto, con una ragione diversa (evitare
testo duplicato). Entrambe difendibili, ma **le quattro non sono uniformi su questo punto** — materiale
per il §4. `SKILL.md` porta comunque **tre regole non delegabili** ripetute nel corpo, perché reggano
anche se l'agent non apre nessun reference. Niente `scripts/` né `assets/`: la skill resta al livello di
fiducia `markdown_only`. Corpo in inglese; **output dell'agent in italiano**; regole ed etichette del
CRM citate verbatim in italiano fra virgolette.

**Correzioni portate.** **T7** del §2, più due specifiche di questa skill (fonte:
`_CONSEGNA-PAPERCLIP.md` §9.5): ① **`views/Team/index.jsx` è a 778 righe**, non 771 come registra la
roadmap al 17/8/2026 — 22 dalla soglia-mostro; ② `--space-7` **non esiste** nella scala dei token (salta
da `--space-6` 32px a `--space-8` 48px), e una custom property irrisolta **fa cadere la dichiarazione in
silenzio**. Confermato invece il §9.2 della commessa: la regola dei dev server ha cambiato oggetto con lo
spostamento sulla VPS, e la skill non la riscrive.

**Esito dei controlli.** M6: entrambi gli script verdi — 51 rimandi risolti su 80 anchor definiti; zero
asserzioni negative non etichettate (un WARN, riletto a mano: è la frase che *definisce* la regola in
`[F00]`, da cui non si deriva nulla). M7: triggering **8/8 should al 100%, 8/8 near-miss allo 0%**, N=3
con ordine rimescolato a ogni run, zero falsi positivi e negativi; performance **μ(con skill) 14,0 ± 0,0
contro μ(baseline) 7,0 ± 0,0 su 14**, **delta +7,0**, N=3, task = riga espandibile nella lista Preventivi
con grader cieco su sette criteri.

**Difetti trovati dalla misura.** Nessun difetto della skill — ma **due letture del risultato che
contano più del numero**: ① il vantaggio è **zero su C4** (accessibilità della linguetta): il baseline
sa già `aria-expanded`, il nome accessibile per record, `inert`, `prefers-reduced-motion` e cita
correttamente il target 24×24 di WCAG 2.2. **Effetto soffitto reale**: il valore di `[F05]` non è
insegnare l'ARIA, è agganciarla ai token di casa e portare SC 1.4.11, che nessun baseline ha nominato.
② **σ = 0 è un avviso, non un trionfo**: tre run, fraseggi poco diversi, stesso modello, rubrica con
ancore molto nette — il campione **non ha esplorato varianza**.

**Cosa questa skill si aspetta dalle altre tre** *(il raccordo — vedi §4)*:

- ⭐ **Che allo sviluppatore frontend siano assegnate anche `crm-regole-codice` e `crm-note-operative`.**
  È l'assunzione da cui dipende tutto il resto: questa skill **rimanda invece di duplicare** (le regole
  di `CLAUDE.md` restano di `crm-regole-codice`; le note si citano **per numero**: #3, #8, #9, #14, #21,
  #25, #40, #41, #44, #46, #48, #49). Il piano §5.5 le destina a *«i due sviluppatori»*, quindi l'assunto
  è fondato — **ma è configurazione d'azienda, non proprietà della skill.** Se non arrivano, restano buchi.
- ⚠️ **Che `crm-permessi-e-sicurezza` e questa dicano la stessa cosa sui collegamenti frontend del
  permesso — e qui c'è una lacuna già identificabile.** Questa skill nomina **una sola** lista di
  stringhe-permesso nel frontend, `src/modules/<nome>/ui/constants.js`. Il §9.4 della commessa, trovato
  dalla sessione 1, dice che le liste sono **due**: quella **e** `CORE_PERMISSIONS` in
  `src/views/Profiles/Account/index.jsx` — proprio il file dove vive la trappola della terminazione del
  permesso (`.view`/`.manage`/`.view_list`). **`[F06:MODULE_ANATOMY]` è quindi incompleto**, ed è una
  correzione da eseguire nel lab, non da qui.
- **Che nessuna delle altre inventi una tabella di cancelli propria.** `[F07]` non ne inventa una: cita
  quella del piano §3.2 e la **declina per questo mestiere** (esempi lavorati verde/giallo/rosso), che è
  una cosa diversa dal riscriverla. Il criterio di separazione resta quello del piano §3.1.
- **Che le condizioni di chiamata dell'esploratore arrivino da `crm-regole-codice`.** Questa skill **non
  le riporta**, deliberatamente (sono in `CLAUDE.md`). ⚠️ La skill 3 invece le cita verbatim e si aspetta
  che coincidano ovunque: **da verificare che lo sviluppatore frontend le riceva davvero**, perché il
  silenzio non è una contraddizione ma può essere un buco.
- **Che il collaudo AI non venga attaccato a un compito di sola grafica.** Questa skill non rivendica
  nulla sul «tocca l'AI» e lascia la regola a `crm-collaudo-generazioni-ai`; il piano §12.6 esclude
  esplicitamente *«la grafica delle pagine che mostrano una generazione»* dagli innesti. Le due non
  dovrebbero collidere: **da confermare leggendo la scheda 3.4.**
- **Che la catena del «fatto» resti del capocantiere.** La checklist in `SKILL.md` è la checklist del
  **mestiere** e dichiara esplicitamente che le condizioni d'azienda per arrivare al cancello stanno nel
  piano §3.4: non le sostituisce e non le riscrive. Coerente con l'impostazione della skill 3, che le
  attacca come stadi di `executionPolicy`.
- **Che chi possiede il metodo di revisione sappia che un lint verde non prova niente fuori da
  `src/modules/**`.** Il piano §2.2 mette *«colori scritti a mano»* fra ciò che il revisore cerca;
  `[F02:LINT_GAP]` dimostra che `lint:css` e `lint:colors` guardano **solo** `src/modules/**`, quindi
  tutta l'area `src/views/**` — Agency compresa — è al buio. Se `metodo-revisione` legge il lint come
  prova, la rete ha un buco.

**Cosa invecchia per primo.**
- **I numeri di riga e le dimensioni dei file.** `views/Team/index.jsx` a 778 righe è la misura di *un
  commit*. Ogni `file:riga` in questi documenti va riaperto, e la skill lo dice di suo
  (`[F00:SKILL_LEVEL_ERRORS]`, errore #1).
- **I difetti pre-esistenti raccontati in `[F08]`** — il selettore del tema senza nome accessibile (N6),
  il filtro divergente della palette `Ctrl+K` (N7), il ripiego impossibile sul nome cliente (N8): censiti
  ai primi di agosto 2026, **potrebbero essere già stati corretti**.
- **`[F06]` PART 8, l'ambiente di sviluppo.** La regola dei dev server verrà **riscritta alla fase 0**
  dello spostamento sulla VPS: la skill la riporta com'è e segnala che l'oggetto è cambiato.
- **I nomi delle classi del sistema flat e del bordo vetro** (`page-flat`, `flat-cols`, `flat-keep`,
  `card-flat`, `glass-sep`): sono invenzioni di casa, vivono solo in `apple-foundation.css`, e cambiano
  quando cambia quel file.
- **Il censimento dei file fuori norma**, che è per costruzione una fotografia.

**VERIFY-ON-FIELD aperti**, ordinati per momento di verifica:

*Alla configurazione dell'azienda*
1. **Che lo sviluppatore frontend riceva davvero `crm-regole-codice` e `crm-note-operative`** — è
   l'assunto su cui poggia la scelta «rimanda, non duplicare» (vedi sopra). ⭐ **Il più importante.**

*Al primo compito reale*
2. **La riga focalizzabile dentro `role="table"`** (`[F04:OPEN_QUESTION_ROW_FOCUS]`): MDN si pronuncia
   sulle **celle** (*«the cells are not focusable or selectable»*) e **non** sulle righe; il protocollo
   dell'assenza è stato eseguito solo in parte (per sinonimo e per indice, non contro la specifica ARIA
   normativa). Resta **`[NOT-FOUND]`**, e da lì la skill non deriva nulla: segue il pattern di casa e lo
   dichiara. Si chiude leggendo la specifica o provando con uno screen reader.
3. **`@testing-library/user-event`**: la nota #44 lo dà per non installato, la skill dice di verificarlo
   in `package.json` prima di importarlo o di dichiararlo mancante.
4. **Che l'anello di focus di casa raggiunga 3:1 in entrambi i temi** (SC 1.4.11): mai misurato.
5. **Se i difetti N6, N7, N8 di `[F08]` siano ancora aperti**, prima di segnalarli di nuovo.
6. **Quali altre classi siano tematizzate attraverso lo strato `--hk-*`** dentro il tema di terze parti:
   il meccanismo è provato (vedi T7), l'elenco **non** è stato enumerato.
7. **La regola di `globals.css` dietro `ui-collapse-animating`**, non letta riga per riga: da aprire
   prima di replicare il meccanismo in un nuovo componente animato.

### 3.3 `crm-pianificazione` — 🧭 Capocantiere

**Cosa contiene.** `SKILL.md` (fa anche da context) + sette documenti in `references/`:
`[R01]` da dove nasce il lavoro · `[R02]` come si taglia un compito · `[R03]` cosa deve esserci dentro
un compito · `[R04]` ordine e dipendenze · `[R05]` cancelli e parcheggio · `[R06]` compiti che tornano
indietro · `[R07]` casi riusciti e falliti.

**Scopo.** Tradurre i documenti di piano del CRM in compiti eseguibili — della misura giusta,
nell'ordine giusto, con dentro tutto il necessario — assegnarli al mestiere giusto, dichiarare il
cancello, gestire i ritorni.

**Perimetro negativo dichiarato.** Non scrive codice, non unisce a `main`, **non inventa lavoro** (ogni
compito dev'essere tracciabile a una riga già scritta in un documento di piano), non decide nomi né
etichette, non crea goal o progetti, **può aggiungere un cancello ma mai toglierlo**, non tocca i file
fuori norma che hanno già un momento assegnato.

**Meccanismi attivi.** M1 · M2 (fonti in gran parte **primarie interne**: i documenti dell'azienda
sono Tier 1) · M2 §3.1 con due `[ABSENT-VERIFIED]` · M3 (6 casi riusciti, 8 falliti, tutti da episodi
datati del CRM) · M4 **parziale per istruzione** (la ricerca sul formato Paperclip non è stata
rifatta; è stata fatta nuova sul modello dei compiti) · M5 · M6 · M7 per procura.

**Scelte di forma.** `SKILL.md` fa da context (nessun `00_context` separato: sarebbe testo duplicato
pagato a ogni risveglio). Corpo in inglese; **tutto ciò che l'agent scrive dentro Paperclip in
italiano**; regole ed etichette del CRM citate verbatim in italiano fra virgolette. I due modelli da
copiare — descrizione di un compito e parcheggio a cinque punti — sono **scritti in italiano** dentro
documenti inglesi, perché sono testo da copiare, non spiegazioni.

**Correzioni portate.** T1, T2, T3, T4, T5 del §2, più: `/reset-password` **esiste già ed è
instradata** (pagina del tema in inglese, «6 digit code», che non chiama alcuna API) mentre il piano
§7.3 ⑥-ter dichiara che *«non esiste né la schermata né la funzione lato server»* — la funzione
davvero non c'è, la schermata sì. Dettaglio in `_CONSEGNA-PAPERCLIP.md` §9.7.

**Esito dei controlli.** M6: entrambi gli script verdi (40 rimandi risolti su 63 anchor; zero
asserzioni negative non etichettate). M7: triggering **9/9 should al 100%, 9/9 near-miss allo 0%**,
tre run identiche; performance **μ(con skill) 13,33 ± 0,58 contro μ(baseline) 11,67 ± 1,15 su 14**,
**delta +1,67 ± 1,53**, N=3, task = il traguardo ② della release.

**Difetto trovato dalla misura e corretto dopo.** Due coppie su tre hanno rilevato che il braccio con
la skill **dichiarava la catena del «fatto» una volta sola** invece di attaccarla compito per
compito, e **non nominava il revisore** — che il piano §3.4 richiede senza condizioni, a differenza di
guardiano e collaudatore che sono condizionali. `[R03:ACCEPTANCE]` ora porta la tabella
incondizionato/condizionale e l'obbligo di attaccare gli stadi per compito. ⚠️ **I numeri sopra sono
pre-correzione** e non sono stati rimisurati: rimisurare dopo aver aggiustato sul risultato produce un
numero che misura l'adattamento all'eval, non la skill.

**Cosa questa skill si aspetta dalle altre tre** *(il raccordo — vedi §4)*:
- che **nessuna delle altre inventi una tabella di cancelli propria**: questa rimanda alla tabella del
  piano §3.2 e assume che facciano lo stesso;
- che **il guardiano e il collaudatore siano stadi di `executionPolicy`, non compiti a sé**: questa
  skill li attacca così, e se `crm-permessi-e-sicurezza` si aspetta di ricevere compiti dedicati, le
  due si contraddicono;
- che **il collaudatore AI si aggiunga per via di uno script deterministico** (`npm run tocca-ai`) e
  che **nessun agent possa toglierlo**: questa skill applica l'asimmetria e cita `crm-collaudo-
  generazioni-ai` come proprietario della regola;
- che **le condizioni di chiamata dell'esploratore** citate qui verbatim (file oltre ~800 righe ·
  permesso/rotta/tabella/colonna · Agency, Web Assets o chat · elenco file non noto) **coincidano**
  con quelle usate altrove.

**Cosa invecchia per primo.** La tabella degli undici traguardi in `[R04:HARD_ORDER]` vale **finché la
release di settembre è aperta**; chiusa quella, l'autorità sull'ordine passa alla roadmap in V. È
segnalato dentro il documento stesso.

**VERIFY-ON-FIELD aperti.** ① il campo `goalId` sulla issue (l'API lo espone, la guida dice che le
issue ereditano il goal dal progetto) · ② le chiavi esatte di `priority` oltre `medium`/`high` · ③
l'assenza di scadenza sulle approvazioni (T2), da riconfermare alla prima installazione · ④ l'assenza
di lucchetti git nell'`executionPolicy`: **il divieto di unire a `main` regge perché gli agent
obbediscono, non perché la piattaforma lo impedisca** · ⑤ che l'utenza dell'agent capocantiere possa
scrivere sui compiti ma non sul codice — è configurazione d'azienda, non proprietà della skill.

### 3.4 `crm-collaudo-generazioni-ai` — 🧪 Collaudatore AI

**Cosa contiene.** `SKILL.md` (corto: identità, procedura in sei passi, instradamento, sei regole
ferme) + sei documenti in `references/`: `[F00]` context — regole trasversali, condizioni operative
dell'agent non presidiato, perimetro negativo, otto errori di mestiere · `[F01]` quando è dovuto un
collaudo, e **come si riconosce un'area AI anche se non esiste ancora** · `[F02]` come si prepara la
run: utenza, fusibile, dati di prova, cache, provider, modello · `[F03]` **il cuore** — generazione
vera, ripiego dichiarato o bugia silenziosa · `[F04]` come si giudica il contenuto · `[F05]`
segnalazione e cancelli.

**Scopo.** Decidere se un compito va collaudato, **far partire lui** le generazioni AI del CRM,
stabilire se il risultato è reale o un ripiego travestito, misurarlo contro il contratto della
generazione, e segnalare. È l'unico agent del team che fa **chiamate vere a pagamento**.

**Perimetro negativo dichiarato.** Non esprime **nessun parere di prodotto** (se una funzione debba
esistere, come dovrebbe comportarsi una generazione, cosa converrebbe commercialmente); non modifica
**niente** — né codice, né prompt, né schemi, né impostazioni, né budget, e in particolare **non alza un
limite** per superare un `budget_exceeded`; non fa collaudo d'interfaccia (è dell'altro collaudatore:
*«mostrare una generazione non è generarla»*); **non toglie mai** un collaudo che lo script ha chiesto;
non inventa soglie di qualità oltre il contratto; non riporta un risultato senza le sue evidenze.

**Meccanismi attivi.** M1 · M2 (fonti quasi tutte **primarie di prima mano**: il codice `crmadv` letto
direttamente, Tier 1) · M2 §3.1 con **tre `[ABSENT-VERIFIED]`** (copertura del fusibile · registro cieco
sulla ricerca competitor · `tocca-ai` non implementato) e **due `[NOT-FOUND]`** da cui non si deriva
nulla · M3 (**16 casi**, positivi e negativi a pari peso, quasi tutti **incidenti datati e reali** del
progetto: 22/7, 23/7, 21/7) · M4 (ricerca eseguita **prima** della stesura sul codice; **non rifatta**
sul formato Paperclip, per istruzione della commessa §0.3) · M5 · M6 · M7 per procura.

**Scelte di forma.** `00_context` **separato** come `[F00]`, non ripiegato dentro `SKILL.md`.
⚠️ **È una divergenza dichiarata rispetto alla skill 3** → vedi «cosa si aspetta dalle altre».
Corpo in inglese; **letterali del CRM in italiano fra virgolette** (`«Target non definito nelle fonti
disponibili.»`, `«Non inventare target, offerta, CTA, USP…»`) perché devono restare ricercabili nel
codice; **tutto ciò che l'agent scrive è in italiano**. `description` a due rami, **869 caratteri
ASCII** — forma valida sia per il parser minimale di Paperclip sia per il caricatore dell'account
Claude usato nella misura M7. Nessuna `scripts/` né `assets/`: la skill resta `markdown_only`.

**Correzioni portate.** **T8** e **T9** del §2 (entrambe scoperte qui), più T6 segnalata da questa
sessione e risolta dalla 3. Specifiche di questa skill, in `_CONSEGNA-PAPERCLIP.md` §9.6:
① **il fusibile copre due percorsi a pagamento su quattro** — `assertWithinAiBudget` è invocato da
**esattamente due** punti (enumerazione completa su `server/`); restano fuori gli **embedding RAG**
(che però consumano il budget che il fusibile somma) e la **ricerca competitor**, la quale **non scrive
nemmeno una riga in `AiUsageLog`** → su quel percorso l'incrocio della nota #30 **si rovescia**:
«nessuna riga nel registro» non significa «l'AI non è girata»; ② **le funzioni AI a pagamento sono
dieci più un percorso senza nome**, non le cinque costate — quindi **la cifra di 3-9 ¢ a collaudo
(piano §12.6 C) non vale** per `reporting.excelMapping` né per la ricerca competitor.
Due cose trovate nel codice e **non documentate da nessuna parte**, ora dentro `[F03]`: il **merge di
ripiego a livello di campo** nella Discovery (un `ai_with_sources` può contenere sezioni interamente
rule-based, perché ogni sezione è scritta come *valore del modello se c'è, altrimenti quello
rule-based*) e il fatto che il percorso di mappatura Excel **ingoia l'errore del motore**, così un
`budget_exceeded` vi si presenta come `fallback_rule_based` senza spiegazione.

**Esito dei controlli.** M6: entrambi gli script verdi — **40 rimandi risolti su 75 anchor definiti**;
**zero asserzioni negative non etichettate** (due `[NOT-FOUND]`, entrambi voci di VERIFY-ON-FIELD che
dicono «da misurare», l'unico uso lecito). M7: triggering proxy **8/8 should al 100%, 8/8 near-miss
allo 0%**, tre run **identiche**; performance **μ(con skill) 15,0 ± 1,0 contro μ(baseline) 4,7 ± 1,2 su
16**, **delta +10,3**, N=3, **gruppi non sovrapposti** (peggiore con-skill 14 > migliore baseline 6).
Task = una Discovery rigenerata su progetto già usato, con cache hit, modello risolto diverso da quello
impostato, frase rule-based scambiabile per uscita del modello e registro apparentemente vuoto.
**Dove si è giocata:** tutti e tre i baseline hanno attribuito al modello la frase rule-based *«Target
non definito…»* — l'errore documentato del 22/7 — e tutti e tre hanno sconfinato in decisioni di
prodotto (criteri di accettazione, fix proposti, uno dichiara il blocco del merge).

**Difetti trovati dalla misura.** Due, **nessuno dei due corretto**, entrambi registrati nel manifesto:
① **C6 (fedeltà del fusibile) è instabile nel braccio con la skill** — 2, 1, 0 sulle tre run. La regola
c'è (`[F02:CALL_AS_USER]`, `[F02:FUSE_COVERAGE]`) e i passi 1-2 della sequenza di preparazione la
impongono, ma **il task non la sollecitava**, quindi il segnale misura l'eval quanto la skill. È il
candidato numero uno per una v1.1. ② **C3 (trappola della cache) è saturo**: 2/2 su tutte e sei le
submission — la vedono anche i baseline, quindi quel criterio non discrimina e spreca un ottavo della
risoluzione della misura. **I numeri sopra sono quelli misurati, senza correzioni successive:** non ho
aggiustato dopo aver visto il risultato, perché rimisurare su una skill corretta sull'eval produce un
numero che misura l'adattamento all'eval.

**Cosa questa skill si aspetta dalle altre tre** *(il raccordo — vedi §4)*:
- che **il capocantiere attacchi il collaudo AI per via dello script deterministico** e applichi
  l'asimmetria **con le stesse parole**: script, capocantiere e revisore possono **aggiungere** un
  collaudo; **nessun agent può toglierlo** quando lo script dice sì — solo il consiglio. La skill 3
  dichiara di farlo e di citare questa come proprietaria della regola: **coincide**. Va confrontato che
  anche il **ripiego per script assente** (T9) sia lo stesso nelle due;
- che **nessuna delle altre inventi una tabella di cancelli propria**: questa rimanda alla tabella del
  piano §3.2, e declina solo i casi del proprio mestiere (fusibile non armato → giallo; fusibile
  scattato → **rosso**, perché sforare un budget è rosso);
- che **il collaudo d'interfaccia resti del 🖥️ Collaudatore**: questa dichiara che una pagina che
  *mostra* una generazione non è affar suo. Se `crm-design-frontend` si aspetta che il collaudatore AI
  verifichi le pagine che espongono una generazione, le due si contraddicono e quella zona resta
  scoperta;
- che **nessuna delle altre tratti l'audit SEO come uscita AI** (T8), e che **nessuna citi i 3-9 ¢**
  come valore valido per tutte le generazioni;
- che **il guardiano non assuma che ogni chiamata a pagamento verso l'esterno sia registrata**: la
  ricerca competitor esce verso un provider **senza lasciare traccia in `AiUsageLog`**. Se il modello di
  sicurezza di `crm-permessi-e-sicurezza` poggia sul registro come inventario delle uscite, è incompleto;
- che **nessuna si aspetti da questo agent una proposta di correzione**: osserva e segnala, e su una
  cosa da correggere si ferma.
- ⚠️ **Divergenza di forma da sciogliere, non un difetto di nessuna delle due.** La skill 3 ha ripiegato
  il context dentro `SKILL.md` («sarebbe testo duplicato pagato a ogni risveglio»); questa lo tiene
  separato in `[F00]` e ne impone la lettura per prima. **Il risultato pratico è quasi lo stesso** —
  `[F00]` finisce letto a ogni attivazione — quindi il risparmio della scelta separata è minore di
  quanto sembri, e in `SKILL.md` costa **una lettura di file in più**. Se il raccordo vuole una
  convenzione sola, **quella della skill 3 è la più economica**; qui non è stata cambiata perché la
  misura M7 è stata fatta su questa forma e cambiarla dopo invaliderebbe il numero.

**Cosa invecchia per primo.** ① **La tabella dei `functionName` in `[F01]`** — è dichiarata dentro il
documento stesso come **istantanea, non verità**, con l'istruzione di rienumerare i tre scarichi a
pagamento a ogni uso; è il pezzo costruito apposta per non invecchiare male. ② **I testi dei prompt
citati in `[F04:FAMILY_GRID]`**: il prompt è la cosa che cambia senza che cambi nient'altro, ed è
proprio uno dei cinque innesti che fanno scattare il collaudo. ③ **Il punto aperto sull'inferenza del
target**, che decade nel momento in cui Jacopo e Claudio decidono. ④ I numeri di riga citati nei blocchi
fonti — il simbolo nominato è il riferimento stabile, la riga una comodità.

**VERIFY-ON-FIELD aperti**, ordinati per momento di verifica:
*Alla prima installazione in Paperclip* — ① l'assenza di un tetto di caratteri sulla `description`;
② quali costrutti YAML accetta davvero il parser minimale (qui il frontmatter è elementare apposta).
*Alla configurazione dell'azienda / prima del primo collaudo* — ③ che **esistano** l'utenza CRM
dedicata del collaudatore e il tetto di **10 $/giorno** (il passo 2 della sequenza di preparazione è
scritto per **accorgersi** della loro assenza, non per darle per fatte); ④ il **fuso orario del server**,
che decide la finestra giornaliera del fusibile — conta se l'agent lavora di notte; ⑤ **dove gira la
seconda chiamata, quella che giudica**, a quale utenza è imputata e se compaia in un registro: una
chiamata di giudizio fuori dal CRM è **fuori dal fusibile** `[NOT-FOUND]`.
*Alla scrittura di `npm run tocca-ai`* — ⑥ il suo contratto d'uscita (codice di ritorno o risposta
stampata) e se dichiari **quale** innesto è scattato: se lo dichiara, la preparazione della run si può
restringere alla generazione toccata invece che all'intera famiglia.
*Al primo compito reale che li tocchi* — ⑦ se **altre generazioni oltre a quella Excel** ingoino gli
errori del motore (solo quella è stata letta per intero); ⑧ i **contratti della chat**, che sono
assemblati per ambito e non scritti come una stringa letterale; ⑨ il **costo reale** di
`reporting.excelMapping` e della ricerca competitor `[NOT-FOUND]`; ⑩ che gli **embedding erodano
davvero** il margine di budget delle generazioni — è un'inferenza da due fatti letti separatamente, non
una misura.

---

## 4. Il raccordo — cosa confrontare fra le quattro

Questa è la parte che **nessuno ha ancora fatto**, per costruzione: le quattro sessioni non si sono
viste. Sotto, cosa guardare e perché.

### 4.1 Le convenzioni che devono coincidere

| Cosa | Perché conta |
|---|---|
| **La tabella dei cancelli** 🟢🟡🔴 | Se due skill la declinano diversamente, due agent classificano lo stesso atto in modo diverso. La commessa lo vietava esplicitamente: coerenti con il piano §3.2, **nessuna tabella propria** |
| **Il formato del parcheggio a cinque punti** | È l'unico canale con cui un agent non presidiato chiede una decisione. Se una skill lo semplifica, quelle richieste arrivano non istruite |
| **La lingua dell'output** | Tutte devono scrivere **in italiano** dentro Paperclip. Una skill che lascia l'inglese produce una bacheca bilingue |
| **Le condizioni di chiamata dell'esploratore** | Sono citate verbatim apposta, per applicarsi senza interpretazione. Vanno confrontate parola per parola |
| **Come si cita una nota operativa / una regola del CRM** | Il piano prevede la citazione **per numero**, perché è ciò che rende contabile se una nota è servita |

### 4.2 I confini che devono combaciare

Ogni skill dichiara un perimetro negativo. Verifica che **non ci siano zone scoperte e zone doppie**:

- **Chi decide se serve il guardiano su un compito?** Il capocantiere lo attacca come stadio; il
  guardiano ha una propria idea di quando entra? Se le due condizioni divergono, o entra sempre o non
  entra mai.
- **Chi possiede la regola «il permesso nasce col pezzo di CRM» (①/①-bis)?** È citata dalla
  pianificazione come vincolo da scrivere nel compito, e presumibilmente posseduta da
  `crm-permessi-e-sicurezza`. Devono dire la **stessa** cosa, e una sola deve essere la fonte.
- **Chi decide che una modifica «tocca l'AI»?** Deve essere lo script deterministico, e l'asimmetria
  (si può aggiungere, non togliere) deve comparire uguale in entrambe le skill che la nominano.
- **Chi tocca i file fuori norma?** La pianificazione dichiara di non pescarli mai di iniziativa; il
  frontend ha una propria regola sulle soglie. Le due non devono legittimare eccezioni diverse.

### 4.3 Le contraddizioni da cercare attivamente

Non aspettare che saltino fuori: cercale.

1. **Due skill che descrivono lo stesso oggetto del CRM con dettagli diversi** (una catena di permessi,
   una soglia, un percorso di file). È il caso più probabile, perché ognuna ha letto il codice per
   conto proprio, in momenti diversi.
2. **Due skill che si rimandano a vicenda** («questo lo fa l'altro»), lasciando la cosa a nessuno.
3. **Una skill che riporta come vero qualcosa che il §2 ha corretto** — succede se una sessione ha
   chiuso prima che la correzione fosse scritta.
4. **Costo cumulato.** Ogni skill si paga **a ogni risveglio di ogni agent che ce l'ha**. Se un
   mestiere ne porta più d'una, guarda la somma dei corpi, non il singolo.

### 4.4 I VERIFY-ON-FIELD, da consolidare in una lista sola

Ogni skill porta i propri, in coda ai documenti. Molti si sovrappongono, e alcuni si verificano con lo
stesso gesto alla prima installazione reale. **Consolidali in un elenco unico e ordinato per momento
di verifica** (prima dell'installazione · alla configurazione dell'azienda · al primo compito reale):
è materiale direttamente utile a chi accenderà Paperclip.

---

## 5. Il documento che ci restituisci

Se dall'analisi del §4 esce qualcosa, scrivi **un solo documento** e daglielo a Jacopo, che lo
riporterà nel lab. Verrà eseguito lì, in una sessione unica, su una o tutte e quattro le skill.

**Nome suggerito:** `CORREZIONI-SKILL-<data>.md`, nella stessa cartella.

**Formato — una voce per correzione, e niente prosa attorno:**

```markdown
### C<n> — <titolo breve>
- **Skill:** <quale, o «tutte e quattro»>
- **File e punto:** <nome file + anchor o sezione. Se vale per tutte, dillo per ognuna>
- **Cosa dice adesso:** <citazione testuale, non parafrasi>
- **Cosa dovrebbe dire:** <il testo nuovo, o il criterio se il testo va scritto nel lab>
- **Perché:** <la ragione, con la FONTE: file del CRM + sezione, o pagina della documentazione>
- **Gravità:** 🔴 produce un errore silenzioso · 🟡 incoerenza fra skill · ⚪ rifinitura
- **Se non si corregge:** <cosa succede in concreto>
```

**Tre regole per rendere le tue voci eseguibili:**

1. **Cita testualmente ciò che c'è adesso.** Chi corregge nel lab deve poter cercare la stringa.
2. **Porta la fonte.** «Mi sembra incoerente» non basta a modificare una skill; «il file X §Y dice
   Z» sì. Se non hai una fonte, scrivilo lo stesso ma marcalo come **da verificare** — è un'ipotesi,
   e va trattata come tale.
3. **Distingui l'incoerenza dal disaccordo.** Se due skill dicono cose diverse, è una correzione. Se
   una skill dice una cosa che tu avresti scritto diversamente, è un'opinione: mettila in fondo,
   separata, e dichiarala per quello che è.

**Se non esce niente, dillo esplicitamente**, elencando cosa hai confrontato. Un «ho verificato i
cinque punti del §4.1 e coincidono» vale, e chiude la partita.

---

## 6. La passata intermedia — 25 agosto 2026

### 6.1 Cos'è, e perché la trovi qui

Le quattro skill erano finite e consegnate. Rileggendo questo documento sono emerse cose che erano
**già errori accertati** — con fonte, con proprietario, e una perfino misurata — non ipotesi da
vagliare. Jacopo ha deciso di non consegnare il resoconto in quello stato, ma di fare prima una
passata di correzione nel lab, **in una sessione sola e con tutte e quattro le skill sotto gli
occhi**.

La ragione della sessione unica è la stessa che rende utile questo documento: le correzioni che
contano toccano **più skill insieme**, e se ognuna fosse stata corretta con parole proprie si sarebbe
ricreata esattamente la divergenza che la correzione doveva eliminare. **Una formulazione, applicata
identica ovunque serva.**

⭐ **La cosa più importante che è successa in questa passata non è una correzione: è una lettura.**
Le quattro sessioni di sviluppo hanno lavorato senza avere `piano-paperclip-2026-08-19.md` per
intero. In questa passata è stato letto tutto, insieme a `paperclip-quadro-insieme.html` e a
`note-operative-ai.md`. **Diverse domande che le schede del §3 pongono alle altre skill erano già
risposte dentro il piano**, e nessuno poteva saperlo. Le trovi qui sotto marcate ✅.

### 6.2 Come sono state sciolte le decisioni

Tre erano bloccanti — da come si sciolgono dipende *dove* va scritta una regola, non solo come.
Una quarta è emersa leggendo il quadro d'insieme.

| # | Decisione | Esito | Chi/cosa ha deciso |
|---|---|---|---|
| **D1** | Chi possiede la condizione d'ingresso del guardiano | **Il capocantiere.** `crm-pianificazione` `[R03:GUARDIAN_ENTRY]` tiene la lista canonica; `crm-permessi-e-sicurezza` la **cita verbatim** nel suo Step 0 e non ne conserva una propria | Jacopo, 25/8/2026 |
| **D2** | Forma del context: convenzione unica o divergenza | **Uniformata al context separato.** `crm-pianificazione` aveva il context ripiegato in `SKILL.md`; è stato estratto in `references/00_context.md` `[R00]`. Tutte e quattro ora hanno la stessa forma | Jacopo, 25/8/2026, **sostenuto dal piano §5.2**: *«`SKILL.md` corto, profondità in `references/`»* |
| **D3** | La sovrapposizione fra guardiano e `metodo-revisione` | **Non era una decisione: il piano l'aveva già presa.** Vedi §6.4 | il piano §1.2 |
| **D4** | Versionamento delle skill corrette | **Restano v1.0**, con la correzione registrata nei manifesti. Nessuna delle quattro è mai stata installata, quindi non c'è una versione in esercizio da sostituire: è una correzione **pre-installazione**, non una revisione | Jacopo, 25/8/2026 |

⚠️ **Su D4 c'è un motivo che vale la pena tenere a mente anche dopo.** *«Installare o sostituire una
skill»* è un **cancello rosso** (piano §3.2), perché aggiornare una skill aggiorna tutti gli agent
che ce l'hanno in un colpo solo. Finché le quattro non sono installate, correggerle costa zero. Dal
giorno dopo, ogni ritocco passa dal consiglio. **Questa è la finestra buona per sistemare le cose, e
si chiude all'installazione.**

### 6.3 Le correzioni eseguite

Quindici punti, tutti verificati contro una fonte nominata. La colonna «fonte» dice **perché** la
correzione è dovuta, non chi l'ha suggerita.

#### Su `crm-pianificazione` — 🧭 capocantiere

| # | Cosa | Dove | Fonte |
|---|---|---|---|
| 1 | Diventa **proprietaria della condizione d'ingresso del guardiano**, in una lista sola: permessi · ruoli · rotte · moduli · voci di menu · autenticazione · raggiungibile senza login · sicurezza | `[R03:GUARDIAN_ENTRY]` (nuovo) | D1. Le due skill ne avevano **due diverse**: qui mancavano *«rotte, moduli, voci di menu»*, là *«autenticazione, raggiungibile senza login»* |
| 2 | ⭐ Scritto **l'ordine degli stadi**: guardiano → revisore → collaudatore → cancello | `[R03:STAGE_ORDER]` (nuovo) | Piano §1.2, passi 5-8. **Non era scritto in nessuna delle quattro skill.** Ragione operativa: `maxReviewRounds` è **3** per default, e un revisore che gira prima del guardiano brucia un giro su lavoro che il guardiano rimanderà indietro comunque |
| 3 | **Context estratto** in `references/00_context.md` `[R00]` | `SKILL.md` (149 → 132 righe) | D2 + piano §5.2 |
| 4 | **File fuori norma**: i tre casi distinti | `[R05:OVERSIZE_READING]` (nuovo) · `[R02]` | T10 |
| 5 | Dichiarato il **ripiego per `npm run tocca-ai` assente**, con le stesse parole della skill 4 | `[R03:AI_TESTER_TRIGGER]` (nuovo) | T9 |

#### Su `crm-permessi-e-sicurezza` — 🛡️ guardiano

| # | Cosa | Dove | Fonte |
|---|---|---|---|
| 6 | Lo Step 0 **cita verbatim** la lista del capocantiere invece di tenerne una propria, con due regole asimmetriche: **non puoi esimerti** (se sei sveglio e vedi un innesco segnali, anche se lo stadio non era attaccato) e **non puoi allargarla da solo** (è un parcheggio al consiglio) | `SKILL.md` `[SKILL:PROCEDURE]` | D1 |
| 7 | `[F04:BOUNDARY_WITH_REVIEWER]` da **proposta Tier 3** a **regola citata, Tier 1** | `references/04_gate_compliance.md` | Piano §1.2 — vedi §6.4 |
| 8 | ⭐ Aggiunto il **sesto controllo a posteriori: la lista dei collegamenti dell'esploratore** | `[F04:EXPLORER_LIST]` (nuovo) | Piano §3.4 (condizione ⑥ di «fatto») e §2.2: *«la sua lista è quella che revisore **e guardiano** spunteranno dopo»*. I controlli erano cinque e **nessuno la nominava** |
| 15 | Citate **per numero** le note **#49**, **#50** e **#54**, che prima non comparivano mai | `[F01]` (due punti) · `[F04]` | Vedi §6.5 |

#### Su `crm-design-frontend` — 🎨 sviluppatore frontend

| # | Cosa | Dove | Fonte |
|---|---|---|---|
| 9 | `[F06:MODULE_ANATOMY]` nominava **una** lista di stringhe-permesso nel frontend. Sono **due**: aggiunta `CORE_PERMISSIONS` in `src/views/Profiles/Account/index.jsx` — il file dove vive la trappola del suffisso — con `MODULE_LABELS` e il fatto che `hasPermission` è un `Array.includes()`, quindi **un refuso sparisce senza errore** | `[F06:SECOND_PERMISSION_LIST]` (nuovo) | `_CONSEGNA-PAPERCLIP.md` §9.4. La sessione 2 l'aveva marcata «da eseguire nel lab» |
| 10 | **File fuori norma**: i tre casi distinti, con la nota che per questo mestiere **la riga di mezzo è la comune** (il frontend tocca file condivisi di continuo) | `[F07:OVERSIZE_READING]` (nuovo) | T10 |
| 11 | ✅ Chiuso il VERIFY-ON-FIELD marcato *«il più importante»* | `[F00]`, blocco «Sibling skills» | Vedi §6.5 |
| 12 | **Struttura della sorgente allineata**: i nove file di conoscenza stavano nella radice della cartella del lab mentre la copia consegnata li aveva già sotto `references/` | struttura | Nessun contenuto modificato |

#### Su `crm-collaudo-generazioni-ai` — 🧪 collaudatore AI

| # | Cosa | Dove | Fonte |
|---|---|---|---|
| 13 | Registrato che **il mestiere resta spento fino a dopo la release di settembre**, con le due conseguenze operative | `[F00:TRADE_NOT_YET_ON]` (nuovo) | Piano §12.6 F — vedi §6.5 |

### 6.4 D3: il piano aveva già tracciato la linea, e nessuno l'aveva letta

La scheda §3.1 dichiara `[F04:BOUNDARY_WITH_REVIEWER]` come **Tier 3, «una proposta ragionata, non una
regola citata»**, con la motivazione: *«nessuno dei due documenti sorgente traccia la linea»*.

**Non è vero, e la frase che la traccia è una sola:**

> *«Il guardiano controlla permessi e sicurezza, se il compito li tocca. **Il revisore controlla il
> resto.**»* — `piano-paperclip-2026-08-19.md` §1.2, passi 5 e 6.

Corroborata dalla scheda del revisore al §2.2, il cui elenco di *«cosa cerca»* ha **sei voci e la
sicurezza non c'è** — mentre in `.claude/agents/revisore.md` la sicurezza è il punto #6. Su Paperclip
la sicurezza si è spostata al guardiano, e il piano lo dice.

Quindi: la tabella di `[F04]` sale a **Tier 1 / HIGH**, e il suo VERIFY-ON-FIELD è stato **rimosso
perché falso**.

#### ⚠️ Ma la correzione che serve NON si fa nella skill generata — e questo tocca a te

`metodo-revisione` è una skill di **tipo B**: generata da uno script a partire da
`.claude/agents/revisore.md`. Il piano §5.3 dice perché, ed è una buona ragione:

> *«Generarle invece di scriverle rende impossibile la divergenza. La fonte resta una sola, la skill è
> una proiezione.»*

**Correggere la proiezione ricrea esattamente la divergenza che la generazione esiste per impedire.**
La correzione va fatta **alla fonte, prima che il generatore giri**:

> **In `.claude/agents/revisore.md`, l'errore #1 (la catena dei permessi) e il punto #6 (la sicurezza)
> vanno tolti al revisore e rimandati al guardiano.** Al revisore resta il *«resto»* che il piano gli
> assegna: collegamenti **non** legati ai permessi (rotte, client api, `RouteList.jsx`), migrazioni
> mancanti, generazioni AI che ripiegano in silenzio, colori scritti a mano, convenzioni, test.

⚠️ **Questo file non è stato toccato dal lab**, ed è deliberato: sta in `crmadv` fuori da
`paperclip/skills/`, e la regola della commessa è che dal lab si scrive **solo** lì. È un lavoro tuo,
o di Jacopo. **Finché non è fatto, la sovrapposizione è garantita**: il guardiano gira al passo 5 e il
revisore al 6, quindi il revisore rifarebbe un lavoro appena fatto — non è una rete di sicurezza, è
rumore doppio sulle stesse segnalazioni, che è il modo tipico in cui questo mestiere smette di essere
letto.

#### 💡 Proposta (non eseguita) — `metodo-revisione` è classificata male

Il piano §5.4 separa `metodo-*` (*«riutilizzabili ovunque»*) da `crm-*` (*«solo qui»*), e il §5.5
mette `metodo-revisione` fra le prime. Ma il file da cui verrà generata è **quasi tutto specifico di
questo CRM**: `server/auth/rbac-catalog.ts`, `SidebarMenu.jsx`, `MobileBottomNav.jsx`, le note #21,
#30 e #32, `npm run lint:colors`, `agency.service.ts` con le sue 10.000 righe.

Generata così, `metodo-revisione` sarebbe una skill `metodo-*` piena di contenuto `crm-*` — cioè la
separazione che il §5.4 fa *«da subito»* perché *«costa niente adesso, molto dopo»* nascerebbe già
violata.

**La forma che proponiamo, da valutare tu:** ciò che è metodo (quando chiamare il revisore, che non
si chiama su codice a metà, come si risponde, «non inventare rilievi per giustificare la chiamata»,
il non modificare niente) resta in `metodo-revisione`; ciò che è di questo CRM scende in
`crm-regole-codice` o va al guardiano. **È una proposta, non una correzione**: non abbiamo eseguito
niente, e la decisione è di chi possiede quei file.

### 6.5 Cose che il piano ha già risposto — e che le schede del §3 pongono ancora come domande

Le schede sono state scritte senza il piano completo. Queste righe **non vanno più cercate**: sono
chiuse.

| Domanda aperta in una scheda | Risposta, con la fonte |
|---|---|
| ⭐ Skill 2, VERIFY-ON-FIELD **n.1, marcato «il più importante»**: *«che lo sviluppatore frontend riceva davvero `crm-regole-codice` e `crm-note-operative»`* | ✅ **Sì, per entrambe.** Piano §5.5: `crm-regole-codice` → *«i due sviluppatori, revisore, guardiano»*; `crm-note-operative` → *«tutti, per mestiere»*. La scelta «rimanda, non duplicare» della skill 2 poggia su una regola scritta, non su una scommessa. **Sorpresa utile: `crm-regole-codice` arriva anche al guardiano** — cosa che la skill 1 non sapeva |
| Skill 2: *«che le condizioni di chiamata dell'esploratore arrivino da `crm-regole-codice»`* | ✅ Sì, per la riga sopra: le condizioni stanno in `CLAUDE.md`, da cui `crm-regole-codice` è generata, e la riceve |
| Skill 4: *«che il capocantiere applichi l'asimmetria con le stesse parole, e che il ripiego per script assente sia lo stesso»* | ✅ **Fatto** — punto 5. `crm-pianificazione` ora cita il ripiego verbatim, dichiarando la skill 4 proprietaria della regola |
| Skill 1: *«che sia il capocantiere a possedere la condizione di quando il guardiano entra»* | ✅ **Fatto** — punti 1 e 6 |
| Skill 1 e 3: *«che nessuna inventi una tabella di cancelli propria»* | ✅ Verificato: nessuna lo fa. Tutte rimandano al piano §3.2 e ne declinano i casi del proprio mestiere |
| Skill 1, 2, 3: *«che la regola sui file fuori norma valga uguale»* | ✅ **Fatto** — punti 4 e 10, con le stesse parole in tutte e tre |
| Il collaudatore AI è acceso? | ⚠️ **No, e va letto con attenzione** — vedi sotto |

⚠️ **Il punto su cui è facile sbagliare, e su cui questa passata si è corretta da sola.** Il §12.6 F
del piano dice: *«L'accensione resta dopo la release di settembre, alla riapertura della V5»*, e la
tabella §2.3 marca il mestiere `spento`. `_CONSEGNA-PAPERCLIP.md` §9.1 marca invece *«❌ Superato»* la
riga *«Nasce spento e si accende quando riapre la V5»* — e sembra dire il contrario. **Non lo dice:**
ciò che è superato è **il criterio di quando il collaudatore interviene** (non più «quando cambia la
V5» ma i cinque innesti nel diff), **non la data di accensione**. Le due affermazioni coesistono.

La skill 4 è giusta nel merito; semplicemente **il suo mestiere non parte con gli altri nove**, e
adesso lo dichiara → `[F00:TRADE_NOT_YET_ON]`.

### 6.6 Le note operative, e perché la skill 1 non ne citava nessuna

Il piano §5.2 costruisce il caricamento della conoscenza su tre livelli e dichiara la debolezza del
terzo: *«il livello 3 funziona se l'agent pensa a guardare»*. Gli argini sono due, e uno è la
**citazione per numero**, che il §5.7 rende contabile — *«si può contare quante volte una nota viene
citata»*, e una nota mai citata è inutile o scritta male.

Contate nelle quattro skill: `crm-design-frontend` **28**, `crm-collaudo-generazioni-ai` **7**,
`crm-pianificazione` **3**, `crm-permessi-e-sicurezza` **0**. Aperto
`archivio-documenti/note-operative-ai.md` in sola lettura, tre note stanno in pieno nel dominio del
guardiano, e ora sono citate:

- **#49** — *«Vale per qualsiasi mappa costruita a mano su valori che nascono altrove: etichette di
  stato, **permessi, chiavi di moduli**, nomi di funzione»*. È la forma generale degli anelli 4-6
  della catena. Ne è stata portata dentro anche la lezione che conta di più per un verdetto:
  *«un test che verifica il dizionario contro sé stesso passa sempre. La suite verde non dice niente
  sulla completezza di una mappa»* — quindi test verdi **non** sono prova che la catena sia completa.
- **#50** — `ensureRbacCatalog` gira **dentro** `ensureWorkspaceSystemRoles`, chiamata a ogni
  `/auth/me`: leggere prima il database mostra i valori **vecchi**, ed è **normale**. Senza questa
  nota, un guardiano diligente segnala *«il permesso non arriva a schermo»* su una lettura non
  sincronizzata — un falso allarme perfetto.
- **#54** — 18/8/2026: un giro di lavoro su schema, permessi e migrazioni chiuso *«senza nessuna
  revisione»*. Non è aneddotica: è **la forma esatta** di ciò che i controlli di conformità ai
  cancelli cercano, ed era già successo.

### 6.7 Cosa resta a te — la passata non l'ha toccato

Questa passata ha corretto ciò che le quattro sessioni avevano già scoperto **di sé stesse e delle
altre**, più ciò che il piano letto per intero ha reso decidibile. **Non sostituisce il §4.** Restano
interi, e sono il lavoro che nessuno ha potuto fare:

1. **Leggere le quattro skill vere, affiancate**, e cercare le contraddizioni che nessuna sessione
   poteva vedere → §4.3. Il punto 1 di quell'elenco — *«due skill che descrivono lo stesso oggetto
   del CRM con dettagli diversi»* — resta il più probabile, perché ognuna ha letto il codice per
   conto proprio in momenti diversi, e la passata ha allineato le **regole**, non ogni **dettaglio
   di codice**.
2. **Il consolidamento dei VERIFY-ON-FIELD in una lista sola** → §4.4. Uno solo è stato chiuso
   (§6.5); gli altri restano, e alcuni si verificano con lo stesso gesto alla prima installazione.
3. **Il costo cumulato** → §4.3 punto 4. La passata ha **aggiunto** testo a tre skill su quattro e
   ne ha tolto a una: se un mestiere ne porta più d'una, la somma dei corpi è cambiata.
4. **La correzione di `.claude/agents/revisore.md`** → §6.4. È l'unica cosa di questa passata che
   **doveva** essere fatta e non poteva esserlo da qui.

⚠️ **Un'ultima onestà, che vale per tutto il §6.** Le correzioni qui sopra sono **argomentate**, non
verificate sul campo: ognuna ha una fonte citata e una ragione, nessuna è stata provata con agent che
girano davvero su Paperclip. La misura M7 di ciascuna skill è **anteriore** a queste correzioni e non
è stata rifatta — rimisurare dopo aver aggiustato produce un numero che misura l'adattamento
all'eval, non la skill. La prova vera arriva quando gli agent gireranno.

---

## 7. Come funziona Paperclip davvero — le correzioni al piano tecnico

### 7.1 Perché questa sezione esiste, e come va usata

Il piano `piano-paperclip-2026-08-19.md` è stato scritto **confrontando la documentazione di Paperclip
con il metodo di lavoro del progetto**, ed è accurato su quasi tutto. Ma è del 19 agosto, e su alcuni
punti descrive **la traduzione desiderata** — come vorremmo che il lavoro fosse organizzato — in una
forma che sembra descrivere **il modello della piattaforma**. Sono due cose diverse, e quando si passa
a costruire davvero la differenza si paga.

Nel lab, prima di scrivere le skill, la ricerca è stata rifatta sulle fonti primarie: la
documentazione ufficiale (`docs.paperclip.ing`), il riferimento API, il sorgente su GitHub e le skill
di serie. Lo standard del lab impone alla ricerca di **falsificare le premesse del committente**, non
di confermarle. **Cinque premesse date per buone sono risultate false o incomplete**, e sotto ci sono
per intero, con il dettaglio tecnico che il §2 comprime in una riga di tabella.

**Come leggerla:**

- Il **§2** dice *che cosa* è cambiato, in una riga per voce (T1-T11). **Questo §7 dice perché, con i
  nomi dei campi, gli enum, gli endpoint e il grado di confidenza.** Se devi configurare l'azienda,
  questo è il capitolo che ti serve; se ti basta sapere cosa non fidarti, basta il §2.
- **Tier 1** = documentazione ufficiale o sorgente, letti di prima mano. **Tier 2** = fonte secondaria
  che riassume il sorgente. La confidenza è **HIGH / MEDIUM / LOW** e non è decorativa: dove è MEDIUM
  c'è un VERIFY-ON-FIELD, elencato al §7.7.
- ⚠️ **Data della ricerca: 24 agosto 2026.** Il piano stesso, al rischio 6, avverte che Paperclip è
  nato a marzo 2026 e che sono attese **migrazioni di schema a ogni aggiornamento**. Un enum o un
  nome di campo qui sotto è vero a quella data. **Il criterio resta quello del §0.3: se quello che
  vedi tu oggi diverge, vince quello che vedi tu.**

### 7.2 Le cinque premesse rovesciate

#### ① La gerarchia degli oggetti — ❌ **falsa**

> Il piano §8.2 traduce il lavoro in **Iniziativa → Progetto → Traguardo → Compito → Sotto-compito**.

Il modello reale della piattaforma è **Goal → Project → Issue** (la catena completa, citata
testualmente nella guida ai goal, è *«Goal → Project → Issue → Execution workspace → Agent run»*), e i
sotto-compiti si ottengono con **`parentId` sulla issue**.

**`[ABSENT-VERIFIED]` — non esistono oggetti «iniziativa», «epic» o «traguardo/milestone».** Protocollo
dell'assenza eseguito su tre vie: *(sinonimo)* ricerca mirata su initiative / epic / milestone, nessun
oggetto; *(schema)* `POST /api/companies/{companyId}/goals` espone solo
`title` · `description` · `level` · `status` · `parentId` · `ownerAgentId`, e `/projects` solo
`name` · `status` · `goalIds` · `leadAgentId` · `targetDate` · `env` · …; *(indice)* la sezione
*Projects & Workflow* della documentazione contiene projects · goals · routines · workspaces, e nessuna
pagina «initiatives». **Confidenza HIGH.**

→ **Conseguenza operativa:** i due livelli mancanti si ottengono con **goal annidati** — `parentId` più
il campo `level`, il cui enum è **`company` · `team` · `agent` · `task`** (default `task`). Non c'è
niente da inventare e niente da simulare in prosa: c'è un campo.

#### ② La scadenza di 12 ore del cancello giallo — ❌ **falsa come premessa tecnica**

> Il piano §3.2 la scrive in una forma che si legge come un comportamento della piattaforma:
> *«Trascorse senza risposta, l'agent procede con l'opzione raccomandata»*.

Resta **verissima come regola aziendale**. Ma negli approvals di Paperclip **`[ABSENT-VERIFIED]` non
risulta alcun campo di scadenza, auto-approvazione o escalation**: il corpo di creazione è
`type` · `payload` · `requestedByAgentId` · `issueIds`, e il record contiene
`type` · `status` · `payload` · `requestedBy*` · `decisionNote` · `decidedByUserId` · `decidedAt`.
Protocollo: *(schema)* riferimento API approvals; *(indice)* nessuna pagina di escalation o timeout
nella sezione approvals; *(sinonimo)* ricerca su auto-approve / timeout / expiry. **Confidenza
MEDIUM** → VERIFY-ON-FIELD.

⚠️ **Un timeout esiste, ma è un'altra cosa e non ci si appoggia niente.** Un timeout di **60 minuti**
emerge in materiale di livello community e riguarda le **conferme a livello di strumento**
(`request_confirmation` / `PAPERCLIP_APPROVAL_ID`), **non** le approvazioni di governo. Non è stato
confermato sulla pagina ufficiale: resta `[VERIFY]`, e da lì non si deriva nulla.

→ **Conseguenza pesante, ed è la più insidiosa di tutta questa sezione:** allo scadere delle 12 ore
**non succede niente**, e non c'è un errore da nessuna parte. È **disciplina che l'agent esegue da
sé** — scadenza scritta come orario assoluto dentro il compito, ricontrollata a ogni risveglio. Se
nessuno la ricontrolla, **il giallo diventa un rosso mascherato**: si ferma per sempre, in silenzio.
Se configurando l'azienda non prevedi chi ricontrolla le scadenze, quella riga del piano non esiste.

#### ③ Le dipendenze raccontate nella descrizione — ❌ **falsa**

Esiste un campo di prima classe **`blockedByIssueIds`** (più `blocks`, la relazione inversa), e il dato
che decide tutto è questo:

> *«Wakes fire when all blockers reach `done`»* — i bloccanti **guidano i risvegli**.

I bloccanti **annullati non contano come risolti**; le catene circolari sono rifiutate; **l'array
sostituisce l'insieme** a ogni scrittura, non ci si aggiunge. La skill di serie lo dice in una riga:
*«use blockers over prose descriptions»*. Tier 1 / HIGH.

⚠️ **La trappola più facile per chi pianifica**, dalla skill di serie Task Planning: *«parent/child
nesting alone does not block execution»*. **Annidare un sotto-compito sotto il padre NON lo blocca.**
Chi si aspetta che i figli aspettino il padre scopre gli agent che lavorano tutti insieme, in ordine
sbagliato, senza che niente segnali un problema. I figli paralleli, dice la stessa fonte, vanno
dichiarati esplicitamente `blockers: none`.

→ **Conseguenza:** l'ordine di lavorazione della release va **codificato, non descritto**. Un ordine
scritto benissimo nella descrizione di un compito non sveglia nessuno.

#### ④ «Paperclip non dà niente sulla pianificazione» — ⚠️ **incompleta**

Vero che **non produce conoscenza di dominio** (piano §5.1, e la ricerca lo conferma). Ma fornisce
skill di serie che insegnano il **craft generico**, e sono già lì:

- **Task Planning** (`paperclip-operations`) — *«One child issue, one specialty»* · *«One child issue,
  one acceptance verdict. If a reviewer would say "this is half done", split it»* · *«Order children by
  real blocker chains»* · *«Encode every hard dependency as `blockedByIssueIds`»* · il figlio dev'essere
  comprensibile **senza rileggere il padre** · e il piano si salva come documento `plan` sulla issue.
  Dice anche quando **non** usarla: *«The issue is a single small change you can ship in the same
  heartbeat. Just ship it.»*
- **`paperclip-converting-plans-to-tasks`**, **Issue Triage** (*«classify stale, blocked, in-review, or
  stalled issues and choose the next action»*) e **QA Acceptance** (*«define observable acceptance
  criteria»*).

Sono **non modificabili né cancellabili** e si ricreano a ogni reinstallazione. Tier 1 / HIGH.

→ **Conseguenza sul perimetro, e vale per tutte e quattro le nostre skill:** ciò che scriviamo noi è il
**delta di questo CRM**, non la copertura totale del mestiere. Ripetere il craft generico si paga a
ogni risveglio di ogni agent che porta la skill, e non aggiunge niente.

#### ⑤ «Un agent in dubbio può sempre fermarsi e chiedere» — ⚠️ **in conflitto con la piattaforma**

La skill base di Paperclip contiene la **Critical Rule #1**:

> *«NEVER ASK A HUMAN TO DO WHAT AN AGENT COULD DO. If you need to escalate, escalate. If you could ask
> your CEO to do it, then you do that — don't hand it back to a human.»*

I cancelli del CRM sono un'**eccezione deliberata** a quella regola, e **vanno riconciliati per
iscritto dentro ogni skill che prevede un cancello**. Altrimenti un agent che legge entrambe le skill
risolve il conflitto da sé — e lo risolve male, in silenzio, alle tre di notte, perché prevale quella
che ha letto per ultima.

→ **La forma corretta della riconciliazione**, ed è quella adottata nelle quattro skill: la regola di
Paperclip vieta di **delegare la difficoltà**; i cancelli vietano di **usurpare l'autorità**. Il
criterio che li separa è quello del piano §3.1 — *«ci si ferma quando la decisione è vostra, non perché
la cosa è importante»*.

### 7.3 Il modello degli oggetti, per intero

Tutto Tier 1 dal riferimento API e dalle guide, salvo dove indicato.

| Oggetto | Cos'è, testualmente | Campi alla creazione | Enum |
|---|---|---|---|
| **Goal** | *«an outcome statement — a description of something the company is trying to achieve»* | `title` (obbl.) · `description` · `level` · `status` · `parentId` · `ownerAgentId` | `level`: **company · team · agent · task** (def. `task`) · `status`: **planned · active · achieved · cancelled** (def. `planned`) |
| **Project** | *«the container Paperclip uses to group related work… If goals answer "why are we doing this?" and issues answer "what exactly needs doing?", projects sit in between»* | `name` · `description` · `status` · `goalIds` · `leadAgentId` · `targetDate` · `env` · `executionWorkspacePolicy` · `archivedAt` · `workspace` | `status`: **backlog · planned · in_progress · completed · cancelled** (def. `backlog`) |
| **Issue** | *«a discrete unit of work — something an agent picks up, executes, and completes»*; *«Every issue in Paperclip lives under a project»* | `title` (obbl.) · `description` · `status` · `priority` · `projectId` · `goalId` · `parentId` · `blockedByIssueIds` · `labelIds` · `executionPolicy` · `executionWorkspaceId` · `assigneeAgentId` · `assigneeUserId` | `status`: **backlog · todo · in_progress · in_review · blocked · done · cancelled** |

**Un progetto lega il lavoro a un repository e a un budget.** Il ciclo della issue è
Backlog → Todo → In Progress → In Review → Done (terminale); da qualunque stato si può andare in
Blocked e tornare, oppure in Cancelled (terminale).

**Nella risposta** la issue porta anche: un `identifier` leggibile (es. `PAP-39`), `blocks` (l'inverso
dei bloccanti), `ancestors` (la catena dei padri), `checkoutRunId`, `completedAt`, `cancelledAt`.
Etichette: *«free-form company-scoped labels with a colour»*. **Allegati:**
`POST /api/companies/{companyId}/issues/{issueId}/attachments` — è lì che finiscono gli screenshot del
collaudatore, non in un messaggio di chat.

**Assegnatario:** *«An agent or a user»*, e — dato che conta per la contesa —
*«Only one agent can hold an issue "in progress" at a time»*, garantito dal database.

⚠️ **Due punti a confidenza MEDIUM, non HIGH:**
- **Le chiavi esatte di `priority`.** La guida descrive quattro livelli con la loro semantica
  (*Critical: «Blocking work; must be done immediately»* · *High: «Important this week»* · *Medium:
  «Normal workload»* · *Low: «Nice to have; do when nothing else is waiting»*), ma il riferimento API
  mostra esplicitamente solo `medium` (default) e `high`. La **semantica** è HIGH, **l'elenco delle
  chiavi** è MEDIUM.
- **`goalId` sulla issue.** La guida dice che le issue *non* si legano direttamente ai goal ma
  ereditano il legame dal progetto; l'API di creazione espone però un campo `goalId`, e la skill di
  serie dice di impostarlo **sempre** sui sotto-compiti. Si segue l'API, che è più specifica, ma il
  punto resta MEDIUM.

### 7.4 Dove vivono davvero i cancelli — l'execution policy

Questo è il punto in cui una catena di accettazione smette di essere prosa e diventa un meccanismo:

> *«the **runtime enforces** review and approval stages automatically — the moment an executor tries to
> close the issue, the runtime intercepts the transition and routes the work to the right reviewer or
> approver»*

Si imposta **sulla singola issue**, campo `executionPolicy`, alla creazione o in PATCH. Modello:

- `mode: "normal" | "auto"` · `commentRequired: boolean` · `stages: IssueExecutionStage[]` ·
  `maxReviewRounds?` (1-50, **default 3**);
- ogni stage: `id` · `type: "review" | "approval"` · `approvalsNeeded` · `participants[]`, con
  `type: "agent" | "user"` più `agentId` / `userId`.

⚠️ **`[ABSENT-VERIFIED]` — la policy non parla di git.** Nessuna copertura di unione dei rami, nessun
revisore obbligatorio in stile GitHub: instrada **solo dentro Paperclip**. Protocollo: *(schema)* i
campi elencati sopra sono l'intera interfaccia; *(indice)* la sezione *Power Features* contiene
execution-policy, import/export e terminale; *(sinonimo)* la pagina non nomina merge o branch
protection. **Confidenza MEDIUM** → VERIFY-ON-FIELD.

→ **Conseguenza da mettere in conto quando accendi l'azienda:** *«un compito, un ramo, un'unione»* e il
divieto di unire a `main` **reggono perché gli agent obbediscono, non perché la piattaforma lo
impedisca**. Gli argini veri sono altrove — `main` protetto lato repository, un ramo per lavoro,
revisione obbligatoria — e il piano stesso li mette fra le cose da fare **prima del primo compito**
(rischio 7).

**Le approvazioni — la forma tecnica del parcheggio.** Tipi (enum): **`hire_agent` ·
`approve_ceo_strategy` · `budget_override_required` · `request_board_approval`**. Stati: **`pending` ·
`revision_requested` · `approved` · `rejected`**. Endpoint di decisione: approve · reject ·
**request-revision** · resubmit, tutti con `decisionNote`. Creazione: `type` (obbl.) · **`payload`
(JSON libero, obbligatorio)** · `requestedByAgentId` · **`issueIds`**.

→ Il parcheggio a cinque punti del CRM è un **`request_board_approval`** con il testo nel `payload`
libero e i compiti bloccati in `issueIds`. Dopo la decisione, *«Paperclip queues the requester to wake
automatically»*: non serve che qualcuno vada a ripescare chi aspettava.

⭐ **Un regalo della piattaforma che il piano non sfrutta:** *«The CEO cannot move tasks to "in
progress" until you approve its strategy»*. È la versione di piattaforma della regola
**«pianificazione ≠ via libera al codice»** (piano §6-F): esiste già, non va costruita.

### 7.5 Come si sveglia un agent, e come si carica una skill

**I quattro modi di svegliare un agent:** timer (il battito), assegnazione o commento su un compito,
«wake now» manuale, routine automatica. **Solo il timer sveglia senza lavoro vero** — gli agent girano
*«because there's something to do, not in case there's something to do»*. Il **battito è spento per
impostazione predefinita** ed è un'adesione volontaria.

**Il protocollo del risveglio**, in sintesi (Tier 1 / **MEDIUM** sui nomi esatti degli endpoint):
recupero identità da `/api/agents/me`; recupero assegnazioni via
`GET /api/companies/{companyId}/issues?assigneeAgentId=…&status=todo,in_progress`; priorità
`in_progress` → `in_review` → `todo`; **checkout del compito prima di lavorare** — *«Always checkout
before working — never PATCH to in_progress manually»* — e aggiornamento di stato con l'intestazione
del run.

**Le routine**, che il piano nomina poco: *«a reusable job definition with a trigger attached to it»*.
Inneschi: **cron nel fuso orario** oppure **webhook firmato**. Portano assegnazione (agent + progetto),
istruzioni come modello markdown, variabili `{{nome}}`, priorità. Politiche di concorrenza
(*coalesce* / *skip* / *always enqueue*) e di recupero (*skip missed* / *catch up in capped batches*),
con default **coalesce if active, skip missed**.

**Il formato di una skill.** Cartella con `SKILL.md` alla radice più `references/`, `scripts/`,
`assets/` opzionali. Frontmatter YAML: `name` (*«Human-readable label. Falls back to the slug when
missing»*), `description` (*«The routing logic the agent reads first»*), `slug` (opzionale, kebab-case,
**derivato dal `name`**), `key`/`skillKey`, `metadata`.

- ⚠️ **Il frontmatter è letto da un parser YAML minimale proprio di Paperclip** — scalari piatti,
  oggetti annidati e liste letterali, **non** la grammatica YAML completa. Tier 2 / **MEDIUM**:
  asserito da una fonte secondaria che legge il sorgente, non verificato sul file. *Conseguenza
  adottata nelle quattro skill: frontmatter elementare, per scelta.* I blocchi scalari `>` e `|` nella
  `description` sono invece supportati, Tier 1 / HIGH.
- ⭐ **Il livello di fiducia di una skill è il massimo della sua inventory:** `references/` = solo
  markdown · `scripts/` = eseguibili · `assets/` = risorse, con
  `markdown_only` < `assets` < `scripts_executables`. **Perciò nessuna delle quattro skill contiene
  cartelle `scripts/` o `assets/` vuote «per completezza»:** alzerebbero il livello di fiducia
  richiesto per installarla senza dare niente in cambio.
- ⭐ **Il `name` non va versionato.** Lo `slug` si deriva dal `name`: chiamare una skill
  `crm-permessi-e-sicurezza-v1.1` creerebbe una skill **nuova** nella libreria invece di sostituire
  quella esistente. La versione vive in intestazione e piè di pagina dei file. *(E sostituire una skill
  è un cancello rosso: aggiorna tutti gli agent che ce l'hanno in un colpo solo.)*
- **Nessun limite di lunghezza sul corpo, ma il corpo si carica per intero:** *«There is no length
  limit, but the agent loads the entire body into context once it decides the skill is relevant — keep
  it short and put long material in supporting files»*.
- **`[ABSENT-VERIFIED]` — non risulta alcun tetto di caratteri sul campo `description`.** Protocollo:
  *(sinonimo)* ricerca su length limit / constraints / max characters nella reference delle skill — il
  limite è dichiarato solo per il corpo, e in forma negativa; *(schema)* lettura di
  `packages/shared/src/validators/company-skill.ts` nel repository: `description` è
  `z.string().nullable()`, **senza `.max()`**, e gli unici `max` presenti sono `tagline` (120) e il
  vincolo di riga singola sul `name`; *(indice)* enumerazione delle pagine
  reference/skills, reference/skills/bundled, reference/skills/optional, guides/org/skills — nessuna
  menziona un tetto. **Confidenza MEDIUM** (lo schema è stato letto per estrazione, non riga per riga)
  → VERIFY-ON-FIELD.
  ⚠️ **Da non confondere col limite di 1024 caratteri del caricatore dell'account Claude**, che è di
  **un'altra piattaforma** e non si applica qui. Le quattro `description` lo rispettano comunque,
  perché la misura M7 è stata fatta su quel caricatore.

**L'instradamento — il meccanismo che regge tutta l'economia della conoscenza.** La `description` è la
logica di instradamento, **letta per prima**, e il corpo si carica **solo se combacia**:
*«An agent with 10 skills doesn't load all 10 into its context on every heartbeat — it only loads the
ones that are relevant to the current task»*. La forma raccomandata è **decisionale e con l'esclusione
esplicita**; l'esempio della documentazione è *«Use when asked to review a pull request or code diff.
Don't use when writing new code from scratch.»*

→ **Conseguenza adottata:** tutte e quattro le `description` hanno un ramo «usa quando» **e** un ramo
«non usare quando». È anche il motivo per cui il ramo negativo non va tagliato per accorciare: è metà
del meccanismo di instradamento, non una nota di cortesia.

**Le skill vivono a livello di azienda**, non dentro il singolo agent: si assegnano dalla scheda Skills
dell'agent, e *«The agent will pick up the new skill list on its next run»*.

### 7.6 Le assenze verificate — cosa NON regge, in un elenco solo

Sono le quattro affermazioni di **assenza** su cui poggiano decisioni di progetto. Ognuna ha avuto il
protocollo eseguito su tre vie; nessuna è un «non l'ho trovato».

| Assenza | Confidenza | Cosa NON puoi dare per fatto |
|---|---|---|
| Non esistono oggetti iniziativa / epic / milestone | **HIGH** | Che i traguardi della release abbiano un oggetto proprio. Si fanno con goal annidati |
| Nessuna scadenza, auto-approvazione o escalation sulle approvazioni | **MEDIUM** | Che un giallo si sblocchi da solo dopo 12 ore. **Non succede niente** |
| L'execution policy non copre git | **MEDIUM** | Che la piattaforma impedisca a un agent di unire a `main`. Non lo impedisce |
| Nessun tetto di caratteri sulla `description` di una skill | **MEDIUM** | — (è un'assenza che *libera*, non che vincola: se sbagliata, l'installazione fallisce e ce ne accorgiamo subito) |

### 7.7 Cosa va riconfermato sull'installazione reale

Tutto quello che sopra è **MEDIUM**, più i nomi degli endpoint. In ordine di quando diventa
verificabile:

**Alla prima installazione di una skill**
1. Che l'assenza del tetto sulla `description` regga davvero (se l'installazione fallisse con un
   errore di validazione, il claim cade).
2. Quali costrutti YAML accetta davvero il parser minimale — il frontmatter delle quattro skill è
   stato tenuto elementare apposta, quindi il rischio è basso, ma va guardato.

**Alla configurazione dell'azienda**
3. I nomi e la forma esatti degli endpoint del protocollo del battito, prima di citarli in una skill.
4. Le chiavi esatte dell'enum `priority` oltre `medium` e `high`.
5. Se `goalId` sulla issue si comporta come dice l'API o come dice la guida.

**Prima del primo compito reale**
6. L'assenza di scadenza sulle approvazioni — è la più importante da riconfermare, perché è quella su
   cui poggia una regola aziendale intera.
7. Che l'execution policy non tocchi git, e quindi che gli argini lato repository siano stati messi.

---

## 8. Esito delle correzioni C1-C6 — 25 agosto 2026, secondo giro

> **Chi scrive:** la sessione del lab, eseguendo la **Parte 1** di `CORREZIONI-SKILL-2026-08-25.md`.
> **A chi parla:** alla sessione che lavora in `crmadv` e ha prodotto quel documento — c'è **una
> proposta da vagliare** al §8.4, che è il motivo per cui questa sezione arriva subito invece che a
> lavoro chiuso.

### 8.1 In una riga

**Cinque correzioni su sei eseguite** (C1, C2, C4, C5, C6), tutte verificate, entrambi gli script
meccanici verdi su tutte e quattro le skill. **C3 non eseguita**: è la voce che il documento stesso
marca come *«l'unica per cui "no" è una risposta ragionevole»*, e misurandone il costo è emerso un
dato che cambia la valutazione → §8.4.

Le skill restano **v1.0**, con la correzione registrata nei manifesti: stessa logica della decisione
D4 del §6.2 — nessuna delle quattro è mai stata installata, quindi è una correzione
**pre-installazione**, non una revisione.

### 8.2 Le quattro verifiche della Parte 2 — eseguite prima di toccare C4-C6

C4, C5 e C6 esistono solo perché i tre lavori della Parte 2 sono stati fatti; il documento chiede di
accertarlo prima di eseguirle, e di fermarsi a C1-C3 se anche una sola non torna. **Tutte e quattro
tornano**, lette in sola lettura:

| Verifica | Esito |
|---|---|
| `.claude/agents/revisore.md` → *«Permessi e sicurezza sono del guardiano»* | ✅ riga 50 |
| `note-operative-ai.md` → *«Correzione del 25/8/2026»* | ✅ riga 200 |
| `note-operative-ai.md` → `## 56.` | ✅ riga 832 |
| `design-linguaggio-apple-web.md` → *«Corretto il 25/8/2026»* | ✅ riga 130 |

### 8.3 Cosa è cambiato, voce per voce

| Voce | Skill · file | Cosa è stato fatto |
|---|---|---|
| **C1** 🟡 | `crm-collaudo-generazioni-ai` · `05_reporting-and-gates.md` `[F05:PARKING_FORMAT]` | I cinque punti diventano un **blocco da copiare in italiano**, con le stesse intestazioni delle altre tre skill. Aggiunta la riga che dichiara che **le glosse inglesi non fanno parte di ciò che si scrive**: è il punto in cui l'ambiguità nasceva, perché la skill imponeva l'italiano e poi dava un modello inglese da copiare |
| **C2** 🟡 | `crm-permessi-e-sicurezza` · `05_reporting_cases.md` PART 1 | Percorsi e righe dell'esempio sostituiti da **segnaposto** (`percorso/file.jsx:NN`, `<modulo>`, `<Voce>`). La dichiarazione «è un'illustrazione, non una segnalazione vera» **spostata immediatamente sopra l'esempio**; quella in fondo resta e dice esplicitamente che è stata spostata e perché. Aggiunto cosa l'esempio insegna: **la forma** (ordine di gravità, frase singola, conseguenza concreta, dubbio dichiarato), non il contenuto |
| **C4** 🟡 | `crm-permessi-e-sicurezza` · `04_gate_compliance.md` | Il ⚠️ sulla sovrapposizione diventa ✅ **allineato il 25/8/2026**, con le due finezze dell'esecuzione trasferite dentro la skill: numerazione degli errori intatta (#6 svuotato, non rimosso) e **divisione trascritta da questa stessa tabella**, con l'avvertenza che cambiarne una riga senza dirlo riaprirebbe la divergenza. Primo elemento del VERIFY **rimosso**; al suo posto ciò che resta aperto davvero. Aggiunta una riga al blocco fonti. ⚠️ **Tabella righe 233-245: non toccata**, come chiesto |
| **C5** ⚪ | `crm-design-frontend` · `02_tokens_and_themes.md` | Aggiornati **due** punti, non uno: il passaggio didattico del protocollo dell'assenza (dove la nota era descritta come «stale») **e** il blocco SOURCE_NOTES |
| **C6** ⚪ | `crm-design-frontend` · `01_design_compass.md` VERIFY · `04_dense_lists.md` `[F04:COLLAPSIBLE_SECTION]` | Divergenza al passato con la data, in **entrambi** i punti che la citavano. Il secondo — dentro `04_dense_lists.md` — non era nominato nel documento di correzioni: diceva ancora *«§3.4 **still** describes it as…»* |

**Le tre lezioni che le voci chiedevano di non perdere: non perse.** In C5 e C6 le due voci lo chiedono
esplicitamente, e perdere la regola per aver sistemato l'esempio sarebbe stata la correzione sbagliata:

- *«Operating note #14's list of uncovered cases should be treated as a lead, not as a finding»* —
  **resta**, e ora dice a chiare lettere che **una sola** voce è stata verificata e le altre no;
- *«quando documento e codice divergono, vince il codice, e la divergenza si segnala invece di
  correggere il documento»* (`[F00:SKILL_LEVEL_ERRORS]`) — **resta**, e la correzione alla fonte della
  nota #14 è ora citata come **l'esempio di come si chiude bene** (alla fonte, perché
  `crm-note-operative` è generata da lì e il piano §5.5 la dà a tutti gli agent);
- *«treat every implementation detail in the compass as a claim to check against the code, not as a
  specification»* — **resta**, con l'aggiunta che una divergenza trovata e chiusa **non è prova** che
  le altre siano state controllate.

**Self-check:** `verify-cross-references.sh` ✅ e `verify-negative-claims.sh` ✅ su tutte e quattro.

### 8.4 ⚠️ C3 — non eseguita, e il costo è diverso da come era stato stimato

La voce dice: *«ogni rinomina di file trascina i rimandi `[Rnn]`/`[Fnn]` che li citano»*. **Misurato:
non è così.** Gli anchor sono **codici, non percorsi** (`[R05:GATES]`, `[F04:COLLAPSIBLE_SECTION]`):
una rinomina di file **non li tocca**. Trascina solo le stringhe che nominano il file.

**Il costo reale, contato:**

| Skill | File da rinominare | Occorrenze da correggere | Dove |
|---|---|---|---|
| `crm-collaudo-generazioni-ai` | 5 (trattino → trattino basso) | **15** | `SKILL.md`, `references/00_context.md`, `_MANIFESTO.md` |
| `crm-pianificazione` | 7 (trattino → trattino basso **e italiano → inglese**) | **7** | solo `_MANIFESTO.md` — la sua `SKILL.md` instrada per codice `[Rnn]`, mai per nome di file |
| `crm-permessi-e-sicurezza` · `crm-design-frontend` | 0 | 0 | già conformi |

**Due cose pesano più delle 22 stringhe, e sono la ragione per cui non l'ho eseguita d'ufficio:**

1. **Per `crm-pianificazione` non è una rinomina meccanica.** `01_fonti-del-lavoro` → *serve tradurre*:
   sono **sette decisioni di nomenclatura**, non un `mv`. Il documento di correzioni suggerisce la
   convenzione ma non i nomi, ed è giusto così.
2. ⚠️ **`CORREZIONI-SKILL-2026-08-25.md` cita quei nomi su 4 righe.** Rinominare oggi rende impreciso
   un documento consegnato ieri. *(Il `RESOCONTO-SVILUPPO-SKILL.md` invece non li cita mai: zero
   occorrenze. Non ne risente.)*

**La proposta del lab, da vagliare:** eseguire C3 **solo su `crm-collaudo-generazioni-ai`**. È
meccanica, 15 stringhe, nessuna traduzione da decidere, e porta a **tre skill su quattro** conformi
alla convenzione. Su `crm-pianificazione` lasciarla stare: il guadagno è cosmetico e il costo è sette
scelte di nomenclatura più l'imprecisione introdotta nel documento appena consegnato.

📌 **Se non sei d'accordo, dillo:** l'alternativa coerente è farle **entrambe** e accettare che le 4
righe del documento di correzioni vadano rilette, oppure **nessuna delle due** e chiudere la voce
dichiarandola scartata. Tutte e tre sono risposte legittime — la voce nasce marcata ⚪ e senza fonte
che imponga una convenzione.

### 8.5 Le altre due proposte ancora aperte, per non perderle

Non sono azioni di questa passata: sono cose che il §6 aveva lasciato aperte e su cui la Parte 5 del
documento di correzioni si è già pronunciata. Le ripeto qui solo perché stiano tutte in un posto.

| Proposta | Stato |
|---|---|
| **La classificazione di `metodo-revisione`** (§6.4): è `metodo-*` *«riutilizzabile ovunque»* ma verrebbe generata da un file quasi tutto specifico di questo CRM | ✅ **Approvata nel principio**, con la precisazione che conta: il generatore delle otto skill di tipo B **non esiste ancora**, quindi non c'è nessuna proiezione sbagliata in circolazione e la separazione si fa **quando si scrive il generatore**. Il passo urgente — togliere al revisore permessi e sicurezza — è già stato fatto (L1) |
| **I VERIFY-ON-FIELD consolidati** (§4.4 e §7.7) | ✅ **Fatti**: la Parte 3 di `CORREZIONI-SKILL-2026-08-25.md` li raccoglie dai 26 blocchi delle quattro skill, deduplicati e ordinati per quando diventano verificabili. È la lista da tenere aperta accanto a chi accende Paperclip |

---

## Appendice A — Regola di aggiornamento *(riguarda il lab, non chi legge in `crmadv`)*

Questo file è scritto da **quattro sessioni parallele**, quindi:

1. **Scrive una sessione alla volta**, solo la propria sezione del §3, le proprie righe nella tabella
   del §2, e la propria casella nella riga «Contributi ricevuti» in testa.
2. **Rileggi il file da disco prima di modificarlo.** Un'altra sessione potrebbe averlo appena
   aggiornato, e sovrascriverla cancellerebbe il suo lavoro.
3. **Non riscrivere le parti delle altre**, e non riscrivere §0, §1, §4 e §5 senza un ok esplicito di
   Jacopo: sono le parti condivise.
4. **Niente `commit` né `push`** senza ok esplicito di Jacopo.
5. **La consegna la dichiara Jacopo**, non una sessione: quando dirà che l'ultimo contributo è
   arrivato, il file si rinomina `RESOCONTO-SVILUPPO-SKILL.md` e si copia in
   `crmadv/paperclip/skills/`.

## Appendice B — Stampo delle schede del §3

Da riempire così, nello stesso ordine, per rendere le quattro schede confrontabili:

```markdown
### 3.x `<nome-skill>` — <emoji> <mestiere>

**Cosa contiene.** <SKILL.md + elenco dei reference con i loro codici e una riga a testa>
**Scopo.** <due righe>
**Perimetro negativo dichiarato.** <cosa la skill dichiara di NON coprire e NON fare>
**Meccanismi attivi.** <M1-M7: quali sì, quali no, e il perché delle esclusioni>
**Scelte di forma.** <notazione, lingua, come è risolto il context, eventuali modelli da copiare>
**Correzioni portate.** <rimando alle righe T del §2 + quelle specifiche, con la fonte>
**Esito dei controlli.** <M6: esito dei due script. M7: triggering e delta, con N e task usato>
**Difetti trovati dalla misura.** <se ce ne sono stati, e cosa si è corretto dopo — o «nessuno»>
**Cosa questa skill si aspetta dalle altre tre.** <il raccordo: assunzioni su chi possiede cosa>
**Cosa invecchia per primo.** <le parti legate a stati temporanei, es. la release di settembre>
**VERIFY-ON-FIELD aperti.** <elenco numerato, con quando si verificano>
```
