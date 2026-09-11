<!-- AMBITO-DOCUMENTO: consulenza-postazione-locale -->

> # ⛔ Questo documento non riguarda lo sviluppo del CRM
>
> **Vale solo per** le sessioni dell'assistente sul **PC Windows di Jacopo**, in ruolo di consulenza. **NON vale per** l'assistente che sviluppa dentro **Paperclip, sulla VPS**: se stai scrivendo codice o facendo commit su questo repository, **passa oltre** — non seguire, non applicare, non aggiornare, non citare.
>
> **Criterio meccanico:** Linux + VPS → ignora. Windows + `C:\Users\jacop\` → è per te. Spiegazione completa in `LEGGIMI.md`, in questa cartella.

---

> # 🗑️ DOCUMENTO VOLATILE — nasce per essere cancellato
>
> **Perché esiste:** il 9/9/2026 Paperclip si è bloccato e l'indagine è stata interrotta a metà da una decisione (passaggio a KVM 2). Questo file conserva le misure già fatte, così se il guasto torna **non si ricomincia da zero**.
>
> **Quando si cancella — basta una delle due:**
> 1. **Sono passate due settimane senza che il blocco si ripeta** sulla nuova taglia → il problema era la capacità, caso chiuso.
> 2. **Si è cambiato servizio di hosting** → questa macchina non esiste più, il dossier non descrive niente.
>
> **Prima di cancellarlo, leggi l'ultima sezione:** ci sono cinque fatti che restano veri comunque e vanno spostati altrove, non persi.
>
> Si cancella senza cerimonie: `git rm` del file e via. Non è citato da nessun altro documento.

---

# Incidente VPS del 9 settembre 2026 — cosa si è misurato

## In una riga

Paperclip ha smesso di rispondere perché **Hostinger ha messo il freno alla CPU della macchina** (limitazione automatica), dopo che qualcosa — mai identificato — ha saturato CPU e memoria a partire dalle 9-10 del mattino.

Non è stato un crash, non è stato un firewall, non è stata la rete. La macchina era accesa e i servizi erano vivi: erano **strozzati**.

## La cronologia, con le misure

| Momento | Fatto |
|---|---|
| Notte fra 8 e 9/9 | CPU piatta intorno al **40%**, RAM poco sopra **1 GB**. Situazione di riposo della macchina |
| **~9-10 del mattino** | CPU sale e si **incolla al 100%**. RAM salta a **~4 GB**, cioè il tetto. Le due cose insieme, nello stesso momento |
| Mattina | Hostinger applica la **limitazione della CPU**. Da qui in poi la macchina risponde al rallentatore |
| ~14:20 | Jacopo vede il banner *"Temporary Docker Manager issue"* ricaricando la panoramica hPanel |
| ~14:20 | Il terminale dell'app Paperclip dice *"Looks like your server isn't responding"* |
| ~14:30-14:50 | Misure dall'esterno (sotto). Tutto muto tranne il ping |
| ~14:50 | Jacopo cambia la password di root da hPanel → **la macchina si riavvia** |
| ~14:55 | Dopo il riavvio Paperclip torna a rispondere, ma **in 14,4 secondi** invece di frazioni di secondo |
| ~15:00 | Compare il banner **"Limitazione CPU attivata"**, con i grafici che datano l'inizio |
| ~15:10 | Decisione di Jacopo e Claudio: **passaggio a KVM 2** |

## Le misure dall'esterno (fatte dal PC di Jacopo)

| Prova | Esito | Cosa dimostra |
|---|---|---|
| `ping 191.218.160.114` | 4 su 4, ~31 ms | La macchina è accesa e il kernel risponde |
| Porta 22 (SSH) | timeout | — |
| Porta 80 / 443 | timeout | — |
| **Porta 12345** (inesistente) | **timeout** | ⭐ Su una macchina sana una porta chiusa risponde *subito* «non c'è nessuno». Un timeout anche lì significa **pacchetti scartati prima di arrivare** |
| `github.com` (controllo) | HTTP 200 in 0,36 s | Il collegamento di chi misurava funzionava: i timeout erano veri |
| Paperclip da **telefono su rete 4G** | `ERR_TIMED_OUT` | Il blocco valeva **per tutti**, non solo per la rete dell'ufficio |

## Le misure dall'interno (Console Web, dopo il riavvio)

**`ss -tlnp`** — tutti i servizi erano **in ascolto regolarmente**: `sshd` sulla 22, `traefik` su 80 e 443, `node` (API del CRM) sulla 3001 in locale, `docker-proxy` sulla 49928 verso Paperclip. Nessun servizio caduto.

**`iptables -S`** — `-P INPUT ACCEPT` e **nessuna regola sull'ingresso**. Solo catene `DOCKER`, che è la normalità. `FORWARD DROP` è il valore predefinito di Docker, non un blocco.

**`nft list ruleset`** — solo tabelle gestite da Docker. Niente di ostile.

**`docker ps -a`** — `traefik-traefik-1` (creato 4 giorni prima) e `paperclip-pblu-paperclip-1` (creato 7 giorni prima), entrambi `Up 4 minutes`: erano **ripartiti**, non ricreati. Coerente col riavvio causato dal cambio password.

## Le ipotesi scartate, e perché — leggi qui prima di rifare l'indagine

Questa è la parte che fa risparmiare tempo. **Cinque strade già battute e chiuse:**

1. **Memoria esaurita che blocca il sistema (OOM)** — era il primo sospetto, e i documenti del progetto lo indicavano come rischio noto della KVM 1. **Chiusa come causa del blocco**: dopo il riavvio il login in console è stato *immediato*, cosa impossibile su una macchina che annaspa sullo swap. ⚠️ **Ma non del tutto scagionata**: il grafico mostra la RAM salita al tetto dei 4 GB insieme alla CPU. La memoria era satura, semplicemente non era *lei* a bloccare — era il freno sulla CPU.

2. **Firewall sulla macchina** — **smentita**: `iptables -S` mostra `INPUT ACCEPT` senza regole, e `nft` non aggiunge niente.

3. **Bando dell'indirizzo IP dell'ufficio (fail2ban)** — **smentita** dal telefono su rete dati: stesso timeout da un indirizzo completamente diverso.

4. **Servizi caduti (Traefik, sshd, Paperclip)** — **smentita** da `ss -tlnp`: erano tutti in ascolto.

5. **Macchina morta o in crash** — **smentita** dal ping e dalle metriche del pannello, che continuavano ad aggiornarsi.

### La porta 22 chiusa NON è un guasto

Va scritto perché è il tipo di dettaglio su cui si perde mezza giornata: **la porta 22 risulta chiusa dall'esterno anche adesso che tutto funziona.** Il blocco sta a monte, nella rete di Hostinger, ed è quasi certamente una configurazione voluta (passano solo 80 e 443). Probabilmente l'ha impostata Claudio — **da confermare con lui**, ma non è materiale d'indagine.

Conseguenza pratica: **l'accesso SSH dall'esterno non è disponibile.** L'unica via d'ingresso è la **Console Web** di hPanel, che passa dall'hypervisor e funziona anche quando la rete della macchina è irraggiungibile. L'idea di «dare accesso SSH all'assistente» non è realizzabile finché quella porta resta chiusa.

## Cosa è rimasto senza risposta

L'indagine si è fermata qui. **Non si è mai scoperto cosa abbia saturato la macchina.** Queste cose non sono state fatte, e sono le prime da fare se il guasto torna:

- ❌ **La tabella delle cause di Hostinger** non è mai stata letta. Sta sotto ai grafici nella pagina *Utilizzo del server*, e **contiene l'elenco dei processi incriminati già identificati da loro**. È la fonte migliore e costa un clic.
- ❌ `ps aux --sort=-%cpu | head -12` — mai eseguito mentre la CPU era al 100%.
- ❌ `uptime` e `last reboot` — mai eseguiti.
- ❌ `docker logs --tail 50 1c73` (Paperclip) — mai letti.
- ❓ **Cosa è stato avviato verso le 9-10 del 9/9?** Un compito a un agent, il collaudatore con Chromium, un'esecuzione lasciata aperta? Se qualcuno se lo ricorda, è probabilmente la risposta.

## La decisione presa, e come si capisce se è servita

**Passaggio da KVM 1 a KVM 2** (deciso da Jacopo e Claudio insieme, 9/9/2026). Se la taglia è quella standard di Hostinger si passa da 1 processore e 4 GB a **2 processori e 8 GB** — da verificare nel pannello.

⚠️ **Attenzione, perché qui c'è un inganno possibile.** Raddoppiare la macchina **non elimina un processo impazzito**: gli dà spazio in cui girare senza far cadere tutto il resto. Se la causa era un consumo anomalo, la KVM 2 lo *nasconde* invece di risolverlo — e il freno può tornare, perché Hostinger guarda il consumo prolungato, non il picco.

**I tre segnali da guardare nei prossimi giorni** (pagina *Utilizzo del server*, vista *Ultima settimana*):

| Cosa guardare | Buon segno | Cattivo segno |
|---|---|---|
| **CPU a riposo** | scende verso il **20%** (lo stesso lavoro su doppia capacità) | resta al **40% o sale**: il consumo cresce da solo, non era la capacità |
| **RAM a riposo** | resta intorno a **1-1,5 GB** | risale verso il tetto: è una perdita di memoria, e su 8 GB ci mette solo il doppio del tempo |
| **Banner della limitazione** | non torna | ritorna: il problema non era la taglia |

## ⚠️ Cinque cose da salvare PRIMA di cancellare questo file

Restano vere anche se il dossier sparisce. Vanno spostate in `archivio-documenti/note-operative-ai.md` (le note condivise), perché servono anche a chi sviluppa dentro Paperclip:

1. **Cambiare la password di root da hPanel riavvia la macchina.** Non lo dice da nessuna parte. È costato un riavvio non pianificato durante un'indagine.
2. **L'accesso alla macchina è la Console Web, non SSH.** La porta 22 è chiusa a monte. La Console Web funziona anche a macchina irraggiungibile, perché passa dall'hypervisor.
3. **La Console Web sporca i comandi incollati.** Il testo arriva con dentro `^[[200~` e una `~` finale, e il comando fallisce con un `command not found` fuorviante. **I comandi lì si scrivono a mano.** (È parente della nota condivisa #67 sui comandi scritti per Jacopo.)
4. **Un timeout su una porta certamente chiusa significa "pacchetti scartati a monte", non "servizio morto".** Una porta chiusa su una macchina sana risponde subito. È il test che ha smontato tre ipotesi in un colpo, e costa dieci secondi.
5. **hPanel ha i backup giornalieri attivi**, e l'export di Paperclip si fa da *Company Settings → Company Packages → Export*. Il timore scambiato su WhatsApp — *«nel caso dobbiamo reinstallare la VPS»* — è meno grave di come sembrava.
