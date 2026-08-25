# Fase 0 — Accendere la macchina, passo per passo

> **A chi serve:** a Jacopo, davanti al terminale. **Cosa copre:** solo la **fase 0** del §9.3 del
> piano — la macchina, Paperclip acceso, e il collegamento fra l'assistente e l'azienda.
> **Quanto dura:** mezza giornata, una volta sola.
>
> **Come è fatta:** un passo per volta. Per ognuno: *cosa fai* · *come si fa* · *come sai che è
> andata bene* · *cosa fare se non va*. **Vanno eseguiti in quest'ordine**, perché ognuno usa quello
> prima — la sola eccezione è il passo 9, che si può fare in qualsiasi momento.
>
> ⚠️ **I comandi vengono dalla documentazione ufficiale** di Paperclip, Tailscale e Claude Code,
> letta il 25/8/2026 (fonti in fondo).

---

## Prima di cominciare — le tre cose da avere sottomano

1. **Un accesso alla VPS**: indirizzo IP e password di amministratore, o meglio una chiave SSH.
2. **L'account Claude** con cui Claude Code girerà **sulla VPS**. È un'installazione a sé: la sua
   autenticazione non è quella del tuo portatile.
3. **Un'ora e mezza senza interruzioni per i passi 1-7.** Dall'8 in poi si può spezzare.

### Cosa NON c'è in questa lista, e non è una dimenticanza

| Cosa | Quando |
|---|---|
| **Discord** | Fase 3, non ora (§9.3) |
| **L'ambiente di sviluppo del CRM** sulla VPS — PostgreSQL, il server dei dati, quello delle pagine | Serve alla **fase 1**, quando un agent dovrà far girare i collaudi. La fase 0 non lo tocca |
| **Gli argini su git** — `main` protetto, un ramo per lavoro | Prima del **primo compito vero**, non prima del collegamento |
| **Il salvataggio periodico** della macchina | Appena sulla VPS c'è qualcosa da perdere: fine fase 0 o inizio fase 1 |

### ⚠️ La macchina è stretta: cosa aspettarsi

Parti dal **KVM 1** (4 GB) per scelta, contro la raccomandazione del piano che indicava il KVM 4. La
scelta non si discute qui. Servono però **due cose concrete**:

- **Sulla macchina finiranno due database PostgreSQL, non uno.** Paperclip se ne installa uno proprio
  (porta `54329`); il CRM ha il suo, e arriverà alla fase 1. Più il server di Paperclip, gli agent, e
  Chromium per il collaudatore.
- **La memoria esaurita non dà un errore che dice «memoria esaurita».** Dà installazioni che muoiono
  a metà senza spiegazione, comandi che tornano indietro muti, la macchina che rallenta invece di
  protestare. **Se in fase 0 succede una cosa così, il primo sospetto è quello, non il comando che
  hai scritto.** Si guarda con `free -h`, colonna *available*.

---

## Passo 1 — Creare la VPS

**Cosa fai:** compri la macchina e la accendi con Ubuntu.

**Come si fa.** Dal pannello del fornitore: **Ubuntu 24.04 LTS**. Il piano non impone la
distribuzione, ma la guida ufficiale di Paperclip è scritta per Ubuntu 22.04/24.04 — stare lì
significa che i comandi combaciano invece di andare adattati. Carica la tua chiave SSH se il pannello
lo permette: eviti di lavorare a password.

**Come sai che è andata bene.** Dal tuo portatile:

```bash
ssh root@INDIRIZZO-IP
```

Ti risponde un terminale della macchina nuova.

**Se non va:** quasi sempre la macchina si sta ancora avviando — passano due o tre minuti dalla
creazione. Se dopo cinque rifiuta ancora, controlla nel pannello che l'IP sia quello giusto e che il
firewall del fornitore lasci passare la porta 22.

---

## Passo 2 — Mettere in ordine la macchina

**Cosa fai:** aggiorni il sistema e crei un utente normale, per non lavorare da `root`.

**Come si fa.** Collegato come `root`:

