# Note operative AI — errori da non ripetere

> Documento di **auto-miglioramento** dell'assistente AI. Raccoglie modi sbagliati di eseguire operazioni ricorrenti (verifiche, avvii, comandi) e il modo corretto per non ripeterli.
>
> **Regola:** l'AI aggiorna questo file **in autonomia**, senza che glielo si chieda, ogni volta che individua un proprio procedimento inefficiente o errato. Va letto a inizio sessione (è richiamato in `CLAUDE.md`).
>
> Ogni voce è breve e azionabile: **Contesto → Errore → Modo corretto**.

---

## 1. Verifica visiva nell'anteprima: non ricaricare a raffica

**Contesto:** verifica di una modifica avviando l'anteprima locale (`preview_start` + controllo della pagina).

**Errore:** ricaricare / ri-navigare la pagina ripetutamente (`window.location.reload()`, riassegnare `location.href`) mentre sta ancora caricando. Ogni reload **interrompe** il caricamento in corso (errori `ERR_ABORTED`), trasformando un'attesa di ~10 secondi in decine di tentativi falliti e minuti persi.

**Modo corretto:**
- Dopo `preview_start`, **prima** guardare i log del server. Se compare `re-optimizing dependencies` (Vite, tipico al primo avvio di sessione o dopo un `npm install`), Vite ricaricherà **da solo** la pagina a fine ottimizzazione: **aspettare, non ricaricare**.
- Al primo avvio mettere in conto ~10 s una tantum (ready di Vite + eventuale ri-ottimizzazione dipendenze).
- Fare **un solo** controllo dopo un'attesa adeguata, non un ciclo reload–controlla–reload.
- Se serve davvero ricaricare, farlo **una volta sola** e poi attendere che `document.readyState === 'complete'` **e** che il nodo root sia montato (es. `#root` con figli), invece di controllare subito.

**Cause certificate (dai log Vite), oltre al comportamento manuale:**
- **Ri-ottimizzazione dipendenze dopo un `npm install`.** Se cambia `package-lock.json`, al successivo avvio Vite logga `Re-optimizing dependencies because lockfile has changed` e forza un reload: schermo vuoto per ~10-30 s. Va **aspettato**, non si riavviano i server ripetutamente.
- **Reload COMPLETO al posto dell'HMR (strutturale).** Modificando file condivisi ad alto livello (es. `src/styles/scss/globals.css`, `tailwind.css`, `src/lib/workspaceBranding.ts`, `App.jsx`) l'aggiornamento risale il grafo fino a `src/components/session-provider.tsx`, che **esporta un hook/context insieme a un componente** → incompatibile con Fast Refresh (`Could not Fast Refresh ("useSessionContext" export is incompatible)`). Vite allora fa un **page reload totale**: la SPA si re-inizializza da zero (remount React + ripristino sessione + branding) → alcuni secondi di `#root` vuoto **dopo ogni modifica** a quei file. Non è colpa dei reload manuali.

**Come comportarsi, di conseguenza:**
- Dopo una modifica a file di **tema/condivisi**, mettere in conto un **reload completo di ~5-10 s**: attendere una volta e fare **un solo** check (`#root` con figli + `data-bs-theme` presente), senza navigare/ricaricare nel frattempo.
- Le modifiche a **CSS di un singolo modulo/componente foglia** invece fanno vero HMR (veloci): lì si può controllare quasi subito.

**Possibile miglioramento strutturale (per una sessione dedicata):** spostare l'export `useSessionContext` fuori da `session-provider.tsx` (in un file separato, solo hook/context) ripristinerebbe il Fast Refresh ed eliminerebbe i reload totali, velocizzando **tutte** le verifiche in anteprima future.

---

## 2. Anteprima con più sessioni: porta assegnata vs porta di Vite

**Contesto:** un'altra chat teneva già occupata la porta 5173. Con `autoPort` attivo il preview tool assegna una porta libera (es. 54756) e la passa al processo via variabile d'ambiente `PORT`.

**Errore:** `vite` (script `npm run dev`, senza flag) **non legge la variabile `PORT`**: si è messo da solo sulla prima porta libera (5174), mentre il proxy dell'anteprima puntava a 54756 → pagina nera con `ERR_CONNECTION_REFUSED`. Diagnosticato tardi dopo vari reload a vuoto.

**Modo corretto:**
- In `vite.config.js` far leggere la porta assegnata: `server.port = process.env.PORT ? Number(process.env.PORT) : undefined` (già fatto — non cambia `npm run dev` normale, che resta su 5173).
- Se l'anteprima resta nera, **controllare subito la porta reale nei log di Vite** (`Local: http://localhost:XXXX/`) e confrontarla con quella assegnata dal preview tool: se differiscono, il problema è la porta, non il codice.
- In `.claude/launch.json` il frontend ha `"autoPort": true` così non contende la 5173 ad altre sessioni.

---

## 3. Due tipi di "card": Bootstrap `.card` vs primitive React `.glass-edge`

**Contesto:** scrivere override CSS mirati ai "blocchi/riquadri" (es. rifinitura Apple, o il test "separatori al posto delle scatole" sulla Dashboard).

**Errore:** dare per scontato che tutti i blocchi siano `.card` di Bootstrap. Le pagine legacy usano `.card` (Bootstrap/Jampack), ma le pagine già rifatte (Dashboard, Impostazioni, Checklist) usano le primitive React `src/components/ui/card.jsx`, che rendono un `div.glass-edge` **senza** la classe `.card`. Un selettore `.dashboard-flat .card` non ha quindi colpito nulla sulla Dashboard (0 elementi) → un giro di verifica sprecato.

**Modo corretto:**
- Prima di scrivere l'override, **verificare la classe reale** dell'elemento bersaglio (ispezione in anteprima: `document.querySelectorAll(selettore).length`, oppure guardare il JSX del componente). 
- Regola pratica: blocchi delle pagine **legacy** → `.card`; blocchi delle pagine **già su primitive `ui/`** → `.glass-edge`.
- Attenzione ai conflitti con `globals.css`: `.glass-edge` forza `border-color: transparent !important`; per disegnare una hairline su un blocco `.glass-edge` serve `!important` sul bordo (o usare un altro lato/pseudo-elemento).

---

## 4. Screenshot dell'anteprima in timeout: controllare PRIMA se la finestra è visibile

