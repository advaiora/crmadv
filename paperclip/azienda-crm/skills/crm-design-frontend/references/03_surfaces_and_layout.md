# KNOWLEDGE DOCUMENT — [F03]
# Surfaces, separation and layout
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F03:USAGE_NOTE]

Read this when you are about to build or change a **block**: a card, a panel, a KPI tile, a widget, a
page layout. It is the part of the craft where a hand-rolled solution looks *almost* right — which is
worse than looking wrong, because nobody reports it and it spreads by imitation.

The values it draws on are in → [F02:SCALES] and → [F02:PALETTE]. The reasoning behind the choices is
in → [F01:AIR_VS_DENSITY]. Dense lists have their own recipe: → [F04:DENSE_LIST_RECIPE].
Traceability: → [F03:SOURCE_NOTES].

---

## PART 1 — TWO KINDS OF BLOCK, AND THEY ARE NOT INTERCHANGEABLE  [F03:SURFACES]

`[CODE]` This codebase contains **two families of block**, and they carry different classes:

| Family | Where | Class in the DOM |
|---|---|---|
| **Legacy Bootstrap / Jampack** | Pages not yet redone | `.card` |
| **React primitives** — `src/components/ui/card.jsx` | Pages already redone (Dashboard, Impostazioni, Checklist) | `div.glass-edge` (Tailwind: `rounded-xl border-0 bg-card text-text`) — **without** `.card` |