```bash
apt update && apt upgrade -y
adduser jacopo
usermod -aG sudo jacopo
rsync --archive --chown=jacopo:jacopo ~/.ssh /home/jacopo
```

L'ultima riga copia la tua chiave SSH sul nuovo utente, così ci entri senza password.

**Come sai che è andata bene.** Da una **seconda finestra** del portatile — non chiudere la prima
finché non funziona:

```bash
ssh jacopo@INDIRIZZO-IP
sudo whoami
```

Il secondo comando risponde `root`: l'utente nuovo può amministrare.

> **Perché non si lavora da `root`.** `root` non ha reti di protezione: un comando sbagliato non
> chiede conferma e non trova niente che lo fermi. Con un utente normale i comandi pericolosi vanno
> preceduti da `sudo`, che è mezzo secondo per pensarci.

---

## Passo 3 — Installare Node e pnpm

**Cosa fai:** metti sulla macchina il motore su cui gira Paperclip.

**Come si fa.** Come `jacopo`:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git ca-certificates
sudo npm install -g corepack
sudo corepack enable
corepack prepare pnpm@latest --activate
```

**Come sai che è andata bene:**

```bash
node --version
pnpm --version
git --version
```

Tre numeri di versione, nessun `command not found`. Node dev'essere **20 o superiore**.

> **Cosa sono.** *Node* esegue il codice di Paperclip. *pnpm* scarica e installa i pezzi di cui
> Paperclip ha bisogno. *corepack* tiene pnpm aggiornato. Non devi impararli: servono a Paperclip,
> non a te.

---

## Passo 4 — Tailscale: la rete privata fra le tue macchine

**Cosa fai:** metti VPS, portatile e telefono nella stessa rete privata, così si vedono fra loro senza
che niente sia esposto su internet.

> **Cos'è, in una riga.** Tailscale è un'azienda a sé (`tailscale.com`), che non c'entra con
> Paperclip: fa solo reti private. Installandola su due macchine, quelle due **si vedono come se
> fossero nella stessa stanza**, ovunque siano. Niente dominio, niente certificati, nessuna porta
> aperta verso il mondo, e niente da tenere aperto: funziona da sé.

### L'account: si usa un Gmail personale *(deciso da Jacopo il 25/8/2026)*

Il piano **Personal è gratuito** ed è quello che si ottiene iscrivendosi con un'email personale
(Gmail, Apple, GitHub). Con un'email aziendale il sistema instraderebbe su **Standard, 8 dollari per
utente al mese**. **Jacopo e Claudio usano un Gmail privato**, e la questione è chiusa.

**I limiti del piano gratuito non toccano questo impianto:** servono 2 utenti su 6 disponibili, e
cinque dispositivi (VPS, due portatili, due telefoni) su un numero illimitato.

**E no, Tailscale non può accorgersi che l'uso è di lavoro.** Il traffico è cifrato da un capo
all'altro, fra le vostre macchine: i loro server sanno **quali dispositivi** sono collegati, non
**cosa ci passa dentro**. Non esiste un meccanismo con cui possano vedere che dall'altra parte c'è
Paperclip o un CRM. L'unico segnale che guardano è il dominio dell'email dell'iscrizione.

**Come si fa.** Prima crea l'account su `tailscale.com` — si entra con Google, Microsoft o GitHub,
non c'è una password nuova da inventare. Poi, **sulla VPS**:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Il secondo comando stampa un indirizzo: aprilo nel browser del portatile e autorizza la macchina.

Poi **sul portatile** installa l'app di Tailscale dal sito ed entra con lo stesso account. E se lo
vuoi, **sul telefono**: c'è l'app per iPhone e Android, stesso account, due minuti.

Infine chiedi alla VPS qual è il suo indirizzo nella rete privata:

```bash
tailscale ip -4
```

⭐ **Segnati quel numero** (una cosa tipo `100.x.y.z`): lo useranno i passi 7, 10 e 11.

### 🛑 Fallo adesso, o fra sei mesi si spegne tutto senza dire perché

**Le chiavi dei dispositivi scadono dopo 180 giorni**, su tutti i piani. Alla scadenza il dispositivo
**esce dalla rete privata**: non si rompe e non si perde niente, ma smette di collegarsi, **senza
preavviso e senza un messaggio che spieghi cosa è cambiato**. Sei mesi dopo, quando nessuno si ricorda
più di questa pagina. Per rientrare basta rifare il login (`sudo tailscale up`, o l'app sul telefono):
trenta secondi. Il problema non è la fatica, è che nessuno capisce cosa sia successo.

**→ La scadenza si disattiva su TUTTI i dispositivi** *(deciso da Jacopo il 25/8/2026)*. Pannello di
`tailscale.com`: pagina **Machines** → menu della riga → **Disable Key Expiry**. Disponibile su tutti
i piani, gratuito compreso. Va rifatto per ogni dispositivo nuovo che entra nella rete.

#### ⚠️ La condizione che tiene in piedi questa scelta, e non va separata da essa

La scadenza serve a **un caso solo**: perdere un dispositivo e **non accorgersene**, o accorgersene e
non fare niente. È una rete di sicurezza pensata per chi ha centinaia di macchine e non può tenerle a
mente. Qui siete in due, con cinque dispositivi: se un telefono sparisce ve ne accorgete entro un'ora.

**Quindi la protezione non viene tolta, viene sostituita con una migliore:** se un dispositivo si
perde, si rompe o si cambia, **va rimosso dal pannello Machines**. Revoca l'accesso **subito**, invece
di aspettare fino a sei mesi come farebbe la scadenza.

🛑 **Le due cose stanno insieme.** Chi rilegge questa pagina fra un anno non deve trovare solo
«disattiva la scadenza»: quella da sola sarebbe un peggioramento. La rimozione manuale del dispositivo
perso **è** ciò che sostituisce la scadenza, non un consiglio in più.

**Come sai che è andata bene.** Dal portatile:

```bash
ping 100.x.y.z
```

Risponde. Le due macchine si vedono.

**Se non va:** se `tailscale up` non stampa nessun indirizzo, quasi sempre è già autorizzata —
controlla con `tailscale status`. Se il ping non passa, verifica sul pannello di `tailscale.com` che
entrambe le macchine risultino collegate.

---

## Passo 5 — Installare Paperclip

**Cosa fai:** scarichi Paperclip, lo installi e lo configuri.

**Come si fa.** Scarica l'installatore ufficiale **verificandone l'impronta** — è la stessa prudenza
che il §9.4 impone sui pacchetti-sosia:

```bash
curl -fsSLO https://paperclip.ing/install.sh
curl -fsSLO https://paperclip.ing/install.sh.sha256
sha256sum -c install.sh.sha256
bash install.sh
```

Il terzo comando deve rispondere `install.sh: OK`. **Se risponde `FAILED`, fermati:** il file
scaricato non è quello che dice di essere, e non va eseguito.

L'installatore avvia una configurazione a domande. Rispondi:

| Domanda | Risposta | Perché |
|---|---|---|
| Modalità di distribuzione | **authenticated** | Per entrare bisogna fare login. Senza, chi arriva alla porta comanda gli agent |
| Esposizione | **private** (la voce Tailscale, se la propone) | Niente su internet: ci si arriva solo dalla rete privata del passo 4 |
| Database | **embedded PostgreSQL** | Quello incluso: non devi installarne uno |
| Archiviazione | **local disk** | |

Poi dichiara l'indirizzo da cui ci si collegherà:

```bash
paperclipai allowed-hostname 100.x.y.z
```

**Come sai che è andata bene:**

```bash
paperclipai doctor
```

Stampa una diagnosi senza errori. La configurazione finisce in
`~/.paperclip/instances/default/config.json`.

**Se non va:**
- `paperclipai: command not found` → l'installatore l'ha messo in `~/.paperclip/cli` e la shell non
  ci guarda ancora: **chiudi e riapri il collegamento SSH**, che rilegge il percorso.
- `doctor` si lamenta di *host* o di *auth* → è la modalità sbagliata, o manca l'indirizzo
  autorizzato. Si corregge senza reinstallare: `paperclipai configure --section server`.

> ⚠️ **Nota per chi legge la guida ufficiale accanto a questa.** La guida Linux di Paperclip configura
> `authenticated` + **`public`**: esposto su internet, con dominio e reverse proxy. **Noi facciamo
> diversamente per scelta** (§7.4 e §9.4 del piano): niente indirizzo pubblico della macchina. Se
> segui la guida alla lettera ti ritrovi il pannello che comanda gli agent su internet — protetto da
> password, ma esposto.

---

## Passo 6 — Farlo restare acceso da solo

**Cosa fai:** fai in modo che Paperclip riparta da sé, invece di spegnersi quando chiudi il terminale.

**Come si fa.** Crea il file di servizio:

```bash
sudo tee /etc/systemd/system/paperclip.service > /dev/null <<'FINE'
[Unit]
Description=Paperclip control plane
After=network.target