**Contesto:** verifica visiva con `preview_screenshot`; lo screenshot va in timeout dopo 30 s (successo poi di nuovo il 3 luglio 2026, come nella sessione precedente dove si era sospettato che l'effetto vetro fosse "troppo pesante").

**Errore:** attribuire il timeout alla pesantezza del CSS (gradienti/maschere dell'effetto vetro) e avviare lunghe indagini sulla resa. Verificato con test A/B: anche **disattivando completamente** l'effetto (`display:none` sugli pseudo-elementi) lo screenshot restava in timeout. La pagina intanto era viva e veloce (JS reattivo).

**Modo corretto:**
- Al primo timeout di `preview_screenshot`, eseguire subito `preview_eval` con `document.visibilityState`. Se risponde `"hidden"`, **la finestra di anteprima non è visibile a schermo**: il browser non disegna fotogrammi per le pagine nascoste e la cattura aspetta un frame che non arriva mai. Il codice non c'entra.
- Soluzione: chiedere all'utente di **aprire/mostrare il pannello di anteprima** e ritentare. Con `visibilityState === "visible"` lo screenshot riesce (verificato: stessa pagina, stesso effetto attivo, screenshot ok quando visibile).
- Nota collegata: gli stili si possono comunque verificare senza screenshot (ispezione con `preview_eval`/`preview_inspect`), che funziona anche a finestra nascosta.

---

## 5. Lint generale (`npm run lint`): ora gira su flat config, verde con avvisi advisory

> **Aggiornato il 22/7/2026:** migrato a **flat config** (`eslint.config.js`); il vecchio `.eslintrc.cjs` non esiste più. Le indicazioni sotto valgono per il nuovo assetto.

**Contesto:** dopo aver aggiunto/modificato file `.jsx`, per controllare la qualità del codice (regole React, hook) serve il lint generale, non solo `lint:css`/`lint:colors` (che coprono **solo** `src/modules/**`).

**Come funziona adesso:**
- `npm run lint` **gira ed è verde** (`0 errori`, ~13 avvisi advisory). Lo script è `eslint . --report-unused-disable-directives` (niente più `--ext js,jsx`, che nel flat config non è valido; niente più `--max-warnings 0`, che con gli avvisi pre-esistenti terrebbe il comando perennemente rosso). Anche `npx eslint <percorsi>` diretto ora funziona (trova `eslint.config.js`) — **non serve più** il vecchio trucco `ESLINT_USE_FLAT_CONFIG=false`.
- **I ~13 avvisi sono pre-esistenti e voluti**, NON vanno "sistemati" di straforo: `react-refresh/only-export-components` (file del design system che esportano componente + costante/hook, scelta strutturale — vedi nota #1) e `react-hooks/exhaustive-deps` (dipendenze degli hook, rischiose da auto-correggere). Verificare quindi solo che **i propri file nuovi/modificati** non aggiungano errori.
- **Il flat config NON abilita l'intero ruleset "React Compiler"** del plugin react-hooks 7.x (`set-state-in-effect`, `static-components`, `immutability`, `use-memo`…): tiene solo `rules-of-hooks` (error) ed `exhaustive-deps` (warn), fedele all'intento storico. Adottare quelle regole strette è una scelta a sé (molte correzioni di massa), **da concordare**.
- I `.ts` non si lintano qui (vedi #6): per i tipi si usa `tsc`.

---

## 6. I file TypeScript (`.ts`) non si lintano con l'ESLint del progetto

**Contesto:** dopo aver aggiunto/modificato file `.ts` (es. in `src/lib/`), si vuole controllarne la qualità come si fa con i `.jsx`.

**Errore:** lanciare eslint su un `.ts` restituisce `Parsing error: Unexpected token type` sulla parola chiave `type`/sulle annotazioni. Sembra un errore nel proprio codice, ma **non lo è**: il lint del progetto copre solo i `.js`/`.jsx` (il flat config `eslint.config.js` usa il **parser di default** espree, **senza** parser TypeScript) e lo `eslint.config.js` mira `src/**/*.{js,jsx}`. Quindi i `.ts` non sono proprio previsti da ESLint.

**Modo corretto:**
- Non lintare i `.ts` con ESLint. Per controllarne i tipi usare `tsc`:
  `./node_modules/.bin/tsc --noEmit --skipLibCheck --strict --moduleResolution bundler --module esnext --target es2020 --lib es2020,dom <file.ts>` (nessun output = ok).
- Il frontend usa `.ts` transpilati da Vite/esbuild (nessun type-check a build sui file front): il typecheck mirato con `tsc` è il modo per non far passare errori di tipo.
- I `.jsx`/`.js` restano da lintare come al punto 5.

---

## 7. Anteprima stretta: la tabella desktop è nascosta (misure tutte a 0)

**Contesto:** verifica di un componente con render doppio **tabella desktop** (`.d-none .d-md-block`) + **card mobile** (`.d-md-none`), es. la lista Clienti. Si misura l'altezza/larghezza di un elemento dentro la tabella desktop.

**Errore:** il pannello dell'anteprima è spesso **fisicamente stretto (~680px, < breakpoint md 768px)**. A quella larghezza la tabella desktop ha un **antenato** `.table-responsive.d-none.d-md-block` con `display:none`, quindi **tutto dentro misura 0** (larghezza/altezza). Ho interpretato quegli 0 come un componente rotto (falsa pista su "grid-rows non funziona dentro una cella di tabella"), sprecando diversi giri. Attenzione: `getComputedStyle(tabella).display` può dire `"table"` anche se un **antenato** è `display:none` → falso positivo di "visibile".

**Modo corretto:**
- Prima di misurare dentro una tabella desktop, controllare `window.innerWidth` e il `display` **dell'antenato** `.table-responsive` (non solo dell'elemento), oppure forzare un viewport largo: `preview_resize` con `width: 1280` (il preset `desktop` può "resettare alla dimensione nativa" che resta stretta — meglio una larghezza esplicita).
- Regola pratica: se una catena di elementi annidati misura **tutta 0**, sospettare per primo un **antenato nascosto** (viewport/responsive), non il CSS del componente.
- **Animare un blocco espandibile (collapse):** il trucco CSS `grid-template-rows: 0fr→1fr` **non è affidabile** con una `transition` attiva su Chromium recente (148): con la transizione, `1fr` risolve a **0px** (il track `fr` viene trattato come definito → contenuto invisibile a fine animazione); senza transizione `1fr` = contenuto. Anche `Collapse` di react-bootstrap qui finiva nella classe sbagliata (contenuto sparito). **Soluzione adottata:** primitiva `CollapsibleSection` che **misura l'altezza in JS** e anima `transition: height` tra px espliciti (`0px ↔ contenuto`, poi `auto`) — robusta e fluida ovunque, celle di tabella incluse. Attenzione: in fase di **chiusura** usare `setTimeout` e non `requestAnimationFrame` per il passo "px → 0px", perché a **tab nascosta** (anteprima non visibile) i rAF sono sospesi e l'animazione resta bloccata.

---

## 8. Animazioni di riga espandibile: `<table>` scatta, griglia a `div` no

**Contesto:** rendere fluida una riga che si espande (linguetta) in una lista dati.

**Errore:** dentro una `<table>` HTML, animare l'altezza di una riga costringe il browser a **rifare il layout dell'intera tabella ad ogni frame**. Misurato sulla lista Clienti: **~4,5 ms per re-layout** con `table-layout: auto`, ~2,7 ms con `table-layout: fixed` — abbastanza da far scattare l'animazione su macchine reali. Mitigazioni sulla tabella (fixed) aiutano ma non risolvono.

**Modo corretto:** per le viste dense con righe espandibili, usare un **layout a `div` con CSS Grid** invece della `<table>` (colonne via `grid-template-columns`, semantica preservata con `role="table"/"row"/"columnheader"/"cell"`). L'animazione dell'altezza avviene in contesto a blocco: costo di re-layout sceso a **~0,1 ms** (≈45× più leggero), animazione fluida. Come misurare il costo senza vedere gli FPS (anteprima nascosta): loop di N cambi d'altezza forzando il reflow sincrono (`void el.offsetHeight`) e dividere il tempo per N.

---

## 9. Scatto animazione: la causa era il RE-RENDER di React, non il CSS

**Contesto:** l'animazione della linguetta Clienti scattava anche dopo aver reso il layout leggerissimo (div grid, reflow 0,1 ms).

**Errore diagnostico:** dare per scontato che lo scatto di un'animazione sia sempre CSS/paint. Qui il vero costo era **un blocco del thread da ~462 ms al click**, perche' cambiare lo stato `expandedIds` in `ClientsList` ri-renderizzava **tutte le 24 righe** (12 desktop + 12 card mobile, sempre montate), ognuna con un `ClientActionsMenu` = `Dropdown` Bootstrap (Popper) + `Modal`. Il DOM diretto costava 3 ms, il toggle via React 462 ms → la differenza era tutta React.

**Come si diagnostica (anteprima VISIBILE):**
- `PerformanceObserver({entryTypes:['longtask']})` durante l'interazione: se compare un task da centinaia di ms al momento del click, e' JavaScript (render), non paint.
- Confronto **DOM diretto vs React**: fai la stessa modifica (toggle classe, cambio altezza) via `element.style`/`classList` e cronometrala; se e' cheap ma il toggle React e' lento, il costo e' nel re-render.
- Frame timing con `requestAnimationFrame`: a riposo deve dare ~16-17 ms costanti; durante l'animazione i buchi indicano dove.

**Modo corretto:** memoizzare. Estrarre la riga in un componente `React.memo` (`ClientGridRow`/`ClientMobileCard`) con **props stabili** (client dall'`items` in `useMemo`; callback in `useCallback`) → aprire una riga ne ri-renderizza **solo quella**, non le altre. Blocco sceso da 462 ms a **0 long task**. Memoizzare anche i figli pesanti riusati in lista (menu azioni, ecc.).

**Causa secondaria (paint):** un `backdrop-filter: blur()` su un elemento **fisso** (navbar glass) viene ri-rasterizzato ad ogni frame quando la pagina cambia layout → frame a 30-50 ms durante l'animazione. Non isolabile con `contain`/`translateZ` sulla lista. Mitigazione adottata: `CollapsibleSection` mette una classe `ui-collapse-animating` su `<html>` mentre anima; in `globals.css` quella classe **sospende** i backdrop-filter dei layer fissi (impercettibile, ~0,28 s). Nota: il blur della navbar spesso e' attivo **solo da scrollati** (a scroll-top e' `blur(0)`).

---

## 10. Verifica di flussi con login: l'anteprima è cross-origin, testa il backend via `curl`

**Contesto:** verificare una feature dietro autenticazione (es. una pagina che carica dati da API dopo il login).

**Errore:** provare a fare il login **dentro l'anteprima** compilando i campi e cliccando "Accedi". Due problemi: (1) `preview_fill` (o settare `input.value`) **non aggiorna lo stato controllato di React** → il form invia campi vuoti; (2) l'app chiama l'API su un'altra origine (`localhost:4000`), quindi il pannello `preview_network` — che mostra solo l'origine dell'anteprima — **non vede** le chiamate di login/API e non aiuta a diagnosticare.

**Modo corretto:**
- Per la verifica **funzionale** della logica server (nuovi endpoint, permessi, validazioni), testare l'API **direttamente via `curl`** su `http://localhost:4000`: `POST /auth/login` per ottenere il token, poi chiamare gli endpoint con `-H "Authorization: Bearer <token>"`. **Le rotte multi-tenant `/agency/**` (e in genere le rotte workspace) vogliono anche l'header `-H "x-workspace-id: <id>"`** (in alternativa `x-workspace-slug`): senza, rispondono `400 "Workspace header is required"`. Id workspace e dati utente arrivano dal login; password dei seed demo: **admin `admin123`**, **membri `demo123`** (in `prisma/seed-demo.ts`). È più veloce e affidabile del browser. L'API in `tsx watch` **ricarica da sola** le modifiche ai file `server/**` (anche se il server l'ha avviato un'altra sessione, stessa cartella).
- L'anteprima frontend serve soprattutto a confermare che **compili e monti senza errori**: dopo `preview_start`, guardare `preview_logs`/`preview_console_logs` e la lista `preview_network` (i propri file nuovi devono comparire `200 OK`).
- Se serve **davvero** autenticarsi nel browser, settare i campi con il setter nativo + evento: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true}))`. Ma di norma non vale la pena: verifica il server via `curl`.
- Per **confermare che una pagina renderizzi** con i dati veri, usare `preview_eval` che legge il DOM (titoli `h3/h6`, righe `table tbody tr`, `.badge`) invece dello **screenshot**: su questa app (pagina pesante, molti chart) `preview_screenshot` va spesso in **timeout a 30s**, mentre l'ispezione DOM è istantanea e più precisa. Attenzione al **timing**: un server Vite appena avviato su porta random fa il pre-bundling (lento); dopo `location.href=...` dare ~3-4s prima di leggere il DOM, o l'area principale risulta ancora vuota.

---

## 11. Verifica "il file .jsx compila" senza browser: transpile via HTTP su Vite

**Contesto:** confermare che un componente `.jsx` modificato compili, senza attraversare login/anteprima (dietro auth, cross-origin). Vite trasforma i moduli on-demand: `curl http://localhost:<porta>/src/.../File.jsx` restituisce 200 se transpila, 500 con l'errore se no. Modo rapido e affidabile.

**Errori riscontrati e come evitarli:**
- **HTTP 000 al primo transform.** Un file "foglia" che importa librerie pesanti (`react-bootstrap`, `lucide-react`) al **primo** `curl` innesca il **pre-bundling delle dipendenze** di Vite: può superare i ~30-60s. Un `curl -m 30` torna `HTTP 000` (timeout, non errore di codice). **Non** concludere "errore": rilancia **una volta** con timeout ampio (`-m 90/120`). Il secondo tentativo (dipendenze già ottimizzate) risponde 200 in pochi secondi.
- **"Server not found" / porta morta.** Tra un check e l'altro il server di anteprima può **essersi fermato** (altra sessione, timeout): un `curl` alla vecchia porta dà `HTTP 000` per connessione rifiutata. Prima di indagare il codice, verificare con `preview_logs`/`preview_list` che il server sia vivo; se no, `preview_start` (ri-assegna una porta con `autoPort`) e usare la **porta nuova**.
- Regola pratica: `HTTP 000` = problema di **rete/timeout/porta**, non di sintassi. Solo un **500 con corpo** è un errore reale di compilazione.

---

## 12. pgvector non è installabile dalla sessione AI (Postgres nativo Windows, no admin)

**Contesto:** la V4 (vettorizzazione/RAG) richiede l'estensione `pgvector` sul Postgres. Verificato: `pg_available_extensions` non elenca `vector` → `CREATE EXTENSION vector` fallirebbe.

**Perché non si può fare in autonomia:** il Postgres è un'installazione **nativa EDB** in `C:\Program Files\PostgreSQL\17\` (niente Docker da swappare). Aggiungere pgvector richiede: (a) scrivere i file dell'estensione dentro `Program Files` → **permessi admin** (la sessione AI **non** è admin, `...\17\lib` non è scrivibile); (b) toolchain **MSVC** per compilarlo (assente) o binari precompilati di terze parti (da non scaricare in `Program Files` in autonomia); (c) riavvio del servizio. UAC non è concedibile da una shell non interattiva.

**Modo corretto:** non tentare workaround rischiosi. È pronto lo script `scripts/install-pgvector-win.ps1` (idempotente) da lanciare **una volta come amministratore**: installa i Build Tools se mancano, compila+installa pgvector, abilita l'estensione. Finché l'utente non lo esegue, costruire il RAG con embeddings reali è bloccato (il resto del Modulo Fonti funziona senza).

**Aggiornamento (10/7/2026): FATTO.** L'utente ha eseguito lo script come amministratore: pgvector **installato e attivo** (`vector` versione **0.8.0**) sul database `crm_advaiora`. Il RAG è sbloccato. (Durante l'esecuzione: la richiesta interattiva della password di `postgres` si evita impostando prima `$env:PGPASSWORD="postgres"` nella finestra, così `psql` non chiede nulla — utile perché la digitazione "alla cieca" del prompt password si sporca facilmente con Invio multipli.)

---

## 13. Script PowerShell (.ps1): mai caratteri non-ASCII (il trattino lungo "—" rompe tutto)

**Contesto:** ho scritto `scripts/install-pgvector-win.ps1` per l'utente. Al primo lancio su Windows PowerShell 5.1 dava `ParserError: TerminatorExpectedAtEndOfString` alla riga 121 (una riga di per sé corretta) — errore fuorviante, la vera causa era altrove.

**Errore:** nel file avevo usato il **trattino lungo `—` (em dash, U+2014)** dentro stringhe (righe 2, 3, 120). Il file era salvato in **UTF-8 senza BOM**; Windows PowerShell 5.1 legge i `.ps1` senza BOM con il **codepage ANSI (cp1252)**, non UTF-8. L'em dash (3 byte in UTF-8) viene interpretato come 3 caratteri, l'ultimo dei quali è una **virgoletta "tipografica"** che PowerShell tratta come **delimitatore di stringa** → sbilancia le virgolette e l'errore "esplode" molte righe dopo (a riga 121), non dove sta il carattere colpevole.

**Modo corretto:**
- Negli script `.ps1` (e in genere nei file che PowerShell 5.1 esegue) **usare solo ASCII**: trattino normale `-` al posto di `—`/`–`, apostrofo dritto `'` al posto di `'`, virgolette dritte `"`/`'` mai "tipografiche". Nei commenti in italiano preferire apostrofi al posto degli accenti (`gia'`, `puo'`) come già fa lo script.
- Se serve testo non-ASCII, salvare il file **UTF-8 con BOM**.
- **Diagnosi rapida** di un `ParserError: TerminatorExpectedAtEndOfString` che punta a una riga apparentemente sana: cercare caratteri non-ASCII in **tutto** il file, non solo alla riga segnalata. Comando: leggere le righe e filtrare i char con codice > 127.
- **Verifica senza eseguire** che un `.ps1` sia sintatticamente valido: `[System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$null,[ref]$errors)` e controllare `$errors` (nessuna esecuzione dello script).

---

## 14. Audit grafico chiaro/scuro: dove cercare i colori e cosa NON riscrivere

**Contesto:** passata di pulizia chiaro/scuro su un'area (es. Agency). Obiettivo: eliminare i "box bianchi in tema scuro" senza sprecare giri su codice già a posto.

**Due trappole in cui non ricadere:**
- **`npm run lint:colors`/`lint:css` coprono solo `src/modules/**`.** Le pagine in `src/views/**` (tutta l'area Agency e' `src/views/Agency`) **non sono lintate**: un lint verde NON vuol dire che quell'area sia pulita. I colori a mano vanno cercati a mano con grep (`#[0-9a-fA-F]{3,8}`, `rgba?\(`, `bg="light"`, `bg-white`, `text-bg-light`, `variant="light"`).
- **Molti pattern "sospetti" nei JSX sono gia' neutralizzati da `globals.css`.** Prima di riscrivere a tappeto i componenti, verificare cosa fa gia' il sistema globale: `.badge.bg-light`/`.text-bg-light` sono rimappati a `var(--muted)`+`var(--foreground)`; `[data-bs-theme="dark"] .bg-white` -> `var(--card)`; `--bs-light` e `.btn-light` sono tematizzati. Quindi `Badge bg="light"`, `div bg-white`, `Button variant="light"` **funzionano gia' in scuro** e NON vanno toccati.
  - ⚠️ **Correzione del 25/8/2026.** Questa riga finiva con *«Restano scoperti (da sistemare) i casi non nella lista di globals, es. `Alert variant="light"` (`.alert-light` non e' tematizzato)»*. **Era falso, ed e' stato tolto.** `.alert-light` **e' tematizzato**, ma da un terzo posto che questa nota non contemplava: `src/styles/scss/style.scss` (la regola `&.alert-light`, righe ~17889-17895), dove i valori fissi sono **commentati** e sostituiti da `var(--hk-text-secondary)` / `var(--hk-bg-secondary)` / `var(--hk-border-tertiary)`, ognuno marcato `// <-- THEMED`; le tre variabili `--hk-*` sono definite due volte in `globals.css`, una per tema.
  - ⭐ **La lezione che vale piu' del caso singolo: i posti dove cercare sono TRE, non due.** Il JSX, `globals.css`, **e lo strato `--hk-*` dentro l'SCSS di Jampack** — che e' quello che si salta sempre, perche' e' un file di terze parti da 18.000 righe che nessuno apre. Prima di dichiarare una classe "scoperta", la terza ricerca va fatta li'. **Quante altre classi Jampack passino da quell'indirezione non e' stato enumerato:** le altre voci di questa nota vanno trattate come piste, non come verdetti.
  - *Trovato dallo sviluppo delle skill Paperclip (`crm-design-frontend`), verificato sul codice il 25/8/2026. Contava correggerlo alla fonte perche' da questo file viene **generata** la skill `crm-note-operative`, che il piano da' **a tutti gli agent**: una riga falsa qui sarebbe diventata una riga falsa nel bagaglio di ogni mestiere.*

**Dove stava il vero problema (caso Agency):** un CSS di area dedicato (`src/views/Agency/agency-ui.css`) che definiva i propri colori con **esadecimali chiari fissi** (`#ffffff`, `#f8fafc`, ...) e li imponeva con `!important`, **senza blocco `[data-bs-theme="dark"]`**. Dentro l'area scavalcava il sistema a token -> box e campi (`form-control`) bianchi in scuro. Fix: convertire tutti i valori in token globali (i propri alias `--agency-*` puntati a `var(--card|--muted|--border|--foreground|--primary|--accent)`), cosi' cambiano da soli.

**Come verificare il fix senza screenshot (anteprima spesso `visibilityState: "hidden"`, nota #4):** ispezione DOM con `getComputedStyle`. In dark, il `backgroundColor` dei box deve risultare una superficie scura (es. `rgb(17,17,19)` = `--card`), non `rgb(255,255,255)`. Prova rapida "a colpo d'occhio": contare gli elementi con sfondo bianco puro residuo dentro l'area — deve essere **0**: `[...shell.querySelectorAll('*')].filter(e=>getComputedStyle(e).backgroundColor==='rgb(255, 255, 255)').length`. Controllare anche il chiaro forzando `data-bs-theme="light"` un istante e rileggendo (deve tornare bianco/chiaro come prima).

---

## 15. Prisma migrate/generate su Windows: fermare prima il server API (lock DLL)

**Contesto:** modifica di `schema.prisma` seguita da `prisma migrate dev` (o `prisma generate`) mentre il server API di sviluppo (`npm run dev:api`, `tsx watch`) e' acceso — tipico durante una sessione con l'anteprima gia' avviata.

**Errore:** la migrazione si applica al DB, ma la **rigenerazione del client Prisma fallisce** con `EPERM: operation not permitted, rename '...\.prisma\client\query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'`. Causa: il processo Node dell'API tiene un **lock** sulla DLL del query engine (usa `@prisma/client`), quindi Windows non puo' sostituirla. Il client resta vecchio (senza i nuovi modelli) e l'API userebbe un client disallineato anche dopo il reload di `tsx watch`.

**Modo corretto:**
- Prima di `prisma migrate dev`/`prisma generate`, **fermare il server API** (`preview_stop` del processo `api`, o chiudere `dev:api`). Poi lanciare il comando Prisma e **riavviare** l'API (caricera' il client rigenerato).
- Se l'EPERM capita comunque: la migrazione **e' gia' applicata al DB** (lo dice l'output "have been created and applied"); basta fermare l'API e rilanciare **solo** `npx prisma generate`, poi riavviare l'API.
- Il frontend Vite non c'entra (non usa Prisma): fermare **solo** l'API, non serve toccare il preview del frontend.

---

## 16. `prisma migrate dev` e' interattivo: in sessione AI usare diff + deploy

**Contesto:** creare una nuova migrazione tracciata dalla sessione AI (ambiente non-interattivo).

**Errore:** `npx prisma migrate dev --name ...` fallisce con *"Prisma Migrate has detected that the environment is non-interactive, which is not supported"*. Capita **anche con `--create-only`** quando c'e' un warning (es. un nuovo `@@unique` su colonna che "potrebbe avere duplicati"): il warning richiede una conferma interattiva che in sessione non si puo' dare.

**Modo corretto (verificato 14/7/2026):** generare l'SQL col diff e comporre il file di migrazione a mano, poi applicarlo con `migrate deploy` (non-interattivo):
1. `npx prisma migrate status` → deve dire "up to date" (se no, prima riconciliare; non forzare).
2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` → stampa l'SQL del diff DB↔schema. **Leggerlo**: dev'essere solo la modifica attesa (nessun DROP inatteso).
3. Creare la cartella `prisma/migrations/<AAAAMMGGhhmmss>_<nome>/` (timestamp con `date +%Y%m%d%H%M%S`) e scrivere l'SQL in `migration.sql`.
4. `npx prisma migrate deploy` (applica solo le pending) e poi `npx prisma generate` (a API ferma, per il lock DLL — vedi #15).
5. Verificare con `migrate status` ("up to date") e una query sulle nuove colonne/indici.

Cosi' la migrazione resta **tracciata** (regola del progetto), additiva e senza prompt.

---

## 17. Fermare processi per PID/command-line: escludere il proprio processo

**Contesto:** fermare il server API su una porta (es. per il lock Prisma) filtrando i processi per command-line con `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'server/index.ts' -or ... }`.

**Errore:** il filtro ha **incluso il processo PowerShell che eseguiva il comando stesso** — la sua command-line conteneva le stringhe cercate (`server/index.ts`, `dev:api`, `tsx`, `watch`) come testo dello script → il comando si e' **auto-terminato** (exit 255) dopo aver killato i target ma prima di stampare l'esito.

**Modo corretto:** nel filtro escludere il proprio PID: `Where-Object { $_.ProcessId -ne $PID -and (... match ...) }`. In alternativa, individuare il PID dalla porta (`Get-NetTCPConnection -LocalPort 4000 -State Listen`) e risalire all'albero, senza matchare per testo dello script. Verificare **sempre** dopo, con un comando separato che non contenga le stringhe di ricerca, che la porta sia libera e che il frontend/preview non sia stato colpito.

---

## 18. Verifiche via `curl`: il `/tmp` di Git Bash non esiste per Node, e niente `sleep` in primo piano

**Contesto:** collaudo di endpoint via `curl` (nota #10), salvando le risposte JSON su file per rileggerle con `node -e`.

**Tre errori, tutti costati giri a vuoto:**
- **`/tmp` non e' condiviso.** `curl ... > /tmp/login.json` scrive dove Git Bash crede, ma `node -e "require('/tmp/login.json')"` lo cerca in `C:\tmp\...` e fallisce con `MODULE_NOT_FOUND`. Bash e Node interpretano lo stesso percorso in modo diverso.
- **`sleep` in primo piano e' bloccato** dall'ambiente: `sleep 6; curl ...` va in timeout e non esegue nulla.
- **Dare per scontata la forma della risposta.** Ho scritto `login.data.user.workspaceId` senza guardare: il workspace sta in `data.workspace.id`, non dentro `user`.

**Modo corretto:**
- Salvare i file di lavoro nella **cartella scratchpad di sessione** con percorso in stile Windows (`C:/Users/.../scratchpad`), che Bash e Node leggono entrambi. Metterla in una variabile a inizio comando: `SP="C:/Users/.../scratchpad"`.
- Per aspettare che un server sia su, **niente sleep**: ciclo di ritentativi che esce al primo successo — `for i in $(seq 1 20); do r=$(curl -s -m 5 ...); [ -n "$r" ] && break; done`. Oppure Bash in background con `until`.
- Al primo uso di una risposta, **stamparla** (`JSON.stringify(d,null,1)`) invece di indovinare i campi.
- Nota di contorno: dopo aver toccato `server/**`, `tsx watch` ricarica e per qualche secondo l'API **risponde vuoto**. Una risposta vuota subito dopo una modifica non e' un errore del codice: ritentare.

---

## 19. Anteprima: leggere il DOM subito dopo `navigate` da' zero elementi (non e' codice rotto)

**Contesto:** verifica che una lista renderizzi certi attributi (`document.querySelectorAll('[data-ask-ai-type]').length`).

**Errore:** eseguire la query **subito** dopo `navigate`. Ha risposto `0` e stavo per concludere che gli attributi non venivano applicati: ho perso un giro a ricontrollare il sorgente e il modulo servito da Vite (che erano corretti). In realta' la lista carica i dati via API: al momento della query le righe non c'erano ancora. Poco dopo, la stessa query ne trovava 12 con tutti gli attributi.

**Modo corretto:**
- Dopo `navigate`/cambio rotta, prima verificare che la **vista sia popolata** (es. `document.querySelectorAll('.clients-grid-row').length > 0`), e solo allora misurare il dettaglio.
- Meglio ancora: fare la verifica dentro una IIFE asincrona con una piccola attesa — `(async () => { await new Promise(r => setTimeout(r, 1500)); ... })()`. Attenzione: `javascript_tool` **non accetta `await` al livello superiore**, va sempre incapsulato in `(async () => { ... })()`.
- Regola pratica: `0 elementi` subito dopo una navigazione = **timing**, non codice. Prima di indagare il sorgente, rimisurare a vista caricata (vedi anche #7 per il caso opposto: tutto 0 per un antenato nascosto).

---

## 20. Script Node di verifica: dalla cartella scratchpad `@prisma/client` non si risolve

**Contesto:** verifica del modello dati con uno script `node` che usa Prisma, scritto nello scratchpad di sessione come prescrive la nota #18.

**Errore:** `node C:/.../scratchpad/check.mjs` fallisce con `ERR_MODULE_NOT_FOUND: Cannot find package '@prisma/client'`. La nota #18 dice di usare lo scratchpad per i file di lavoro, ed e' giusto **per i dati** (JSON letti/scritti da curl e node), ma **non per gli script che importano dipendenze del progetto**: Node risolve i moduli risalendo da dove sta il file, e lo scratchpad non ha nessun `node_modules` sopra di se'.

**Modo corretto:**
- Gli script che importano roba del progetto (`@prisma/client`, moduli `server/**`) vanno scritti **dentro la cartella del progetto** (es. `./tmp-check.mjs`) e **rimossi subito dopo**, nello stesso comando: `node ./tmp-check.mjs; rm -f ./tmp-check.mjs`. Metterli in coda con `;` e non `&&`, cosi' la pulizia avviene anche se lo script fallisce.
- Lo scratchpad resta il posto giusto per i **file di dati** (risposte curl, output intermedi), con percorso in stile Windows.
- Se lo script tocca il DB demo, **ripulire i dati creati** a fine verifica e stampare il conteggio finale per dimostrare che non e' rimasto niente.

---

## 21. Un parametro nuovo va collegato a TUTTE le rotte, non solo a quelle che si stanno provando

**Contesto:** introdotto `conversationId` (quale sessione della chat aprire) nel service; collegato solo alle rotte di **lettura**, perche' erano quelle che stavo verificando.

**Errore:** invio, azzeramento e partecipanti continuavano ad accettare la querystring ma **la ignoravano**, ricadendo in silenzio sul valore predefinito ("l'ultima sessione"). Nel test l'invito e' finito **su una sessione diversa da quella richiesta senza alcun errore**, e per capirlo ho perso un giro sospettando la logica di congelamento (che era corretta). Un parametro esplicito ignorato in silenzio e' peggio di un parametro non supportato: il chiamante crede di aver agito su X e ha agito su Y.

**Modo corretto:**
- Quando si aggiunge un parametro che **seleziona su cosa si agisce**, censire subito TUTTE le rotte che toccano quell'oggetto (`grep` sul nome del service) e collegarlo ovunque nello stesso passaggio — non solo dove serve al test del momento.
- Nel dubbio tra "ignorare" e "fallire": far **fallire**. Un 400 si scopre subito; un fallback silenzioso no.
- Regola di verifica: se un test si comporta in modo strano, prima di sospettare la logica **controllare che il parametro sia arrivato davvero** fin dentro il service.

---

## 22. Anteprima: il tema di questo progetto e' `data-bs-theme`, non `data-theme`

**Contesto:** verificare che un componente nuovo funzioni in chiaro e scuro, commutando il tema da `javascript_tool` e rileggendo i colori calcolati.

**Errore:** ho impostato `document.documentElement.setAttribute('data-theme', 'light')` — l'attributo standard che si usa altrove — e i colori **non cambiavano**. Stavo per concludere che i token non rispondessero al tema (cioe' un difetto inesistente nel mio CSS). In realta' il progetto e' su tema Bootstrap 5: l'attributo e' **`data-bs-theme`** (`globals.css`: `[data-bs-theme="light"]` / `[data-bs-theme="dark"]`, piu' la classe `.dark`).

**Modo corretto:**
- Commutare con `document.documentElement.setAttribute('data-bs-theme', 'light'|'dark')`, e **rimettere il valore di partenza** a fine verifica.
- Prima di dichiarare che "il tema non funziona", **controllare come si commuta davvero** (`grep -nE "^\[data-|prefers-color-scheme" src/styles/scss/globals.css`).
- Prova utile: leggere i colori calcolati nei due temi e confrontarli — se cambiano entrambi, i token stanno funzionando. Vale piu' di uno screenshot.
- Nota: `computer{action:"screenshot"}` in questa sessione andava in **timeout** pur con la pagina viva e la console pulita. Se succede, non e' l'app: verificare col DOM (`javascript_tool` / `read_page`) e proseguire.

---

## 23. Verificare un POLLER in anteprima: e' fermo perche' la pagina e' nascosta

**Contesto:** collaudo di una lista che si aggiorna da sola (polling ogni N secondi), es. i contatti della messaggistica nel popup.

**Errore:** ho aperto una conversazione (che segna i messaggi come letti), sono tornato all'elenco e ho visto il contatore dei non letti **ancora a 1**. Stavo per dare la colpa al mio poller. In realta' il poller e' gated su `document.visibilityState === 'visible'` (giustamente: non si spreca rete a tab nascosta) e **l'anteprima e' quasi sempre `hidden`** (nota #4). Il giro veniva saltato **di proposito**: codice corretto, misura sbagliata.

**Modo corretto:**
- Prima di sospettare il codice, chiedere al **server** qual e' la verita': `curl` sull'endpoint (qui `/messages/users`) diceva gia' `unreadCount: 0`. Se server e UI divergono, il problema e' il rinfresco, non la scrittura.
- Poi controllare `document.visibilityState`: se `hidden`, ogni poller gated e' fermo per definizione.
- Per provare che il caricamento funziona **senza** dipendere dal poller, innescare una rilettura per un'altra via che non passi dal gate (qui: inviare la **ricerca**, che rilancia la fetch). Ha restituito subito il dato fresco.
- Regola: **dato stantio in anteprima ≠ dato sbagliato**. Confronta sempre con l'API prima di mettere mano al codice.

---

## 24. Un elenco "vuoto" puo' essere una CORSA fra due chiamate, non un elenco vuoto

**Contesto:** aprendo un ambito della chat, l'elenco delle sessioni diceva "Nessuna conversazione" mentre la chat accanto era aperta e viva.

**Errore (nel codice, trovato collaudando):** due chiamate lanciate **in parallelo** — `loadChat` (che alla prima apertura **crea** la sessione) e `loadSessions` (che la **legge**). La lettura arrivava prima della creazione: elenco vuoto su una sessione che stava per esistere. Il difetto c'era da quando esiste l'elenco, ma si vedeva solo aprendo la tendina nell'istante giusto; e' diventato sistematico quando l'elenco e' passato a **colonna sempre a video**.

**Come si diagnostica:** l'indizio e' che **rientrando** nello stesso ambito l'elenco si popola (la seconda volta la sessione esiste gia'). Se un elenco e' vuoto solo **la prima volta**, non e' vuoto: e' una corsa. Conferma decisiva: chiedere al server (`curl` su `/agency/chat/sessions`) — diceva **1 sessione**, con `createdAt` all'istante del click.

**Modo corretto:** quando una chiamata **crea** cio' che un'altra **legge**, non lanciarle con due `void` affiancati: metterle in sequenza in un solo helper (`await crea(); await leggi();`) e usare quello **ovunque** si apre l'oggetto — cosi' l'ordine e' garantito in un punto solo e non si ricrea al prossimo punto d'ingresso (stessa logica della nota #21).

---

## 25. `display: flex` su un contenitore di testo spezza la frase a ogni tag

**Contesto:** lo stato vuoto di una lista con del testo che contiene `<strong>` (es. *"Scrivi e usa **@AI** (o **Chiedi all'AI**) per una risposta"*).

**Errore:** il contenitore aveva `display:flex; flex-direction:column` (serviva per centrare testo + bottone in un altro uso). Con il flex, **ogni figlio diventa un flex item**: i tre spezzoni di testo e i due `<strong>` sono finiti su **cinque righe** incolonnate, alte 154px in tutto. Sembra un errore di copy, e' un errore di layout — e non si vede leggendo il JSX.

**Modo corretto:**
- Il testo dentro un contenitore flex va avvolto in **un solo elemento** (`<p className="mb-0">…</p>`): torna una frase sola (154px → 76px).
- Diagnosi rapida: `[...el.childNodes].map(n => n.textContent.trim()).filter(Boolean)` — se restituisce **piu' spezzoni** dove ti aspetti una frase, il flex li sta incolonnando.
- Regola: prima di mettere `display:flex` su qualcosa che contiene prosa, chiedersi se ci sono tag inline dentro.

---

## 26. Screenshot dell'anteprima: cattura la PAGINA, non la viewport

**Contesto:** screenshot del popup a tutto schermo per la verifica visiva.

**Errore:** nello screenshot il pannello sembrava riempire solo meta' altezza, con una fascia nera sotto — e sembrava anche **duplicato** sulla destra. Stavo per indagare un doppio montaggio del componente e un `height:100%` rotto. **Nessuno dei due esisteva:** `document.querySelectorAll('.ai-chat-panel').length` dava **1**, e il pannello misurava **640px su una viewport di 640px**.

**Perche':** la cattura restituisce l'immagine dell'**intera pagina scrollabile** (e scalata: viewport 1000x640 → immagine 800x512). Un overlay `position: fixed` copre solo la viewport, quindi tutto il contenuto della pagina sotto compare **oltre** il pannello e sembra spazio vuoto o roba duplicata.

**Modo corretto:** lo screenshot serve a mostrare il risultato all'utente, **non a misurare**. Per le dimensioni usare sempre `getBoundingClientRect()` confrontato con `window.innerHeight/innerWidth`. Se una misura "a occhio" sullo screenshot contraddice il CSS, misurare col DOM prima di toccare il codice (vale anche al contrario, vedi #7).

---

## 27. La pane dell'anteprima si blocca (CDP wedged): `navigate` va, ma DOM/evaluate no

**Contesto:** verifica dal vivo di una pagina; a un certo punto **ogni** ispezione del DOM va in timeout a 30s (`javascript_tool`, `read_page`, `get_page_text`, `computer{screenshot}`), mentre `navigate` continua a rispondere.

**Errore (di interpretazione):** dare la colpa al proprio codice — sospettare un **loop di render** che pianta il thread. Ho perso molti tentativi (5+ riavvii del preview, tab nuove, `about:blank`) prima di riconoscere che era la pane. **Indizi che NON e' il codice:**
- il blocco si presenta **anche su una tab `about:blank`** (che non esegue l'app) e **anche su `/dashboard`** (che non monta il componente nuovo);
- **la console non ha errori** — in particolare **manca `Maximum update depth exceeded`**, che React logga *sempre* per un loop di `setState`. Nessun errore = nessun loop;
- `navigate` funziona ma `evaluate`/`get_page_text`/`screenshot`/`read_page` no: e' il **canale Runtime/DOM del CDP** a essersi piantato, non il main thread della pagina;
- sopravvive ai riavvii del server di preview (il canale resta wedged).

**Modo corretto:**
- Al **secondo** timeout consecutivo di ispezione DOM con `navigate` ancora vivo, **fermarsi**: e' la pane, non il codice. Non riavviare il preview a raffica (ogni cold start di Vite qui e' 30-70s e il canale si ri-pianta).
- **Distinguere loop da pane in un colpo:** leggere la console (`read_console_messages`). Se e' pulita (niente `Maximum update depth exceeded`, niente `RangeError: Maximum call stack`), **non c'e' loop di render**: il problema e' ambientale.
- **Verificare comunque, per altri canali:** `curl` sul transform Vite del file (`http://localhost:<porta>/src/.../File.jsx` → 200 = compila, nota #11); `lint`; `tsc --noEmit`; `npm run test:unit`; `npm run build`. Se sono tutti verdi e la console non ha errori, il codice e' sano: la **resa visiva** resta l'unica cosa non verificata, da guardare quando la pane torna (o dalla persona in staffetta).
- **Progettare per non dipendere dal pixel:** se un layout ha un valore stimato (es. `height: calc(100dvh - 116px)` per togliere topbar+tab), mettere `overflow: hidden` sul contenitore, cosi' una stima imperfetta non produce mai una doppia barra di scroll — al massimo un filo di spazio in piu' o in meno, cosmetico.

---

## 28. Un'altra sessione tiene API+Vite attivi: niente `prisma generate`, e build in contesa

**Contesto:** lavorare mentre **un'altra sessione** (altra chat/finestra) ha gia' avviato `npm run dev:api` (porta 4000) e `npm run dev` (porta 5173) sulla stessa cartella. Un hook lo segnala ("Another chat's dev server is running").

**Tre conseguenze da mettere in conto:**
- **`prisma generate` va in EPERM (lock DLL, nota #15) e NON si puo' risolvere** fermando "il proprio" server: il processo che tiene il lock e' dell'**altra sessione**, e **non va ucciso** (romperebbe il suo lavoro). Quindi in questa condizione **qualsiasi cambiamento di schema Prisma e' di fatto bloccato** (la migrazione SQL si applicherebbe con `migrate deploy` senza toccare la DLL, ma il client non si rigenera → tsc e runtime non vedono i campi nuovi). **Conseguenza di metodo:** se serve una feature che vorrebbe una colonna nuova, **progettarla senza toccare lo schema** finche' l'altra sessione e' attiva (es. dati effimeri restituiti nella risposta invece che persistiti; snapshot testuali su colonne gia' esistenti). Verificato il 16/7 su piu' fasi della V4 (navigazione suggerita, compressione contesto): costruite tutte schema-free.
- **`npm run build` va in contesa** e puo' sforare i 5 minuti (exit 143 = SIGTERM del timeout) con Vite+API dell'altra sessione + eventuali `tsc`/test in parallelo. **Modo corretto:** lanciarlo in **background** (`run_in_background`) e leggere il log a fine corsa, invece di tenerlo in primo piano con timeout stretto; evitare di far girare build **e** tsc **e** test insieme (thrash). A macchina meno carica il build riesce (~4 min, "6961 modules transformed").
- **Salvare file del SERVER fa ricaricare l'API dell'altra sessione (`tsx watch`), e durante il reload il frontend mostra i dati VUOTI per qualche secondo** — non solo una sezione: tutto cio' che sta caricando (es. i Messaggi "spariti da tutto il CRM"). **NON e' una regressione del codice:** appena `tsx watch` finisce, torna tutto da solo. Verificato il 16/7 costruendo il tempo reale (Fase 4): salvando `app.ts` + due service, l'utente ha visto la messaggistica vuota per pochi secondi, poi ricomparsa. **Come non farsi ingannare:** prima di dare la caccia a un bug fantasma, controllare che l'API sia viva con `curl -s http://localhost:4000/health` (deve dare `{"status":"ok","db":"up"}`); se e' verde, era solo il reload. E in generale, **salvare i file del server in blocco** (non uno alla volta con verifiche in mezzo) riduce il numero di reload che l'altra sessione subisce.

**Come capire chi tiene le porte senza uccidere il processo sbagliato:** `netstat -ano | grep LISTENING | grep :4000` (e `:5173`) da' il PID; **non** matchare per command-line (nota #17) e comunque **non terminare** processi che non si sono avviati in questa sessione. *(Se serve identificare QUALE sessione: l'albero dei processi risale a `claude.exe`; l'elenco delle chat con titolo/cwd/ultima-attività si legge coi tool di gestione sessioni. Il 16/7 la sessione colpevole era un'altra chat di Claude Code sullo stesso progetto.)*

> **TODO (chiesto da Jacopo il 16/7) — regola di progetto da CONCORDARE, non ancora scritta.** Serve una regola che eviti *strutturalmente* questa situazione (una sessione tiene su l'API `tsx watch` → blocca `prisma generate`/migrazioni e mostra dati vuoti al reload dell'altra). Opzioni da discutere: (a) **una sola sessione alla volta** avvia i dev server (coerente col metodo a staffetta); (b) **convenzione esplicita** su chi/quando li tiene e su come passarseli con l'handoff; (c) un **accorgimento tecnico** (es. avvio dei server centralizzato, o `prisma generate` che non prenda il lock). Da decidere insieme e poi, se del caso, promuovere in CLAUDE.md. Tracciato anche nella roadmap V4 ("Da fare / da decidere").

---

## 29. Collaudo AI via script (login + endpoint): host, forma delle risposte, flag di dominio

**Contesto:** collaudare a costo (quasi) zero le funzioni AI/agency con script Node che fanno `fetch` sull'API (login → chiamate), invece che a mano nel browser (nota #10). Fatto il 21/7 per le aree 6/10/11 del piano di collaudo.

**Cinque errori, tutti costati giri a vuoto:**
- **`fetch` verso `localhost` → `ECONNREFUSED`.** L'API ascolta su `0.0.0.0` (solo IPv4, `runtime-env.ts` default), ma il `fetch` di Node (undici) su Windows risolve `localhost` a IPv6 `::1` → connessione rifiutata. `curl` invece prova IPv4 e funziona (fuorviante). **Modo corretto:** negli URL degli script usare **`127.0.0.1`**, non `localhost` (l'`Origin` header del WebSocket resta `http://localhost:5173`, è solo testo).
- **Letto il campo sbagliato nella risposta → diagnosi completamente errata.** `GET /agency/settings/ai-budgets` risponde `{ data: { budgets: { defaultDailyLimitUsd, members } } }`: leggere `data.members` (invece di `data.budgets.members`) dà sempre `undefined → []`, da cui ho concluso — a torto — "0 membri gestibili, budget per-utente rotto" e stavo per scriverlo nell'handoff. **Modo corretto:** al primo uso **stampare la risposta** e verificare il path reale (già in #18); non fidarsi di un `?? []`/`?? 0` che maschera un path sbagliato da un dato davvero vuoto.
- **Assert sullo status HTTP dove il dominio usa un FLAG.** La chat gestisce il budget esaurito con **HTTP 200** + `{ aiInvoked:false, budgetExceeded:true, budgetMessage }` (agency.service.ts:8444), non con un 4xx. Un assert `status >= 400` dà **falso negativo** (sembra "non bloccato" mentre invece lo è). **Modo corretto:** per le funzioni che "falliscono con grazia" controllare i **flag nel corpo**, non lo status. In più, **non troncare il corpo a 300-400 char** quando il segnale sta in fondo (i messaggi storici in testa nascondono il campo che serve).
- **Dove sono le chiavi AI per i test.** Sono **per-workspace** (`AgencyRuntimeSetting`, righe `openai_api_key`/`anthropic_api_key` cifrate), nell'unico workspace **Demo**. Per esercitarle via API autenticarsi come `admin@test.com` / `admin123` (**superadmin**, in `PLATFORM_ADMIN_EMAILS`, membro di Demo). Login: `data.token` + `data.user.id` + `data.workspace.id`; le rotte `/agency/**` vogliono l'header `x-workspace-id`. Modelli **economici** del catalogo (per non spendere): `claude-haiku-4-5-20251001`, `gpt-4o-mini`. Gli **override budget per-utente** vanno impostati su un **membro gestibile** (i platform-admin non sono nella lista membri dei budget; il default di workspace invece vale per tutti).
- **`process.exit()` dopo `fetch` su Windows/Node 24 → `Assertion failed … async.c`** in chiusura (exit 127/255) **dopo** aver già stampato tutto l'output. È rumore di teardown di undici, non un errore del test. **Modo corretto:** non chiamare `process.exit()` bruscamente; usare `process.exitCode = code` e un `setTimeout(() => process.exit(code), 1500).unref()` di sicurezza. Leggere comunque l'esito dall'output, non dall'exit code.

---

## 30. Collaudo di una generazione AI: distinguere "AI usata" da "fallback silenzioso"

**Contesto:** collaudare una funzione AI che ha un **fallback rule-based** (Discovery, Web, Ads: se l'AI non è configurata o il parse fallisce, ricadono su un output deterministico). Il 22/7 collaudando la Discovery su RAG.

**Errore (evitato per un soffio):** dare per buono l'**output** della generazione come "risposta dell'AI". La risposta HTTP era `200` e conteneva sezioni plausibili ("Dati insufficienti… Target non definito"): sembrava l'AI. In realtà l'AI era **stata chiamata e fatturata**, ma il suo output era stato **scartato in parse** (JSON con code-fence non rimossa) e il sistema era ricaduto sul **rule-based**. Un fallback ben fatto **assomiglia** a un risultato reale (solo più povero): guardare solo il testo non basta e porta a diagnosi sbagliate (es. "l'AI marca target non definito" quando l'AI non è nemmeno stata usata).

**Modo corretto:**
- Non fidarsi del corpo: controllare il **flag di modalità** nella risposta (qui `discovery.aiGeneration.mode` — `ai_with_sources` vs `fallback_rule_based`) e l'eventuale campo `error`. Se c'è un flag che dice "ho usato l'AI o il fallback", è quello la verità, non la prosa.
- **Incrociare con `AiUsageLog`**: se compare una riga `functionName` della funzione (es. `discovery.generateBrief`) con `status: success` **ma** l'output è quello del fallback, l'AI è girata e la spesa è stata **buttata** → c'è un bug tra "chiamata AI" e "uso del risultato" (tipicamente il parse). Il log costi si scrive **prima** del parse, quindi "costo loggato" NON implica "risultato usato".
- Per un'app multi-provider, collaudare **ogni provider**: qui OpenAI (JSON forzato `json_object`) funzionava, Anthropic no. Un collaudo sul solo provider "buono" avrebbe mancato il bug. Il default del workspace decide quale path si esercita davvero.

---

## 31. Script di verifica API: DELETE (e ogni richiesta senza body) NON deve mandare `content-type: application/json`

**Contesto:** script Node di collaudo (login → crea → scansiona → **cancella** l'asset di prova). La `fetch` helper metteva sempre l'header `content-type: application/json` su ogni chiamata, anche sul `DELETE` che non ha corpo.

**Errore:** il `DELETE /web-assets/:id` tornava **400** `FST_ERR_CTP_EMPTY_JSON_BODY` ("Body cannot be empty when content-type is set to 'application/json'"). Fastify, se vede `content-type: application/json`, **pretende** un corpo JSON: mandare l'header senza body è un 400 lato parser, **prima** di arrivare all'handler. Sembrava un blocco di business (asset non cancellabile) e la pulizia falliva, lasciando **due asset di prova nel workspace Demo**.

**Modo corretto:**
- Nella helper `fetch`, aggiungere `content-type: application/json` **solo se c'è un body** (`if (body) headers['content-type'] = 'application/json'`). GET/DELETE senza corpo vanno mandati senza quell'header.
- Un `DELETE` andato a buon fine qui risponde **204** (nessun corpo), non 200: assertare `status === 204`.
- Regola di pulizia: se uno script di collaudo **crea** dati (asset, righe demo), deve **cancellarli in fondo** e **verificare che siano spariti** (ri-listare e contare), perché un 4xx sulla delete può passare inosservato e lasciare sporcizia nel workspace Demo.

---

## 32. Structured output (Anthropic tool-use): lo schema DEVE elencare i campi, altrimenti esce un oggetto vuoto

**Contesto:** 23/7, implementazione dello structured output per far produrre a Claude JSON sempre valido (opzione A decisa con Claudio). Si obbliga il modello a rispondere chiamando uno "strumento" con un `input_schema`.

**Errore:** ho passato uno schema **generico e permissivo** (`{type:'object', properties:{}, additionalProperties:true}`), ragionando che "tanto la forma del JSON è già descritta nel system prompt". Risultato dal vivo: Claude ha chiamato lo strumento restituendo **`{"_dummy": …}`** con **4 token di output**. JSON validissimo — e completamente vuoto. Peggio: il codice lo prendeva per una generazione riuscita e marcava `generationMode: 'ai_with_sources'` su un brief che in realtà veniva tutto dal fallback rule-based. Cioè avevo **sostituito un fallback silenzioso con una bugia silenziosa**.

**Perché:** nello structured output è **lo schema** a guidare la generazione, non il system prompt. Se lo schema non dichiara proprietà, il modello non ha campi da riempire e produce un segnaposto.

**Modo corretto:**
- Passare uno schema **vero**, con le proprietà attese (qui: `sections` con le 8 chiavi della Discovery, `missingFields`, ecc.). Con lo schema reale: **1029** token di output, tutte le sezioni compilate e ancorate alle fonti.
- Derivare lo schema dalle costanti già esistenti (es. `DISCOVERY_SECTION_KEYS`) così non si disallinea quando si aggiunge un campo.
- Attivare il tool-use **solo se il chiamante fornisce lo schema**; senza schema restare sul comportamento precedente, così i chiamanti non ancora migrati non regrediscono.
- Trattare un payload vuoto (solo chiavi tipo `_dummy`) come **fallimento**, non come successo: meglio ripiegare sul rule-based che spacciare per AI un contenuto che non c'è.
- **Regola di verifica generale:** dopo aver "sistemato" una generazione AI, non fermarsi al flag di modalità (nota #30). Guardare **i token di output e le chiavi del payload**: `estimatedOutputTokens: 4` e una sola chiave sconosciuta erano il segnale che qualcosa non tornava, mentre il flag diceva "AI usata".

**Trappola collaterale (cache):** la Discovery mette in cache il payload per `inputHash`; ri-generare sullo stesso progetto con fonti invariate **non richiama l'AI** (`cacheHit: true`). Per collaudare davvero un cambiamento al motore, usare un **progetto diverso** (o svuotare la voce di cache), altrimenti si "verifica" il risultato vecchio.

---

## 33. Frontend Vite ascolta su IPv6 (`[::1]`), l'API su IPv4 (`0.0.0.0`): host diversi per i curl

**Contesto:** verifica che i file `.jsx`/`.js` compilino via transform di Vite (`curl http://<host>:5173/src/.../File.jsx`, nota #11), con i dev server avviati a mano dall'utente.

**Errore:** usato `http://127.0.0.1:5173/...` (come per l'API, nota #29) → **tutti** i file davano `HTTP 000` (connessione rifiutata). Sembrava che i file non compilassero o che il server fosse morto; in realta' era solo l'host sbagliato. Verificato con `netstat`: il frontend Vite era in ascolto su **`[::1]:5173` (solo IPv6)**, mentre l'API era su `0.0.0.0:4000` (IPv4). Quindi `127.0.0.1:5173` (IPv4) rifiuta, ma `localhost:5173` (che risolve a `::1`) e `[::1]:5173` rispondono `200`.

**Modo corretto:**
- Per i curl al **frontend Vite** (transform dei moduli, `@vite/client`, ecc.) usare **`localhost:5173`** o **`[::1]:5173`**, NON `127.0.0.1`.
- Per i curl all'**API** restare su **`127.0.0.1:4000`** (nota #29: il `fetch` di Node su `localhost` andrebbe a `::1` dove l'API IPv4 non ascolta — l'opposto del frontend).
- Diagnosi rapida di un `HTTP 000` su TUTTI i file (non solo uno): `netstat -ano | grep LISTENING | grep :5173` per vedere se l'indirizzo e' `[::1]` o `0.0.0.0`, e allineare l'host del curl. `000` = rete/host, non codice (come gia' in #11).

---

## 34. I dev server avviati con `preview_start` possono fermarsi tra un turno e l'altro

**Contesto:** avviati API (4000) e frontend (5173) con lo strumento di preview per una verifica; poco dopo l'utente segnala che il browser non carica.

**Errore:** fidarsi del messaggio "Server started successfully" e dire all'utente di aprire il browser senza ricontrollare. I server avviati con `preview_start`, in una sessione lunga, possono **fermarsi tra i turni** (lo strumento ne perde traccia: `preview_list` torna vuoto), e a quel punto la pagina non carica. Ho comunicato "sono accesi" quando in realta' erano gia' giu'.

**Modo corretto:**
- Prima di dire all'utente di aprire il CRM nel browser, **verificare lo stato reale**, non fidarsi del "started successfully": `netstat -ano | grep LISTENING | grep -E ":4000|:5173"` + un `curl` di salute all'API (`http://127.0.0.1:4000/health` deve dare `{"status":"ok",...}`). Se non rispondono, riavviare e ri-verificare.
- Ricordare all'utente di usare **`localhost:5173`**, non `127.0.0.1:5173` (Vite ascolta su IPv6 `[::1]`, nota #33).
- **In chiusura sessione:** `preview_list` puo' tornare **vuoto** mentre i processi sono ancora **vivi** (netstat li vede su 4000/5173). Se non ci sono piu' `serverId` validi per `preview_stop`, spegnerli individuando i PID dalla porta (`Get-NetTCPConnection -LocalPort 4000,5173 -State Listen`) e terminandoli mirati per PID — mai per command-line (nota #17), e solo dopo aver verificato che siano di questa sessione.

---

## 35. Seed che aggiunge definizioni "con nome" a un workspace: prima guarda cosa c'e' gia'

**Contesto:** scrivere un seed di arricchimento demo che crea `CustomFieldDefinition` (ma vale per qualsiasi entita' "con nome" per-workspace: project type, metric set, checklist template...). Il 30/7/2026, arricchimento clienti/progetti demo.

**Errore:** ho definito un custom field `priorita_cliente` (select alta/media/bassa) senza controllare le definizioni gia' presenti nel workspace demo. C'era gia' un campo `priorita` con **le stesse identiche opzioni**, residuo dei test V3 Custom Fields (9/7): il mio era un **doppione** semantico. Me ne sono accorto solo dalla verifica a valle (`CUSTOM defs=[...]` mostrava sei campi, non i quattro attesi), e ho dovuto scrivere uno script una-tantum per cancellare la definizione `priorita_cliente` e ripulire la chiave dai `customFields` dei 12 clienti gia' scritti.

**Modo corretto:**
- **Prima** di definire entita' "con nome" in un seed su un workspace gia' popolato, **interrogare cosa esiste** (`customFieldDefinition.findMany({where:{workspaceId, entity}})`, o l'equivalente per project type/metric set). Il workspace demo **accumula definizioni incidentali** dai collaudi delle feature (es. `priorita` e `marketing` lasciati dalla V3), non e' un foglio bianco.
- Se esiste gia' un campo adatto, **riusarne la chiave** (consolidare) invece di crearne uno quasi-uguale: si evita il doppione e si **riempie** un campo altrimenti orfano (coerente con l'obiettivo "niente buchi" del demo).
- La chiave e' identita': un `upsert` su `(workspaceId, entity, key)` con una chiave diversa **non** aggiorna quello esistente, ne crea un altro. Cambiare chiave a meta' lavoro lascia **artefatti** (definizione vecchia + valori gia' scritti nei JSON degli oggetti) che vanno ripuliti a mano — su un DB pulito non si ripresenterebbero, ma sul DB di sviluppo restano finche' non li togli.

---

## 36. Strumenti che leggono i log di Claude Code: entrare nelle sottocartelle `subagents/`

**Contesto:** il misuratore dei consumi (`scripts/agenti/consumi.mjs`) legge i registri che Claude Code scrive in `~/.claude/projects/<progetto>/`. Il 30/7/2026 riportava **quota subagent 0,0%** anche se gli agenti erano stati usati decine di volte.

**Errore:** lo script leggeva solo i `.jsonl` del **primo livello** della cartella di progetto. Ma Claude Code usa un layout a **cartelle-per-sessione**: il transcript principale sta in `<progetto>/<sessione>.jsonl`, mentre le chiamate dei subagent finiscono in `<progetto>/<sessione>/subagents/*.jsonl`. Risultato: tutti i subagent invisibili — quota falsata a 0 e **totale sottostimato** (quindi anche picco e finestra sotto il vero). Un'intera analisi del team ne era uscita distorta ("gli agenti non li usa nessuno", falso: c'erano ~54 invocazioni).

**Modo corretto:**
- Chi legge i registri di Claude Code deve **camminare le sottocartelle** (ricorsione), non fermarsi al primo livello.
- I subagent la' dentro sono marcati `isSidechain: true` (nei file principali il flag e' sempre `false`); piu' robusto marcarli **anche per posizione** (dentro `subagents/`), cosi' reggono se il flag cambiasse.
- Attribuire il loro consumo alla **sessione madre** (la cartella nonna), non a una pseudo-sessione col nome del file.
- Regola generale: prima di fidarsi di un numero che vale **0 esatto**, verificare che non sia "0 perche' non l'ho letto" invece di "0 perche' non c'e'".

---

## 37. Test frontend (Vitest): su questa macchina l'avvio dell'ambiente e' LENTO per natura — un timeout non e' un test rotto

**Contesto:** 30/7/2026, primo avvio della rete di test frontend (`npm run test:frontend`, Vitest + Testing Library). Un test banale (render + `getByRole`) e' fallito con `Test timed out in 5000ms`.

**Errore (di interpretazione, corretto dal revisore):** la prima diagnosi era "cold-start dopo `npm install`, al secondo giro tutto veloce". **Falsa**: anche a cache calda l'`environment` puo' restare altissimo **quando la macchina e' sotto carico** (misure del 30/7 sulla stessa suite: environment da 13 s a 83 s, giri interi da 19 s a 135 s — verosimilmente jsdom sotto scansione antivirus). Non e' il primo giro a essere lento: e' il **carico della macchina** a comandare, e col timeout di default (5 s) un test poteva tornare rosso **a caso** nei giri peggiori.

**Modo corretto:**
- Il timeout per singolo test e' stato alzato a **15 s** in `vite.config.js` (`test.testTimeout`) proprio per questo: margine contro l'ambiente saturo, non licenza di scrivere test lenti (i test veri restano sotto il secondo).
- Mettere in conto la durata: `test:frontend` va da **~20 s a macchina scarica a ~2 minuti sotto carico** (misurati entrambi il 30/7: 22 s e 135 s, stessa suite). Non e' un errore, non interromperlo; lanciarlo in background e leggere l'esito.
- Un fallimento **con timeout** su un test banale = prima sospettare l'ambiente (guardare la riga `Duration`: `environment` spropositato rispetto a `tests`). Un fallimento **di asserzione** (`expected ... to be ...`) invece e' reale sempre, anche al primo giro.
- Setup del sistema test (per non ri-scoprirlo): config dentro `vite.config.js` (sezione `test`, ambiente `jsdom`, setup `src/test/setup.js`); i test stanno accanto ai sorgenti (`X.test.js/.jsx/.ts`, stesso nome del sorgente, minuscole comprese); si scrive con **import espliciti** da `vitest` (niente globals). L'`include` mira `src/**` ed **esclude** `src/components/@hk-gantt/**`: la libreria vendored ha test propri in stile Jest che non girano qui (un include ingenuo li catturerebbe e fallirebbero).
- Non lanciare `test:frontend` **in parallelo** a lint/build/altri processi pesanti: i tempi si sporcano e anche 15 s possono non bastare (nota #28, contesa).
- **Aggiornamento 4/8/2026 — il sintomo puo' essere piu' grave del timeout: worker MAI AVVIATI.** A macchina satura i file falliscono con `[vitest-pool]: Failed to start forks worker ... Timeout waiting for worker to respond` e **0 test eseguiti** (misurato: 3, poi 14 file su 28; perfino un giro mirato a 2 file con zero test partiti, mentre un file singolo dieci minuti prima girava). Anche questo NON e' un test rotto, e' l'avvio del processo che sfora il timeout interno di vitest. Rimedio strutturale adottato lo stesso giorno: `pool: 'threads'` in `vite.config.js` (un processo solo, niente fork per file: subito dopo il cambio, stesso carico, i test giravano — primo giro completo verde della giornata, 28 file/174 test in 12 minuti contro i 18-27 dei giri a fork). **`isolate: false` invece NON va aggiunto**: provato per riusare gli ambienti (suite a 109 s), ma il registro moduli condiviso sdoppia i `vi.mock` per-file dei moduli API — 11 rossi finti negli hook pipeline (mock mai chiamati, esiti "riusciti"). L'avvio ambienti resta la voce grossa (440 s su 719): e' il bersaglio dell'esclusione antivirus decisa con Jacopo. **Attenzione (giro delle 11:58 del 4/8): sotto carico pesante anche i THREAD-worker possono morire in avvio** (6 file su 28, "Failed to start threads worker") — threads riduce di molto il problema, non lo azzera; vale sempre la regola "rosso da avvio = rilanciare mirato, non indagare il codice". L'esclusione antivirus (attiva dalle ~11:55 del 4/8) va giudicata sui giri accumulati nel tempo, non su un giro solo: la macchina oscilla del ±50% fra giri identici, un singolo numero non distingue l'effetto dal rumore (primo indizio, debole: avvio ambienti per file invariato a ~15 s anche dopo l'esclusione).
- **Aggiornamento 18/8/2026 — "in background" NON vuol dire "posso lavorare mentre gira".** Errore commesso durante la rinomina `posta` → `mail`: la suite e' stata lanciata in background *proprio per* usare l'attesa, e nel frattempo sono girati `tsc --noEmit`, `eslint`, `prisma generate`, `prisma migrate deploy` e due script `tsx` sul database. Risultato: **1650 secondi** (27 minuti, contro i ~52 secondi che gli stessi file impiegano da soli) e **tre rossi finti da timeout** — tutti in file mai toccati dal lavoro — rilanciati mirati e verdi al primo colpo, piu' un giro intero da rifare per identificarne uno che l'output troncato non mostrava. Il background serve a **non bloccare la conversazione**, non ad autorizzare processi pesanti in parallelo: mentre la suite intera gira, si sta fermi o si fa solo roba leggera (leggere file, scrivere documenti). Corollario pratico: se l'output della suite viene filtrato (`Select-Object -Last N`, `tail`), **l'elenco dei file falliti puo' restare fuori** — scriverlo su file intero e leggerlo dopo, o si paga un secondo giro solo per sapere cosa era rosso.

---

## 38. Misurare un limite di ACCOUNT con un metro di PROGETTO: campioni falsati

**Contesto:** taratura del monitor consumi (`scripts/agenti/consumi.mjs`). Lo script pesa i token dei registri locali; la percentuale reale del limite si legge a mano con `/usage` e si registra in `archivio-documenti/consumi/calibrazione.json`.

**Errore:** lo script leggeva **solo la cartella di registri di questo progetto**, mentre i limiti che `/usage` riporta (finestra di 5 ore, settimanali) sono **dell'account intero**. Jacopo lavora spesso su due progetti in parallelo: ogni campione accoppiava quindi un peso *parziale* a una percentuale *totale*. Effetto misurato il 31/7/2026: nella finestra campionata il **41%** del consumo veniva da un altro progetto (64,1 unita' su 154,5).

**Il danno vero non e' il numero storto, e' la diagnosi sbagliata che ne segue.** Dai due campioni falsati era nato il sospetto che l'abbonamento contasse il modello Fable in modo diverso dallo script (i rapporti %/peso divergevano di circa 2x, e Fable e' l'unico modello con listino doppio: sembrava tornare). Ricalcolati i pesi su tutto l'account, i rapporti sono diventati **0,219** e **0,194** — praticamente identici: il modello non c'entrava nulla, era l'altro progetto non contato. Lo scarto medio della stima e' sceso da **7,0 a 1,5 punti**.

**Modo corretto:**
- Il perimetro della misura deve **coincidere con il perimetro del limite**. Lo script ora scansiona tutta la cartella `~/.claude/projects` e stampa la **ripartizione per progetto** della finestra in corso.
- **Prendere il campione subito dopo un reset**, riferendolo alla finestra **appena chiusa**: la finestra del piano ha un orario di reset preciso, quella dello script e' scorrevole (ultime 5 ore) — se non si allineano, i due numeri parlano di periodi diversi.
- Chiedere sempre **quali modelli** e **se c'erano altri progetti attivi**: senza, il campione non e' rileggibile.
- Un campione preso con un metro non confrontabile non va cancellato ne' lasciato a inquinare la stima: si marca `"escluso": true` con il motivo nella nota (lo script lo salta). Se invece i registri sono ancora sul disco, meglio ancora: si **ricalcola** il peso col metro nuovo, e il campione torna valido. Prova che il ricalcolo e' affidabile: rifacendo il conto solo-progetto del campione del 30/7 e' uscito 56,4 contro il 57,0 registrato allora.

---

## 39. Una chiamata sta su PIU' righe del registro: fondere al massimo, non prendere la prima

**Contesto:** qualsiasi strumento che legge i `.jsonl` di Claude Code per contare i token (il misuratore dei consumi, `scripts/agenti/consumi.mjs`). Trovato il 3/8/2026.

**Errore:** una singola chiamata al modello viene annotata su **piu' righe** — il ragionamento, ogni uso di strumento, la risposta finale — tutte con lo **stesso `requestId`**, e i contatori `usage` **crescono riga dopo riga**. Lo script deduplicava tenendo la **prima** riga vista e scartando le altre. Effetti misurati su tutto lo storico:
- **mancava il 12% dei token di uscita** (19,4 milioni contati su 22,1 reali — misura del 3/8/2026 sull'intero storico), cioe' proprio la voce piu' cara (in scala di listino l'uscita vale 5 volte l'ingresso);
- la **risposta finale di un agent** risultava di **2-3 token** invece di qualche migliaio: nel file l'ultima riga porta il conteggio vero, la penultima (il ragionamento) e' ferma a 3. Il numero da confrontare col costo dell'agent era quindi azzerato.

**Modo corretto:**
- Raggruppare per `requestId` e tenere il **massimo** di ogni contatore (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`), non la prima riga e **nemmeno la somma**: sommare le righe darebbe 74,1 milioni di token di uscita contro i 22,1 veri, cioe' **il 236% in piu'** (le righe si ripetono, non si aggiungono).
- Verifica rapida che la fusione sia giusta: il totale col massimo dev'essere **di poco sopra** quello della prima riga (qui +13,7%), non multiplo.
- A volte pero' il conteggio dell'ultima riga **non viene aggiornato** e resta a 2-3 anche sul testo finale. In quel caso serve una misura di riserva: la **lunghezza del testo** diviso 4 (caratteri per token), usata dentro un `Math.max` col valore dichiarato — cosi' puo' solo correggere in difetto, mai gonfiare.
- Corollario sui **prezzi per modello**: i nomi nei registri possono avere il suffisso della data (`claude-haiku-4-5-20251001`). Un confronto per uguaglianza non trova la chiave di listino e fa ripiegare sul prezzo di default: qui Haiku veniva pesato come Opus, **5 volte il vero**. Cercare la chiave piu' lunga di cui il nome del modello e' il prolungamento.
- **Quando si corregge il metro, i campioni di taratura vanno ricalcolati**, non buttati (nota #38): `node scripts/agenti/consumi.mjs --finestra-a "2026-07-31T09:50Z"` ristampa il peso di una finestra passata. I due campioni sono passati da 82,3 e 154,5 a 84,3 e 156,3, e lo scarto medio della stima e' sceso da 1,5 a 1,3 punti.

**Regola generale, gia' vista nella #36:** prima di fidarsi di un numero estratto dai registri, controllare **come sono fatte le righe**, non solo cosa contengono. Qui il difetto non dava nessun errore: dava un numero plausibile e sbagliato.

---

## 40. Rinominare un file: il censimento degli import con UN solo giro di ricerca puo' mancare occorrenze

**Contesto:** 3/8/2026, rinomina di `pipelineSettings.utils.js` in `pipeline.utils.js` — serviva l'elenco completo dei file che lo importano.

**Errore (sventato):** due ricerche con lo strumento Grep hanno dato **elenchi diversi e tutti e due incompleti**: la prima (pattern `pipelineSettings\.utils` su tutto il repo) non ha riportato i file in `src/modules/**`; la seconda (pattern piu' largo su `src/`) ha trovato quelli ma ha saltato `useStageChecklistRules.js`, che l'import ce l'ha eccome (riga 8). Fidarsi del primo elenco avrebbe lasciato un import rotto **silenzioso** (si sarebbe visto solo a runtime/test). Il campanello c'era: l'handoff parlava di 4 importatori, il primo giro ne trovava 2.

**Modo corretto:**
- Per i censimenti da rinomina usare **`git grep -n "<nome>"`** (deterministico sui file tracciati), non un solo giro dello strumento di ricerca.
- **Confrontare il conteggio con un'aspettativa** (handoff, memoria, import noti): se i numeri non tornano, e' la ricerca a essere incompleta, non il progetto a essere diverso.
- Dopo la rinomina, ri-verificare con `git grep` che il nome vecchio non compaia piu' (fuori dai documenti storici, che non si riscrivono).
- Vale in generale: un elenco di occorrenze usato per **modifiche meccaniche di massa** va costruito con uno strumento esaustivo, e ogni discrepanza tra due giri di ricerca va spiegata prima di procedere.

---

## 41. Test di hook React: `await act(async () => await promessa)` va in stallo se la promessa la scioglie un effetto

**Contesto:** 3/8/2026, test del contratto di `refetch` (usePipelineSettingsQueries): la promessa risolve solo quando l'EFFETTO della query ha ricevuto i dati.

**Errore:** scrivere `await act(async () => { await result.current.refetch(); })`. Sembra il pattern standard, ma qui e' un **abbraccio mortale**: l'effetto che scioglie la promessa parte solo quando act flusha il lavoro, e act aspetta che il callback finisca — che a sua volta aspetta la promessa. Timeout a 15 s. Effetto collaterale peggiore: l'act rimasto appeso **corrompe l'ambiente dei test successivi dello stesso file** (`result.current` diventa `null` in un test che di suo era sano) — il secondo rosso era contagio, non un secondo bug.

**Modo corretto:**
- Spezzare in due: **innescare in un act sincrono** (`act(() => { promessa = refetch(); })` — qui React flusha subito il re-render e l'effetto parte) e **attendere in un secondo act** (`await act(async () => { await promessa; })`).
- La regola vale per qualunque promessa la cui risoluzione dipenda da un effetto/da un re-render del componente sotto test. Se invece la scioglie un mock esterno (un resolver in mano al test), il singolo act asincrono va bene.
- Diagnosi rapida: **un timeout secco su un await dentro act** = sospettare lo stallo, non la logica; e se i test DOPO quello rosso danno `result.current === null` senza motivo, ripartire dal primo rosso — gli altri sono contagio.

---

## 42. Commit da PowerShell 5.1: le VIRGOLETTE DOPPIE nel messaggio spezzano l'argomento di git

**Contesto:** 3/8/2026, `git commit -m @'...'@` con una here-string che conteneva `"non ancora in lista"` tra virgolette doppie.

**Errore:** la here-string arriva intera a PowerShell, ma nel passaggio al comando NATIVO (git) PS 5.1 avvolge l'argomento tra doppi apici **senza fare escape di quelli interni**: le virgolette del testo chiudono l'argomento a meta' e il resto diventa pathspec (`error: pathspec 'ancora' did not match...`). Il commit non parte; il `git push` accodato dopo il `;` parte lo stesso (e per fortuna non c'era niente da pushare). Trappola subdola: con lo STESSO messaggio senza virgolette doppie il comando funziona.

**Modo corretto:**
- Per i messaggi di commit multiriga usare **`git commit -F <file>`**: messaggio scritto su file (scratchpad) con lo strumento di scrittura file, niente quoting di mezzo. Vale per qualsiasi testo lungo passato a un comando nativo.
- In alternativa evitare del tutto le virgolette doppie nel testo (parafrasare), ma il `-F` e' l'unica via robusta.
- Non accodare `push` al commit con `;` quando il messaggio e' complesso: se il commit fallisce, il push parte comunque (con `;` l'esito del primo comando non ferma il secondo).

*(Nota: dallo strumento Bash — Git Bash, non PowerShell — la here-string `git commit -F - <<'EOF' ... EOF` funziona senza problemi, virgolette doppie comprese. Il vincolo qui sopra vale quando si passa da PowerShell.)*

---

## 43. Un 200 dal transform di Vite NON prova che gli import di quel modulo risolvano

**Contesto:** 4/8/2026, spezzatura di `AgencyProjectWebPage.jsx` in 21 file nuovi. Per confermare che i pezzi nuovi fossero a posto ho usato la nota #11: `curl http://localhost:5173/src/.../File.jsx` su ognuno, tutti `200`.

**Errore (segnalato dal revisore):** ho presentato quei `200` come prova che **i percorsi relativi degli import fossero giusti** — che era il rischio numero uno del giro, visto che i file nuovi sono scesi di una o due cartelle. Non lo provano: Vite in dev **riscrive gli specificatori** e serve il modulo; se un import punta a un file inesistente, il `200` arriva lo stesso e l'errore si manifesta sulla **richiesta successiva** (quella del file mancante), che nessuno sta guardando.

**Modo corretto:**
- Il `200` di Vite prova **solo** che il file transpila (sintassi valida). Per quello resta utile e velocissimo.
- Per provare che gli import **risolvano**, servono: la **suite di test** (ogni modulo nuovo dev'essere importato da almeno un test — se manca, quel modulo non e' verificato da nessuno), oppure `npm run build`, oppure il controllo dei percorsi su disco.
- Regola generale, la stessa della #30: quando si dichiara "verificato", dire **cosa** ha verificato quella prova. Una prova che copre la sintassi non copre il collegamento.

---

## 44. Test frontend: `@testing-library/user-event` non e' installato

**Contesto:** 4/8/2026, primi test di componente nella cartella `src/views/Agency/**` (che prima era a zero test).

**Errore:** scritto `import userEvent from '@testing-library/user-event'` e `await userEvent.click(...)` per default, come si fa di solito con Testing Library. Il pacchetto **non c'e'** fra le dipendenze: il file fallisce in raccolta (`Failed to resolve import`, zero test eseguiti) — un rosso che sembra grave e invece e' solo un import.

**Modo corretto:**
- La convenzione gia' in uso nel progetto e' **`.click()` diretto sull'elemento**: `screen.getByRole('button', { name: 'Elimina' }).click();` (esempio: `src/modules/projects/ui/modals/ConfirmDeleteModal.test.jsx`). Funziona e non serve `await`.
- Per scrivere in un campo controllato da React, nei test si usa il `fireEvent`/`change` di Testing Library; **nell'anteprima** invece serve il setter nativo (nota #10).
- Regola generale: prima di importare una libreria di comodo in un test, **guardare cosa importano i test gia' presenti**. Vale per qualsiasi cartella nuova: le convenzioni si copiano dai vicini, non dalla memoria.

---

## 45. Anteprima: forzare il viewport piu' grande della finestra vera fa atterrare i click NEL POSTO SBAGLIATO

**Contesto:** 5/8/2026, verifica dal vivo della pagina Fonti e Materiali. La pane dell'anteprima e' **piccola** (viewport nativo misurato: 558x307). Per vedere il layout desktop ho forzato `resize_window` a 1280x900.

**Errore:** con il viewport forzato piu' grande della finestra reale, la pagina viene **scalata**: le coordinate che `computer` calcola dal riferimento dell'elemento non corrispondono piu' a dove quell'elemento sta davvero sullo schermo. Due click su "Aggiungi URL" (uno dalla striscia, uno dal riquadro) sono stati riportati come eseguiti — `left_click at (369, 450) [ref_58]` — **senza produrre nessun effetto**. Il sospetto naturale, sbagliato, e' stato che il collegamento pagina→hook non funzionasse: sono andato a rileggere l'hook degli URL cercando un difetto che non c'era.

**Modo corretto:**
- Per **provare le interazioni**, lavorare al **viewport nativo** (`resize_window` con `preset: "desktop"`, che lo riporta alla dimensione vera della pane). Subito dopo, lo stesso click sullo stesso pulsante ha aggiunto la riga.
- Il viewport forzato va bene per **guardare** un layout (screenshot, lettura della struttura), non per cliccare.
- **Un click che il tool dichiara "eseguito" non e' un click andato a segno.** Prima di sospettare del codice, verificare che l'effetto atteso ci sia (un conteggio di elementi prima/dopo costa una riga) e, se manca, sospettare **prima** la geometria della pane. Stessa famiglia della #43: dire sempre *cosa* prova la prova che si sta usando.
- Corollario utile: `read_page` restituisce **solo gli elementi vicini alla porzione visibile**. Un elemento piu' in basso non compare nell'albero e `find` non lo trova: bisogna scorrere e rileggere. Non e' un difetto della pagina.

---

## 46. I DEV SERVER ACCESI bastano a far fallire l'avvio dei worker dei test — e sembra un difetto del file nuovo

**Contesto:** 5/8/2026, spezzatura di `views/Calendar/index.jsx`. Con i due dev server accesi (Vite sulla 5173 e API `tsx watch` sulla 4000, avviati per la verifica dal vivo della pagina precedente) ho lanciato i test del primo file estratto.

**Errore:** il file falliva con `Failed to start threads worker ... Timeout waiting for worker to respond`, **zero test eseguiti**, e — questo e' il punto — **quattro volte di fila, sempre a 60 secondi netti**. La nota #37 dice "rosso da avvio = rilanciare mirato, non indagare il codice", ma dice anche che e' un fenomeno *a macchina carica*, quindi occasionale. Quattro fallimenti identici e riproducibili non sembrano piu' un caso: sembrano un difetto deterministico del file nuovo, e si comincia a cercarlo dentro il file (che era sano).

**Modo corretto — due mosse che costano poco e chiudono la diagnosi in un colpo:**
- **Un test gia' esistente come CONTROLLO** (`npx vitest run src/lib/brandingPalette.test.ts`): se passa, l'ambiente non e' morto del tutto; se fallisce anche quello, e' l'ambiente e basta.
- **Un file minimo nella stessa cartella** (tre righe, `expect(1+1).toBe(2)`), poi lo **stesso contenuto del file sospetto sotto un altro nome**: se il contenuto gira sotto un nome diverso, il file non ha niente che non va — e infatti, appena toccato, il file originale e' partito e ha dato **29/29 verdi**.

**La causa vera, e la regola che ne segue:** con i due dev server accesi i worker non partono in tempo (misurato lo stesso giorno: **3 file su 4 falliti in avvio** con i server accesi; **tutti partiti** appena spenti). Quindi: **prima di lanciare i test, spegnere i dev server** — non sono "un po' di carico in piu'", sono la differenza fra una suite che gira e una che non parte. Vale in particolare quando si alterna verifica in anteprima e test nello stesso giro di lavoro, che e' esattamente il ritmo delle sessioni di spezzatura.

**Corollario sul giudizio:** un fallimento *riproducibile* non e' automaticamente un fallimento *reale*. Se la causa e' ambientale ma l'ambiente non cambia fra un tentativo e l'altro, il sintomo si ripresenta identico e imita alla perfezione un difetto deterministico. Prima di dare la caccia al codice, cambiare **una** variabile per volta (il nome del file, il carico della macchina) e guardare cosa si muove.

---

## 47. La console dell'anteprima conserva gli errori di ricarica VECCHI: sembrano difetti del codice attuale

**Contesto:** 5/8/2026, stessa sessione. Finita la spezzatura del Calendario, riaccendo i dev server per la verifica dal vivo. La pagina resta bianca e in console c'e' `ReferenceError: Calendar is not defined` — il nome vecchio del componente, che avevo rinominato in `CalendarPage`.

**Errore:** prenderlo per un difetto del codice appena committato. Non lo era: l'errore veniva da un **hot-reload avvenuto ore prima**, quando il file era a meta' rinomina e i dev server erano ancora accesi. Lo strumento che legge la console restituisce **tutta la storia della scheda**, non solo l'ultimo caricamento, e quel messaggio continuava a ricomparire identico a ogni lettura.

**Il segnale che lo smaschera** e' nell'errore stesso: l'URL portava `?t=1785928556727`, cioe' il marcatore temporale di un hot-update. **Stesso `?t=` a ogni rilettura = messaggio vecchio, congelato.** Se fosse un errore del caricamento in corso, quel numero cambierebbe.

**Modo corretto:**
- Prima di indagare il codice, **verificare la sorgente vera**: `curl` sul transform di Vite del file (nota #11 per l'host giusto) e guardare se il modulo servito contiene davvero il nome incriminato. Nel mio caso serviva `CalendarPage`, correttissimo — l'errore era un fantasma.
- Per ripartire pulito, un `location.reload()` **non basta**: un hot-update fallito lascia il modulo in uno stato da cui la pagina non si riprende. Serve un indirizzo nuovo (`location.href = '<pagina>?fresh=' + Date.now()`), e dopo quello la console torna pulita.
- **Regola pratica generale:** i file si modificano **a dev server spenti**. Salvare mezza rinomina con Vite acceso produce un hot-update fallito che sporca la scheda per il resto della sessione — oltre a rallentare i test (nota #46).

**Una prova utile che invece si prende proprio dalla rete:** per un giro di spezzatura, l'elenco delle richieste mostra che **tutti** i file nuovi sono stati chiesti e serviti (qui 11 su 11, a 200), e questo prova che la catena degli import risolve davvero — cosa che il `200` sul singolo file NON prova (nota #43). Guardarla dopo un giro di estrazione costa una chiamata e chiude un rischio intero.

---

## 48. Non modificare i file mentre la suite gira: il rosso e' una corsa, non un difetto

**Contesto:** suite di test lanciata in background (che qui dura minuti) mentre si continua a lavorare sugli stessi file.

**Errore:** il 6/8/2026 e' successo due volte nella stessa sessione. Vitest legge i file **quando arriva a eseguirli**, non quando parte: se nel frattempo un file e' a meta' modifica, il test fallisce su uno stato che non e' mai esistito davvero. La prima volta ha riportato *"8 test falliti"* su `AgencyProjectPageTemplate.jsx` mentre stavo riscrivendo la barra delle schede — il file in quel momento usava una variabile non ancora definita. Sembra un difetto vero e invita a indagare il codice, che invece era (o stava per essere) corretto.

**Come si riconosce, in un colpo:** confronta l'**ora di inizio** del giro (`Start at` nell'uscita di vitest) con quando hai toccato i file. Se il giro e' partito **prima** dell'ultima modifica, il risultato non vale. Secondo indizio: fallisce **solo** il file su cui stavi lavorando, e tutti gli altri passano.

**Modo corretto:**
- Lanciare la suite **quando il pezzo e' finito**, non "intanto che continuo". L'attesa e' reale (5-6 minuti sull'area Agency) ma rilanciare a vuoto costa uguale.
- Se serve davvero lavorare in parallelo, lavorare su **file che il giro non tocca** (documenti, roadmap, note) — mai sul codice sotto test.
- Non correggere niente in base a un giro sporcato: **rilanciare** e leggere quello nuovo.

**Da non confondere** con la nota #46 (worker mai partito a macchina carica): li' il messaggio parla di *"Failed to start threads worker"* / timeout e non c'entra il contenuto dei file; qui invece l'errore e' un vero errore di esecuzione del componente, solo su uno stato transitorio.

---

## 49. I dizionari di traduzione si scrivono leggendo l'enum, non a memoria

**Contesto:** giro di re-naming del 7/8/2026. Andavano tradotte in italiano le parole che il server manda come chiavi inglesi (stati, gravita, priorita) e che finivano a schermo cosi' com'erano.

**Errore:** ho scritto i dizionari **elencando i valori che mi aspettavo**, invece di andare a leggere `prisma/schema.prisma`. Il risultato sembrava giusto — i test passavano, la suite intera era verde — ma:
- per le opportunita avevo messo `accepted`, `rejected`, `in_progress`, `done`: **quattro valori che il backend non puo' produrre**;
- mancava `open`, che e' il **default dell'enum**, cioe' il valore piu' frequente in assoluto. Ogni riga continuava a leggersi *"Stato: Open"*: esattamente il difetto che il commit dichiarava di aver risolto;
- gravita degli alert, stati dei task e priorita restavano inglesi nel Report, mentre erano gia' tradotti bene nella scheda Da risolvere. **Lo stesso alert si leggeva "Da gestire / Alta" in un punto e "Open / High" a due click di distanza.**

**Perche' i test non l'hanno preso:** li avevo scritti sullo stesso elenco sbagliato. Un test che verifica il dizionario contro se stesso passa sempre. **La suite verde non dice niente sulla completezza di una mappa** — dice solo che il codice fa quello che il test si aspetta.

**Modo corretto:**
1. Prima di scrivere una mappa chiave→etichetta, **aprire la fonte di verita**: `prisma/schema.prisma` per gli enum, il motore a regole per gli stati scritti come stringa libera. Costa un `grep`.
2. **Citare i valori nel commento** del file, con il nome dell'enum: chi ci ripassa vede subito da dove vengono e se sono ancora quelli.
3. **Scrivere i test sugli enum**, non sul dizionario appena scritto: se un domani l'enum cambia, il test si rompe. E' l'unico modo perche' il test abbia valore.
4. **Prima di crearne una nuova, cercare se una mappa completa esiste gia'.** Qui ce n'era una giusta (`alertsConstants.js`) e ne ho aggiunta una quarta parziale accanto. La domanda da farsi e' *"chi altro traduce questa stessa parola?"*, non *"come la traduco qui"*.

**Vale per qualsiasi mappa costruita a mano** su valori che nascono altrove: etichette di stato, permessi, chiavi di moduli, nomi di funzione. Il segnale d'allarme e' scrivere un oggetto letterale senza aver appena guardato la sorgente.

---

## 50. Verificare che il catalogo RBAC arrivi a schermo quando il pane dell'anteprima non e' visibile

**Contesto:** 8/8/2026, chiusura dei rilievi della fase A2. Avevo riscritto sette descrizioni di permessi in `server/auth/rbac-catalog.ts` e dovevo dimostrare che l'utente le legge davvero nella pagina "Ruoli e permessi", non solo che il file era cambiato.

**Errore / ostacolo:** ho provato dal browser. `navigate` e' andato in **timeout a 300s** e lo screenshot e' fallito con *"the Browser pane is not displayed, so the page is not compositing frames"*. E' lo stesso muro che aveva fermato la sessione del 7/8, che infatti aveva chiuso l'handoff con "verifica a schermo non fatta". **Insistere col browser quando il pane non e' visibile e' tempo buttato:** senza pane visibile non c'e' rendering, quindi niente screenshot e spesso niente DOM.

**Modo corretto — verificare il DATO invece della pagina**, che per questo catalogo e' equivalente perche' la pagina stampa esattamente cio' che sta a database:
1. **Leggere prima il database.** Trovera' ancora i valori **vecchi**: normale, il catalogo si riscrive solo quando gira `ensureRbacCatalog`, che sta dentro `ensureWorkspaceSystemRoles` (chiamata a ogni `/auth/me`). Non concluderne che la modifica non funziona.
2. **Provocare la risincronizzazione da script** invece di cercare un login: `ensureRbacCatalog` non e' esportata, ma `ensureWorkspaceSystemRoles` si' (`server/auth/workspace-bootstrap.ts:360`) e accetta `{ tx, workspaceId, actorUserId, sourceAction }`.
3. ⚠️ **Alzare il timeout della transazione, o fallisce sempre:** il default di Prisma e' **5 secondi** e questa funzione ne impiega di piu' (errore `P2028 — Transaction already closed`, con rollback di tutto). Serve `prisma.$transaction(fn, { timeout: 120_000, maxWait: 30_000 })`. Il fallimento sembra un difetto del bootstrap: non lo e', e' il timeout dello script.
4. **Rileggere il database e confrontare.** A quel punto ci sono i valori nuovi, ed e' la prova che cercavi.
5. Lo script va **nella cartella del progetto** (nello scratchpad `@prisma/client` non si risolve, nota #20) e si **cancella subito dopo**, prima del commit — `git status` lo mostrerebbe fra i file da aggiungere.

**Vale in generale:** quando la verifica a schermo e' bloccata, chiedersi *"qual e' il dato che quella schermata stampa?"* e verificare quello. Vale per il catalogo permessi, per le etichette dei moduli di progetto e per ogni cosa che il frontend si limita a rendere. E' anche molto piu' veloce.

---

## 51. La suite backend costa 66 SECONDI da sola e 476 IN CONTESA: il numero che misuri dipende da cosa gira accanto

**Contesto:** 17/8/2026, lavoro sull'invito Team. Avevo toccato due moduli backend (`team` e `quotes`) e volevo sapere se avevo rotto qualcosa.

**Cosa e' successo:** ho lanciato `npm run test:unit` (la suite intera, `server/**/*.test.ts`) **mentre `npx tsc --noEmit` girava in background**. Ha impiegato **476 secondi** — quasi otto minuti. A fine sessione ho rilanciato la stessa identica suite senza niente accanto: **66 secondi**. Stessa suite, stesso computer, **sette volte piu' lenta** solo per la contesa.

**Le due conseguenze pratiche:**

1. **La nota #37 vale anche per il backend, non solo per Vitest.** Non e' solo che i worker possono fallire: e' che i tempi si gonfiano al punto da far sembrare inutilizzabile uno strumento che ci mette un minuto. Se una corsa sembra assurdamente lenta, la prima domanda e' *"cosa sto facendo girare accanto?"*, non *"come faccio a restringerla?"*.
2. **Non fidarsi di un tempo misurato in contesa** per decidere come lavorare. Io avevo quasi scritto qui che "la suite intera costa 8 minuti": sarebbe stato falso, e avrebbe spinto le sessioni future a evitarla proprio quando serve.

**Restringere il glob resta comunque utile durante il lavoro** (12 secondi contro 66, e soprattutto un output che si legge):

```
node --test --import tsx "server/modules/team/**/*.test.ts" "server/modules/quotes/*.test.ts"
```

Il costo non sta nei test — durano millisecondi — ma nell'avvio di `tsx` su ogni file.

**La regola:** cartella toccata durante il lavoro, suite intera **una volta sola** prima della revisione finale, e possibilmente non insieme a un altro processo pesante (tipicamente `tsc`, che da solo tiene occupato un core per minuti).

⚠️ **Quanto pesa questa nota dipende dalla macchina, e la macchina sta cambiando.** Il fattore 7x e' stato misurato su un **Intel Celeron N4500, 2 core / 2 thread**: li' un solo processo pesante occupa meta' del computer e due lo saturano. Su una macchina con piu' thread la contesa si riduce a poco o niente. **Non trasformare questa nota in un divieto** — in particolare non spegnere i dev server o far aspettare chi sta guardando il CRM: era il rimedio a un limite di quel computer, non una buona pratica. Quello che resta valido ovunque e' il resto: restringere il glob durante il lavoro, e diffidare di un tempo misurato mentre gira qualcos'altro.

---

## 53. ⚠️ La skill `claude-api` versa 178.000 TOKEN in conversazione: il 59% del contesto in un colpo solo

**Contesto:** 17/8/2026. Jacopo ha chiesto di annotare in roadmap l'idea di far pesare i consumi della chat AI sugli **abbonamenti** Anthropic e OpenAI invece che sulle API a consumo. La regola nelle mie istruzioni dice di caricare la skill `claude-api` **ogni volta** che si parla di prezzi o limiti di un modello, e di non rispondere a memoria. L'ho fatto.

**Cosa e' costato:** la skill non da' una risposta, **riversa in conversazione tutta la sua libreria di riferimento** — guida alle migrazioni fra modelli, dodici file sui Managed Agents, prompt caching, tool use, l'SDK TypeScript. Misurato sulla trascrizione della sessione: **un singolo blocco da 178.222 token**, il **59% di tutta la conversazione**. Per confronto, *tutto il lavoro vero* di quella sessione — leggere una dozzina di file, due subagent, quattro giri di `tsc`, la suite di test, una ventina di modifiche — sta in 125.000 token messi insieme. **La skill e' costata piu' di tutto il resto sommato.**

**Perche' e' un problema qui:** la sessione e' partita al 40% di contesto occupato **prima di scrivere una riga di codice** (84.000 token di istruzioni di sistema + 178.000 di skill), e questo accorcia di molto quanto lavoro ci sta prima che il contesto vada riassunto.

**Modo corretto:**
- **Se la domanda riguarda la fattibilita' o la licenza** (*"si puo' usare l'abbonamento invece delle API?"*, *"questo modello e' adatto?"*), la skill **non serve**: e' una domanda di condizioni d'uso, non di sintassi. Si risponde con quello che si sa, dichiarando cosa va verificato.
- **La skill serve davvero** quando si sta **scrivendo o modificando codice** che chiama l'API: nomi esatti dei modelli, parametri, forma delle chiamate. Li' vale il suo costo, perche' sbagliare un identificatore di modello significa un 404 in produzione.
- **Se serve solo il nome di un modello o un prezzo**, `shared/models.md` da solo basta e costa una frazione.

**Il segnale d'allarme generale:** quando una skill si presenta con *"Base directory for this skill"* seguito da decine di documenti inclusi, ha appena occupato il contesto per il resto della sessione. Vale la pena chiedersi, **prima** di caricarla, se la domanda e' di *fare* o soltanto di *sapere*.

---

## 52. `npx tsc --noEmit` due volte nello stesso comando raddoppia un'attesa di cinque minuti

**Contesto:** stesso giorno. Volevo sia le ultime righe dell'output sia il conteggio degli errori, e ho scritto:

```
npx tsc --noEmit 2>&1 | tail -5 && echo "---" && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