⚠️ **The mistake this has already caused.** A CSS override written as `.dashboard-flat .card` matched
**zero elements** on the Dashboard, because that page uses the React primitives, which do not carry
`.card`. A whole verification round was spent on a selector that could never have matched
(operating note #3).

**Before writing an override targeted at blocks, establish which family you are hitting.** Read the
JSX of the component, or count the matches in the running page
(`document.querySelectorAll(selector).length`). Rule of thumb: **legacy page → `.card`; page already on
the `ui/` primitives → `.glass-edge`**.

⚠️ **A second trap on the same terrain.** `.glass-edge` forces `border-color: transparent !important`.
To draw a real hairline on such a block you need `!important` on the border too — or you use a
different side, or a pseudo-element. Discovering this by trial and error costs a round.

**Which one do you use for something new?** The React primitives from `src/components/ui/`. They are
already bound to the tokens, already correct in both themes, already carry the house edge.

---

## PART 2 — THE GLASS EDGE, HOUSE STYLE FOR BLOCKS  [F03:GLASS_EDGE]

`[PROJECT-DOC]` `[CODE]` Blocks in this product do **not** use a full border closing the perimeter.
They use a **discontinuous glass edge**: the global class `.glass-edge`.

**What it is, conceptually:** a gradient ring (a masked `::before`) that stays visible **at the
corners** and fades to nothing **along the sides** — so the outline never closes — plus a faint light
reflection along the top edge. It is built on `--foreground` through `color-mix`, so it is **adaptive
to the theme** (a soft opening hairline in light; a more perceptible glass refraction in dark) and
compliant with the color law by construction.

**It is already the default, app-wide.** `src/styles/scss/apple-foundation.css` applies the same ring
to every `.card` in the application, so legacy blocks get the house look without their markup being
touched. Blocks that already carry `.glass-edge` share the same pseudo-element: **no double border**.
A shorthand collision with the Jampack `.card-border` is neutralised there too, once, for the whole app.

**The variants and the opt-outs:**

| Class | Effect |
|---|---|
| `.glass-edge` | The house edge on a block |
| `.glass-edge-interactive` | Adds a slight liveliness on approach — for "at a glance" blocks such as KPI tiles |
| `.card-flat` | A plain hairline instead of the ring — for dense lists and grids |
| `.no-glass` | No ring at all |

`[CODE]` The worked example of the interactive variant is `src/modules/dashboard/ui/KpiCard.jsx`, which
combines `glass-edge glass-edge-interactive glass-sep` on a KPI tile — the third class being what lets
it also work inside a flat page (→ [F03:FLAT_SYSTEM]). `.glass-edge` and `.glass-edge-interactive` are
defined in `globals.css`; the app-wide default for `.card` and the `.card-flat` variant are in
`apple-foundation.css`.

**Three things not to do:**

- **Do not raise its intensity** until it reads as neon or showy glass. Low opacities; perceptible only
  from close up. An eye-catching edge is anti-pattern 5 of → [F01:ANTI_PATTERNS].
- **Do not apply it to small controls** — buttons, inputs, badges. It is for **surfaces and blocks**.
- **Do not confuse it with glassmorphism.** It is an **edge** effect, not a blur over content — which
  is what keeps it compatible with the rule in → [F03:SEPARATION_ORDER] about translucency.

`[CODE]` The reflection that follows the cursor is driven by `src/components/effects/GlassPointer.jsx`,
a single delegated listener that sets `--gx`, `--gy` and `--glass-glow` on `.glass-edge`, `.card` and
`.glass-sep`. It honours `prefers-reduced-motion`. You normally never touch it — but if you invent a
new glass surface that never lights up, this is why: it has to be one of those three classes.

---

## PART 3 — SEPARATION ORDER  [F03:SEPARATION_ORDER]

`[PROJECT-DOC]` To separate two things, **do not start from the border**. In order of preference:

1. **Space** between the groups;
2. **A slightly different background** between adjacent elements;
3. **A soft shadow** — it acts as a border, more gently;
4. **A hairline border**, only if it is genuinely needed.

Full, dark borders everywhere make a screen look dirty and tiring. Where a line is genuinely wanted as
a *material*, the house has one: the glass separator of the flat system (→ [F03:FLAT_SYSTEM]).

**Translucency and blur** `[PROJECT-DOC]` are used sparingly and **only on surfaces that sit above the
content and stay fixed while it scrolls** — the top navigation bar and the mobile bottom bar, both
already done. Never on a static content surface: it is fake there, and it costs performance. Keep
opacity high enough that text stays readable.
⚠️ A blur on a fixed element is re-rasterised on every frame when the page changes layout — the
secondary cause of the stutter documented in → [F04:PERFORMANCE].

---

## PART 4 — THE FLAT SYSTEM: pages without boxes  [F03:FLAT_SYSTEM]

`[CODE]` A reusable set of classes in `apple-foundation.css` that removes the boxes and separates
blocks with glass lines instead — the iOS Settings/Mail feel. Used on the "clean" pages (Dashboard,
Checklist, Impostazioni → Moduli).

**Three container classes, one brick, one opt-out:**

| Class | Put it on | Effect |
|---|---|---|
| `.page-flat` | The page container | Blocks inside — both `.glass-edge` primitives and legacy `.card` — lose the box: background, shadow and ring go |
| `.flat-cols` | A grid of blocks **side by side on one row** | Vertical glass lines between columns from **≥1280px**; horizontal ones when they stack |
| `.flat-cols-tight` | A compact strip, e.g. KPI tiles | Same drawing, narrower step. Between 768 and 1279px (a 2×2 grid) **no lines**, only space |
| `.flat-rows` | A multi-row grid at desktop | No lines at ≥1280px; horizontal separators once the blocks stack |
| `.flat-list` | A **vertical** stack of rows, e.g. a settings list | Horizontal lines between rows, centred in the container gap |
| `.glass-sep` | Each block or row to be separated | The brick: this is what actually draws the line |
| `.flat-keep` | A single block inside a `.page-flat` page | Opt-out: **keeps** its box, with the reactive glass ring |

⚠️ **The choice between `.flat-cols` and `.flat-rows` is not cosmetic.** The separators follow the
**DOM order**, not the visual columns. On a multi-row grid `.flat-cols` would draw lines in the wrong
places. One visual row → `.flat-cols`. More than one → `.flat-rows`.

**The mixed approach, for dense pages.** `.flat-keep` is the tool: box on the tables and the forms
where a container genuinely helps read the data, flat everywhere else. This is how a page stays
subtracted without dissolving the dense parts (→ [F01:AIR_VS_DENSITY]).

**Two more mechanics worth knowing:** consecutive `<section>` elements inside a `.page-flat` page get a
full-width horizontal divider automatically — the way iOS Settings groups things; and `.flat-list`
centres its line in a 16px gap by default, adjustable by redefining `--flat-list-gap` if the container
uses a different gap.

**It is all reversible:** remove `.page-flat` and the boxes come back. That is deliberate, and it is
why extending the system to a new page is a low-risk change.

---

## PART 5 — CHOOSING A VALUE  [F03:CHOOSING]

| Decision | Rule |
|---|---|
| How much space between two blocks | A step from `--space-*`, larger between sections than within a group. Never a number chosen by eye (→ [F02:SCALES]) |
| Which radius | Proportional to the element: small controls `--radius-sm`, cards `--radius-md`, modals and sheets `--radius-lg`, avatars and chips `--radius-pill` |
| Which shadow | By elevation: at rest `--shadow-xs`/`--shadow-sm`; hover `--shadow-md`; floating (dropdown, modal, popover) `--shadow-lg` |
| Border or no border | Ask the separation order first (→ [F03:SEPARATION_ORDER]). On a block, the house answer is the glass edge, not a border |
| Where does the style go | → [F03:WHERE_TO_STYLE] |

---

## PART 6 — MOTION  [F03:MOTION]

`[PROJECT-DOC]` Movement here is **purposeful**: it explains where something came from or where it
went. It is never decoration.

- **Durations and curves come from tokens**: `--duration-fast` 150ms, `--duration-base` 250ms,
  `--duration-slow` 400ms, with `--ease-out` — enters decisively, settles gently. Interface
  interactions live in the 150-250ms band.
- **Micro-interactions on hover and press**: color, shadow, a slight lift or scale. A press that
  reduces scale very slightly is the house feel.
- **Motion is never the only carrier of meaning.** Whatever an animation says must also be said by
  text, color or state.
- ⚠️ **`prefers-reduced-motion` is mandatory, not optional** (→ [F05:REDUCED_MOTION]). Both
  `CollapsibleSection` and `GlassPointer` already honour it; anything you add must too.

---

## PART 7 — WHERE A STYLE GOES  [F03:WHERE_TO_STYLE]

`[CODE]` The stylesheets are imported in `src/main.jsx` in this order, and the order matters:

```
tailwind.css → scss/style.scss (Jampack theme) → scss/globals.css (tokens + theme blocks)
  → scss/apple-foundation.css (house layer) → design-tokens.css (last: scales and typography)
```

| What you are styling | Where it goes |
|---|---|
| A single module | `src/modules/<name>/ui/<name>-ui.css`. The worked example to imitate is `src/modules/clients/ui/clients-ui.css` |
| A brand-new reusable block | A primitive in `src/components/ui/`, with its test (→ [F06:SIZE_AND_TESTS]) |
| A dark-only touch-up | A `[data-bs-theme="dark"] .your-selector { … }` block, still on tokens (→ [F02:DARK_CHECK]) |
| Something app-wide | ⚠️ Almost never yours. `apple-foundation.css` and `globals.css` change the look of **every page at once**: that is a product-level change, therefore 🟡 yellow (→ [F07:DESIGN_VS_PRODUCT]) |

**On specificity:** the house layer beats the Jampack theme by prefixing the app's real wrapper class
`.hk-wrapper` and using `:where()`, rather than scattering `!important`. `!important` appears only
where a theme shorthand has to be neutralised. Imitate that: prefix and `:where()` first, `!important`
as the exception you can justify in a comment.

---

## [F03:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: stylesheets and React primitives
read directly in `crmadv` (read-only) at the current commit; design decisions cross-checked against
the project's design compass and operating notes.

Standing caveat: the flat system and the glass edge are **house inventions** — they exist nowhere
outside this repository, so the code is the only possible authority and there is no external source to
corroborate them against. This raises the value of reading the CSS before relying on a class name.

- **The two families of block, and that the React primitive renders `div.glass-edge` without `.card`**:
  `src/components/ui/card.jsx`, read directly (it renders
  `glass-edge rounded-xl border-0 bg-card text-text …`) — Tier 1 / **HIGH** `[CODE]`.
- **The failed `.dashboard-flat .card` selector that matched zero elements, and the practical rule for
  telling the families apart**: operating note #3 — Tier 2 / **HIGH** (note written from a real
  failure, with the diagnosis).