[Service]
Type=simple
User=jacopo
Group=jacopo
WorkingDirectory=/home/jacopo
Environment=PAPERCLIP_DEPLOYMENT_MODE=authenticated
ExecStart=/usr/bin/npx paperclipai run
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
FINE
sudo systemctl enable paperclip
sudo systemctl start paperclip
```

**Come sai che è andata bene:**

```bash
systemctl status paperclip
```

Deve dire `active (running)`. Per vedere cosa scrive, in diretta:

```bash
sudo journalctl -u paperclip -f
```

⭐ **Non chiudere questa finestra:** il passo 7 ha bisogno di un indirizzo che compare **proprio qui**.

> **Cos'è `systemd`.** È la parte di Linux che tiene accesi i programmi che devono restare accesi. Un
> comando lanciato a mano muore quando chiudi il terminale; un *servizio* no — riparte anche dopo un
> riavvio della macchina. `Restart=on-failure` vuol dire: se Paperclip si pianta, riprovaci da solo
> dopo cinque secondi.

---

## Passo 7 — Diventare il proprietario, e aggiungere Claudio

**Cosa fai:** dichiari che l'azienda è tua, poi inviti la seconda persona.

**Come si fa.** Nella finestra del passo 6, fra le righe del registro, Paperclip stampa **una volta
sola** un indirizzo per rivendicare la proprietà (*board-claim URL*). Copialo e aprilo nel browser del
portatile — **adesso ci arrivi**, perché la rete privata del passo 4 è già in piedi.

Nel browser: entra o crea il tuo account se lo chiede, poi premi **Claim ownership** nel pannello
*Claim Board ownership*.

Poi Claudio: **Settings → Invites**, crea un collegamento d'invito e mandaglielo. Perché possa usarlo
dev'essere **anche lui nella rete privata** — lo inviti su Tailscale dal pannello di `tailscale.com`,
e lui fa il passo 4 sulla sua macchina. Quando usa l'invito, la richiesta compare in **Settings →
Access**, e lì la approvi.

**Come sai che è andata bene.** Entri nell'interfaccia e ti vedi come proprietario. Se Claudio ha già
accettato, in *Settings → Access* ci sono due persone.

**Se non va:** l'indirizzo del claim è **usa e getta** e scorre via nel registro. Se l'hai perso:

```bash
sudo journalctl -u paperclip | grep -i claim
```

⭐ **Da qui in poi Paperclip è raggiungibile anche dal telefono**, se hai fatto anche quel pezzo del
passo 4: apri `http://100.x.y.z:3100` nel browser del telefono e vedi la bacheca, approvi, commenti.

