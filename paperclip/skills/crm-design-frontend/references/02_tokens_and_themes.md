# KNOWLEDGE DOCUMENT — [F02]
# Tokens, colors and the two themes
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F02:USAGE_NOTE]

Read this whenever a **value** is about to be written: a color, a size, a spacing, a radius, a shadow,
a duration. It answers "which token do I use", and it holds the two things that most often go wrong
here — **a screen that only works in one theme**, and **a green lint that proves nothing**.

The reasoning behind the values is in → [F01]. The surfaces built out of them are in
→ [F03:SURFACES]. Traceability: → [F02:SOURCE_NOTES].

---

## PART 1 — THE COLOR LAW  [F02:COLOR_LAW]

> **Never write an interface color by hand.** Not `#hex`, not `rgb()`, not `rgba()`, not `hsl()`. Use
> a token `var(--…)`, a token-bound Tailwind class, or a standard Bootstrap component class.
> `[PROJECT-DOC]`

**This includes JSX inline styles.** `style={{ background: '#fff' }}` is the same violation as writing
it in a stylesheet, and it is the form the guardrail was built to catch.

**Why it is a law and not a preference.** The theme is one global system: `src/styles/scss/globals.css`
defines a `[data-bs-theme="light"]` block and a `[data-bs-theme="dark"]` block. Anything built on
tokens inherits **both themes for free**. Anything with a fixed color **overrides the system** and
produces the classic defect — a white panel in dark mode, or a dark box in light mode — which nobody
sees until someone opens that page in the other theme.

**And a second reason, specific to this product.** The accent is **per workspace**: `--primary` and
`--brand-accent` are overwritten at runtime from the workspace branding. A hand-written blue is not
merely off-system, it is the **wrong color for that customer**, who may be branded green or purple.

**Three compliant ways to write a color:**

| Form | Example | When |
|---|---|---|
| CSS custom property | `background: var(--card);` | Module CSS, any stylesheet |
| Tailwind class bound to a token | `className="bg-card text-textMuted"` | The React primitives in `src/components/ui/` already work this way |
| Standard Bootstrap class | `.card`, `.btn-primary`, `.form-control`, `.table` | Restyled onto the tokens in `globals.css` — themes come for free |

**Opacity over a surface or a border** uses the triplet form, because several tokens are stored as
RGB triplets rather than finished colors: `background: rgb(var(--surface-2) / 0.9)`.

---

## PART 2 — WHICH TOKEN FOR WHAT  [F02:PALETTE]

`[PROJECT-DOC]` The full list is in `crmadv/archivio-documenti/design-system-temi.md`. These are the
ones a frontend task actually reaches for.

**Surfaces**
| Token | Use |
|---|---|
| `--background` | Page background |
| `--card` | Cards, modals, dropdowns, popovers |
| `--muted` | Quiet surface, secondary zones |
| `--surface-2`, `--surface-3`, `--surface-elevated` | Layered surfaces (triplets — use `rgb(var(--surface-3) / 0.6)`) |

**Text**
| Token | Use |
|---|---|
| `--foreground` | Primary text. Note: it is **not** pure black, deliberately |
| `--muted-foreground` | Secondary text, captions, placeholders |
| `--primary-foreground`, `--secondary-foreground`, `--accent-foreground` | Text sitting on a colored surface |

**Borders**
| Token | Use |
|---|---|
| `--border` | Standard border |
| `--input` | Form field border |
| `--border-subtle` | Faint border (triplet — `rgb(var(--border-subtle) / 0.5)`) |

**Accent and brand** — per workspace, default blue
`--primary` / `--primary-foreground` (the action color) · `--accent` / `--accent-foreground` (the soft
tint for hover and selection) · `--brand-accent`, `--brand-accent-hover`, `--brand-accent-active`,
`--brand-accent-soft` (+ their `-foreground`) · `--ring`, `--focus-ring-shadow` (focus).

**States** — semantic only (→ [F01:ACCENT])
`--success` / `--success-soft` · `--info` / `--info-soft` · `--warning` / `--warning-soft` ·
`--danger` / `--danger-soft`.

**Rows and shadows**
`--row-hover` (triplet — `rgb(var(--row-hover) / 0.7)`) · `--shadow-color` (triplet).

