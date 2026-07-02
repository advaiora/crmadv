# Linguaggio di design Apple-style per il nostro CRM web

> **Cos'è questo documento.** È la **bussola di design** del progetto: i principi e le regole concrete per dare al CRM un aspetto "Apple-style a sottrazione" restando un'**applicazione web gestionale** (non un sito marketing, non un'app nativa iOS/macOS).
>
> **Perché esiste.** Va usato come riferimento in **ogni** sessione, anche quando chi lavora non ha memoria delle discussioni precedenti. Se una scelta di design non è chiara, la risposta si cerca qui. La roadmap (`03-roadmap-confronto-e-build.md`) chiede esplicitamente un "design system Apple-style: token, tipografia, spacing, motion": questo è quel tassello.
>
> **Rapporto con gli altri documenti.** I **token colore** e la regola d'oro chiaro/scuro stanno in `design-system-temi.md`; i **valori tecnici** (variabili CSS) stanno in `src/styles/design-tokens.css` e `src/styles/scss/globals.css`. Questo documento dà il **perché** e il **come comporre**; quelli danno il **cosa** (i valori). Vanno letti insieme.

---

## 0. Come leggere e usare questo documento

- Ogni capitolo ha **principi** (il ragionamento) e **regole pratiche "Fai / Non fare"** (l'azione).
- I **valori numerici** sono agganciati ai nostri token quando esistono. Se un valore non ha ancora un token, il documento lo segnala.
- **Provenienza dei valori** (importante per non prendere lucciole per lanterne):
  - 🍏 **HIG / ufficiale Apple** — principi e specifiche dalle Human Interface Guidelines (app native). *Massima autorità concettuale.*
  - 🌐 **apple.com (marketing)** — valori osservati/ricavati dal sito Apple. Utili per la **polizia tipografica e lo spazio**, ma è un sito vetrina: non copiarne la densità in un gestionale.
  - 🛠️ **Best practice web** — regole consolidate di web design/usabilità (Refactoring UI, Nielsen Norman Group, pratica dark mode). *Servono a tradurre Apple sul web.*
- **La sintesi di tutto è una parola: sottrazione.** Nel dubbio, togli. Ma "togliere" non è "svuotare" (vedi §9 anti-pattern).

---

## 1. Principi di fondo — Clarity, Deference, Depth

🍏 Apple riassume tutto il suo design in tre pilastri. Sono astratti: qui li traduciamo in pratica per il nostro CRM.

### 1.1 Clarity (chiarezza)
Il testo è leggibile a ogni dimensione, le icone sono precise, gli ornamenti ridotti al minimo. **Il contenuto e la funzione si capiscono a colpo d'occhio.**

- **Fai:** gerarchia tipografica netta (un titolo è chiaramente un titolo); icone lineari coerenti; contrasto sufficiente sempre.
- **Non fare:** decorazioni gratuite, gradienti, bordi doppi, ombre pesanti "per fare design".

### 1.2 Deference (l'interfaccia serve il contenuto)
L'interfaccia **non compete mai** con il contenuto: sta sullo sfondo, i dati dell'utente stanno in primo piano. È il cuore della "sottrazione".

- **Fai:** superfici neutre, cromo (chrome) discreto, spazio bianco che fa respirare i dati.
- **Non fare:** barre colorate, riquadri ovunque, elementi UI che "gridano" più dei dati che contengono.

### 1.3 Depth (profondità)
Livelli visivi e movimento realistico comunicano **gerarchia** (cosa sta sopra, cosa sta sotto, dove porta un'azione).

- **Fai:** usa elevazione **sobria** (superficie leggermente più chiara + ombra tenue) per distinguere ciò che "galleggia" (menu, modali, popover); transizioni che spiegano da dove viene e dove va un elemento.
- **Non fare:** profondità finta e ridondante; ombre marcate su tutto (se tutto è elevato, niente lo è).

> **Regola guida del progetto:** ogni volta che aggiungi un elemento, chiediti *"serve al contenuto o compete con esso?"*. Se compete, va tolto o attenuato.

---

## 2. Tipografia

La tipografia è **la leva che cambia di più** la percezione "Apple", a costo bassissimo. Apple si affida a gerarchia di **dimensione + peso + colore**, non a decorazioni.

### 2.1 Il font: San Francisco e la licenza (nota tecnica importante)
- 🍏 Apple usa **San Francisco (SF Pro)**: `SF Pro Display` per testo ≥ ~20px, `SF Pro Text` sotto. Ha tracking dinamico (stretto sui titoli grandi, largo sui testi piccoli).
- ⚠️ **Licenza:** SF Pro è concesso **solo** per app sulle piattaforme Apple. **Incorporarlo come web font su un sito viola la licenza.**
- 🛠️ **Cosa facciamo noi (già corretto nel progetto):** usare lo **stack di sistema**, che su Mac rende *proprio* SF e su Windows Segoe UI. Il nostro token è già così:
  ```
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif;
  ```
  **Fai:** usa sempre `var(--font-sans)`. **Non fare:** non caricare SF Pro come `@font-face`.

### 2.2 La scala di riferimento Apple
🍏 **Scala tipografica iOS** (dimensioni in pt = px a densità 1; queste sono *ufficiali*):

| Stile | Size | Tracking | Line-height |
|---|---|---|---|
| Large Title | 34 | +0.37 | 41 |
| Title 1 | 28 | +0.36 | 34 |
| Title 2 | 22 | +0.35 | 28 |
| Title 3 | 20 | +0.38 | 24 |
| Headline | 17 (semibold) | −0.41 | 22 |
| Body | 17 | −0.41 | 22 |
| Callout | 16 | −0.32 | 21 |
| Subheadline | 15 | −0.24 | 20 |
| Footnote | 13 | −0.08 | 18 |
| Caption 1 | 12 | 0 | 16 |
| Caption 2 | 11 | +0.07 | 13 |

🌐 Sul **sito marketing** Apple va più estremo: hero 56px, display 40/34px, corpo 17px con interlinea ~1.47, e una **scala di pesi 300 / 400 / 600 / 700 (il 500 è assente)**.

**Da ricordare:** il corpo iOS è **17px** perché pensato per il *touch a distanza di braccio*. Un **gestionale desktop** può stare su **15–16px** di corpo senza risultare piccolo (più densità = più dati visibili). La nostra base `--text-base: 15px` va bene.

### 2.3 La nostra scala (mapping ai token del progetto)
I token in `design-tokens.css` sono già coerenti con Apple. Uso consigliato:

| Ruolo | Token | Valore | Peso | Note |
|---|---|---|---|---|
| Titolo pagina (H1) | `--text-2xl`/`--text-3xl` | 28 / 36px | 600–700 | tracking stretto (`--tracking-heading` −0.021em), interlinea `--leading-tight` 1.2 |
| Titolo sezione (H2) | `--text-xl` | 22px | 600 | |
| Titolo card/widget (H3) | `--text-lg`/`--text-md` | 18 / 16px | 600 | |
| Corpo | `--text-base`/`--text-md` | 15 / 16px | 400 | interlinea `--leading-normal` 1.5 |
| Secondario / didascalia | `--text-sm` | 13px | 400 | colore `--muted-foreground` |
| Etichetta / micro | `--text-xs` | 12px | 500–600 | eventuale maiuscoletto + tracking largo per header di sezione |

### 2.4 Regole tipografiche
- **Fai:** titoli **grandi, in peso semibold/bold, con tracking stretto** (è il "sapore" Apple). Gerarchia con **peso e colore**, non solo dimensione (🛠️ Refactoring UI).
- **Fai:** massimo **2 pesi** per blocco (es. 400 per il corpo, 600 per l'enfasi).
- **Non fare:** pesi sotto 400 (leggibilità); testo lungo a piena larghezza (tieni le righe leggibili, ~60–75 caratteri).
- **Non fare:** troppe dimensioni diverse nella stessa vista; MAIUSCOLO su frasi lunghe (solo etichette brevi).

---

## 3. Spaziatura, griglia e densità

### 3.1 Il sistema di spaziatura
- 🌐/🛠️ Convenzione **8 punti** con sotto-passi da 4 (l'HIG non "marchia" ufficialmente la griglia 8pt, ma è il modello con cui si legge tutta la UI Apple). Scala osservata su apple.com: **4 / 8 / 12 / 17 / 24 / 32 / 48 / 80**.
- I nostri token (`--space-1..8`: 4/8/12/16/24/32/48) seguono già questo passo. **Fai:** usa questi step, non valori a caso.
- 🍏 **Touch target minimo 44×44px** per qualsiasi controllo interattivo (vale anche su web per accessibilità/mobile).

### 3.2 La tensione vera: "aria" Apple vs densità gestionale
Questo è il punto più delicato per **noi**. 🌐 Apple sul sito è a **densità bassissima** (ogni tessera occupa quasi una schermata, ≥64px d'aria sopra i titoli). 🛠️ Ma **gli utenti di un gestionale sono power user che vogliono i dati, non lo spazio vuoto**: copiare la densità di apple.com in un CRM è un errore (vedi §9).

**La sintesi operativa per il progetto:**
- **Aria dove aiuta la lettura**: margini generosi attorno ai **titoli di pagina e di sezione**, respiro **tra** i blocchi/sezioni.
- **Densità dove servono i dati**: dentro tabelle, liste, KPI la spaziatura resta compatta e regolare (il valore è vedere molti dati con ordine, non lasciarli soli in mezzo al vuoto).
- **Sottrazione ≠ sottrazione di dati.** Si tolgono **decorazioni e contenitori**, non informazioni. Per gestire la mole: **divulgazione progressiva** (riepilogo/segnale in dashboard → click per il dettaglio/drill-down), non tutto sulla stessa vista.

### 3.3 Regole di layout
- **Fai:** larghezza massima del contenuto (~1200–1440px) e contenuto centrato; ritmo verticale coerente tra le sezioni.
- **Fai:** separa i gruppi con **spazio** prima che con linee.
- **Non fare:** riempire ogni pixel; ma nemmeno lasciare enormi vuoti senza gerarchia.

---

## 4. Colore e accento

### 4.1 Filosofia
🍏🛠️ **Neutrali per l'interfaccia + UN accento usato con disciplina.** Apple raggiunge "systemBlue" come unico accento primario; il colore ha **significato** (azione, stato), non è decorazione.

- **Fai:** superfici e testo in **grigi/neutri**; l'accento **solo** sull'azione primaria di una vista, sui link/elementi attivi, e come tinta tenue per selezione/hover.
- **Non fare:** accento spalmato su troppi elementi (se tutto è "primario", niente lo è); più colori vivaci in competizione.

### 4.2 Testo e gerarchia col colore
🛠️ (Refactoring UI): tre livelli di testo, mai nero puro:
- **primario**: scuro ma **non `#000`** (Apple usa `#1d1d1f`) → nostro `--foreground`;
- **secondario**: grigio medio → `--muted-foreground`;
- **terziario/ausiliario**: grigio più chiaro.
- **Su sfondo colorato:** non mettere grigio; **riduci l'opacità del bianco** o scegli una tinta derivata dallo sfondo. (Nostri esempi: `color-mix` / bianco a opacità.)

### 4.3 Accento personalizzabile (specifico del nostro progetto)
Il nostro accento è **per-workspace** (token `--primary` / `--brand-accent`, sovrascritti a runtime da `workspaceBranding.ts`). Quindi:
- **Fai:** usa **sempre** il token accento (`var(--primary)`, `bg-primary/10`, ecc.), così ogni workspace vede il suo colore.
- **Non fare:** blu scritto a mano — l'accento potrebbe essere verde, viola, ecc. per un cliente.

### 4.4 Colori di stato
Successo/info/avviso/errore hanno token dedicati (`--success/--info/--warning/--danger` + varianti soft). **Fai:** usali solo per il loro significato semantico. **Non fare:** rosso per un'azione distruttiva *secondaria* (🛠️ il rosso pieno si riserva all'azione distruttiva **primaria**).

---

## 5. Chiaro / scuro (dark mode)

🍏 Regole ufficiali Apple + 🛠️ best practice, entrambe **già in gran parte rispettate** dal nostro sistema a token.

- **Non invertire.** Il tema scuro **non** è il chiaro con i colori ribaltati: è una **palette separata** (già così nei nostri blocchi `[data-bs-theme="dark"]`).
- **Base vs elevated.** 🍏 In scuro la profondità si crea con **superfici più chiare = più in alto**: sfondo base più scuro, superfici elevate (card, modali) più chiare. I nostri token lo fanno già: `surface-1` 10/10/11 (base) → `surface-2` 17 → `surface-3` 32 (elevata).
- **Niente nero puro.** 🛠️ Evita `#000`: usa un carboncino (il nostro base è `10 10 11`, non nero). Motivo: sul nero puro **non si vedono ombre né elevazione** e si creano aloni su OLED.
- **Le ombre contano meno in scuro:** affidati alla **luminosità della superficie** per l'elevazione (nostri `--shadow-*` hanno comunque una variante scura più marcata in `design-tokens.css`).
- **Desatura gli accenti.** 🛠️ Colori troppo saturi "vibrano" sul fondo scuro: in scuro l'accento va leggermente smorzato (es. il nostro branding-primary scuro `96 165 250` è un blu più tenue del chiaro).
- **Contrasto.** 🛠️ Minimo **WCAG AA 4.5:1** per il testo normale; 🍏 Apple **consiglia di puntare a 7:1** per il testo piccolo con colori custom. Testo quasi-bianco leggermente smorzato è più riposante del bianco puro.

**Regola d'oro operativa (da `design-system-temi.md`):** usa **sempre** i token `var(--…)`, mai colori a mano. Così chiaro e scuro funzionano da soli.

---

## 6. Bordi, ombre, materiali

### 6.1 Bordi vs ombre vs sfondo
🛠️ Per separare due elementi, **non partire dal bordo**. In ordine di preferenza:
1. **Spazio** tra i gruppi;
2. **Sfondo leggermente diverso** tra elementi adiacenti;
3. **Ombra tenue** (fa da bordo, più delicata);
4. **Bordo hairline** solo se serve davvero.

- **Fai:** bordi **hairline** a bassa opacità (Apple usa 1px `rgba(0,0,0,0.08)`; noi: `color-mix(... var(--border) …)` o `--border-subtle` con alpha).
- **Non fare:** bordi pieni e scuri ovunque → "sporcano" e affaticano.

### 6.2 Ombre
🛠️ Ombre **morbide, ampie, a bassa opacità, con offset verticale** (simula luce dall'alto). I nostri token sono già così:
- `--shadow-xs` / `--shadow-sm` — riposo (card, bottone primario);
- `--shadow-md` — hover / elevazione lieve;
- `--shadow-lg` — elementi che "galleggiano" (dropdown, modali, popover).
- **Fai:** l'ombra è parte della **gerarchia** — più un elemento è "in alto", più marcata (ma con parsimonia).
- **Non fare:** ombre dure/nere, o la stessa ombra forte su tutto.

### 6.3 Raggi (angoli)
Apple usa angoli morbidi e coerenti. Nostri token: `--radius-sm` 8 · `--radius-md` 12 · `--radius-lg` 16 · `--radius-xl` 20 · `--radius-pill`.
- **Fai:** raggio proporzionato all'elemento — controlli piccoli `sm`, card `md`, modali/sheet `lg`, avatar/chip tondi `pill`.
- **Non fare:** raggi a caso scritti a mano.

### 6.4 Materiali / translucenza (vibrancy)
🍏 Apple ama il **vetro smerigliato** (sfondo translucido + blur); dal 2025 c'è "Liquid Glass" (glassmorphism a livello OS). Sul web si ottiene con `backdrop-filter: saturate(180%) blur(...)`.
- **Fai:** usalo **con parsimonia** e solo su **superfici che stanno sopra il contenuto e restano fisse** mentre si scrolla: **topnav** (già fatto), bottom-nav mobile (già fatto), eventualmente sidebar/menu overlay.
- **Non fare:** blur su superfici di contenuto statiche (è finto e costa in performance); esagerare con la trasparenza (il testo deve restare leggibile → tieni opacità alta, ~0.8+).

---

## 7. Controlli e componenti

### 7.1 Bottoni — gerarchia per importanza, non per colore
🍏 Apple ha stili **Filled / Tinted / Gray / Plain**. 🛠️ Regola: lo stile segue **l'importanza**, non solo la semantica.
- **Primario (Filled):** riempito con l'accento, **uno solo** per vista. Nostro `.btn-primary` (accento + `--shadow-xs`, hover con ombra un filo più marcata).
- **Secondario (Tinted/Gray):** accento a bassa opacità **oppure** neutro tenue — **non** un outline grigio spento se puoi evitarlo.
- **Terziario (Plain/link):** senza sfondo, come un link.
- **Fai:** raggio da token, micro-transizione, `:active` con leggero abbassamento/scala (🌐 Apple usa `scale(0.95)` alla pressione).
- **Non fare:** due bottoni "pieni" affiancati che competono; rosso su distruttivo non-primario.

### 7.2 Campi (input)
- **Fai:** altezza comoda (≥44px su touch), raggio `sm`, bordo hairline, **focus ring morbido** con l'accento (nostro `--focus-ring-shadow`), placeholder in `--muted-foreground`.
- **Non fare:** bordi spessi; focus ring duro/aggressivo.

### 7.3 Segmented control, toggle, liste raggruppate — quali reggono sul web
- **Segmented control** 🍏 (scelte brevi, mutuamente esclusive, ≤5): **funziona bene sul web** per filtri/viste. Usalo al posto di gruppi di radio quando le opzioni sono poche.
- **Toggle (switch)** 🍏: ottimo per on/off immediato. Sul web va bene, **ma** l'aspetto iOS "pillola" va reso con misura, non pixel-perfect nativo.
- **Liste raggruppate iOS** (righe con separatori hairline, header di sezione in maiuscoletto tenue): **traducibili** e molto "Apple" per impostazioni/dettagli. Le abbiamo già accennate (header di sezione dashboard).
- ⚠️ **Attenzione (vedi §10):** non trapiantare i controlli **pixel-per-pixel** dal nativo — sul web fanno effetto "finto iOS". Prendi il **principio** (chiarezza, stati evidenti), non lo skin.

### 7.4 Icone
🛠️ Icone lineari coerenti (usiamo **Lucide**), tratto sottile. **Non ingrandire** un'icona piccola 3–4× (diventa sgranata): mettila in un **cerchio/quadrato tinted** (es. `bg-primary/10`) se serve presenza. **Touch target 44px** anche se l'icona è piccola.

---

## 8. Motion (animazioni)

🍏 Principi Apple: il movimento è **finalizzato** (spiega qualcosa), **realistico** e **credibile**, mai gratuito.

- **Curve/durata:** transizioni brevi con **ease-out** (entra deciso, si posa dolce). Nostri token: `--ease-out` `cubic-bezier(.16,1,.3,1)`, durate `--duration-fast` 150ms / `--duration-base` 250ms / `--duration-slow` 400ms.
- **Fai:** micro-interazioni su hover/press (colore, ombra, lieve scala/lift); transizioni di apertura/chiusura che collegano lo stato prima/dopo. Tieni le UI-interaction **veloci** (150–250ms).
- **Non fare:** animazioni lunghe/appariscenti su ogni cosa; movimento come **unico** modo di comunicare (dev'essere ridondante rispetto a testo/colore).
- **Accessibilità (obbligatorio):** rispetta **`prefers-reduced-motion`** — quando l'utente riduce le animazioni, minimizzale o eliminale. 🍏 È una regola Apple esplicita.

---

## 9. Anti-pattern — gli errori di chi "fa l'Apple" sul web

🛠️ Da evitare assolutamente:
1. **Troppo vuoto senza gerarchia.** Spazio bianco a caso ≠ eleganza: se manca la guida visiva, l'interfaccia sembra "vuota e senza direzione". → *Aria sì, ma con gerarchia.*
2. **"Pulito = poco contrasto" (falso).** Testo grigio chiaro su bianco **non è minimalismo, è rotto**. Mantieni sempre il contrasto AA.
3. **Rimuovere l'"odore di informazione".** Togliere troppo fa perdere all'utente gli indizi su cosa fare dopo. → *Togli decorazioni, non i segnali.*
4. **Copiare la densità di apple.com.** Apple.com è una **vetrina** per un brand notissimo: bassa densità, immagini enormi. Un **gestionale** ha bisogno di dati densi e ordinati. Prendi la **cura tipografica e la sottrazione**, non il "una schermata per informazione".
5. **Skeuomorfismo / controlli nativi fuori contesto.** Toggle iOS pixel-perfect, "vetro" ovunque, ombre finte: sul web sanno di imitazione. Prendi il principio, non lo skin.
6. **Densità di contenuto sacrificata all'estetica.** Se per "sembrare Apple" l'utente vede meno dati e deve scrollare di più a parità di lavoro, hai peggiorato il prodotto.

---

## 10. Cosa NON portare dal mondo nativo al web

- **Il font SF Pro come web font** → licenza. Usa lo stack di sistema (§2.1).
- **I controlli iOS pixel-per-pixel** (switch, segmented, picker "a rullo") → prendine il comportamento, non l'aspetto nativo.
- **Le gesture native** (swipe-to-delete come *unico* modo) → sul web servono affordance visibili (bottoni/menu), la gesture è un extra.
- **Liquid Glass / vibrancy spinta ovunque** → sul web pesa e sembra finta; solo su barre fisse sopra il contenuto, con misura.
- **La densità da vetrina** di apple.com → vedi §9.4.
- **Le dimensioni touch come default desktop** (17px corpo, target 44px ovunque) → su desktop il corpo può stare 15–16px; il 44px resta il **minimo** per il touch/mobile, non la regola per il mouse.

---

## 11. Checklist operativa (da rivedere per ogni pagina/componente)

**Tipografia**
- [ ] Titolo pagina grande, semibold/bold, tracking stretto?
- [ ] Massimo 2 pesi per blocco, nessun peso < 400?
- [ ] Gerarchia con peso/colore, non solo con la dimensione?

**Colore**
- [ ] Interfaccia neutra + **un solo** accento per vista?
- [ ] Accento **sempre** da token (`var(--primary)`), mai a mano?
- [ ] Colori di stato usati solo per il loro significato?

**Spazio e layout**
- [ ] Spaziatura sui passi 4/8 (token `--space-*`)?
- [ ] Aria attorno a titoli/sezioni, densità mantenuta dentro tabelle/liste?
- [ ] Ho tolto decorazioni **senza** togliere dati/segnali?

**Superfici**
- [ ] Separazione con spazio/sfondo prima che con bordi?
- [ ] Bordi hairline tenui, ombre morbide da token (`--shadow-*`)?
- [ ] Raggi da token (`--radius-*`) proporzionati all'elemento?

**Chiaro/scuro**
- [ ] Solo token `var(--…)`, nessun colore a mano (passa `lint:css` e `lint:colors`)?
- [ ] In scuro: elevazione via superficie più chiara, niente nero puro, accento desaturato?
- [ ] Contrasto ≥ 4.5:1 (testo normale)?

**Controlli e motion**
- [ ] Bottone primario unico; secondari tinted/neutri; touch target ≥ 44px?
- [ ] Focus ring morbido e visibile (accessibilità)?
- [ ] Transizioni brevi ease-out da token; `prefers-reduced-motion` rispettato?

---

## Appendice A — Mappa rapida principi → nostri token

| Serve | Token / classe |
|---|---|
| Font di sistema | `--font-sans` |
| Scala testo | `--text-xs … --text-3xl` |
| Pesi | `--weight-regular/medium/semibold/bold` (400/500/600/700) |
| Tracking | `--tracking-body` (−0.01em), `--tracking-heading` (−0.021em) |
| Spaziatura | `--space-1 … --space-8` (4→48px) |
| Raggi | `--radius-sm/md/lg/xl/pill` |
| Ombre | `--shadow-xs/sm/md/lg` (+ variante scura) |
| Motion | `--ease-out`, `--ease-in-out`, `--duration-fast/base/slow` |
| Superfici | `--background`, `--card`, `--muted`, `--surface-1/2/3` |
| Testo | `--foreground`, `--muted-foreground` |
| Bordi | `--border`, `--border-subtle`, `--input` |
| Accento (per-workspace) | `--primary` / `--brand-accent*` |
| Stati | `--success/--info/--warning/--danger` (+ soft) |
| Focus | `--ring`, `--focus-ring-shadow` |

## Appendice B — Fonti

**Apple (ufficiali / mirror):**
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines) · [Color](https://developer.apple.com/design/human-interface-guidelines/color) · [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) · [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) · [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) · [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) · [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles) · [Fonts / SF Pro](https://developer.apple.com/fonts/)
- [San Francisco typeface — Wikipedia](https://en.wikipedia.org/wiki/San_Francisco_(sans-serif_typeface)) · [iOS Design Guidelines — Ivo Mynttinen](https://ivomynttinen.com/blog/ios-design-guidelines) · [Apple design-system analysis (valori apple.com)](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/apple/DESIGN.md) · [How Apple Designs Their UI — Superdesign](https://www.superdesign.dev/blog/apple-design-system)

**Web design / usabilità:**
- [Refactoring UI — 7 Practical Tips](https://medium.com/refactoring-ui/7-practical-tips-for-cheating-at-design-40c736799886) · [Refactoring UI](https://refactoringui.com/)
- [Shadows in UI design — LogRocket](https://blog.logrocket.com/ux-design/shadows-ui-design-tips-best-practices/) · [Elevation design patterns](https://designsystems.surf/articles/depth-with-purpose-how-elevation-adds-realism-and-hierarchy)
- [Dark mode best practices — Atmos](https://atmos.style/blog/dark-mode-ui-best-practices) · [Dark mode principles — Uxcel](https://uxcel.com/blog/12-principles-of-dark-mode-design-627)
- [Why your website shouldn't look like Apple's — TinyFrog](https://tinyfrog.com/the-problem-with-apples-website/) · [The dark side of minimalism](https://medium.com/@shrutitddinesh/the-dark-side-of-minimalism-when-clean-ui-becomes-confusing-d27ce1b0894d)

> **Nota di affidabilità.** I valori marcati 🌐 (px di apple.com, scala pesi 300–700, raggi 5/8/11/18) sono **osservati dal sito marketing**, non specifiche HIG ufficiali: usali come *ispirazione tipografica/di spazio*, non come legge. I valori 🍏 (principi, scala tipografica iOS, 44px, base/elevated, semantic color) sono i più autorevoli. I valori 🛠️ sono best practice web consolidate e trasversali a più fonti.