---

## Passo 8 — Claude Code sulla macchina, e il repository

**Cosa fai:** installi Claude Code **sulla VPS** — è quello che gli agent useranno per lavorare — e ci
porti il codice del CRM.

**Come si fa:**

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

Poi l'autenticazione. Lancia `claude` e segui quello che chiede:

```bash
claude
```

Sulla VPS non c'è un browser, quindi ti mostrerà **un indirizzo da aprire sul portatile**: lo apri,
autorizzi, e riporti indietro il codice che ti dà.

Infine il repository:

```bash
cd ~
git clone INDIRIZZO-DEL-REPOSITORY crmadv
```

**Come sai che è andata bene:**

```bash
claude --version
ls ~/crmadv/paperclip/skills
```

Il primo stampa un numero di versione; il secondo mostra le quattro cartelle delle skill. ⭐ **Se le
vedi, le skill sono già sulla macchina**: non si trasferiscono a mano, viaggiano dentro il repository.

> **Perché Claude Code va anche qui.** Quello sul tuo portatile sono io, che ti parlo. Quello sulla
> VPS è il motore che eseguirà il lavoro degli agent. Due installazioni distinte, due autenticazioni
> distinte.

---

## Passo 9 — Chromium per il collaudatore

**Cosa fai:** installi il browser che l'agent collaudatore userà per guardare il CRM e fare gli
screenshot.

