# Fase 0 — Accendere la macchina, passo per passo

> **A chi serve:** a Jacopo, davanti al terminale. **Cosa copre:** solo la **fase 0** del §9.3 del
> piano — la macchina, Paperclip acceso, e l'azienda costruita dentro Paperclip.
>
> **Come è fatta:** un passo per volta. Per ognuno: *cosa fai* · *come si fa* · *come sai che è
> andata bene* · *cosa fare se non va*.

---

## ⚠️ Riscritta il 26/8/2026 — cosa è cambiato rispetto alla prima versione

La prima versione (25/8) era scritta per una macchina nuda, da preparare a mano, e per un assistente
collegato a Paperclip. **Nessuna delle due cose è più vera.** Ecco la corrispondenza, così nessuno
rifà passi già superati:

| Passo di prima | Che fine ha fatto |
|---|---|
| **1, 2, 3, 5, 6** — creare la VPS, prepararla, Node e pnpm, installare Paperclip, farlo restare acceso | ✅ **Fatti da hPanel.** Hostinger installa e mantiene Paperclip dal pannello. Restano solo delle **verifiche** (passo 1 nuovo) |
| **4** — Tailscale, la rete privata | 🗑️ **Eliminato.** hPanel espone Paperclip su un indirizzo pubblico con HTTPS: `https://paperclip-pblu.srv1917293.hstgr.cloud`. Una rete privata sopra un indirizzo pubblico non aggiunge niente |
| **7** — diventare proprietario, aggiungere Claudio | 🟡 **Metà fatto.** Jacopo è già dentro come proprietario. Resta Claudio → passo 2 nuovo |
| **8** — Claude Code sulla VPS e il repository | 🟡 **Da verificare** → passi 1 e 3 nuovi |
| **9** — Chromium | ⏩ Invariato, spostato in fondo → passo 8 nuovo |
| **10** — la chiave del consiglio (`paperclipai auth login`) | 🗑️ **Eliminato** *(decisione di Jacopo, 26/8/2026)* |
| **11** — il collegamento MCP fra l'assistente e Paperclip | 🗑️ **Eliminato** *(stessa decisione)* |
| **12** — la prova che chiude la fase | ⏩ Il criterio resta identico, ma la esegue Jacopo a mano → passo 9 nuovo |
| — | ➕ **Nuovi: passi 4, 5, 6, 7** — l'azienda si costruisce da un **pacchetto `.zip`**, consegnato a Paperclip come **compito con allegato** *(modo scelto da Jacopo il 26/8)* |

### La decisione del 26/8: niente collegamento fra l'assistente e Paperclip

Il piano (§9.4) prevedeva che l'assistente parlasse con l'API di Paperclip e costruisse l'azienda al
posto vostro. **Jacopo ha deciso di non farlo**: la catena da montare (chiave da riga di comando →
server MCP → verifica) costa più di quello che rende, visto che l'azienda si costruisce una volta.

**La conseguenza va tenuta a mente, perché cambia il modo di lavorare insieme:** dentro Paperclip
l'assistente **non vede e non tocca niente**. Non può dire «vedo tre agent», non può correggere una
configurazione sbagliata, non può accorgersi da solo che qualcosa non è andato. **Ogni verifica di
questa lista è una cosa che guardi tu a schermo e riferisci.** Dove serve, il passo lo dice.

In cambio: quello che l'assistente produce sono **file**, e i file entrano in Paperclip da soli
attraverso l'importazione dei pacchetti (passi 4-6). Il lavoro si sposta, non si perde.

### 🔓 Una cosa da sapere sull'indirizzo pubblico

Il piano aveva scelto l'accesso privato per non esporre niente su internet. Con l'indirizzo di
hPanel, **Paperclip è raggiungibile da chiunque conosca l'indirizzo**, e l'unica difesa è il suo
login.

Non è un motivo per fermarsi — è la stessa condizione di qualunque servizio web — ma **due
conseguenze pratiche** valgono da subito:

1. **La password dell'account proprietario è la chiave dell'azienda.** Se qualcuno entra lì, approva
   al posto vostro. Va lunga, e diversa da tutte le altre.
