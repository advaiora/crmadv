# KNOWLEDGE DOCUMENT — [F01]
# The design language, turned into decisions
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F01:USAGE_NOTE]

Read this when you are about to **choose** something visual: how big a title should be, how much space
to leave, whether a block needs a border, whether a field belongs in the row or behind a disclosure.

This document holds the **decisions**, not the theory. The theory — the *why*, with its Apple and web
sources — lives in the project's own compass, `crmadv/archivio-documenti/design-linguaggio-apple-web.md`.
That document is the authority; this one is what you do with it at 3 a.m. with nobody to ask.

The token names and values are in → [F02:SCALES]. The surfaces and the layout machinery are in
→ [F03:SURFACES]. Traceability: → [F01:SOURCE_NOTES].

---

## PART 1 — THE ONE QUESTION  [F01:THE_QUESTION]

Every visual choice in this product answers one question `[PROJECT-DOC]`:

> **Does this serve the content, or does it compete with it?**

If it competes, it goes or it gets quieter. This is what "subtraction" means here, and it is the tie
breaker whenever two options both look acceptable.

**The direction has a name and a shape:** Apple-style by subtraction, for a **web management
application** — not a marketing site, not a native iOS app. Both of those comparisons are traps and
each has its own anti-pattern below (→ [F01:ANTI_PATTERNS]).

**Subtraction is of decorations, never of data.** `[PROJECT-DOC]` Removing a border is subtraction.
Removing a column that a user reads every day is damage. The test: *if the same job now needs more
scrolling, more clicks or more waiting, you have made the product worse, however clean it looks.*

---

## PART 2 — HIERARCHY  [F01:HIERARCHY]

Hierarchy is built with **size, weight and color** — in that order of leverage — and not with boxes,
rules or decoration `[PROJECT-DOC]`.

| Decision | Do this | Not this |
|---|---|---|
| A page title | Large, semibold or bold, tight tracking (`--tracking-heading`) | Same size as a section title, distinguished by a border |
| A section title | One clear step down, weight 600 | Same weight as body, in a colored bar |
| Emphasis inside a block | Change **weight** or **color**, not size | A third font size |
| Secondary text, captions | `--text-sm` in `--muted-foreground` | Light grey at body size (→ anti-pattern 2) |
| A micro-label / section header | `--text-xs`, weight 500-600, optionally uppercase with wide tracking | Uppercase on a whole sentence |

**Three hard limits** `[PROJECT-DOC]`:

- **At most two weights per block** — typically 400 for body, 600 for emphasis.
- **Never a weight below 400.** It reads as broken, not as elegant.
- **Never more than a handful of distinct sizes in one view.** If you need a fourth, you needed
  weight or color instead.

**Line length.** Long prose at full container width is unreadable; keep running text to roughly 60-75
characters. This applies to descriptions and empty states, not to table cells.

---

## PART 3 — THE ACCENT  [F01:ACCENT]

**Neutral interface, one accent, used with discipline** `[PROJECT-DOC]`.

- **One primary action per view.** One filled accent button. A second filled button next to it means
  neither is primary. Secondary actions are tinted or neutral; tertiary look like links.
- **The accent carries meaning**, never decoration: the primary action, the active element, the tint
  of a selection or hover.
- **State colors are semantic only.** `--success` / `--info` / `--warning` / `--danger` mean what they
  say. Full red is reserved for a **primary** destructive action; a secondary destructive action is
  not red.
- ⚠️ **The accent of this product is per-workspace.** It is not blue — it is whatever a given client's
  workspace is branded with, applied at runtime. Writing a blue by hand does not merely violate the
  color law, it produces the **wrong** color for that customer (→ [F02:COLOR_LAW]).

---

## PART 4 — AIR VS DENSITY  [F01:AIR_VS_DENSITY]

This is the sharpest tension in the whole product, and the one where copying Apple naively does the
most damage `[PROJECT-DOC]`.

Apple's own site is a **shop window**: enormous images, one idea per screen. The users of this CRM are
**power users who came for the data**. Both things are true at once, and the resolution is not a
compromise — it is a **split by zone**:

| Zone | Rule | Concretely |
|---|---|---|
| **Around titles and between sections** | Air, generously | Margins above page and section titles; real breathing room *between* blocks |
| **Inside tables, lists, KPI strips, forms** | Density, compact and regular | Rows stay tight; the value is seeing many records in order, not each one alone in a field of white |

**Group with space before you group with a line** `[PROJECT-DOC]`. The order of preference for
separating two things is: space → a slightly different background → a soft shadow → a hairline border.
The border is the last resort, not the first idea (→ [F03:SEPARATION_ORDER]).

**Layout frame.** Content has a maximum width (roughly 1200-1440px) and is centered; the vertical
rhythm is consistent between sections. Spacing comes from the 4/8 steps of `--space-*`, never from
numbers chosen by eye (→ [F02:SCALES]).

---

## PART 5 — PROGRESSIVE DISCLOSURE  [F01:PROGRESSIVE_DISCLOSURE]

This is how the product reconciles subtraction with density, and it comes in two forms
`[PROJECT-DOC]`:

- **Drill-down** — a summary or signal on a list or dashboard, the full record one click away.
- **Inline row disclosure** — a chevron that expands the row in place, without leaving the page. A
  *quick glance*, not a replacement for the detail page.

**Which fields go where — the decision rule:**

| Field | Where | Test |
|---|---|---|
| Read at a glance, every time: name, status, key contacts, tags, actions | **Always visible in the row** | Would hiding it cost time on the ordinary job? |
| Consulted now and then: tax data, address, notes | **Behind the disclosure** | Is it needed only when the user is already interested in that one record? |

⚠️ **The guardrail, and it is the one that gets forgotten.** Never hide a field the power user looks at
constantly. If opening a chevron costs time on the same job, the product got worse — the exact
anti-pattern of § anti-pattern 6. **When in doubt, a heavily used field stays in the row.**

**Extend this pattern one view at a time**, riding the redesign of each module — not in a single sweep
across the product. It was piloted on the Clienti list; the mechanics are in → [F04:DENSE_LIST_RECIPE].

---

## PART 6 — ANTI-PATTERNS  [F01:ANTI_PATTERNS]

Six ways to make this product worse while believing you are making it more elegant `[PROJECT-DOC]`.
Each is a check you run on your own work before handing it over.

| # | The mistake | What it actually looks like | The correction |
|---|---|---|---|
| 1 | **Emptiness without hierarchy** | White space scattered evenly, nothing leading the eye | Air *with* hierarchy: space that groups, not space that dilutes |
| 2 | **"Clean means low contrast"** | Light grey text on white | It is not minimalism, it is broken. Contrast is a floor, not a taste (→ [F05:CONTRAST]) |
| 3 | **Removing the information scent** | The user can no longer tell what to do next | Remove decoration, keep the signals |
| 4 | **Copying the density of a marketing site** | One record per screen, endless scrolling | Take the typographic care and the subtraction; leave the shop-window density |
| 5 | **Native controls transplanted pixel-for-pixel** | An iOS switch, a wheel picker, glass everywhere | Take the *behaviour* (clear states, obvious affordance), never the skin |
| 6 | **Data sacrificed to looks** | Same job now takes more scrolling or more clicks | Revert. This one is measurable, so measure it |

**Two things that must not travel from the native world to this web app** `[PROJECT-DOC]`:
the SF Pro font as a web font — a licensing matter, the system stack handles it (→ [F02:TYPOGRAPHY]) —
and gestures as the *only* way to do something; on the web an affordance must be visible, the gesture
is a bonus.

---

## PART 7 — THE DECISION CHECKLIST  [F01:DECISION_CHECKLIST]

Run this before you hand the work over. It is deliberately short: the long checklist is the product of
the other files, this one catches the design mistakes.

- [ ] Does every element here **serve** the content? Anything competing has been quieted or removed.
- [ ] One primary action in this view — exactly one.
- [ ] Hierarchy readable with the screen squinted at: title, sections, body, secondary.
- [ ] At most two weights per block; nothing below 400.
- [ ] Air around titles and between sections; density preserved inside the data.
- [ ] Grouping done with space or background **before** any border was added.
- [ ] Nothing that a user looks at constantly ended up behind a disclosure.
- [ ] Same job, same number of clicks and scrolls as before — or fewer.