**Come si fa:**

```bash
sudo apt-get install -y chromium-browser
```

**Come sai che è andata bene:** `chromium-browser --version` stampa una versione.

**Se non va:** su alcune Ubuntu il pacchetto si chiama `chromium`. Prova quello.

> Questo passo **non ha vincoli di ordine**: fallo quando vuoi. Serve dalla fase 2 in poi.

---

## Passo 10 — La chiave del consiglio

**Cosa fai:** ti autentichi con lo strumento a riga di comando di Paperclip. È da qui che nasce la
credenziale che userò io per costruire l'azienda.

**Come si fa.** Sul **portatile**:

```bash
paperclipai auth login --api-base http://100.x.y.z:3100
```

Si apre il browser su una pagina che dichiara cosa sta chiedendo. Premi **Approve CLI access**.

**Come sai che è andata bene:**

```bash
paperclipai auth whoami
```

Ti riconosce.

⛔ **Due regole su questa credenziale, dal §9.2 del piano:**

1. **È una password.** Non finisce in chat e non finisce nel repository. In questo progetto una
   password è già transitata in chat una volta, ed è rimasta nelle trascrizioni salvate sul disco.
2. **Le chiavi di Paperclip non hanno poteri limitati** — o possono tutto, o non esistono. Fra le
   facoltà c'è **approvare**, e approvare è funzione vostra, non mia: tutto l'impianto dei cancelli
   perde senso se le firma un assistente. **Non è imponibile tecnicamente, regge sul comportamento** —
   ed è per questo che sta scritta, non nonostante.

---

## Passo 11 — Il collegamento fra me e Paperclip

**Cosa fai:** registri il collegamento sul tuo portatile, così posso costruire l'azienda invece di
farti cliccare tutto a mano.

**Come si fa.** ⚠️ **La forma esatta del comando va riconfermata al momento** (§9.4): questa è quella
scritta nel piano. Serve la chiave del passo 10.

```bash
claude mcp add paperclip \
  --env PAPERCLIP_API_URL=http://100.x.y.z:3100 \
  --env PAPERCLIP_API_KEY=... \
  --env PAPERCLIP_COMPANY_ID=... \
  -- npx -y @paperclipai/mcp-server
```

⚠️ **Il nome del pacchetto dev'essere esattamente `@paperclipai/mcp-server`**, dall'organizzazione
`paperclipai`. Cercando «paperclip mcp» escono almeno tre pacchetti **di terzi** con nomi quasi
identici, e quello che installi **si porta dentro la chiave dell'azienda**.

**Come sai che è andata bene.** Me lo chiedi: faccio una lettura innocua — l'elenco degli agent — e ti
dico cosa vedo. Se rispondo con un elenco, anche vuoto, il collegamento c'è.