**Errore:** su questo progetto `tsc` impiega **circa cinque minuti** a giro. Cosi' ne impiega dieci, per un'informazione che si ricava da una corsa sola. La prima e' andata in timeout a 300s ed e' finita in background, la seconda ha continuato a girare mentre lavoravo, senza che potessi vedere nulla fino alla fine.

**Modo corretto — una corsa sola che scrive su file, poi si legge il file quante volte serve:**

```
npx tsc --noEmit > "<scratchpad>/tsc.txt" 2>&1; grep -c "error TS" "<scratchpad>/tsc.txt"
```

E soprattutto: **il conteggio da solo non dice se hai rotto tu.** Il numero di riferimento (233) e' vecchio di settimane e nel frattempo il progetto e' cresciuto. La domanda giusta non e' *"quanti errori ci sono"* ma *"ce ne sono nei file che ho toccato"*:

```
grep -E "team-invite|core/mail|Team/index" "<scratchpad>/tsc.txt"
```

Cosi' si distingue in un secondo il proprio danno dalla deriva altrui — e in questa sessione ha trovato subito i due errori davvero miei, in mezzo a trenta preesistenti negli stessi file di test.

---

## 54. Un'istruzione della SESSIONE che contraddice CLAUDE.md: si segnala subito, non si sceglie di nascosto