> The `--bs-*` (Bootstrap) and `--hk-*` (theme) variables are **already mapped** onto the tokens above.
> Using standard Bootstrap classes and `react-bootstrap` components means you never touch them.

---

## PART 3 — TYPOGRAPHY  [F02:TYPOGRAPHY]

`[CODE]` Defined in `src/styles/design-tokens.css`.

**The font is the system stack**, `var(--font-sans)` — which renders as San Francisco on a Mac and
Segoe UI on Windows. Also available: `--font-heading` (an alias of the same stack) and `--font-mono`.
⚠️ **Do not load SF Pro as a web font**: it is licensed for Apple platforms only, and the stack already
gives it where it is legal to have it (→ [F01:ANTI_PATTERNS]).

| Role | Token | Value | Weight |
|---|---|---|---|
| Page title (H1) | `--text-2xl` / `--text-3xl` | 28 / 36px | 600-700 |
| Section title (H2) | `--text-xl` | 22px | 600 |
| Card or widget title (H3) | `--text-lg` / `--text-md` | 18 / 16px | 600 |
| Body | `--text-base` / `--text-md` | 15 / 16px | 400 |
| Secondary, caption | `--text-sm` | 13px | 400, in `--muted-foreground` |
| Micro-label | `--text-xs` | 12px | 500-600 |

**Line height:** `--leading-tight` 1.2 (titles) · `--leading-normal` 1.5 (body) · `--leading-relaxed`
1.65. **Weights:** `--weight-regular` 400 · `--weight-medium` 500 · `--weight-semibold` 600 ·
`--weight-bold` 700. **Tracking:** `--tracking-body` −0.01em · `--tracking-heading` −0.021em, applied
to `h1`-`h6` globally.

**Body base is 15px, not 17px, and that is deliberate.** 17px is the iOS body size, tuned for touch at
arm's length; a desktop management application reads comfortably at 15-16px and shows more data
(→ [F01:AIR_VS_DENSITY]).

---

## PART 4 — SPACE, RADII, SHADOWS, MOTION  [F02:SCALES]

`[CODE]` Same file, `src/styles/design-tokens.css`.

**Spacing** — a 4px step. `--space-1` 4px · `--space-2` 8px · `--space-3` 12px · `--space-4` 16px ·
`--space-5` 24px · `--space-6` 32px · `--space-8` 48px.

> ⚠️ **There is no `--space-7`.** `[ABSENT-VERIFIED]` The scale jumps from `--space-6` (32px) to
> `--space-8` (48px). Absence protocol run: by synonym (searched `space-7` across `src/`), by
> enumeration (all `--space-*` definitions listed — 1,2,3,4,5,6,8), by schema (`tailwind.config.js`
> checked). Writing `var(--space-7)` yields an **unresolved** custom property, which fails silently:
> the declaration is dropped and the element gets no spacing at all, with no error anywhere.

**Radii** — proportional to the element. `--radius-sm` 8px (small controls) · `--radius-md` 12px
(cards) · `--radius-lg` 16px (modals, sheets) · `--radius-xl` 20px · `--radius-pill` (avatars, chips).

**Shadows** — soft, wide, low opacity, with a vertical offset. `--shadow-xs` / `--shadow-sm` (at rest:
cards, primary button) · `--shadow-md` (hover, slight elevation) · `--shadow-lg` (things that float:
dropdowns, modals, popovers) · `--shadow-focus` (the focus halo).
The shadow **is part of the hierarchy**: the higher an element sits, the more marked. Applied to
everything equally, it stops meaning anything. All four are **redefined for dark**, more marked, in the
`[data-bs-theme='dark']` block of the same file.

**Motion** — `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)` (enters decisively, settles gently) ·
`--ease-in-out` · `--duration-fast` 150ms · `--duration-base` 250ms · `--duration-slow` 400ms.
Interface interactions stay in the 150-250ms band. Anything animated must honour
`prefers-reduced-motion` (→ [F05:REDUCED_MOTION]).

---

## PART 5 — LIGHT AND DARK  [F02:DARK_CHECK]

