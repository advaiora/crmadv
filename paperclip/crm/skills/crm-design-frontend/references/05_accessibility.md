# KNOWLEDGE DOCUMENT — [F05]
# The accessibility floor
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F05:USAGE_NOTE]

Read this whenever you add or change something a person **operates**: a button, a field, a menu, a
disclosure, an animation, a color pairing. It is a **floor**, not an aspiration: below it the work is
not finished, however good it looks.

It carries the four normative numbers of this craft, and it is deliberately the one document here
built on **external standards** rather than on project decisions — because a project decision can be
revisited by the council, while a success criterion cannot.

⚠️ Two beliefs that are widespread and wrong are corrected below: what the minimum target size actually
is (→ [F05:TARGETS]), and what `aria-controls` actually does (→ [F05:NAMES]).
Traceability: → [F05:SOURCE_NOTES].

---

## PART 1 — THE FLOOR  [F05:FLOOR]

Eight checks. If any applicable one fails, the task is not ready for review.

- [ ] **Every icon-only control has an accessible name** (→ [F05:NAMES]).
- [ ] **Every form field has a real label**, programmatically associated.
- [ ] **Focus is visible** on everything reachable by keyboard, and the ring itself has enough contrast
      (→ [F05:FOCUS]).
- [ ] **Everything doable with the mouse is doable with the keyboard**, in a sensible order.
- [ ] **Text contrast** ≥ 4.5:1, or ≥ 3:1 if large (→ [F05:CONTRAST]).
- [ ] **Non-text contrast** ≥ 3:1 for controls, their states, and the focus indicator
      (→ [F05:CONTRAST]).
- [ ] **Targets** ≥ 24×24 CSS px, or spaced to compensate (→ [F05:TARGETS]).
- [ ] **`prefers-reduced-motion` honoured** by anything that animates (→ [F05:REDUCED_MOTION]).

**Why this floor is stricter here than in an ordinary project.** Nobody opens these screens with a
screen reader before they ship. There is no review pass that catches a missing name. What is not built
in is not caught later — it is simply absent.

---

## PART 2 — NAMES: the button that says nothing  [F05:NAMES]

**An icon is not a name.** A `<button>` containing only a chevron, a gear or a pencil is announced as
*"button"*, and it cannot be found by label in a test either.

**Give it a name, in Italian, saying what it does — and for what:**

```jsx
aria-label={isExpanded ? `Nascondi dettagli di ${client.name}` : `Mostra dettagli di ${client.name}`}
```

**The house convention already exists**: the icon buttons in the top bar follow the form
`«Apri …»` — `«Apri la ricerca rapida»`, `«Apri le notifiche»`. Follow the neighbours rather than
inventing a wording (→ [F06:LOOK_AT_THE_NEIGHBOURS]).

⚠️ **A real case in this codebase.** The **theme switcher** in the top bar is the only button there
with neither `aria-label` nor `title`: a screen-reader user hears *"pulsante"* and learns nothing, and
tests cannot reach it by label. Every one of its neighbours has one. It is a pre-existing defect, one
line to fix — but **not while you are doing something else** (→ [F07:FOUND_ALONG_THE_WAY]).

### `aria-expanded` carries the state. `aria-controls` mostly does not.

For a disclosure — a chevron that opens a panel — the informative attribute is **`aria-expanded`** on
the button, plus the accessible name.

`[VERIFY]` **`aria-controls` has weak real-world support.** JAWS dropped announcing its presence from
its defaults in **2019**, and from **2020** the setting to re-enable it is gone. Keep the attribute
(it is correct, it costs nothing, and it documents the relationship in the markup) — but **do not rely
on it to tell the user anything**. If the relationship matters, it must be in the name.

---

## PART 3 — FOCUS  [F05:FOCUS]

- **Never remove the focus outline without replacing it.** `outline: none` on its own is one of the
  cheapest ways to make a product unusable by keyboard.
- **Use the house focus ring**: the tokens `--ring` and `--focus-ring-shadow`, and the composed
  `--shadow-focus`. Soft, visible, on the accent (→ [F02:PALETTE]).
- **The ring itself must meet 3:1** against what is adjacent to it — it is a non-text element and falls
  under SC 1.4.11 (→ [F05:CONTRAST]). A focus ring so discreet it is invisible is not restraint, it is
  a failure.