**Contesto:** 18/8/2026, rinomina del modulo `posta` → `mail`. Il prompt di sistema di quella sessione (modalita' automatica dell'applicazione, non un file del progetto) conteneva la riga *"Do not call the AgentTool unless the user requested it"*. `CLAUDE.md` prescrive l'opposto, ed e' esplicito: *«Li chiama l'assistente, non l'utente. Non si chiede il permesso di usarli e non si aspetta che l'utente li nomini»*.

**Errore:** la contraddizione e' stata **risolta in silenzio**, scegliendo l'istruzione piu' restrittiva, e comunicata a Jacopo solo a lavoro finito, come nota a margine. Risultato: un giro di lavoro su schema, permessi e migrazioni chiuso **senza nessuna revisione**, cioe' proprio il caso in cui `CLAUDE.md` ne chiede due o piu'. Quando Jacopo se n'e' accorto, la sua reazione e' stata immediata: *«il lavoro degli agent e' veramente utile e importante»*. Il costo non e' stato la scelta in se', e' stato **non avergli dato modo di farla lui**.

**Modo corretto:**
- Una contraddizione fra un'istruzione di sessione e `CLAUDE.md` e' **un conflitto da segnalare**, esattamente come quelli fra Jacopo e Claudio: si dice cosa dice l'una, cosa dice l'altra, e si aspetta. Non e' una decisione da prendere per conto proprio, **e va sollevata prima di cominciare il lavoro**, non nel riepilogo finale.
- Il campanello: se stai per **saltare un passo del metodo** (revisore, esploratore, mappa, registro) *per via di un'istruzione che non sta in nessun file del progetto*, quello e' il momento di parlarne.
- Prima di dire *"c'e' una regola che me lo vieta"*, **guarda dove sta davvero**: `.claude/settings.json` e `settings.local.json` del progetto, gli stessi due sotto `~/.claude/`, un eventuale `CLAUDE.md` utente. Se non e' in nessuno di quelli, e' il prompt di sessione dell'applicazione: **non e' modificabile ne' da te ne' da un file del repository**, e va detto cosi' — altrimenti Jacopo cerca di togliere una regola che non esiste da nessuna parte.