**Dark is not light inverted** `[PROJECT-DOC]`. It is a separate palette, already written in the
`[data-bs-theme="dark"]` block. Four consequences you can act on:

1. **Elevation comes from surface lightness, not from shadow.** In dark, higher = lighter surface:
   base → `--surface-2` → `--surface-3`. Shadows count for less there.
2. **No pure black.** The base is a charcoal. On pure black no elevation is visible at all, and OLED
   screens produce halos.
3. **Desaturate the accent.** Over-saturated colors vibrate on a dark ground; the dark accent is
   deliberately softer than the light one. This is already handled by the tokens — which is another
   reason not to write one by hand.
4. **A dark-only touch-up is legitimate and rare.** Add a `[data-bs-theme="dark"] .your-selector { … }`
   block — still with tokens.

### How to check both themes — and you must, every time

The single most common failure in this codebase is a screen built and verified in **one** theme.

- The attribute is **`data-bs-theme`**, on the root — *not* `data-theme`. Using the wrong name toggles
  nothing and you conclude, wrongly, that the theme works.
- **Read the computed value, do not judge by eye.** In dark, the background of a panel must come out as
  a dark surface (`--card`), not `rgb(255, 255, 255)`. A fast sweep: count the elements inside the area
  whose computed `backgroundColor` is still pure white — it must be **zero**.
- **Check light as well**, by switching back: a fix for dark that breaks light is a common trade.
- **Images and logos that depend on the background** are chosen from the theme
  (`const { theme } = useTheme();`), never assumed.

---

## PART 6 — WHAT `globals.css` ALREADY HANDLES  [F02:ALREADY_HANDLED]

`[CODE]` Before rewriting components wholesale because a class "looks light", check what the global
layer already remaps. Several suspicious-looking patterns **already work in dark** and must be left
alone:

| Pattern in JSX | Status |
|---|---|
| `<Badge bg="light">`, `.badge.text-bg-light` | ✅ Remapped to `--muted` + `--foreground` with a soft border |
| `<Button variant="light">`, `.btn-light`, `.btn-outline-secondary` | ✅ Remapped to `--secondary` / `--border` / `--secondary-foreground` |
| `bg-white`, `bg-gray-50`, `bg-slate-50` | ✅ Remapped under `[data-bs-theme="dark"]` to `--card` |
| `--bs-light`, `--bs-soft-*`, `--bs-*-bg-subtle` | ✅ Redefined per theme |

### The one worth showing in full, because the protocol reversed the answer

`<Alert variant="light">` is recorded in **operating note #14** as *not* themed — a case still to fix.
Running the absence protocol on it shows the opposite, and the note is **stale on this point**:

- **by synonym** — `alert-light` appears nowhere in `globals.css`, `apple-foundation.css`,
  `design-tokens.css` or `tailwind.css`. On that evidence alone, the note looks right.
- **by enumeration** — `globals.css` themes `.alert` (base) plus `.alert-primary`, `.alert-success`,
  `.alert-info`, `.alert-warning` and `.alert-danger`, each with a `[data-bs-theme="dark"]`
  counterpart. `[ABSENT-VERIFIED]` `.alert-light` is genuinely absent from that list. Two searches
  down, the answer still looks like "uncovered".
- **by index** — searching the whole `src/styles` tree finds `.alert-light` **once**, inside the
  Jampack SCSS. Opening it shows the hardcoded values **commented out** and replaced with
  `var(--hk-text-secondary)`, `var(--hk-bg-secondary)` and `var(--hk-border-tertiary)`, each marked
  `// <-- THEMED`. Those three `--hk-*` variables are defined **twice** in `globals.css` — once per
  theme — pointing at our tokens.

> **Conclusion: `.alert-light` is themed, and it works in both themes.** Two of the three searches said
> "absent"; the third said "present, one layer down and under a different name". That is exactly the
> failure mode the protocol exists to catch, and the reason a not-found may never be reported as an
> absence (→ [F00:SOURCE_FLAGGING]).

**The transferable lesson, which is worth more than the fact:** in this codebase a class can be themed
**through the `--hk-*` layer inside the third-party theme** rather than in `globals.css`. So "it is not
in `globals.css`" is not a conclusion — it is one search out of three.

---