2. **`Settings → Access` va guardato ogni tanto**: è l'elenco di chi può entrare. Devono esserci due
   persone, Jacopo e Claudio. Nessun altro.

Se in futuro doveste volere l'accesso privato, la strada è ancora quella del piano (Tailscale, o il
firewall di Hostinger che lascia passare solo i vostri indirizzi) — ma è una scelta da fare a mente
fredda, non un pezzo di questa fase.

---

## ⚠️ La macchina è stretta: cosa aspettarsi

Parti dal **KVM 1** (4 GB) per scelta, contro la raccomandazione del piano che indicava il KVM 4. La
scelta non si discute qui. Servono però **due cose concrete**:

- **Sulla macchina finiranno due database PostgreSQL, non uno.** Paperclip se ne installa uno proprio;
  il CRM ha il suo, e arriverà alla fase 1. Più il server di Paperclip, gli agent, e Chromium per il
  collaudatore.
- **La memoria esaurita non dà un errore che dice «memoria esaurita».** Dà installazioni che muoiono
  a metà senza spiegazione, comandi che tornano indietro muti, la macchina che rallenta invece di
  protestare. **Se in fase 0 succede una cosa così, il primo sospetto è quello, non il comando che
  hai scritto.** Si guarda con `free -h`, colonna *available*.

## Cosa NON c'è in questa lista, e non è una dimenticanza

| Cosa | Quando |
|---|---|
| **Discord** | Fase 3, non ora (§9.3) |
| **L'ambiente di sviluppo del CRM** sulla VPS — PostgreSQL, il server dei dati, quello delle pagine | Serve alla **fase 1**, quando un agent dovrà far girare i collaudi |
| **Gli argini su git** — `main` protetto, un ramo per lavoro | Prima del **primo compito vero**, non prima dell'azienda |
| **Il salvataggio periodico** della macchina | Appena sulla VPS c'è qualcosa da perdere: fine fase 0 |
| **Le altre otto basi di conoscenza** degli agent | Fase 2. Il generatore che le produce non esiste ancora |

---

## Passo 1 — Verificare che la macchina sia davvero pronta

**Cosa fai:** tre controlli su quello che hPanel ha installato. Non è pignoleria: tutto il resto
poggia qui, e un guaio scoperto adesso costa un minuto invece di mezza giornata.

### 🔑 Chi ha le chiavi della macchina *(scoperto il 26/8/2026)*

**La VPS l'ha creata e configurata Claudio**, e hPanel è sul suo account. Jacopo non ha né il pannello
né la password di root. Non è un guaio, ma cambia due cose:

- **I comandi sulla macchina non li può lanciare Jacopo da solo.** Le due strade qui sotto valgono per
  chi ha l'accesso; per gli altri la terza strada è quella buona.
- **Esiste una terza strada, ed è la migliore: chiederlo a Paperclip.** Gli agent girano *dentro* la
  VPS, quindi un compito assegnato a un agent è a tutti gli effetti un terminale — con in più il
  vantaggio che resta scritto nella bacheca invece che in una finestra che poi si chiude. ⚠️ **Serve
  però un agent capace di farlo, e all'inizio non c'è**: vedi il passo 2-bis.

### 📍 Dove si scrivono questi comandi

**Non in PowerShell.** PowerShell è il terminale del *tuo computer*: lì `free -h` non esiste, è un
comando di Linux. Questi comandi vanno scritti **dentro la VPS**, e ci si arriva in due modi.

**Modo 1 — dal pannello di Hostinger (il più semplice, niente da installare).** In hPanel, sulla
scheda della VPS, c'è un **Browser terminal**: si apre una finestra nera dentro la pagina web e sei
già dentro la macchina, **come root e senza password** — ti autentica il pannello, perché sei già
entrato col tuo account Hostinger. Da lì scrivi i comandi.

⭐ **È anche la risposta al problema della password.** Una VPS creata dal pannello ha una password di
root che non è mai passata per le tue mani: se provi `ssh` te la chiede e tu non ce l'hai. Il
terminale del browser gira intorno alla cosa. Se un giorno ti servisse davvero SSH, in hPanel c'è la
voce per **impostare una nuova password di root** — ma per la fase 0 non serve.

**Modo 2 — da PowerShell, con SSH.** PowerShell serve **solo per il primo comando**, quello che ti fa
entrare:

```bash
ssh root@srv1917293.hstgr.cloud
```

Questo è **l'indirizzo vero della macchina**, non un segnaposto: si copia così com'è. È lo stesso
nome dell'indirizzo di Paperclip senza il `paperclip-pblu.` davanti, e corrisponde all'IP
`191.218.160.114` (verificato il 26/8/2026).

La prima volta ti chiede se ti fidi della macchina: rispondi `yes`. Poi la password di root, quella
di hPanel — **mentre la digiti non compare niente, nemmeno gli asterischi**: è normale, sta scrivendo
lo stesso.

> ⚠️ **Sui segnaposto.** Dove in questa lista compare una parola tutta maiuscola con i trattini —
> come `INDIRIZZO-DEL-REPOSITORY` al passo 3 — **non è un comando da copiare, è un buco da riempire**.
> Copiarla così com'è dà l'errore `Could not resolve hostname` o simili. Se non sai cosa metterci,
> chiedi invece di tirare a indovinare.

⭐ **Da quel momento la finestra cambia padrone.** Il testo prima del cursore non è più il tuo
computer ma la macchina: tutto quello che scrivi finisce **lì**, non su Windows. Per tornare a casa
si scrive `exit`.

**Come si fa.** I tre controlli, **in quest'ordine** — il riavvio va per ultimo perché ti butta
fuori:

**Controllo A — quanta memoria è libera davvero:**

```bash
free -h
```

Guarda la colonna **available** della riga `Mem`. È il numero che conta.

**Controllo B — Claude Code sulla VPS.** È il motore che farà lavorare gli agent, ed è
un'installazione a sé: quella del portatile non conta.

```bash
claude --version
```

**Controllo C — Paperclip sopravvive a un riavvio.** Serve a sapere se resta acceso da solo o se
qualcuno deve riaccenderlo a mano ogni volta:

```bash
sudo reboot
```

⚠️ **Questo comando ti disconnette, ed è normale**: stai spegnendo la macchina su cui sei. La
finestra si chiude o si blocca. Aspetta due minuti, poi apri
`https://paperclip-pblu.srv1917293.hstgr.cloud/CRM/org` dal browser — non serve rientrare nel
terminale per questo controllo.

**Come sai che è andata bene:** A → almeno **1,5 GB** disponibili a macchina ferma. B → stampa un
numero di versione. C → la bacheca ricompare da sola, senza che tu abbia toccato niente.

**Se non va:**

- **A sotto il mezzo giga:** fermati e dimmelo. Non ha senso proseguire su una macchina già piena.
- **C non torna su:** vuol dire che Paperclip è acceso ma non **impostato per riaccendersi**. Si
  risolve, ma va risolto adesso: rientra con `ssh` e dimmi cosa risponde
  `systemctl status paperclip`.
- **B dice «command not found»:** Claude Code non è sulla VPS. Si installa con
  `curl -fsSL https://claude.ai/install.sh | bash`, poi si lancia `claude` e si segue
  l'autenticazione con l'abbonamento Max. Sulla VPS non c'è un browser: ti darà un indirizzo da
  aprire sul portatile e un codice da riportare indietro.

**📋 Riferiscimi le tre risposte.** Senza collegamento a Paperclip, questo è l'unico modo che ho di
sapere com'è messa la macchina.

---

## Passo 2 — Aggiungere Claudio ✅ GIÀ FATTO

> **Verificato il 26/8/2026:** Claudio compare già fra le persone dell'azienda (si vede
> nell'elenco degli assegnatari di un compito). **Non c'è niente da fare.** Il passo resta scritto
> solo per chi rileggesse la lista da capo.

**Cosa fai:** l'azienda deve essere di due persone, non di una. È anche metà del criterio che chiude
la fase (passo 9: «da due computer diversi»).

**Come si fa.** Nell'interfaccia di Paperclip: **Settings → Invites**, crea un collegamento d'invito
e mandaglielo. Quando lo usa, la richiesta compare in **Settings → Access**, e lì la approvi.

⭐ Rispetto a com'era scritto prima, **non deve fare nient'altro**: l'indirizzo è pubblico, gli basta
il browser. La rete privata non c'è più.