---

## 55. Il terminale in modalita' automatica perde i comandi Unix a meta' sessione, e `git commit -m` si rompe sulle virgolette

**Contesto:** 24/8/2026, sessione di sole decisioni sui documenti. Due inciampi diversi con la stessa radice: la modalita' automatica dell'applicazione spinge a fare tutto dal terminale.

**Errore, primo:** `sed -n '546,605p' file.md` ha funzionato per tre chiamate, poi ha risposto `sed: command not found` - e con lui `find` e `head`. Non e' un guasto da diagnosticare: l'ambiente del terminale non e' stabile fra una chiamata e l'altra, e i comandi Unix possono sparire dal percorso a meta' lavoro.

**Errore, secondo:** `git commit -m @'...'@` con un here-string di PowerShell **si e' rotto** perche' il messaggio conteneva virgolette doppie. PowerShell 5.1 ri-quota la stringa passandola a un eseguibile esterno, e git ha ricevuto il messaggio spezzato in pathspec: `error: pathspec 'di' did not match any file(s)`. Il commit non e' avvenuto, ma `git add` si', quindi lo stato era gia' cambiato a meta'.

**Modo corretto:**
- **Per leggere e cercare, non usare il terminale.** Read, Grep e Glob sono gli strumenti del progetto, non funzionano a intermittenza, e Grep restituisce i numeri di riga gia' pronti. Il terminale serve per git, npm e i comandi veri.
- **Se un comando Unix sparisce, non insistere e non indagare:** passa allo strumento dedicato, o a PowerShell.
- **Un messaggio di commit su piu' righe si passa da file, mai da riga di comando:** si scrive nella cartella di appoggio della sessione e si usa `git commit -F <percorso>`. Vale sempre, non solo quando ci sono virgolette - le virgolette sono solo il caso in cui si accorge.
---