> **Cosa il collegamento NON dà**, perché «pieno potere» suona più largo di quello che è: parla solo
> con l'API di Paperclip. **Niente comandi sulla VPS**, niente database, niente codice, niente git. Il
> raggio d'azione è **una configurazione**. Gli agent che poi lavoreranno davvero sul CRM sono
> contenuti da altro — `main` protetto, un ramo per lavoro, revisione obbligatoria — ed è per questo
> che quegli argini vanno messi prima del primo compito, non prima del collegamento.
>
> 📱 **E non funziona dal telefono**, se te lo stai chiedendo: questo collegamento è un programma che
> gira **sul computer**, accanto a Claude Code, e l'app del telefono non fa girare programmi così. Dal
> telefono restano l'interfaccia di Paperclip via rete privata (passo 7) e i pulsanti di approvazione
> dentro Discord (fase 3) — che è poi la cosa che davvero serve fare da fuori.
>
> ⭐ **La regola d'ingaggio, che vale più del comando** (§9.4): il collegamento **resta acceso**, non
> si revoca niente a impianto finito. Il confine non è tecnico ma di mandato — **nessuna azione dentro
> Paperclip che non sia stata chiesta esplicitamente e chiaramente.**

---

## Passo 12 — La prova che chiude la fase

**Cosa fai:** verifichi il criterio di fine fase del piano, che è uno solo e preciso:

> **Un agent di prova si sveglia, esegue un comando innocuo, e lo vedete succedere da due computer
> diversi.**

**Come si fa.** Questo passo lo facciamo insieme: creo un agent di prova dal collegamento, gli do un
compito da nulla, e lo guardiamo partire. **«Da due computer diversi»** significa che anche Claudio,
dal suo, deve vedere la stessa cosa — è la prova che l'azienda è davvero condivisa e non un
giocattolo locale.

**Se non riesce:** ci si ferma qui e si capisce perché. Il piano è netto su questo per la fase 1
(*«se questa fase non riesce, ci si ferma qui»*), e vale a maggior ragione per la 0: **tutto il resto
poggia su questa.**

---

## Subito dopo, prima di dormirci sopra

| Cosa | Perché adesso |
|---|---|
| **Il salvataggio periodico della macchina** | Da questo momento sulla VPS c'è la memoria dell'azienda, e presto anche il database di sviluppo del CRM (rischio 8 del piano) |
| **Riscrivere la regola dei dev server in `CLAUDE.md`** | Diceva «una sola sessione accesa per volta» riferendosi ai vostri computer. Da adesso **riguarda la VPS** (§12.4, conseguenza ③) |
| **Verificare il «lucchetto di Prisma»** | Il piano lo dava per tornato; è quasi certamente un comportamento di Windows che su Linux non esiste. La fase 0 è il posto per accertarlo (§12.4, conseguenza ②) |

---

## Fonti

Verificate il 25/8/2026 sulla documentazione ufficiale:

- **Paperclip** — [installazione](https://docs.paperclip.ing/guides/getting-started/installation/) ·
  [modalità di distribuzione](https://docs.paperclip.ing/reference/deploy/deployment-modes/) ·
  [accesso privato via Tailscale](https://docs.paperclip.ing/reference/deploy/tailscale-private-access/) ·
  [accesso a più utenti](https://docs.paperclip.ing/how-to/enable-multi-user-login/) ·
  [autenticazione da riga di comando](https://docs.paperclip.ing/administration/cli-auth/) ·
  [repository ufficiale](https://github.com/paperclipai/paperclip)
- **Claude Code** — [installazione e autenticazione](https://code.claude.com/docs/en/setup)
- **Tailscale** — [piani e prezzi](https://tailscale.com/pricing) ·
  [scadenza delle chiavi](https://tailscale.com/kb/1028/key-expiry)
- **Il piano** — `piano-paperclip-2026-08-19.md`: §9.1 (cosa resta manuale), §9.3 (le quattro fasi),
  §9.4 (il collegamento), §12.4 (l'ambiente sulla VPS), §7.4 (perché Discord e non Telegram).

⚠️ **Un punto che da qui non si poteva verificare**, marcato anche nel testo: la forma esatta del
comando del **passo 11**. Si scopre eseguendo; **se si comporta diversamente, si aggiorna questo
file** invece di aggirarlo.

*Scritto il 25 agosto 2026 in `crmadv`. Copre la sola fase 0: le fasi 1-4 restano nel §9.3 del piano.*
