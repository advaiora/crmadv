# Design system — colori e temi (chiaro/scuro)

> Come colorare qualsiasi pagina/componente in modo che chiaro e scuro funzionino **da soli**, senza doverci tornare sopra dopo.

## Regola d'oro

**Mai scrivere un colore "a mano" (`#hex`, `rgb(255,…)`, `rgba(…)`, `hsl(…)`) per elementi di interfaccia.**
Si usano **sempre i token** (`var(--nome-token)`) o i componenti Bootstrap standard. I token cambiano da soli tra chiaro e scuro, quindi il componente si adatta senza altro lavoro.

Perché: il tema è un sistema unico globale definito una volta in `src/styles/scss/globals.css` (blocco `[data-bs-theme="light"]` e blocco `[data-bs-theme="dark"]`). Chi usa i token eredita entrambi i temi gratis. Chi scrive un colore fisso **scavalca** il sistema e crea i bug tipo "riquadro scuro anche in tema chiaro".

Vale anche per gli **stili inline in JSX** (`style={{ background: "..." }}`): stessa regola, usa `var(--token)`.

## Token da usare (i più comuni)

**Superfici / sfondi**
- `--background` — sfondo pagina
- `--card` — sfondo di card, modali, dropdown, popover
- `--muted` — superficie tenue (zone secondarie)
- `--surface-2`, `--surface-3`, `--surface-elevated` — superfici a livelli (per opacità: `rgb(var(--surface-3) / 0.6)`)

**Testo**
- `--foreground` — testo principale
- `--muted-foreground` — testo secondario / didascalie
- `--primary-foreground`, `--secondary-foreground`, `--accent-foreground` — testo sopra superfici colorate

**Bordi**
- `--border` — bordo standard
- `--input` — bordo dei campi form
- `--border-subtle` — bordo tenue (triplet, usare `rgb(var(--border-subtle) / 0.5)`)

**Accento / brand** (personalizzabile per workspace, default blu `#0d6efd`)
- `--primary` / `--primary-foreground` — colore d'azione (bottoni primari, link attivi)
- `--accent` / `--accent-foreground` — sfondo tenue dell'accento (hover, selezione)
- `--brand-accent`, `--brand-accent-hover`, `--brand-accent-active`, `--brand-accent-soft` (+ `-foreground`)
- `--ring`, `--focus-ring-shadow` — anello/alone di focus

**Stati** (successo/info/avviso/errore)
- `--success` / `--success-soft`, `--info` / `--info-soft`, `--warning` / `--warning-soft`, `--danger` / `--danger-soft`
- versioni testo/soft per i temi già gestite in globals.css

**Righe / ombre**
- `--row-hover` — sfondo hover righe tabella (`rgb(var(--row-hover) / 0.7)`)
- `--shadow-color` — colore ombre (`rgb(var(--shadow-color) / 0.28)`)

> Ci sono anche le variabili `--bs-*` (Bootstrap) e `--hk-*` (template): sono **già mappate** sui token qui sopra. Usando le classi Bootstrap standard e i componenti `react-bootstrap` non serve toccarle.

## Pattern pratici

- **Componente nuovo:** usa classi Bootstrap standard (`.card`, `.btn-primary`, `.form-control`, `.table`, badge/alert…). Sono già ri-stilizzate sui token in globals.css → chiaro/scuro automatici.
- **CSS di modulo (es. `src/modules/**/…css`):** usa `var(--token)`. Vedi `src/modules/clients/ui/clients-ui.css` come esempio già fatto bene.
- **Serve opacità su una superficie/bordo:** usa la forma triplet, es. `background: rgb(var(--surface-2) / 0.9)`.
- **Ritocco specifico solo per lo scuro:** aggiungi un blocco `[data-bs-theme="dark"] .tuo-selettore { … }` (sempre con token). Serve di rado.
- **Logo/immagini che dipendono dallo sfondo:** scegli l'asset in base al tema (`const { theme } = useTheme();`), non dare per scontato uno sfondo fisso.

## Cosa NON è un token (colori "veri", restano fissi)

Gialli/colori decorativi non tematici (es. la palette `$yellow` del template, le bandiere dei paesi, un'illustrazione) restano letterali: non sono interfaccia. Se hai un dubbio se un colore è "di tema" o "decorativo", trattalo come di tema e usa un token.

## Controllo automatico

C'è uno stylelint che segnala i colori scritti a mano nei file CSS di modulo: `npm run lint:css`. Attenzione: **non** vede gli stili inline in JSX — lì la disciplina è manuale (vale la regola d'oro).