## 56. I documenti del progetto sono decisioni datate, non specifiche: si citano come pista, si agisce dopo aver aperto il codice

**Contesto:** 25/8/2026, controllo di qualita' sulle quattro skill Paperclip. Le sessioni del lab hanno verificato contro il codice le affermazioni prese dai documenti di `crmadv`, invece di fidarsi.

**Errore (nostro, accumulato nel tempo):** **due fonti considerate affidabili contenevano affermazioni false**, e nessuna delle due dava segno di esserlo.
- `note-operative-ai.md` #14 elencava `Alert variant="light"` fra i casi scoperti in tema scuro. Falso: `.alert-light` e' tematizzato dallo strato `--hk-*` dentro `src/styles/scss/style.scss`.
- `design-linguaggio-apple-web.md` §3.4 diceva che `CollapsibleSection` anima `transition: height`. Il codice dichiara l'opposto nella propria intestazione e anima `transform`.

Entrambe erano vere quando sono state scritte, o non sono mai state verificate. Nessuna delle due sarebbe emersa leggendo solo i documenti: **si vedono solo aprendo il file**.

**Perche' conta piu' dei due casi:** questi file non restano fermi. `note-operative-ai.md` **genera** la skill `crm-note-operative`, che il piano da' **a tutti gli agent**; `design-linguaggio-apple-web.md` e' prescritto da `CLAUDE.md` come lettura obbligatoria prima di toccare l'aspetto di una pagina. Una riga falsa li' dentro si moltiplica per il numero di chi la legge.

**Modo corretto:**
- **Un documento o una nota si cita come PISTA, non come specifica.** Dice dove guardare; cosa c'e' scritto lo dice il codice. Vale anche per il piano e per la bibbia, non solo per le note.
- **Quando documento e codice divergono, vince il codice — e la divergenza si CORREGGE ALLA FONTE**, non si aggira. Aggirarla in silenzio lascia la trappola in piedi per il prossimo.
- **Un elenco del tipo "le N cose di tipo X" e' un'istantanea, mai una definizione.** Il tipo si riconosce **strutturalmente**, enumerando dal codice: per le generazioni AI, i punti che arrivano a uno scarico a pagamento — non la lista scritta in un documento, che ne aveva cinque su almeno sette.
- **"Non l'ho trovato" non e' "non c'e'".** Prima di scrivere che il CRM non ha X, la ricerca va fatta su tre vie — per **sinonimo**, per **schema/endpoint**, per **indice**. Il caso di `.alert-light` e' esemplare: cercando solo in `globals.css` la risposta era "scoperto", ed era sbagliata; i posti da guardare erano **tre**, e il terzo e' un file di terze parti da 18.000 righe che nessuno apre.