**Come sai che è andata bene.** In *Settings → Access* ci sono **due persone**.

**Se non va:** l'invito può avere una scadenza. Se Claudio lo apre giorni dopo e non funziona, ne
generi un altro — non è un guasto.

> 💬 **Questo passo dipende da Claudio**, quindi può restare aperto mentre vai avanti con i passi 3-8.
> Va chiuso **prima del passo 9**, non prima degli altri.

---

## Passo 2-bis — Il primo agent, che è per forza il CEO

**Cosa fai:** crei a mano il primo agent dell'azienda. Da quel momento hai **le mani sulla macchina
senza passare da hPanel**: gli assegni un compito e lui esegue.

### ⚠️ Perché va fatto a mano e con attenzione

Due vincoli che si incastrano, e conviene conoscerli prima di premere il pulsante:

1. **Paperclip obbliga il primo agent a essere il CEO.** Il campo *Role* è **bloccato** su `CEO`
   quando l'azienda è vuota, e non c'è modo di aggirarlo. Quindi **non si può creare un "agent di
   prova"**: il primo che nasce occupa la casella più alta dell'organigramma, e non è una casella da
   sprecare.
2. **Nel piano il CEO non esiste** — il vertice dell'azienda siete voi due, il *consiglio* (§2.1). Il
   mestiere che gli somiglia di più è il **🧭 Capocantiere** (§2.2): è quello che legge il piano,
   spacchetta il lavoro, mette in fila i compiti e delega. **È lui a prendersi la casella di CEO.**

> 🗣️ **Il nome lo sceglie Jacopo**, come per ogni cosa nuova di questo progetto. La proposta è
> *Capocantiere*, perché è il nome che il piano usa già da mesi e che ricorre in tutti i documenti:
> cambiarlo adesso vorrebbe dire disallineare il piano dall'azienda vera il giorno zero.

### Come si fa

Nella pagina dell'organigramma, pulsante **New Agent**:

| Campo | Cosa mettere | Perché |
|---|---|---|
| **Agent name** | `Capocantiere` | Il nome del piano |
| **Title** | `Decide cosa si fa dopo` | È il sottotitolo che si legge nell'organigramma |
| **Role** | `CEO` — è bloccato | Vincolo di Paperclip, non una scelta |
| **Reports to** | vuoto | È il primo, non risponde a nessun agent |
| **Adapter** | **Claude Code** | È l'unico che usa l'abbonamento Max già autenticato sulla VPS. **Nessuna chiave API** |
| **Model** | il predefinito | Si tara dopo (§11.2 del piano lo vuole di fascia alta). Adesso non è la battaglia |
| **Working directory (cwd)** | `/root` | ⚠️ **Non** `/root/crmadv`: quella cartella non esiste ancora, arriva al passo 3 |
| **Heartbeat enabled** | **spento** | 🛑 Un agent che si sveglia da solo prima che l'azienda esista si mette a fare cose per conto suo. Si accende al passo 9 |
| **Company skills** | niente | Le basi di conoscenza arrivano col pacchetto del passo 5 |

**Come sai che è andata bene.** L'agent compare nell'organigramma, e **compare anche nell'elenco
degli assegnatari** quando apri un nuovo compito — accanto a *Me*, *Claudio*, *Reflection Coach* e
*Summarizer*.

**Se non va:** se il campo *Adapter* non offre Claude Code, vuol dire che Paperclip non lo vede
installato sulla macchina. È la stessa cosa che verificava il controllo B del passo 1, e va risolta
prima di proseguire.

> 💡 **Reflection Coach e Summarizer non servono a questo.** Sono i due agent di servizio che
> Paperclip installa da sé: guardano e riassumono i compiti, non lavorano sulla macchina. Non vanno
> cancellati, semplicemente non è a loro che si assegnano i compiti operativi.

---

## Passo 2-ter — Il primo compito: farsi raccontare la macchina

**Cosa fai:** usi il Capocantiere come terminale, e recuperi i controlli del passo 1 che senza hPanel
non potevi fare.

**Come si fa.** Pulsante **New task**:

- **Task title:** `Controllo della macchina`
- **For:** `Capocantiere`
- **Add description:** il testo qui sotto, incollato tale e quale

