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
- **Molti pattern "sospetti" nei JSX sono gia' neutralizzati da `globals.css`.** Prima di riscrivere a tappeto i componenti, verificare cosa fa gia' il sistema globale: `.badge.bg-light`/`.text-bg-light` sono rimappati a `var(--muted)`+`var(--foreground)`; `[data-bs-theme="dark"] .bg-white` -> `var(--card)`; `--bs-light` e `.btn-light` sono tematizzati. Quindi `Badge bg="light"`, `div bg-white`, `Button variant="light"` **funzionano gia' in scuro** e NON vanno toccati. Restano scoperti (da sistemare) i casi non nella lista di globals, es. `Alert variant="light"` (`.alert-light` non e' tematizzato).

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