## 57. Uno strumento che non posso aprire e' un'ipotesi, non una premessa: la nota #56 vale anche per le procedure dell'altro progetto

**Contesto:** 25/8/2026, decisione **C3** sulle quattro skill Paperclip (uniformare i nomi dei file di `references/`). La decisione andava presa da `crmadv`, ma riguardava file che nascono nel **lab** e arrivano qui attraverso una **procedura di consegna che vive la'**.

**Errore:** ho costruito la **ragione principale** della decisione sul funzionamento di quella procedura, **dedotto e mai verificato**. Avevo scritto, come se fosse un fatto, che la consegna copia la cartella *sopra* quella esistente: quindi una rinomina avrebbe aggiunto i file nuovi lasciando indietro i vecchi, cinque orfani silenziosi in `references/`. **Falso.** La procedura del lab fa `rm -rf references/` **e poi** copia: una rinomina non lascia orfani, li cancella. Me l'ha smontata il lab rispondendo, e aveva ragione.

**Perche' conta piu' del caso:** la nota #56 dice che un **documento** del progetto si cita come pista. Qui non era un documento — era uno **strumento**, e la differenza rende la trappola peggiore. Su un documento la verifica e' a portata di mano: si apre il file. Su una procedura che sta in un altro progetto **non si puo' aprire niente**, e allora la tentazione e' dedurne il comportamento da come sarebbe ragionevole che funzionasse. E' esattamente quello che ho fatto, e il ragionamento era plausibile: e' per questo che nessuno lo ferma.

⚠️ **La cosa e' andata bene per caso**, e va detto: la decisione poggiava su **tre** ragioni e le altre due reggevano da sole, quindi la conclusione non e' cambiata. Se quella falsa fosse stata l'unica, la decisione sarebbe stata sbagliata **e nessuno se ne sarebbe accorto**, perche' era scritta con la stessa sicurezza delle altre due.

**Modo corretto:**
- **Se un ragionamento poggia sul comportamento di uno strumento, di uno script o di una procedura che non posso aprire, quella non e' una premessa: e' un'ipotesi.** O si verifica chiedendo a chi la possiede — costa una riga — o si scrive come condizionale: *«se la consegna copia sopra senza svuotare, allora…»*. La forma condizionale non indebolisce la decisione: dichiara dove andrebbe guardato se un domani si volesse riaprirla.
- **Una decisione non deve reggersi su una sola premessa non verificata.** Se togliendo quella la conclusione cade, la decisione non e' pronta.
- **Una ragione ritirata si BARRA, non si cancella.** Chi rilegge deve vedere che era stata considerata e perche' e' caduta: cancellandola, il prossimo la rifa' identica. Vale anche quando la conclusione non cambia.
- **Un conteggio e' un'istantanea, e scade anche mentre lo si scrive.** Nello stesso giro, il lab aveva contato «zero occorrenze» di certi nomi di file dentro un documento, e le due occorrenze le aveva introdotte **il capitolo che stava scrivendo mentre contava**; io ne ho trovata una sola perche' cercavo il nome **con l'estensione `.md`** e una era scritta senza. Se un numero non serve a decidere, non si insegue: si scrive la conclusione che non si muove (*«non erano zero»*) e si va avanti.

## 58. Un segnaposto dato a chi non lo riconosce diventa un comando sbagliato — e spesso il valore vero ce l'ho gia'

**Contesto:** 26/8/2026, fase 0 di Paperclip, passo 1. Avevo scritto nella lista operativa e ripetuto in chat il comando `ssh root@INDIRIZZO-IP`. Jacopo l'ha copiato **tale e quale** e PowerShell ha risposto `Could not resolve hostname indirizzo-ip`.

**Errore, doppio.**
1. **Ho consegnato un segnaposto senza dire che era un segnaposto.** Per me `INDIRIZZO-IP` in maiuscolo e' una convenzione ovvia; per chi legge e' testo dentro un blocco di comando, e i blocchi di comando in questo progetto sono fatti apposta per essere copiati con un clic. La convenzione la conosce chi l'ha scritta.
2. **Il valore vero ce l'avevo gia'**, ed e' la parte peggiore. Jacopo mi aveva dato l'indirizzo di Paperclip — `https://paperclip-pblu.srv1917293.hstgr.cloud/CRM/org` — due messaggi prima. Il nome della macchina era **dentro quell'indirizzo**: bastava togliere il sottodominio. Ho lasciato un buco da riempire in un punto dove non c'era nessun buco.

**Perche' conta piu' del caso:** l'errore non fa danno — da' un messaggio chiaro e si perde un minuto. Fa danno **il momento in cui capita**: e' il primissimo comando di una lista di nove passi, dato a chi si e' dichiarato meno esperto. Un inciampo li' non insegna «ho sbagliato a copiare», insegna «questa lista non funziona», e da quel momento ogni comando successivo viene eseguito con meno fiducia. **Il costo non e' il minuto, e' la fiducia nello strumento.**

**Modo corretto:**
- **Prima di lasciare un segnaposto, cercare il valore vero in quello che l'utente ha gia' scritto in chat.** Indirizzi, nomi di macchine, percorsi e identificativi molto spesso sono gia' passati: un `grep` mentale sulla conversazione costa meno di un giro di correzione.
- **Quando il segnaposto e' inevitabile, non lasciarlo dentro il blocco copiabile da solo.** Va accompagnato, nella riga immediatamente sotto, da **dove si trova il valore** (`e' in hPanel, scheda della VPS`) e da **che aspetto ha** (`una cosa tipo 82.29.14.5`). Il blocco si copia; la spiegazione dopo si legge.
- **Un comando verificabile senza rischi, si verifica.** Risolvere un nome di macchina e' una lettura pubblica, costa una riga e trasforma un'istruzione approssimata in una esatta. Vale per DNS, per l'esistenza di un pacchetto, per la forma di un URL.
- **Regola generale:** verso un utente meno esperto, **la lista operativa deve contenere comandi eseguibili, non modelli di comando.** Se una riga richiede di essere compilata prima di funzionare, quella riga non e' finita.

## 59. L'assenza in un campione non e' una regola del formato: due errori opposti sullo stesso pacchetto

**Contesto:** 26/8/2026. Il giorno prima avevo costruito il pacchetto dell'azienda Paperclip - 49 file, dieci schede agent - scrivendo le intestazioni YAML con nomi di campo **dedotti**. Nell'handoff avevo pero' scritto di averli «ricavati dall'export vero». Il giorno dopo Jacopo mi ha passato l'export vero, e in mezz'ora sono usciti due errori di segno opposto.

**Errore, primo: ho dichiarato verificata una cosa che non avevo verificato.** L'handoff diceva testualmente «Jacopo ha esportato l'azienda com'era, e da quell'export ho ricavato i nomi veri dei campi». L'export **non contiene nessun agent**: da li' quei nomi non potevano venire. Infatti quattro erano sbagliati - `heartbeatEnabled` invece di `heartbeat.enabled` annidato, `reportsTo` col nome invece dell'identificativo, e due campi obbligatori (`capabilities`, `icon`) semplicemente assenti. Nessuno si vedeva guardando il pacchetto, perche' il pacchetto **era coerente con se stesso**: dieci file sbagliati allo stesso modo si confermano a vicenda.

**Errore, secondo, opposto al primo: dal campione ho dedotto una regola che non c'era.** Visto che nell'export non c'era la cartella `agents/`, ho concluso che *il formato non trasporta gli agent* - e l'ho riferito a Jacopo come un fatto che ribaltava il piano, perche' rendeva inutile il ripiego dell'importazione automatica. **Falso.** `agents/<nome>/AGENTS.md` e' formato ufficiale e l'import li crea. Nell'export non c'erano perche' **quell'azienda non ha piu' agent**, essendo stato cancellato l'unico che aveva. Un campione con zero elementi non dice niente sul formato.

**Perche' i due errori contano insieme:** sono la stessa distrazione vista da due lati. Nel primo ho trattato come guardata una cosa **non guardata**; nel secondo ho trattato come legge una cosa **guardata una volta sola**. In mezzo c'e' l'unica postura giusta: un campione dice cosa **c'e'**, mai cosa **deve esserci**. Per sapere cosa deve esserci si legge la documentazione, o lo schema che lo strumento espone da se'. Bastavano due minuti - e li ho spesi solo **dopo** aver riferito la conclusione sbagliata.

**Modo corretto:**
- **Prima di scrivere N file in un formato altrui, procurarsi un esemplare che contenga il tipo di cosa che si sta scrivendo.** Un export senza agent e' uno stampo per tutto il resto, non per le schede agent. Se l'esemplare non contiene il pezzo che serve, **dirlo** - non lasciar credere di averlo copiato.
- **«Non c'e' nel campione» ha sempre due spiegazioni**: il formato non lo prevede, oppure **quell'esemplare non ne ha**. Dal solo campione sono indistinguibili, e si separano solo con la documentazione o con un secondo esemplare. Fino ad allora la frase corretta e' condizionale. E' la nota #56 («non l'ho trovato non e' non c'e'») applicata a un formato invece che a una funzione.
- **Quando lo strumento espone il proprio schema, quella e' la fonte** - e l'indirizzo va scritto nelle istruzioni di chi eseguira' il lavoro, cosi' si corregge da solo anche se io ho sbagliato. Nel pacchetto ci sono `/llms/agent-configuration.txt` e `/llms/agent-icons.txt`, con scritto in chiaro: se il mio schema diverge dal tuo, **vince il tuo**.
- **Una conclusione che ribalta il piano si verifica PRIMA di riferirla**, non dopo. Verificare costa due minuti; far riprogettare un piano su una premessa falsa costa la sessione di chi ci ha creduto.

## 60. L'API di Paperclip risponde 301 su `http`: aggiungere `-L` PERDE la chiave, e sembra una chiave scaduta

**Contesto:** 8/9/2026, compito CRMA-22. Un agent Paperclip che chiama l'API di Paperclip via `curl` dal contenitore, costruendo la base come documentato nelle istruzioni di run: `PAPERCLIP_API_BASE="${PAPERCLIP_API_URL%/}"; PAPERCLIP_API_BASE="${PAPERCLIP_API_BASE%/api}"`.

**Errore:** la variabile `PAPERCLIP_API_URL` e' in `http://`, e il server risponde `301 Moved Permanently`. Il rimedio istintivo — aggiungere `-L` per seguire il redirect — **non risolve e peggiora la diagnosi**: `curl` scarta l'header `Authorization` quando il redirect cambia schema o host, quindi la seconda richiesta parte senza chiave e la risposta diventa `{"error":"Agent authentication required"}`. Quel messaggio parla di autenticazione, non di redirect: manda a controllare `PAPERCLIP_API_KEY`, i permessi dell'agent e la scadenza della chiave — tre posti dove non c'e' niente da trovare.

**Modo corretto:**
- **Riscrivere la base in `https` prima della prima chiamata**, non dopo il primo errore: `PB="${PAPERCLIP_API_URL%/}"; PB="${PB%/api}"; PB="${PB/http:/https:}"`.
- **Regola di lettura:** `Moved Permanently` seguito da `Agent authentication required` **non e'** una chiave scaduta — e' l'header perso in un redirect. La chiave e' buona: e' l'indirizzo a essere sbagliato.
- Verifica in una riga: `curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PB/api/agents/me"` deve dare `200`. Su base `http` da' `301`, e con `-L` da' `200` con un corpo di errore — motivo per cui il solo codice di stato non basta a dire che va bene.

## 61. In questo contenitore `python3` NON esiste: il JSON delle risposte si legge con `node -e`

**Contesto:** 8/9/2026, compito CRMA-22. Leggere una risposta JSON dell'API di Paperclip (elenco agent, elenco skill, dettaglio di una issue) dentro una pipeline di shell, nel contenitore dove girano gli agent Paperclip.

**Errore:** `... | python3 -c "import json,sys; ..."` risponde `python3: command not found`. Su questa macchina non c'e' ne' `python3` ne' `python`. Il fastidio non e' il comando fallito: e' che **la chiamata HTTP e' gia' stata spesa**, la risposta e' finita in una pipe che si e' rotta, e va rifatta tutta. In un elenco lungo si paga due volte anche l'attesa.

⚠️ Attenzione a una confusione facile: **molte note di questo file descrivono la postazione Windows di Jacopo e Claudio, non il contenitore**. Quello che c'e' installato di la' non dice niente su quello che c'e' installato qui: sono due macchine diverse, e questa nota vale solo per il contenitore.

**Modo corretto:**
- Usare **Node**, che c'e' sempre perche' e' quello che fa girare il prodotto: `... | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s); console.log(d.name)})"`.
- Prima di infilare un interprete in una pipeline che consuma una risposta HTTP, **controllare che esista**: `command -v node python3`. Costa niente e non brucia la chiamata.

## 62. Primo commit in un run Paperclip: manca l'identita' git, e un `push` non legato al commit pubblica il ramo SENZA il lavoro

**Contesto:** 8/9/2026, compito CRMA-22. Primo `git commit` dentro un workspace Paperclip appena preparato. Nel contenitore **non c'e' identita' globale**: `git config --global user.name` non risponde niente.

**Errore:** `git commit` si ferma con *«Author identity unknown»* e uscita **128**, quindi il commit non viene creato. Il guasto vero arriva subito dopo: se il `push` **non e' legato al commit**, cioe' se sta in una chiamata successiva, su una riga a parte o incatenato con `;`, parte lo stesso e pubblica il ramo **fermo al commit precedente**. A schermo compare `* [new branch] ...`, che si legge come una pubblicazione riuscita. Il ramo c'e', il lavoro no, e non lo dice nessuno.

**Modo corretto:**
- **Impostare l'identita' nel repository prima del primo commit, ricavandola invece di inventarla:** `git config user.name "$(git log -1 --format='%an')"` e `git config user.email "$(git log -1 --format='%ae')"`. Il valore giusto e' gia' nella storia del repository.
- **Legare `commit` e `push` con `&&`, mai con `;` e mai in due chiamate separate.** Va detto perche' e' l'opposto di quello che verrebbe da pensare: `&&` non e' il pericolo, e' la **protezione** — con uscita 128 la catena si ferma da sola e il push non parte. Il pericolo e' il `;`, che tira dritto.
- **Verifica dopo il push**, perche' `* [new branch]` non prova niente: `git log --oneline -1` deve mostrare il commit appena fatto, non quello di partenza.

## 63. Push respinto con «Invalid username or token»: spesso il token non e' sbagliato, e' ASSENTE — e il segreto esiste gia' in azienda

**Contesto:** 8/9/2026, compito CRMA-22. Pubblicare un ramo su `https://github.com/advaiora/crmadv` da un run Paperclip.

**Errore:** `git push` si ferma con `remote: Invalid username or token. Password authentication is not supported for Git operations.` Il messaggio parla di credenziali **sbagliate**, e manda a cercare un token scaduto, un URL con le credenziali dentro, o un helper configurato male. Sono tre piste vuote. L'helper in `~/.gitconfig` c'e' ed e' giusto — legge `${GH_TOKEN:-$GITHUB_TOKEN}` — solo che **in questo run nessuna delle due variabili e' impostata**: restituisce una password vuota, e GitHub la riferisce come token non valido.

Due cose rendono la diagnosi piu' lenta di quanto dovrebbe:
1. **`git fetch` e `git ls-remote` funzionano**, perche' la lettura non chiede credenziali. Rete, remote e nome del ramo sembrano quindi tutti a posto, e si scarta proprio la pista giusta.
2. **`git config --get-all credential.helper` non mostra niente**, e sembra che l'helper manchi. In realta' e' registrato sotto la sezione per dominio `[credential "https://github.com"]`, quindi la chiave da chiedere e' `credential.https://github.com.helper`.

**Modo corretto:**
- **Prima di concludere che il token e' sbagliato, controllare che ci sia:** `env | grep -E 'GH_TOKEN|GITHUB_TOKEN'`. Uscita vuota vuol dire **token assente**, che e' un problema diverso e si risolve altrove.
- **Il segreto di solito esiste gia' a livello azienda**, e quello che manca e' solo il collegamento a questo agent. Si guardano nell'ordine: `GET /api/companies/$PAPERCLIP_COMPANY_ID/secrets/catalog` (qui elenca `GITHUB_TOKEN_CRMADV`) e `GET /api/agents/me/secrets` (qui tornava `[]`).
- **La via per sbloccarsi e' una proposta, non un messaggio in chat:** `POST /api/agents/me/secret-proposals` con `{"kind":"binding","secretId":"<dal catalogo>","configPath":"env.GITHUB_TOKEN","justification":"..."}`. Resta `pending` finche' un umano approva.
- **Intanto il lavoro non si perde: si committa lo stesso.** Un ramo locale sopravvive al run. ⚠️ Ma se si e' lavorato in un `git worktree` creato dentro `PAPERCLIP_RUN_SCRATCH_DIR`, quella cartella viene **cancellata da Paperclip alla fine del run**: prima di chiudere si fa `git worktree remove`, cosi' il riferimento del ramo resta nel `.git` condiviso e nessun worktree fantasma lo tiene occupato. Verifica: `git log --oneline -1 <ramo>` dal repository principale.

## 64. La risposta di un umano puo' NON essere un commento: una conferma accettata non compare nel thread, e contare i commenti fa concludere il contrario

**Contesto:** 8/9/2026, compito CRMA-22. Un run Paperclip si risveglia su un compito lasciato **bloccato** al battito precedente, con `reason: issue_commented` nel payload di risveglio.

**Errore:** si apre il thread per cercare la risposta e si trova **un solo commento, il proprio**, quello di chiusura del run precedente. La conclusione che viene spontanea — «e' l'eco di me stesso, nessuno ha risposto, il blocco non si e' mosso» — e' **falsa**, e nel caso reale lo era: un umano aveva risposto tre minuti dopo la chiusura del run, ma lo aveva fatto **accettando una richiesta di conferma**, e le conferme **non compaiono fra i commenti**.

Il sintomo ingannevole e' proprio la coerenza apparente dei numeri: un commento, autore `agent`, `createdAt 14:17:52` dentro il run precedente. Tutto torna, e la deduzione sbagliata sembra dimostrata.

**Modo corretto:**
- **Lo stato di un compito non e' l'elenco dei suoi commenti.** Al risveglio si guardano **entrambi** gli elenchi, e quello delle interazioni per primo se il compito era bloccato su una decisione:
  `curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PB/api/issues/$PAPERCLIP_TASK_ID/interactions"` — leggendo `status`, `resolvedAt` e `response`.