```
Esegui sulla macchina questi comandi, uno per uno, e riporta l'uscita esatta di ognuno così com'è:

1. free -h
2. df -h /
3. claude --version
4. node --version

Non modificare niente, non installare niente, non correggere niente.
Se un comando non esiste o dà errore, riporta l'errore testuale invece di cercare una strada alternativa.
```

**Come sai che è andata bene.** L'agent risponde con quattro uscite. In una volta sola hai scoperto
**quattro cose**: che gli agent partono, che Claude Code sulla VPS funziona ed è autenticato, quanta
memoria e quanto disco ci sono.

**📋 Riporta le quattro uscite.** Sono i numeri del passo 1, presi per un'altra strada.

**Se non va:**

- **L'agent non parte** → è l'adattatore. Torna al passo 2-bis.
- **Parte ma dice che non può eseguire comandi** → l'adattatore è configurato senza accesso alla
  macchina. Copia cosa ha scritto: è un'opzione da cambiare sulla sua scheda, non un muro.

---

## Passo 3 — Il repository del CRM sulla macchina

**Cosa fai:** porti il codice del CRM sulla VPS. È il materiale su cui gli agent lavoreranno, e
contiene anche le loro basi di conoscenza.

**Come si fa:**

```bash
cd ~
git clone INDIRIZZO-DEL-REPOSITORY crmadv
```

**Come sai che è andata bene:**

```bash
ls ~/crmadv/paperclip/skills
```

Deve mostrare **quattro cartelle**: `crm-collaudo-generazioni-ai`, `crm-design-frontend`,
`crm-permessi-e-sicurezza`, `crm-pianificazione`.

⭐ **Se le vedi, le basi di conoscenza sono già sulla macchina**: non si trasferiscono a mano,
viaggiano dentro il repository.

**Se non va:** se `git clone` chiede una password o rifiuta, è un problema di credenziali git sulla
VPS, non di Paperclip. Dimmelo e lo risolviamo lì.

---

## Passo 4 — Esportare il pacchetto di adesso (serve come stampo)

**Cosa fai:** scarichi da Paperclip l'azienda *CRM* così com'è oggi — praticamente vuota. Non serve a
salvarla: serve a **far vedere all'assistente il formato esatto** che Paperclip si aspetta.

**Perché.** Il pacchetto che ti verrà consegnato al passo 5 dev'essere scritto nella forma precisa
che Paperclip legge. La documentazione descrive la struttura delle cartelle, **ma non i campi dentro
i file**. Un pacchetto esportato dal tuo Paperclip, della tua versione, quei campi li ha tutti.
**Copiare uno stampo vero costa un minuto; indovinare i campi costa un pomeriggio di importazioni
rifiutate.**

**Come si fa.** Nell'interfaccia: **Company Settings → Company Packages → Export**. Scarichi un
`.zip`.

**Come sai che è andata bene:** hai un file `.zip` sul portatile. Aprilo e dentro devi trovare almeno
`COMPANY.md` e `.paperclip.yaml`.

**Poi passalo all'assistente:** mettilo in una cartella del progetto e di' dove, oppure allegalo in
chat.

**Se non va:** se la voce *Export* non c'è, dì che voci vedi in *Company Settings* — cambiano da una
versione all'altra, e in quel caso si passa dal comando `paperclipai company export`.

---

## Passo 5 — Il pacchetto dell'azienda *(lo costruisce l'assistente)*

**Cosa fai:** niente. Aspetti.

**Cosa fa l'assistente.** Con lo stampo del passo 4, scrive il pacchetto completo dell'azienda: gli
agent dell'organigramma con ruolo e istruzioni, i collegamenti fra loro, le quattro basi di
conoscenza, e il progetto su cui lavoreranno. Tutto in file di testo, dentro un `.zip`.

**Le consegne sono due, non una:**

1. **Il `.zip`** — da allegare al compito. Dentro ha anche un **`README.md`** in italiano: cosa
   contiene, cosa deve succedere, e cosa resta da regolare a mano dopo (passo 7).
2. **Il testo del prompt** — già scritto, da incollare nella descrizione del compito. Non è un
   riassunto del pacchetto: è l'istruzione che dice all'agent **cosa fare dell'allegato**, in che
   ordine, e **dove fermarsi** (per esempio: non accendere niente, non toccare il repository).