**If a genuine design gap appears** — the compass does not settle the case, and inventing an answer
would set a precedent for the whole product — that is not yours to close. It is 🟡 yellow: park it with
options (→ [F07:DESIGN_VS_PRODUCT]).

---

## [F01:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the project's
own design documents and of the frontend code in `crmadv` (read-only), plus targeted verification of
external normative claims (recorded in → [F05:SOURCE_NOTES], which is where the accessibility numbers
belong).

Standing caveat: this document restates **decisions already taken by this project**. Its authority is
therefore the project document, not an external standard — which is exactly why it is flagged
`[PROJECT-DOC]` rather than `[NORMATIVE]`. A decision can be revisited by the council; it cannot be
revisited by you (→ [F07:DESIGN_VS_PRODUCT]).

- **The three pillars, the governing question, subtraction, "Apple-style for a management app"**:
  `crmadv/archivio-documenti/design-linguaggio-apple-web.md`, §0-§1 — Tier 1 / **HIGH** (project
  document read directly; it carries its own source appendix distinguishing Apple HIG from
  observed marketing values from web best practice).
- **Typographic hierarchy, two weights per block, no weight below 400, 60-75 characters**: same
  document, §2.4 — Tier 1 / **HIGH**.
- **One accent per view, semantic state colors, red reserved for the primary destructive action**:
  same document, §4.1 and §4.4 — Tier 1 / **HIGH**.
- **The accent is per-workspace, overwritten at runtime**: same document §4.3, corroborated in code —
  `src/lib/workspaceBranding.ts` is named as the runtime source of `--primary` / `--brand-accent`;
  `tailwind.config.js` binds the Tailwind color utilities to the same custom properties — Tier 1 /
  **HIGH** `[CODE]`.
- **Air vs density, the split by zone, maximum content width 1200-1440px, the 4/8 spacing step**: same
  document, §3.1-§3.3 — Tier 1 / **HIGH**.
- **Separation order (space → background → shadow → hairline)**: same document, §6.1 — Tier 1 /
  **HIGH**.
- **Progressive disclosure, the two forms, the guardrail on frequently-read fields, "one view at a
  time"**: same document, §3.4 — Tier 1 / **HIGH**.
- **The six anti-patterns and the "what not to bring from native" list**: same document, §9 and §10 —
  Tier 1 / **HIGH**.
- **SF Pro licensing (system stack instead of a web font)**: same document, §2.1 — Tier 1 / **MEDIUM**
  (the licensing statement is asserted by the project document; the underlying Apple licence page was
  not read in this research pass, and the practical consequence — use `--font-sans` — does not depend
  on it).

VERIFY-ON-FIELD:
- **The maximum content width (1200-1440px)** is stated as a range in the compass and has **no token**
  behind it `[NOT-FOUND]` — the absence protocol was not run against the full stylesheet layer, so
  nothing is derived from it here: check the surrounding page before choosing a value, and follow
  whatever the neighbouring pages already do.
- **The compass and the code diverged once**, on the animation technique of `CollapsibleSection`
  (→ [F04:COLLAPSIBLE_SECTION]). ✅ **Closed on 25/8/2026:** `design-linguaggio-apple-web.md` §3.4 no
  longer says `transition: height` — it describes the real mechanism (height measured once in JS, the
  inner content animated with `translateY`), **with its reason** (animating height would redo layout
  every frame and force a re-raster of the bar's `backdrop-filter`) **and its trade-off** (neighbours
  jump to their final position instead of growing).
  ⚠️ **The lesson does not close with the case, and it is the part that matters: treat every
  implementation detail in the compass as a claim to check against the code, not as a specification.**
  One divergence was found and fixed; that is not evidence that the others were checked.

------------------------------------------------------------------------------

End of document — [F01 — The design language, turned into decisions] · crm-design-frontend v1.0