## PART 7 — THE LINT GAP — a green lint proves less than it looks  [F02:LINT_GAP]

Two commands flag hand-written colors:

- `npm run lint:css` — stylelint over module CSS files;
- `npm run lint:colors` — a dedicated ESLint rule over **inline styles in JSX**.

⚠️ **Both look only at `src/modules/**`.** `[ABSENT-VERIFIED]` Absence protocol run: by schema (the two
script definitions read directly in `package.json`: `"src/modules/**/*.css"` and `src/modules`), by
enumeration (all scripts in `package.json` listed — no other color check among them), by synonym
(searched for other lint entries). **Every page under `src/views/**` is unlit** — and that includes the
whole Agency area, WebAssets, Settings, Team, Profiles, Authentication.

**What follows, concretely:** in `src/views/**`, a clean run of both commands says nothing about your
work. There you search by hand: `#[0-9a-fA-F]{3,8}`, `rgba?\(`, `bg="light"`, `bg-white`,
`text-bg-light`, `variant="light"`.

They are **advisory**: they report without blocking the build. A report is not noise to be silenced —
see → [F06:GUARDRAILS].

---

## PART 8 — THE PRINT EXCEPTION  [F02:PRINT_EXCEPTION]

`[PROJECT-DOC]` Inside a `@media print` block, colors **are** written by hand, and that is correct.
Tokens follow light and dark, so printing from a dark theme would produce a black page. Print wants
black on white, always, whatever is on screen.

Two conditions, both required:

1. It applies **only** inside `@media print`.
2. It carries **a comment saying why** — otherwise the next review flags it again as a violation, and
   someone spends a round rediscovering this paragraph.

---

## PART 9 — WHAT IS NOT A TOKEN  [F02:NOT_A_TOKEN]

`[PROJECT-DOC]` Some colors are **data or decoration**, not interface, and they stay literal: the
theme's decorative palettes, country flags, an illustration, the tag palette, the colors of kanban
stages living in util files.

**The rule for the doubtful case:** if you cannot tell whether a color is thematic or decorative,
**treat it as thematic and use a token**. Getting this wrong in that direction is harmless; getting it
wrong in the other direction produces a white box in dark mode.

---

## [F02:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: token files and stylesheets read
directly in `crmadv` (read-only) at the current commit, cross-checked against the project's design
documents and operating notes. No external source is involved: every value here is a **fact of this
codebase**, and the codebase is the only authority for it.

Standing caveat: `[CODE]` claims are the strongest evidence available in this skill **and the fastest
to age**. Values, and above all line numbers, are a photograph of one commit. Open the file.

- **Token values — typography, spacing, radii, shadows, motion**: `src/styles/design-tokens.css`, read
  in full — Tier 1 / **HIGH**.
- **`--space-7` is absent from the scale**: same file (enumeration of `--space-*`), plus a search
  across `src/` and a check of `tailwind.config.js` — Tier 1 / **HIGH** `[ABSENT-VERIFIED]`.
- **Color token list and their roles**: `crmadv/archivio-documenti/design-system-temi.md`, read in
  full — Tier 1 / **HIGH**.
- **The theme is one global system in `globals.css` with a light block and a dark block; `--bs-*` and
  `--hk-*` are mapped onto the tokens**: same document, corroborated in `src/styles/scss/globals.css`
  — Tier 1 / **HIGH**.
- **Tailwind color utilities are bound to the custom properties** (`bg-card`, `text-textMuted`,
  `hover:bg-hover`, `surface1..3`, `border`, `input`, `rowHover`): `tailwind.config.js`, read directly;
  the React primitive `src/components/ui/card.jsx` uses exactly those classes — Tier 1 / **HIGH**
  `[CODE]`.
- **The accent is per workspace and set at runtime**: `design-system-temi.md` and
  `design-linguaggio-apple-web.md` §4.3, which name `src/lib/workspaceBranding.ts` — Tier 1 /
  **MEDIUM** (the runtime file itself was not opened in this pass; the operative consequence — always
  use the token — does not depend on it).