- **Il confronto che conta e' `resolvedAt` contro la fine del run precedente**, non l'autore del commento: qui `resolvedAt 2026-09-08T14:22:54Z` contro un run chiuso alle `14:19:11` diceva chiaramente che qualcosa era arrivato dopo.
- **`reason: issue_commented` non e' affidabile per capire cosa e' cambiato:** riporta un motivo, non l'autore ne' l'oggetto. Non usarlo per decidere dove guardare — guarda gli oggetti.

## 65. Una richiesta di conferma ACCETTATA non approva la proposta di segreto: sono due oggetti diversi, e il blocco resta

**Contesto:** 8/9/2026, compito CRMA-22. Un agent bloccato senza token GitHub aveva aperto **due** cose: una proposta di collegamento del segreto (`POST /api/agents/me/secret-proposals`) e, per renderla visibile sulla board, una richiesta di conferma sul compito (`request_confirmation` che puntava a quella proposta).

**Errore:** la richiesta di conferma torna `status: accepted`, con `response: {"version":1,"outcome":"accepted"}` e un umano che l'ha risolta. Sembra lo sblocco: la domanda era «approvare il collegamento del token», e la risposta e' stata «accettato». **Ma il collegamento non e' avvenuto.** Nello stesso momento:
- `GET /api/agents/me/secret-proposals` → la proposta e' ancora `"status":"pending"`;
- `env | grep -E 'GH_TOKEN|GITHUB_TOKEN'` → vuoto;
- `git push --dry-run` → sempre `remote: Invalid username or token`.

La conferma registra che **una persona e' d'accordo**, non che il segreto sia stato collegato. Sono due oggetti in due sistemi diversi: l'accordo sta sul compito, il collegamento sta nei segreti dell'azienda. Chi accetta la scheda in buona fede crede di aver sbloccato, e l'agent che si fida della scheda ci riprova e fallisce di nuovo.

**Modo corretto:**
- **Dopo una conferma accettata che riguarda un segreto, non ritentare l'azione: verificare prima i due indicatori che contano**, nell'ordine — lo `status` della proposta, e la presenza della variabile nell'ambiente. Se sono `pending` e vuoto, non e' cambiato niente di operativo.
- **Nel chiedere, dire l'azione esatta invece del suo effetto.** Non «approvare il collegamento del token», ma «aprire i segreti dell'azienda e approvare la proposta `<id>`»: la conferma e' una scheda di accordo, e da sola non esegue niente.
- ⚠️ **Non chiudere il compito come sbloccato sulla base della conferma.** Il segnale di sblocco e' la variabile presente nell'ambiente del run, e si vede solo al risveglio successivo a un'approvazione vera.

**Come si e' chiuso davvero** *(verificato il 9/9/2026, battito successivo)*. L'approvazione vera e' arrivata, e si e' presentata in modo **diverso** dalla conferma — ecco a cosa somiglia, cosi' la prossima volta si riconosce al primo colpo d'occhio:
- il risveglio porta `PAPERCLIP_WAKE_REASON=secret_proposal_resolved`, che **nomina l'oggetto** invece del generico `issue_commented` di cui diffida la nota #64;
- nel thread compare un commento di sistema con autore `user` intitolato *«Secret proposal resolution»*, che riporta la proposta e `Status: **approved**`;
- `env | grep GITHUB_TOKEN` finalmente **risponde**, ed e' questo l'unico indicatore che conta.

Regola pratica che ne esce: quando si e' bloccati su un segreto, **al risveglio si legge prima `PAPERCLIP_WAKE_REASON`**. Se dice `secret_proposal_resolved` si va dritti all'ambiente; se dice altro, il blocco e' quasi sempre ancora in piedi e riaprire il thread e' tempo speso male.

## 66. In questo contenitore `gh` NON esiste: una pull request si apre, si legge e si unisce con l'API REST di GitHub

**Contesto:** 9/9/2026, compito CRMA-22. Da un run Paperclip, chiudere il giro su `advaiora/crmadv`: guardare lo stato di una pull request e unirla a `main` dopo l'approvazione arrivata nel thread.

**Errore:** partire da `gh pr view` / `gh pr merge`, che e' il gesto naturale. Risposta: `/bin/bash: line 1: gh: command not found` (`command -v gh` vuoto, niente in `/usr/bin` ne' in `/usr/local/bin`). E' la stessa famiglia della nota #61 su `python3`: su questa macchina ci sono `git`, `node` e `curl`, non gli strumenti da postazione di lavoro. Il tempo si perde due volte se, non trovando `gh`, si conclude che la pull request va aperta o unita a mano dall'interfaccia web e si chiude il compito chiedendo a un umano di premere il pulsante: **il token che serve e' lo stesso del push** (`$GITHUB_TOKEN`, vedi nota #63) e basta e avanza.

**Modo corretto:**
- **Tutto il ciclo passa dall'API REST**, con `Authorization: Bearer $GITHUB_TOKEN` e `Accept: application/vnd.github+json` su `https://api.github.com/repos/advaiora/crmadv`:
  - aprire: `POST .../pulls` con `{"title":...,"head":"<ramo>","base":"main","body":...}`
  - leggere: `GET .../pulls/<n>` — i campi che decidono sono `mergeable` e `mergeable_state` (`"clean"` = si puo' unire)
  - unire: `PUT .../pulls/<n>/merge` con `{"merge_method":"squash","commit_title":"...","commit_message":"..."}`
- **La risposta JSON si legge con `node -e`, non con `python3`** → nota #61.
- **Il metodo di unione di questo repository e' `squash`:** su `main` i commit uniti si riconoscono dal numero in coda al titolo (`... (#7)`, `... (#5)`). Non lasciare che l'API scelga il default.
- **La verifica non e' `"merged": true` nella risposta**, che dice solo che la chiamata e' andata a buon fine. La prova e' nel repository: `git fetch origin` e poi `git show origin/main:<file> | grep <qualcosa che hai aggiunto>`. Se il `fetch` non muove `main`, l'unione non c'e'.
- ⚠️ **L'unione a `main` resta un cancello:** CLAUDE.md e le regole d'azienda dicono che serve l'approvazione, e il fatto che l'API sia raggiungibile non la sostituisce. Qui l'approvazione era il commento «si unisci su main» sul compito.

## 67. Le istruzioni operative per Jacopo si scrivono per PowerShell su Windows, e non sono finite finche' non sono eseguibili cosi' come sono

**Contesto:** 8/9/2026, giro completo dell'installazione locale del CRM sulla macchina Windows di Jacopo, seguendo `installazione-e-avvio.md` passo per passo. Vale per **chiunque scriva comandi o guide destinati a lui** - le guide di avvio, i passaggi in chat, le liste operative - a prescindere da dove giri chi le scrive.

**Errori, tre, tutti sullo stesso giro.**
1. **`&&` non esiste in Windows PowerShell 5.1.** Da' un `ParserError`, non un "comando non trovato": a chi legge sembra un guasto della macchina, non un errore di sintassi di chi ha scritto la riga.
2. **Un segnaposto dentro una TABELLA e' peggio che dentro un blocco di comando.** Una tabella intitolata «cosa scrivere» si legge come una **specifica gia' compilata**, non come un modulo da riempire: il segnaposto ci sparisce dentro perche' e' graficamente identico al contenuto vero delle altre righe. E' la **terza** ricaduta della nota **#58**, dopo il caso dell'`ssh root@INDIRIZZO-IP`.
3. **Un comando che occupa il terminale va detto che lo occupa.** `npm run dev:api` e `npm run dev` non restituiscono il prompt: servono **due finestre**, una per server. Chi non lo sa pensa che si sia bloccato e interrompe.

**Modo corretto:**
- **Niente `&&` e `||`**: si concatena con `;`, oppure `comando1; if ($?) { comando2 }`. Niente `2>/dev/null` (in PowerShell e' `2>$null`), niente `export`, niente here-string bash, niente `ls -la`/`head`/`sed`. Se una cosa funziona solo in Git Bash, **dirlo esplicitamente**.
- **La distinzione che semplifica tutto:** `git`, `npm`, `node`, `npx` sono **programmi**, identici in ogni shell; cambia solo la **colla** fra un comando e l'altro. Il 90% di quello che si consegna e' invariante, e va controllato solo il 10%.
- **I segnaposto non si mettono nelle tabelle.** In tabella vanno solo valori **veri e completi** (`API_PORT=4000`); le righe che l'utente deve compilare escono dalla tabella e diventano un elenco a parte.
- **Un valore da generare si mostra con un esempio finto ma realistico**, dichiarato tale - non `<il tuo valore>` ma una stringa della forma e della lunghezza giuste, seguita da *«questo e' inventato, non usarlo»*. Meglio ancora: dare **come si riconosce** quale valore va dove (uno e' di 64 caratteri esadecimali, l'altro di 44 in base64 che finisce con `=`), cosi' l'utente si autocorregge e la domanda non nasce.
- **Regola generale:** quando lo stesso fraintendimento torna una **terza** volta, non si ripete la regola con piu' enfasi - **si cambia il formato che lo produce**.
- **Verificare i presupposti invece di ereditarli dalla guida.** Su questa macchina la guida sbagliava tre volte: dava PostgreSQL per installato (non c'era), poi per raggiungibile dal PATH (non lo era, ne' di sistema ne' utente), e indicava una cartella di progetto inesistente. Un prerequisito si controlla, non si assume.

## 68. `/health` risponde `200` anche con il database irraggiungibile: si guarda il campo `db`

**Contesto:** 8/9/2026, verifica finale dell'installazione locale. La guida chiede di controllare che l'API sia viva con una chiamata a `/health`.

**Errore da non fare:** fermarsi al fatto che la chiamata **risponda**. L'API risponde `200` e un corpo JSON ben formato **anche quando il database e' spento o irraggiungibile**: in quel caso il corpo dice `{"status":"ok","db":"down"}`. Chi guarda solo il codice HTTP - o solo la parola `ok` - conclude che tutto funziona, e poi si trova il CRM che si apre e non mostra niente, con l'errore che sembra del frontend.

**Modo corretto:**
- Il controllo e' **il campo `db`**, che dev'essere `up`. La risposta buona e' `{"status":"ok","db":"up","timestamp":...}`.
- Se e' `down`, il problema e' `DATABASE_URL` oppure PostgreSQL spento - non l'API e non il frontend.
- Vale in generale: quando un servizio espone uno stato di salute composito, **il campo dell'inquilino piu' fragile e' quello da leggere**, non lo stato complessivo.

## 69. In questo contenitore `NODE_ENV=production`: i test frontend danno 623 rossi finti, e `npm install` salta meta' degli strumenti

**Contesto:** 9/9/2026, verifica dell'unione dei nove rami della release di settembre. Serviva far girare le due suite di test su un checkout senza `node_modules`.

**Due errori distinti, stessa causa.** La variabile d'ambiente `NODE_ENV` vale `production` in questo contenitore, e nessuno dei due sintomi la nomina:

1. **`npm install` installa solo 449 pacchetti e `node_modules/.bin` esce senza `tsx`, `vitest`, `eslint`, `stylelint`.** Con `NODE_ENV=production` npm applica `omit=dev`, quindi le **devDependencies non vengono installate** — cioe' esattamente tutti gli strumenti di verifica. L'uscita e' `exit 0`: nessun errore, solo attrezzi mancanti. Il sintomo che si vede dopo e' `sh: 1: prisma: not found` oppure ogni singolo file di test che fallisce con un laconico `'test failed'`.
2. **`npm run test:frontend` da 623 fallimenti su 980, con `TypeError: React.act is not a function`.** In React 19 `act` e' esportato **solo dal build di sviluppo**. Con `NODE_ENV=production` Vite risolve `react.production.js`, dove `act` non esiste, e **ogni test che monta un componente muore** — comprese aree che non c'entrano niente con il lavoro in corso. Sembra che il ramo abbia distrutto il frontend: e' invece un artefatto dell'ambiente.

**Modo corretto:**
- Installare con `NODE_ENV=development npm install --include=dev`. Controllo che vale piu' del conteggio dei pacchetti: `ls node_modules/.bin | grep -E "^(tsx|vitest|eslint|stylelint)$"` deve tornare **quattro righe**.
- Lanciare le suite con `NODE_ENV=test npm run test:frontend` (e lo stesso per `test:integration`).
- **Il campanello d'allarme generale:** quando falliscono *quasi tutti* i test, comprese cartelle che il lavoro non ha mai toccato, la causa e' l'ambiente, non il codice. La conferma costa dieci secondi — `git diff --name-only origin/main...HEAD | grep <cartella-che-fallisce>`: se non compare, quel file e' identico a `main` e non puo' essere stato rotto dal lavoro in corso. E' lo stesso ragionamento della nota #37 sui rossi da timeout, applicato a una causa diversa.

**Da non confondere con i rossi VERI di questo contenitore, che restano rossi anche facendo tutto giusto:** manca il file `.env` (escluso dal repository), quindi `test:integration` cade 9 volte su 12 con `ENOENT ... /.env` e tre prove di `team-invite` cadono con *«public base URL is not configured»*. Quelle non si aggiustano da qui: il `.env` lo mette Jacopo o Claudio sulla macchina.

## 86. Il titolo di un commit descrive un'intenzione, non un'azione: cosi' un segreto trapelato e' sembrato chiuso per sette mesi

**Contesto:** commit `8a30469`, 19/2/2026, titolo «Rimuovi .env dalla cronologia». La password del superuser PostgreSQL era finita nel commit `569d192` del 10/2/2026 dentro il file `.env`.

**Errore:** il titolo dice che la cronologia e' stata ripulita. Non lo e': `8a30469` e' una cancellazione normale del file (`.env | 3 ---`, un solo file cambiato), non una riscrittura della storia. Il blob resta raggiungibile con `git show 569d192:.env`, ed e' antenato di `origin/main` (`git merge-base --is-ancestor 569d192 origin/main` risponde vero). Chiunque legga quella riga di log conclude che il problema e' stato chiuso a febbraio — ed e' esattamente per questo che nessuno se n'e' accorto per sette mesi, fino al rilievo del Guardiano in CRMA-67 il 10/9/2026.

**Modo corretto:**
- Togliere davvero un file dalla storia e' `git filter-repo` (o equivalente) **piu' un force-push**, non un semplice `git rm` + commit. Un commit che si limita a cancellare il file in punta lascia il blob in ogni versione precedente e in ogni clone gia' fatto.
- Un messaggio di commit descrive **cosa il commit fa**, non cosa si voleva ottenere: «Rimuovi .env dalla cronologia» avrebbe dovuto essere «Rimuovi .env (la cronologia resta invariata)», o non essere scritto affatto in quei termini.
- **Stato residuo, dichiarato invece di lasciato implicito:** su decisione di Jacopo del 10/9/2026 la storia **non** viene riscritta (una cinquantina di rami aperti a quella data, e ogni clone da rifare, erano un prezzo sproporzionato per un segreto di sviluppo) — quindi quella password resta leggibile nella storia di `origin/main` a tempo indefinito. L'unica difesa reale e' che non sia piu' valida: rotazione della password ancora da fare al 10/9/2026 — data da aggiungere qui quando avviene.

## 87. La descrizione di un compito Paperclip si copia nel risveglio di ogni agente che lo tocca: un segreto scritto li' si propaga da solo

**Contesto:** 10/9/2026, apertura di CRMA-67 (il compito che denuncia la password PostgreSQL trapelata, nota #86). Il Guardiano ha riportato la password **in chiaro** nella descrizione del compito, per documentare il rilievo.

**Errore:** la descrizione di un'issue Paperclip non e' un documento passivo: viene iniettata nel risveglio di ogni agente che lavora su quel compito o sui suoi figli. Un compito che denuncia un segreto trapelato lo aveva cosi' ripropagato su un secondo sistema — misurato il 10/9/2026 sulla VPS: **15 file e 5 agenti distinti** avevano gia' il valore in chiaro nei propri trascritti di sessione e log di run, prima ancora che qualcuno se ne accorgesse.

**Modo corretto:**
- In un compito di sicurezza il segreto si **maschera subito**, non dopo: si scrive solo cio' che lo identifica — quale credenziale, in che commit, in che file, il comando per verificarlo (`git show <commit>:<file>`) — mai il valore.
- Chi ha davvero bisogno del valore lo legge dalla fonte (il blob nella storia, il gestore segreti), non dalla bacheca.
- I trascritti gia' scritti non si possono richiamare: e' una delle ragioni per cui, una volta successo, la rotazione della credenziale conviene comunque, indipendentemente dal fatto che il resto del rilievo sia gia' stato mascherato. (Descrizione e documento di CRMA-67 sono stati mascherati il 10/9/2026.)

## 88. `node -e "…"` fra virgolette doppie: la shell mangia tutto cio' che sta fra apici rovesci, PRIMA che node lo veda, e non lo dice

**Contesto:** 10/9/2026, apertura di CRMA-86: il testo passato all'API era un markdown con riferimenti tecnici fra backtick (`` `8a30469` ``, `` `.env` ``, `` `git filter-repo` ``), costruito con `node -e "..."` a virgolette doppie invece che con un file intermedio.

**Errore:** quando il comando e' `node -e "testo con \`qualcosa\` dentro"`, la shell (bash) esegue **prima** tutto cio' che sta fra i backtick, come farebbe con qualsiasi altra sostituzione di comando, e solo il suo output — spesso vuoto o un errore silenzioso — arriva a node. Non e' un problema di virgolette che si chiudono in anticipo (quello darebbe un errore di sintassi evidente): qui la POST **riesce**, risponde `ok`, e il corpo arriva all'API con quei pezzi cancellati. Il guasto non si vede finche' qualcuno non rilegge il contenuto pubblicato. E' la variante di scrittura del problema descritto per la lettura alla nota #61: la' mancava lo strumento (`python3`), qui lo strumento c'e' ma lo si invoca nel modo che lo rompe.

**Modo corretto:**
- Il testo con backtick non passa mai per la riga di comando dentro un `node -e "..."` a doppi apici. Si scrive prima il markdown con lo strumento di scrittura file (nessuna interpretazione di shell), poi lo si legge da un file: `node -e '...'` ad **apici singoli** (la shell non fa sostituzioni dentro apici singoli) leggendo il percorso da `process.argv`, oppure uno script `.mjs` vero e proprio.
- Controllo che non costa nulla: prima di spedire, contare i backtick nel file JSON gia' costruito — se il numero non torna, qualcosa e' stato eseguito invece che copiato.
- **Una risposta `ok` non prova che il contenuto sia integro**: dopo una POST con testo tecnico (nomi di file, hash di commit, comandi), rileggerla dall'API e confrontarla con l'originale, non fidarsi del solo codice di stato.