**Come sai che è andata bene:** hai il `.zip` e il testo del prompt, e il `README.md` ti risulta
comprensibile. **Se leggendolo non capisci cos'è un agent o perché c'è, fermati e chiedi prima di
lanciare il compito** — correggere un pacchetto prima è banale, disfare un'azienda costruita storta
no.

---

## Passo 6 — Lanciare il compito che costruisce l'azienda

**Cosa fai:** apri un compito in Paperclip, gli allegi il `.zip`, incolli il prompt, e lo affidi a un
agent. È lui che costruisce l'organigramma.

> **Perché così e non con l'importazione automatica.** Paperclip sa importare un pacchetto da solo
> (*Company Settings → Company Packages → Import*): è deterministico, mostra un'anteprima e non
> sbaglia. **Jacopo ha scelto la strada del compito** (26/8/2026) perché è quella con cui vuole
> prendere confidenza con lo strumento, ed è anche il primo lavoro vero che l'azienda esegue su sé
> stessa. L'importazione automatica **resta come ripiego** se il compito si impianta — vedi *«se non
> va»* qui sotto.

**Come si fa.** Nell'interfaccia, pulsante **New task**:

1. **Task title** — un titolo che si riconosce fra sei mesi, tipo `Costruire l'organigramma da
   pacchetto`.
2. **For** — al posto di *Me*, scegli **Agent** e indica l'agent che deve eseguirlo.
3. **Upload** — allega il `.zip` del passo 5.
4. **Add description** — incolla il **prompt** del passo 5, senza riscriverlo.
5. **Create Task**.

⚠️ **Un agent deve già esistere per potergli affidare il compito.** Se in azienda c'è solo l'agent di
servizio che Paperclip installa da sé, è a lui che va dato: il compito è di configurazione, non di
sviluppo del CRM.

**Come sai che è andata bene.** Due cose, in quest'ordine:

- **L'agent si sveglia e lavora**: nell'attività del compito vedi cosa fa, passo per passo. Già solo
  questo è metà della prova del passo 9.
- **Poi torni su `/CRM/org` e vedi l'organigramma popolato**: gli agent con i loro nomi e ruoli, al
  posto della pagina quasi vuota di adesso.

**📋 Descrivi cosa vedi** — quanti agent, che nomi, e cosa ha scritto l'agent nel compito. È la
verifica: dall'esterno l'assistente non vede niente di tutto questo.

**Se non va.** Tre modi di non andare, tre risposte diverse:

- **L'agent non parte proprio** → non è un problema del pacchetto. È l'adattatore o il risveglio:
  torna al passo 1, controllo B.
- **Parte e sbaglia** — crea agent a metà, o inventa nomi che nel pacchetto non ci sono → **fermalo e
  copiami cosa ha scritto.** Quasi sempre è il prompt da stringere, non il pacchetto.
- **Ci prova due volte e non ne esce** → 🔁 **si passa al ripiego**: *Company Settings → Company
  Packages → Import*, si sceglie lo stesso `.zip`, si legge l'anteprima e si conferma. Il pacchetto è
  scritto nel formato che quella funzione si aspetta, quindi non c'è niente da rifare. **Non è una
  sconfitta: è il motivo per cui il pacchetto è fatto in quel formato invece che a modo mio.**

---

## Passo 7 — Le rifiniture che il pacchetto non porta

**Cosa fai:** tre cose che un pacchetto **non può contenere per costruzione**, e vanno messe a mano —
qualunque delle due strade del passo 6 tu abbia usato.

**Come si fa.**

1. **L'adattatore di ogni agent.** È il motore che lo fa parlare. Dev'essere **Claude Code**
   (`claude_local`), che sulla VPS usa l'abbonamento Max già autenticato — **nessuna chiave API,
   nessun consumo a token.** Controlla agent per agent che sia quello.
2. **Il tetto di spesa di ogni agent.** I budget non viaggiano nel pacchetto. Vanno rimessi.
3. **I *heartbeat*** — cioè gli agent che si svegliano da soli. **Lasciali spenti per adesso.** Si
   accende il primo al passo 9, uno solo, come prova. Un'azienda intera che si sveglia tutta insieme
   su una macchina da 4 GB è esattamente il modo di scoprire il problema della memoria nel momento
   peggiore.