- **`.glass-edge` forces `border-color: transparent !important`, so a hairline needs `!important`**:
  `src/styles/scss/globals.css`, the `.glass-edge` rule read directly — it sets `position: relative`,
  `border-color: transparent !important` and a `box-shadow` combining `--shadow-sm` with an inset
  highlight built via `color-mix` on `--foreground` — Tier 1 / **HIGH** `[CODE]`. Independently
  asserted by operating note #3.
- **`.glass-edge-interactive` is defined in `globals.css`** (a `:hover::before` rule that swaps in a
  radial gradient following `--gx` / `--gy`), and the worked usage is
  `src/modules/dashboard/ui/KpiCard.jsx`, which combines `glass-edge glass-edge-interactive glass-sep`
  on a KPI tile — Tier 1 / **HIGH** `[CODE]`.
- **`.card-flat` is defined in `apple-foundation.css` block 3** (plain hairline, no ring) and is
  excluded from the default glass treatment and from the flat system by the `:not(.card-flat)` clauses
  in blocks 2 and 5 — Tier 1 / **HIGH** `[CODE]`.
- **The glass edge: what it is, that it is built on `--foreground` via `color-mix`, that it is house
  style for blocks, the "do not raise the intensity" and "not for small controls" rules, and that it is
  an edge effect rather than blur glassmorphism**:
  `crmadv/archivio-documenti/design-linguaggio-apple-web.md` §6.5 — Tier 1 / **HIGH**.
