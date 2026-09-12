<!-- AMBITO-DOCUMENTO: consulenza-postazione-locale -->

> # ⛔ Questo documento non riguarda lo sviluppo del CRM
>
> **Vale solo per** le sessioni dell'assistente sul **PC Windows di Jacopo**, in ruolo di consulenza. **NON vale per** l'assistente che sviluppa dentro **Paperclip, sulla VPS**: se stai scrivendo codice o facendo commit su questo repository, **passa oltre** — non seguire, non applicare, non aggiornare, non citare.
>
> **Criterio meccanico:** Linux + VPS → ignora. Windows + `C:\Users\jacop\` → è per te. Spiegazione completa in `LEGGIMI.md`, in questa cartella.

---

# Note operative della postazione locale

Stesso formato del file condiviso `archivio-documenti/note-operative-ai.md` — *Contesto → Errore → Modo corretto* — ma **numerazione separata** (L1, L2, …), così due contesti che aggiungono voci in parallelo non si scontrano sullo stesso numero.

## ⚠️ Dove va una nota nuova: il test in una riga

Prima di scrivere una nota, la domanda è una sola:

> **Cambierebbe quello che fa un agent che sviluppa dentro Paperclip?**

- **Sì** → va nel file **condiviso** `note-operative-ai.md`, con la numerazione progressiva. Ci finisce tutto ciò che riguarda **il prodotto** (come si comporta il codice, cosa mente, dove sono le trappole) e tutto ciò che riguarda **le istruzioni scritte per Jacopo** — le guide di avvio le scrive Paperclip, quindi le regole su come si scrivono servono a lui.
- **No, ha senso solo su questa postazione** → resta **qui**, con la numerazione `L`. Ci finisce ciò che dipende da **dove giro io**: le due cartelle sul PC, il mio terminale, il fatto che ho accesso alla macchina di Jacopo, il modo in cui preparo i compiti da dargli in pasto.

Nel dubbio vale l'esempio concreto: la regola *«nei comandi per Jacopo niente `&&`»* è **condivisa** (la #67), perché Paperclip scrive guide per Windows. La constatazione *«io ci casco perché il mio terminale è Git Bash»* è **locale**, perché descrive me, non il progetto.

---

## L1. Perché ci casco: il mio terminale non è quello dell'utente

**Contesto:** 8/9/2026. Ho consegnato a Jacopo `npm run build && npm run preview`, che in Windows PowerShell 5.1 non parte.

**Errore:** **io lavoro con lo strumento Bash (Git Bash), dove `&&` funziona.** La forma bash è quella che mi viene naturale perché è quella che provo, e non è quella che l'utente esegue. Non è distrazione: è una differenza sistematica fra il mio ambiente e il suo, che si manifesta ogni volta che consegno un comando.

**Modo corretto:** le regole vere — cosa si può scrivere e cosa no, i segnaposto, i comandi che occupano il terminale — stanno nella **nota condivisa #67**, perché servono anche a chi scrive le guide da dentro Paperclip. Qui resta solo la causa, che è mia: **prima di consegnare un comando, chiedersi in quale shell verrà eseguito**, e non fidarsi del fatto che a me sia andato bene.

---

## L2. Rinominare un remoto non impedisce di pusharci: il freno è un altro

**Contesto:** 8/9/2026. Per evitare che un commit distratto dalla cartella-archivio finisse nel repository ormai abbandonato, avevo detto a Jacopo — e scritto in un documento — che bastava rinominare il remoto da `origin` a `archivio-vecchio`.

**Errore:** non basta, e l'ho scoperto solo perché ho provato. **`git remote rename` aggiorna anche il riferimento del ramo** (`branch.main.remote`): dopo il rename, un `git push` secco continuava a funzionare e ad andare esattamente dove non doveva. Il rename da solo è cosmetico — anzi peggio, perché **dà l'impressione di aver messo un freno che non c'è**.

**Modo corretto:**
- Il freno vero è **disattivare l'indirizzo di push**: `git remote set-url --push <remoto> UN-VALORE-NON-VALIDO`. Il push fallisce subito e il `fetch` continua a funzionare, che è quello che serve per un archivio da consultare.
- **Regola generale, che vale ben oltre questo caso:** una misura di sicurezza si **prova**, non si deduce. Un `git push --dry-run` costa un secondo e distingue *«l'ho protetto»* da *«credo di averlo protetto»*. Fino a quella prova, la frase corretta è al condizionale.

---

## L3. Quello che posso verificare io non lo faccio digitare all'utente

**Contesto:** 8/9/2026, installazione locale del CRM: dodici passi, dai prerequisiti fino all'accesso come Superadmin.

**L'errore che NON è stato fatto**, e vale la pena fissarlo perché ha pagato tre volte. La tentazione, seguendo una guida, è consegnare all'utente l'elenco dei comandi di verifica e chiedergli di incollare l'uscita: è lento, produce trascrizioni parziali, e su un utente meno esperto trasforma ogni controllo in un possibile inciampo. Eseguendoli io sono emerse **tre cose che la guida dava per scontate e che su questa macchina erano false** (PostgreSQL assente, poi fuori dal PATH, e la cartella di progetto indicata inesistente).

**Modo corretto, e il confine:**
- **Tutto ciò che è lettura, lo faccio io**: presenza e versione dei programmi, PATH, servizi Windows e porte in ascolto, file creati, forma del `.env`, stato del database, risposta dell'API. All'utente si chiede solo ciò che **richiede una sua decisione o le sue credenziali**.
- **Lo stato del database si certifica senza mai vedere la password**: uno script `.mjs` temporaneo nella radice del progetto con `import 'dotenv/config'` e `PrismaClient`, che interroga `_prisma_migrations`, `pg_extension` e le tabelle, stampa **solo conteggi e nomi**, e **si rimuove nello stesso comando** (con `;`, non `&&`, così la pulizia avviene anche in caso di errore).
- **Le chiavi le genera e le incolla l'utente**, sempre: non passano dalla conversazione. È anche il motivo per cui restano davvero sue.
- **Un passo si dichiara chiuso solo dopo averlo verificato**, non quando l'utente dice «fatto».

---

## L4. In un compito per Paperclip non si cita un file che sta solo sul mio disco

**Contesto:** 9/9/2026. Nel testo di un compito per Paperclip avevo scritto *«il documento esiste già ed è `archivio-documenti/consulenza-postazione-locale/come-stanno-le-cose.md`, verificane la sezione X»*. Quel file l'avevo scritto io in locale e non era committato, né tantomeno pushato: nel repository non c'era. Paperclip ha verificato in cinque modi, non l'ha trovato, e si è fermato a chiedere.

**Errore:** ho consegnato **un riferimento che il destinatario non poteva risolvere**. La parte che brucia è che è **la stessa identica forma del difetto che avevo diagnosticato il giorno prima** nel pacchetto dell'azienda Paperclip, dove le conoscenze citavano una skill `crm-note-operative` che nel pacchetto non c'era. Diagnosticato il giorno prima, rifatto il giorno dopo.

**Modo corretto:**
- **Prima di citare un percorso in un compito, verificare che sia visibile a chi lo riceve.** Paperclip vede il **repository remoto**: un file non committato, o committato su un ramo locale mai pushato, per lui non esiste. Il controllo è `git ls-tree origin/main -- <percorso>`, oppure `git log origin/main -- <percorso>`.
- **Se il file è di ambito locale, non va citato affatto** in un compito: è fuori dal perimetro di chi sviluppa, e chiedergli di verificarlo contraddice la convenzione stessa.
- **Nota di merito, che va registrata:** Paperclip ha verificato in cinque modi e **ha chiesto invece di inventare**. È il comportamento giusto, ed è utile saperlo quando si valuta se il team di agent stia funzionando.

---

## L5. Due account GitHub sulla stessa macchina: finché è uno il predefinito è implicito, dal secondo in poi va scritto

**Contesto:** 9/9/2026. Il push verso `advaiora/crmadv` veniva rifiutato con `403 Permission denied to Jagolas23`: l'account personale di Jacopo su quel repository ha **solo lettura**, mentre l'account `advaiora` (che lo amministra) vive sulla stessa macchina. Aggiunto il secondo account, sono cominciati i guai **dalla parte opposta**.

**Errore, in due tempi.**
1. **Il rimedio brutale sarebbe stato sostituire la credenziale salvata.** Avrebbe funzionato per `crmadv` e **rotto gli altri cinque progetti** di Jacopo, che vivono su `Jagolas23`: la credenziale di `github.com` è una sola, condivisa da tutti i repository che non dicono quale account usare.
2. **Ma anche la soluzione giusta ha un contraccolpo che non avevo previsto.** Legando `advaiora` a questo repository, la macchina ha cominciato a conoscere **due** account: da quel momento, per ogni indirizzo che non ne indica uno, il gestore credenziali **non può più indovinare** e apre una finestra di scelta. Tutti i repository personali hanno iniziato a chiederla. ⚠️ E quella è una **finestra grafica di Windows, non una domanda nel terminale**: un assistente non può cliccarci dentro, quindi l'operazione gli resta appesa. Il secondo account non ha rotto solo la propria strada: ha reso ambigua quella di tutti gli altri.

**Modo corretto:**
- **Il predefinito va reso esplicito nel momento in cui smette di essere l'unico.** Una riga globale per l'account di casa, e l'eccezione in locale dove serve:
  - `git config --global credential.https://github.com.username <account-di-casa>`
  - `git config credential.https://github.com.username <altro-account>` (dentro il solo repository che lo richiede — in git il locale batte il globale)