- **Focus order follows the visual order.** If the DOM order and the layout disagree, the layout is
  what needs fixing, not `tabIndex` values scattered to compensate.
- **Never put a positive `tabIndex`.** `0` puts an element in the natural order; `-1` takes it out for
  programmatic focus; anything above `0` rearranges the whole page and is nearly always a bug.

---

## PART 4 — CONTRAST  [F05:CONTRAST]

`[NORMATIVE]` Two criteria, both level **AA**, both mandatory.

| Criterion | Requirement | Applies to |
|---|---|---|
| **SC 1.4.3 Contrast (Minimum)** | **4.5:1** normal text · **3:1** large text | Text and images of text |
| **SC 1.4.11 Non-text Contrast** | **3:1** | User interface components **and their states**, focus indicators, graphical objects needed to understand the content |

**"Large text"** means ≥ 18 pt, or ≥ 14 pt when bold — approximately **24 px** and **18.5 px**.

⚠️ **SC 1.4.11 is the one this product's design compass does not mention, and it is the one that bites
here.** A subtracted interface tends toward faint borders, faint field outlines and a discreet focus
ring — and every one of those is a *user interface component* that owes 3:1. **Subtraction stops at
the contrast floor.** When a hairline is too faint to be seen, it is not elegant, it is
non-conformant.

**Two practical consequences:**

- **Grey text on white is not minimalism.** It is anti-pattern 2 of → [F01:ANTI_PATTERNS], and it is
  also a failed criterion. `--muted-foreground` exists and is calibrated; a lighter grey chosen by eye
  is not.
- **Check contrast in both themes.** A pairing that passes in light can fail in dark, and the reverse
  (→ [F02:DARK_CHECK]).

**The stricter target the compass sets for itself** — aiming at 7:1 for small text with custom colors —
comes from Apple's guidance, not from AA. Treat it as the house ambition; 4.5:1 is the line you may not
cross.

---

## PART 5 — TARGETS  [F05:TARGETS]

`[NORMATIVE]` **Two different numbers, and confusing them is the common error.**

| Number | What it is | Level |
|---|---|---|
| **24×24 CSS px** | SC 2.5.8 Target Size (Minimum) — the **obligation** | **AA** |
| **44×44 CSS px** | SC 2.5.5 Target Size (Enhanced) | AAA |

**The 44×44 figure in this project's design compass comes from Apple's guidelines, not from WCAG.**
The compass marks it correctly as an Apple value. So:

- **24×24 is the floor you may not go below.** If a target is smaller, SC 2.5.8 still passes when the
  targets are **spaced** enough that 24 px circles centred on each do not intersect.
- **44×44 is the house standard for touch**, and a good default for anything on a mobile view. It is an
  ambition, not the norm — so do not report a 30 px desktop control as a WCAG violation, and do not
  claim the norm demands 44 when arguing for a bigger control.
- **A small icon does not need a small target.** Keep the icon at 16 px and give the button padding.
  That is what the top-bar buttons do.

---

## PART 6 — REDUCED MOTION  [F05:REDUCED_MOTION]

`[NORMATIVE]` `[PROJECT-DOC]` When the user has asked the system for less motion, animations are
minimised or removed. This is not a nicety: for some people motion causes real symptoms.

**In CSS:**

```css
@media (prefers-reduced-motion: reduce) {
  .my-thing { transition: none; animation: none; }
}
```

**In JS**, when the animation is driven from code — which is how the house primitives do it:

```js
const prefersReducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

`CollapsibleSection` and `GlassPointer` both already honour it. **Anything you animate must too** —
including a hover lift, a chevron rotation or a skeleton shimmer.

**And the related rule from the design language:** motion is never the *only* carrier of meaning. What
an animation communicates must also be communicated by text, color or state — otherwise a user with
motion switched off loses the message entirely (→ [F03:MOTION]).

---

## PART 7 — WHAT IS OUT OF YOUR HANDS  [F05:LIMITS]

`[SCOPE]` Two honest limits, so that a report from this skill is not read as more than it is.

- **You cannot run a screen reader.** What you can guarantee is the **structure**: names, roles, states,
  order, contrast. Whether the announcement is actually pleasant to hear is verified by the tester on a
  real machine, or by a person.
- **A pre-existing accessibility defect is not your task.** You report it, in the format of
  → [F07:FOUND_ALONG_THE_WAY], and go back to what you were doing. The exception is the code you are
  writing right now, which must be born above the floor.

---

## [F05:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: W3C/WAI *Understanding* pages and
MDN reference pages **fetched and read directly** in this pass; project-specific facts read in
`crmadv` (read-only).

⚠️ **Two premises this skill started with were falsified during the research**, and both would have
entered the skill as facts. They are recorded here because that is the point of the exercise:

1. *"44×44 px is the accessibility minimum for targets"* — **false as a WCAG claim**. The AA minimum is
   **24×24** (SC 2.5.8); 44×44 is **AAA** (SC 2.5.5). The 44 in this project comes from Apple.
2. *"`aria-controls` tells the screen reader what the disclosure opens"* — **false in practice**. JAWS
   removed the announcement from its defaults in 2019 and the setting itself in 2020.

- **SC 1.4.3 Contrast (Minimum), level AA, 4.5:1 and 3:1, with "large text" = 18 pt / 14 pt bold ≈ 24 px
  / 18.5 px**: W3C/WAI, *Understanding SC 1.4.3*,
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html — Tier 1 / **HIGH** (page fetched;
  normative text quoted, including the project's own pt→px conversion note).
- **SC 1.4.11 Non-text Contrast, level AA, 3:1, applying to user interface components and their
  states, focus indicators and graphical objects**: W3C/WAI, *Understanding SC 1.4.11*,
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — Tier 1 / **HIGH** (page
  fetched; normative requirement quoted).
- **SC 2.5.8 Target Size (Minimum), level AA, 24×24 CSS px, with the spacing alternative**: W3C/WAI,
  *Understanding SC 2.5.8*, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html —
  Tier 1 / **HIGH**.
- **SC 2.5.5 Target Size (Enhanced), level AAA, 44×44 CSS px**: W3C/WAI, *Understanding SC 2.5.5*,
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html — Tier 1 / **HIGH**.
- **The 44 pt in this project is an Apple value, not a WCAG one, and the compass marks it as such**:
  `crmadv/archivio-documenti/design-linguaggio-apple-web.md` §3.1 (marked 🍏 = Apple HIG) — Tier 1 /
  **HIGH**.
- **The 7:1 ambition for small text with custom colors is Apple guidance, not AA**: same document §5 —
  Tier 1 / **MEDIUM** (asserted by the project document; the Apple page was not fetched in this pass).
- **`aria-controls` support: JAWS dropped it from defaults in 2019, and the setting is gone as of
  2020**: Adrian Roselli, *Disclosure Widgets*,
  http://adrianroselli.com/2020/05/disclosure-widgets.html — Tier 2 / **MEDIUM** (recognised
  accessibility practitioner, not a normative source; taken from search results rather than a full read
  of the article).
- **The theme switcher lacks both `aria-label` and `title` while all its neighbours have one, and the
  neighbours follow an `«Apri …»` convention**: `crmadv/archivio-documenti/03-roadmap-confronto-e-build.md`,
  *Debito tecnico*, entry of 5/8/2026, which also names the probable file
  (`src/utils/theme-provider/theme-switcher.jsx`) — Tier 1 / **MEDIUM** (project document read
  directly; the component itself was not opened in this pass, and the defect may have been fixed since).
- **`prefers-reduced-motion` is honoured by the house primitives, and the JS detection form used**:
  `src/components/ui/CollapsibleSection.jsx` and `src/components/effects/GlassPointer.jsx`, read
  directly — Tier 1 / **HIGH** `[CODE]`.
- **Focus tokens `--ring`, `--focus-ring-shadow`, `--shadow-focus`**:
  `crmadv/archivio-documenti/design-system-temi.md` and `src/styles/design-tokens.css` — Tier 1 /
  **HIGH**.

VERIFY-ON-FIELD:
- **The theme-switcher defect** was recorded on 5 August 2026. Before reporting it again, check whether
  it has since been fixed.
- **`aria-controls` support in the 2025-2026 screen-reader releases** was not re-checked; the evidence
  is from 2020. The operative conclusion (do not rely on it) is unaffected, but do not cite version
  numbers as current.
- **Whether the house focus ring currently meets 3:1 in both themes** was not measured in this pass.
  If a task touches focus styling, measure rather than assume.

------------------------------------------------------------------------------

End of document — [F05 — The accessibility floor] · crm-design-frontend v1.0