- **That it is the app-wide default for `.card`, the `.card-border` shorthand collision resolved once,
  and the `.no-glass` / `.card-flat` opt-outs**: `src/styles/scss/apple-foundation.css`, blocks 1-3,
  read directly — Tier 1 / **HIGH** `[CODE]`.
- **The flat system: every class, its effect, and the real breakpoints (≥1280px vertical separators;
  below, horizontal; ≤767.98px for the compact strip; `--flat-list-gap` defaulting to `--space-4`)**:
  same file, block 5, read in full — Tier 1 / **HIGH** `[CODE]`.
- **The `.flat-cols` versus `.flat-rows` caveat (separators follow DOM order, not visual columns)**:
  same file, stated explicitly in the comments of block 5 — Tier 1 / **HIGH** `[CODE]`.
- **`GlassPointer` drives `--gx` / `--gy` / `--glass-glow` on `.glass-edge`, `.card` and `.glass-sep`,
  with one delegated listener, and honours `prefers-reduced-motion`**:
  `src/components/effects/GlassPointer.jsx`, header documentation read directly — Tier 1 / **HIGH**
  `[CODE]`.
- **Separation order and the sparing use of blur on fixed bars only**: design compass §6.1 and §6.4 —
  Tier 1 / **HIGH**.
- **Blur on a fixed element re-rasterised on every frame during layout change**: operating note #9,
  measured on the Clienti list — Tier 2 / **HIGH** (a measurement, not an opinion).
- **Motion principles, tokens and the ban on motion as the sole carrier of meaning**: design compass
  §8 — Tier 1 / **HIGH**; token values from `src/styles/design-tokens.css` — Tier 1 / **HIGH**
  `[CODE]`.
- **CSS import order in `src/main.jsx`**: read directly (lines 5-11) — Tier 1 / **HIGH** `[CODE]`.
  Corroborated by the header comments of `apple-foundation.css` and `design-tokens.css`, which state
  the intended order and the reason.
- **Specificity strategy (`.hk-wrapper` + `:where()` instead of `!important` spam)**: header comment of
  `apple-foundation.css` — Tier 1 / **HIGH** `[CODE]`.
- **`clients-ui.css` as the module-CSS example done right**:
  `crmadv/archivio-documenti/design-system-temi.md`, *Pattern pratici* — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **Maximum content width** has no token behind it (→ [F01:SOURCE_NOTES]). Follow the neighbouring
  pages.
- **The `--hk-*` indirection.** Some third-party theme classes are themed through `--hk-*` variables
  inside the Jampack SCSS rather than in `globals.css` (the worked case is in
  → [F02:ALREADY_HANDLED]). When a block does not look right in one theme, that layer is the third
  place to look, and it is the one most often skipped.
- **The exact `globals.css` rule behind `ui-collapse-animating`** was not read in this pass
  (→ [F04:COLLAPSIBLE_SECTION]). Read it before copying the mechanism into a new animated component.

------------------------------------------------------------------------------

End of document — [F03 — Surfaces, separation and layout] · crm-design-frontend v1.0