- **What `globals.css` already remaps** (`.badge.bg-light` / `.text-bg-light` → `--muted` +
  `--foreground`; `.btn-light` / `.btn-outline-secondary` → `--secondary`; `[data-bs-theme="dark"]
  .bg-white` / `.bg-gray-50` / `.bg-slate-50` → `--card`): `src/styles/scss/globals.css`, read at the
  relevant block — Tier 1 / **HIGH** `[CODE]`. Independently asserted by operating note #14.
- **`.alert-light` IS themed, through the `--hk-*` layer inside the Jampack SCSS**:
  `src/styles/scss/style.scss` (the `&.alert-light` rule, hardcoded values commented out and replaced
  with `--hk-text-secondary` / `--hk-bg-secondary` / `--hk-border-tertiary`, each marked
  `// <-- THEMED`), plus `src/styles/scss/globals.css` where those three variables are defined once per
  theme — Tier 1 / **HIGH** `[CODE]`. ⚠️ **This contradicts operating note #14**, which lists
  `Alert variant="light"` among the uncovered cases. The code wins; the note is stale on that point,
  and the divergence is reported rather than corrected here (→ [F00:SKILL_LEVEL_ERRORS]).
- **`globals.css` themes `.alert` and the variants primary/success/info/warning/danger, each with a
  dark counterpart, and `.alert-light` is not among them**: `globals.css`, the `.alert*` block read
  directly — Tier 1 / **HIGH** `[ABSENT-VERIFIED]` for that scoped claim (enumeration of the selectors
  present). It is the middle step of the protocol above, and on its own it would have produced the
  wrong answer.
- **The Jampack dark stylesheet `style-dark.css` is not part of the loaded bundle**: `src/main.jsx`
  imports five stylesheets (`tailwind.css`, `scss/style.scss`, `scss/globals.css`,
  `scss/apple-foundation.css`, `design-tokens.css`), and `style-dark` is imported by nothing in `src/`,
  `index.html` or `vite.config.js` — Tier 1 / **HIGH** `[ABSENT-VERIFIED]` (by synonym, by enumeration
  of the imports, by index over the entry points). Relevant because it rules out the "the theme's dark
  file rescues it" hypothesis: what themes `.alert-light` is the `--hk-*` indirection, not a second
  stylesheet.
- **`lint:css` and `lint:colors` cover only `src/modules/**`**: `package.json`, script definitions read
  directly — Tier 1 / **HIGH** `[ABSENT-VERIFIED]`. Independently asserted by operating note #14,
  which calls it a trap.
- **The theme attribute is `data-bs-theme`, not `data-theme`**: operating note #22, corroborated by the
  selector blocks in `globals.css` — Tier 2 / **HIGH** (note written from a real failure, and visible
  in the code).
- **How to verify a theme fix by reading computed styles rather than by eye**: operating note #14 —
  Tier 2 / **HIGH** (procedure already executed successfully on the Agency area).
- **The print exception and its mandatory comment**: `crmadv/CLAUDE.md`, *Colori e temi* — Tier 1 /
  **HIGH**.
- **Body at 15px rather than the iOS 17px, with the reason**:
  `crmadv/archivio-documenti/design-linguaggio-apple-web.md` §2.2 — Tier 1 / **HIGH**.
- **SF Pro may not be embedded as a web font**: same document §2.1 — Tier 1 / **MEDIUM** (asserted by
  the project document; the Apple licence page was not read in this pass).

VERIFY-ON-FIELD:
- **Other classes possibly themed through the `--hk-*` indirection.** The `.alert-light` case shows the
  mechanism exists; how many other Jampack classes use it was not enumerated. Before declaring any
  class "uncovered", run the third search — over `src/styles/scss/style.scss`, not only over
  `globals.css`.
- **Operating note #14's list of uncovered cases** should be treated as a lead, not as a finding: one
  of its entries has been shown stale here, so the others deserve the same protocol before being acted
  on.
- **The exact set of `--surface-*` and `--brand-accent-*` tokens** comes from the design-system
  document rather than from a full read of `globals.css`. Before relying on an unusual one, confirm it
  is defined in both theme blocks.
- **The advisory nature of the two lint commands** (report, not block) is stated by the project
  documents; the CI configuration was not inspected.

------------------------------------------------------------------------------

End of document — [F02 — Tokens, colors and the two themes] · crm-design-frontend v1.0
