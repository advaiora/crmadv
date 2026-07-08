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

## 5. Lint generale (`npm run lint`): serve la variabile d'ambiente + ha errori preesistenti

**Contesto:** dopo aver aggiunto/modificato file `.jsx`, per controllare la qualità del codice (variabili inutilizzate, regole React) serve il lint generale, non solo `lint:css`/`lint:colors` (che coprono **solo** `src/modules/**`).

**Errore:** lanciare `eslint` direttamente (`npx eslint …` o `./node_modules/.bin/eslint …`) fallisce con *"ESLint couldn't find an eslint.config.(js|mjs|cjs) file"*: il binario installato è ESLint 9 (default flat-config), ma il progetto usa ancora `.eslintrc.cjs` (formato legacy).

**Modo corretto:**
- Lanciare `npm run lint` (che usa lo script del progetto) **oppure**, per lintare solo alcuni file, anteporre la variabile: `ESLINT_USE_FLAT_CONFIG=false ./node_modules/.bin/eslint --ext js,jsx <percorsi>`.
- **`npm run lint` NON è verde sul repo**: alcuni file preesistenti (es. `src/components/command-palette/CommandPalette.jsx`, `src/routes/RouteList.jsx`) violano già regole nuove del plugin react-hooks (`react-hooks/set-state-in-effect`, `react-refresh/only-export-components`). Sono **preesistenti** (verificabili lintando la versione `git show HEAD:…`), non vanno "sistemati" di straforo. Verificare quindi solo che **i propri file nuovi/modificati** siano puliti, lintandoli singolarmente.
- Regole react-hooks recenti utili da conoscere: non scrivere `ref.current = …` **durante il render** (`react-hooks/refs`) — farlo dentro un `useEffect`; ed evitare `setState` sincrono nel corpo di un `useEffect` quando possibile.

---

## 6. I file TypeScript (`.ts`) non si lintano con l'ESLint del progetto

**Contesto:** dopo aver aggiunto/modificato file `.ts` (es. in `src/lib/`), si vuole controllarne la qualità come si fa con i `.jsx`.

**Errore:** lanciare eslint su un `.ts` restituisce `Parsing error: Unexpected token type` sulla parola chiave `type`/sulle annotazioni. Sembra un errore nel proprio codice, ma **non lo è**: lo script `npm run lint` è `eslint . --ext js,jsx` e la config (`.eslintrc.cjs`) usa il **parser di default** (espree), **senza** parser TypeScript. Quindi i `.ts` non sono proprio previsti da ESLint.

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
- Per la verifica **funzionale** della logica server (nuovi endpoint, permessi, validazioni), testare l'API **direttamente via `curl`** su `http://localhost:4000`: `POST /auth/login` per ottenere il token, poi chiamare gli endpoint con `-H "Authorization: Bearer <token>"`. È più veloce e affidabile del browser. L'API in `tsx watch` **ricarica da sola** le modifiche ai file `server/**` (anche se il server l'ha avviato un'altra sessione, stessa cartella).
- L'anteprima frontend serve soprattutto a confermare che **compili e monti senza errori**: dopo `preview_start`, guardare `preview_logs`/`preview_console_logs` e la lista `preview_network` (i propri file nuovi devono comparire `200 OK`).
- Se serve **davvero** autenticarsi nel browser, settare i campi con il setter nativo + evento: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true}))`. Ma di norma non vale la pena: verifica il server via `curl`.
- Per **confermare che una pagina renderizzi** con i dati veri, usare `preview_eval` che legge il DOM (titoli `h3/h6`, righe `table tbody tr`, `.badge`) invece dello **screenshot**: su questa app (pagina pesante, molti chart) `preview_screenshot` va spesso in **timeout a 30s**, mentre l'ispezione DOM è istantanea e più precisa. Attenzione al **timing**: un server Vite appena avviato su porta random fa il pre-bundling (lento); dopo `location.href=...` dare ~3-4s prima di leggere il DOM, o l'area principale risulta ancora vuota.