⛔ **I segreti non entrano mai in un pacchetto**, ed è giusto così: chiavi e password si mettono solo
qui, a mano, dentro Paperclip. **Non passano dal repository e non passano dalla chat** — in questo
progetto una password è già transitata in chat una volta, ed è rimasta nelle trascrizioni sul disco.

**Come sai che è andata bene:** apri un agent a caso e vedi l'adattatore giusto, un tetto di spesa, e
il risveglio automatico spento.

---

## Passo 8 — Chromium per il collaudatore

**Cosa fai:** installi il browser che l'agent collaudatore userà per guardare il CRM e fare gli
screenshot.

```bash
sudo apt-get install -y chromium-browser
```

**Come sai che è andata bene:** `chromium-browser --version` stampa una versione.

**Se non va:** su alcune Ubuntu il pacchetto si chiama `chromium`. Prova quello.

> Serve dalla fase 2 in poi: se sei stanco, questo è il passo che puoi rimandare.

---

## Passo 9 — La prova che chiude la fase

**Cosa fai:** verifichi il criterio di fine fase del piano, che è uno solo e preciso:

> **Un agent di prova si sveglia, esegue un comando innocuo, e lo vedete succedere da due computer
> diversi.**

**Come si fa.** Adesso lo fai a mano.

1. Scegli **un** agent — uno solo — e assegnagli un compito da nulla: leggere un file del repository
   e dire cosa c'è dentro. Niente che scriva, niente che tocchi git.
2. Accendi **solo il suo** risveglio automatico.
3. Guarda l'attività: l'agent parte, fa la cosa, scrive il risultato.
4. **Chiedi a Claudio di guardare la stessa cosa dal suo computer.**

**Come sai che è andata bene:** lo vedete **tutti e due**. È la prova che l'azienda è davvero
condivisa e non un giocattolo che gira solo da te.

🛑 **Se non riesce, ci si ferma qui e si capisce perché.** Il piano è netto, e vale a maggior ragione
per la fase 0: **tutto il resto poggia su questa.**

---

## Subito dopo, prima di dormirci sopra

| Cosa | Perché adesso |
|---|---|
| **Il salvataggio periodico della macchina** (snapshot da hPanel) | Da questo momento sulla VPS c'è la memoria dell'azienda, e presto il database di sviluppo del CRM (rischio 8 del piano) |
| **Riscrivere la regola dei dev server in `CLAUDE.md`** | Diceva «una sola sessione accesa per volta» riferendosi ai vostri computer. Da adesso **riguarda la VPS** (§12.4) |
| **Verificare il «lucchetto di Prisma»** | Il piano lo dava per tornato; è quasi certamente un comportamento di Windows che su Linux non esiste (§12.4) |

---

## Fonti

Documentazione ufficiale di Paperclip, letta il 25 e il 26/8/2026:

- [esportazione e importazione dei pacchetti](https://docs.paperclip.ing/guides/power/export-import/)
  — la struttura del `.zip`, cosa viaggia e cosa no, e i due modi di importare
- [gli adattatori](https://docs.paperclip.ing/reference/adapters/overview/) — l'elenco dei motori;
  Claude Code è `claude_local`
- [organigramma e agent](https://docs.paperclip.ing/guides/org/agents/) ·
  [le skill](https://docs.paperclip.ing/reference/skills/) ·
  [accesso a più utenti](https://docs.paperclip.ing/how-to/enable-multi-user-login/)
- **Il piano** — `piano-paperclip-2026-08-19.md`: §9.3 (le quattro fasi), §10 (la macchina), §12.4
  (l'ambiente sulla VPS)

⚠️ **Quello che da qui non si può verificare:** i campi esatti dentro i file del pacchetto. La
documentazione descrive le cartelle ma non il contenuto dei file. **È il motivo per cui esiste il
passo 4** — lo stampo vero risolve la domanda invece di lasciarla aperta.

*Riscritto il 26 agosto 2026 in `crmadv`. Copre la sola fase 0: le fasi 1-4 restano nel §9.3 del
piano.*