- **Non si sostituisce la credenziale, si etichettano.** Il gestore di Windows tiene voci separate (`git:https://github.com` e `git:https://<account>@github.com`): convivono, e ognuna serve chi la nomina.
- **Un'operazione che dipende da una finestra grafica non è automatizzabile.** Prima di dire che una configurazione «funziona», va provata **senza interazione possibile**: se compare una richiesta, per un assistente è un blocco, non un passaggio.
- **La verifica giusta e' un `git push --dry-run`** nel repository che si teme di aver rotto: non modifica niente e mette alla prova proprio l'autenticazione. Farlo **prima** di dichiarare che il resto è salvo, non dopo.
- **Vale anche al contrario:** un clone nuovo di questo stesso repository nascerebbe con l'account di casa e prenderebbe 403. L'eccezione locale va rimessa a ogni clone.

---

## L6. Un documento lungo si scrive con lo strumento di scrittura, non con un heredoc

**Contesto:** 9/9/2026. Scrivendo il dossier dell'incidente VPS (~150 righe di italiano con tabelle, virgolette basse, emoji e sequenze tipo `^[[200~`) ho usato un heredoc `cat > file << 'EOF'` dal terminale.

**Errore:** la shell si e' impuntata con `unexpected EOF while looking for matching quote` e il file non e' stato creato. Un giro sprecato, con il rischio peggiore di scrivere un file troncato a meta' senza accorgersene.

**Modo corretto:** per qualsiasi documento oltre le poche righe si usa direttamente lo **strumento di scrittura file**. L'heredoc va bene per due righe di appunto; da li' in su il rapporto fra rischio e comodita' si inverte. Il segnale per decidere non e' la lunghezza in se': e' la **presenza di caratteri che la shell interpreta** (apici, backtick, `$`, sequenze di escape). Se ce ne sono, non passare dalla shell.
