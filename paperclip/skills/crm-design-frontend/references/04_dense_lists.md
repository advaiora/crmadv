# KNOWLEDGE DOCUMENT — [F04]
# Dense lists and the expandable row
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F04:USAGE_NOTE]

Read this when the task involves **a list of records**: building one, adding a column, making a row
expandable, or fixing one that stutters. This is the richest recipe in the product and the one most
often rebuilt from scratch by someone who did not know it existed.

It is also the place where three separate lessons have already been paid for in this project: the
layout choice, the animation technique, and the render cost. All three are here with their measured
numbers.

Which fields belong in the row and which behind the disclosure is a **design** decision, and it is in
→ [F01:PROGRESSIVE_DISCLOSURE]. The surfaces the list sits on are in → [F03:SURFACES].
Traceability: → [F04:SOURCE_NOTES].

---

## PART 1 — THE RECIPE  [F04:DENSE_LIST_RECIPE]

`[CODE]` The reference implementation is the Clienti list: `src/modules/clients/ui/components/`,
principally `ClientGridRow.jsx`. Read it before building a new one — it is short (under 100 lines)
precisely because the work is distributed the way described here.

**The seven steps:**

1. **Lay the list out as `div`s with CSS Grid, not as a `<table>`.** Columns come from
   `grid-template-columns` on the row container. The reason is measured and is in
   → [F04:WHY_NOT_TABLE].
2. **Keep the semantics with ARIA roles** on those `div`s: `role="table"` on the container,
   `role="row"` on each row, `role="columnheader"` on the headers, `role="cell"` on the cells
   (→ [F04:ARIA]).
3. **First cell: the disclosure button.** A real `<button type="button">` with `aria-expanded`,
   `aria-controls` pointing at the panel id, and an **accessible name that says what it does and for
   which record** — `«Mostra dettagli di Mario Rossi»` / `«Nascondi dettagli di Mario Rossi»`. A
   chevron alone has no name (→ [F05:NAMES]).
4. **Make the row itself open the record**, using the house helper rather than a hand-written
   `onClick` (→ [F04:ROW_ACTIVATION]).
5. **Put the detail panel in `CollapsibleSection`**, with the same `id` the button points at
   (→ [F04:COLLAPSIBLE_SECTION]).
6. **Extract the row into its own `React.memo` component with stable props.** This is not an
   optimisation to add later — without it the list stutters (→ [F04:PERFORMANCE]).
7. **Provide the mobile variant** as a separate memoized component (the pattern here is
   `ClientMobileCard`), and give it its own test.

**The skeleton, reduced to its bones:**

```jsx
const detailId = `client-detail-${client.id}`;

<div className="clients-grid-row" {...rowActivationProps(() => onOpen(client), { role: "row" })}>
  <div className="clients-grid-cell" role="cell">
    <button
      type="button"
      onClick={() => onToggle(client.id)}
      aria-expanded={isExpanded}
      aria-controls={detailId}
      aria-label={isExpanded ? `Nascondi dettagli di ${client.name}` : `Mostra dettagli di ${client.name}`}
    >
      <ChevronRight size={16} />
    </button>
  </div>
  {/* … other cells, each role="cell" … */}
</div>
<CollapsibleSection open={isExpanded} id={detailId}>
  <ClientRowDetails client={client} />
</CollapsibleSection>
```

⚠️ **A generic disclosure button already exists**: `src/components/ui/RowDisclosureButton.jsx`. It
takes `expanded`, `onToggle`, `controlsId` and `label`, builds the two Italian accessible names, and
**stops click propagation** so it does not also trigger the row's navigation. Prefer it to a
hand-written button — the Clienti list predates it and inlines its own, which is history, not a model.

---

## PART 2 — WHY NOT A `<table>`  [F04:WHY_NOT_TABLE]

`[PROJECT-DOC]` Not a matter of taste: it was measured on the Clienti list.

Animating the height of a row inside an HTML `<table>` forces the browser to **re-lay out the entire
table on every frame**. Measured cost: **~4.5 ms** per re-layout with `table-layout: auto`, **~2.7 ms**
with `table-layout: fixed` — enough to make the animation stutter on real machines. Switching to
`div`s in a CSS grid moves the animation into a block formatting context: **~0.1 ms**, roughly **45×
lighter**, and the animation becomes smooth.

`table-layout: fixed` **helps but does not solve it**, so it is not a shortcut around the recipe.

**Use a real `<table>`** when the list is static — no expandable rows, no animation. The grid recipe
exists for the *dense list with disclosure*, not as a blanket replacement for tables.

---

## PART 3 — THE ARIA ROLES  [F04:ARIA]

`[NORMATIVE]` Two things about `role="table"` on `div`s are settled by the reference documentation, and
they matter here:

- **Interactive widgets inside the cells are allowed.** Verbatim from MDN: *"The cells are not
  focusable or selectable, though widgets within individual cells of the table can be interactive."*
  The disclosure buttons, the action menus and the tag editors inside these cells are therefore
  **correct**, not a defect.
- **`grid` is required instead of `table` in three cases**, all named: if the structure maintains a
  **selection state**, if it offers **two-dimensional navigation**, or if it lets the user **reorder
  cells** (drag and drop). None of the three applies to this list.

⚠️ **`role="grid"` is not a relabelling — it is a different keyboard contract.** In a grid only **one**
focusable element is in the page tab sequence and the author must write the focus management (a roving
tabindex). In a table, all focusable elements are in the normal tab sequence. Swapping the role without
writing that machinery makes the component *worse*, not more compliant.

---

## PART 4 — THE OPEN QUESTION: a focusable row  [F04:OPEN_QUESTION_ROW_FOCUS]

`[NOT-FOUND]` The house pattern makes the **row itself** focusable — `tabIndex: 0` plus Enter/Space —
while it carries `role="row"` inside a `role="table"`.

**What the sources say about this exact case: nothing.** MDN speaks only of **cells** ("the cells are
not focusable or selectable") and does not address the focusability of a **row**. The absence protocol
was run only in part — by synonym and by index, not against the normative ARIA specification — so the
result is `[NOT-FOUND]`, and **`[NOT-FOUND]` is not a fact**.

**Therefore, and this is the instruction:**

- **Follow the house pattern.** Uniformity across the lists of this CRM is worth more than an
  unverified semantic improvement, and a divergent list is a second way of doing the same thing —
  which is the defect that always gets worse with time.
- **Do not "fix" it on your own authority.** Changing a shared pattern is a product-level decision, and
  a decision taken at 3 a.m. on an unresolved question is exactly what the gates exist to prevent
  (→ [F07:DESIGN_VS_PRODUCT]).
- **If a task raises the question explicitly**, say what is known and what is not, and park it. Do not
  present the open question as a defect, and do not present the pattern as certified.

---

## PART 5 — ROW ACTIVATION  [F04:ROW_ACTIVATION]

`[CODE]` `src/utils/rowActivation.js` makes a whole row, card or box clickable towards its detail page
**without swallowing the interactive elements inside it**. Use it; do not hand-roll the behaviour.

```jsx
<div {...rowActivationProps(() => history.push(`/apps/clients/${id}`), { role: 'row' })}>
```

**What it gives you:** `role` (default `'link'`), `tabIndex: 0`, an `onClick` that ignores clicks
originating inside an interactive element, and an `onKeyDown` that fires on Enter or Space **only when
focus is on the container itself** — so a button inside the row keeps its own key handling.

**Which elements it already treats as interactive:** `a[href]`, `button`, `input`, `select`,
`textarea`, `label`, `[role="button"]`, `[role="menu"]`, `[role="menuitem"]`,
`[contenteditable="true"]`, and anything carrying `data-row-nav-ignore`.

**To exclude something else** — a custom control that is none of the above — put
`data-row-nav-ignore` on it. That is the supported escape hatch; a `stopPropagation` scattered by hand
is not.

---

## PART 6 — `CollapsibleSection`  [F04:COLLAPSIBLE_SECTION]

`[CODE]` `src/components/ui/CollapsibleSection.jsx` — the progressive-disclosure primitive. Props:
`open`, `id`, `className`, `children`. The open state is controlled by the caller, typically a `Set` of
ids so several rows can be open at once.

**How it actually animates — and this is where the project document is out of date.** The animation
runs on **`transform: translateY`**, on the compositor, not on `height`: the space is reserved or
released in **one** reflow and the content slides in and out. That way the animation never touches page
layout frame by frame, so it does not force repeated painting or re-rasterising of the fixed
`backdrop-filter` layers. The trade-off is deliberate and worth knowing: **neighbouring elements jump
to their final position** instead of growing gradually, because transforms do not move layout.

> ⚠️ `crmadv/archivio-documenti/design-linguaggio-apple-web.md` §3.4 still describes it as *«altezza
> misurata in JS e animata con `transition: height`»*. **The code wins.** This is a live example of the
> rule in → [F00:SKILL_LEVEL_ERRORS]: report the divergence, do not correct the document — that
> document is not yours.

**Three behaviours it already provides**, which you therefore neither reimplement nor break:

- **`prefers-reduced-motion` is honoured** — the animation is skipped entirely (→ [F05:REDUCED_MOTION]).
- **When closed, the content is `inert`** — it leaves the tab order and the accessibility tree, which
  is what stops a screen reader from reading a hidden panel. React 19 accepts a boolean `inert`;
  the old `inert=""` workaround no longer works, because an empty string is `false` for a boolean prop.
- **While animating it puts `ui-collapse-animating` on `<html>`**, and `globals.css` uses that class to
  **suspend the `backdrop-filter` of the fixed layers** for the ~0.28 s of the transition. Removing that
  class, or duplicating the mechanism in a new component, brings back the stutter it was written to
  cure.

---

## PART 7 — PERFORMANCE: the row that stutters  [F04:PERFORMANCE]

`[PROJECT-DOC]` The single most instructive failure in this frontend, because the obvious diagnosis was
wrong.

**The symptom:** the Clienti disclosure animation stuttered — *even after* the layout had been made
featherweight (div grid, 0.1 ms reflow).

**The wrong diagnosis:** assuming a stutter is always CSS or paint.

**The real cause:** a **~462 ms main-thread block on click**. Changing the `expandedIds` state in
`ClientsList` re-rendered **all 24 rows** (12 desktop plus 12 mobile cards, all mounted at once), each
carrying a Bootstrap `Dropdown` (Popper) and a `Modal`. The same DOM change made directly cost 3 ms; the
React toggle cost 462 ms. The whole difference was React.

**The fix:** memoize. The row became a `React.memo` component with **stable props** — the record taken
from an `items` array built in `useMemo`, every callback wrapped in `useCallback`. Opening one row now
re-renders **only that row**. The block dropped from 462 ms to **zero long tasks**. Heavy children
reused down the list (the actions menu) are memoized too.

⚠️ **The memoization fails silently if the parent's callbacks are not stable.** A callback rebuilt on
every render changes the prop identity, `React.memo` compares unequal, and every row re-renders again —
with no error and no warning, just the stutter coming back. The comment at the top of `ClientGridRow`
says exactly this; keep it true.

**How to diagnose one of these, rather than guess:**

| Question | Method |
|---|---|
| Is it JavaScript or paint? | `PerformanceObserver({entryTypes:['longtask']})` during the interaction. A task of hundreds of ms at the click means render, not paint |
| Is the cost in React or in the DOM? | Make the same change via `element.style` / `classList` and time it. Cheap directly but slow through React = the cost is the re-render |
| Where are the dropped frames? | `requestAnimationFrame` timing: ~16-17 ms at rest; the gaps show where |
| Is layout the problem at all? | A loop of N height changes forcing synchronous reflow (`void el.offsetHeight`), time divided by N |

**A secondary cause worth remembering:** a `backdrop-filter: blur()` on a **fixed** element is
re-rasterised on every frame while the page changes layout, producing 30-50 ms frames. That is what
`ui-collapse-animating` exists to suppress (→ [F04:COLLAPSIBLE_SECTION]).

---

## PART 8 — WHAT GOES IN THE ROW  [F04:WHAT_GOES_IN_ROW]

The mechanics above say *how*; the decision of *what* is a design one and lives in
→ [F01:PROGRESSIVE_DISCLOSURE]. Two reminders, because this is where the mechanics tempt you into a
design mistake:

- **The disclosure is a glance, not the record.** It does not replace the detail page, and it should
  not grow into a second one.
- **Never hide a field the user reads constantly.** If the same job now needs a chevron opened, the
  product got worse — anti-pattern 6 of → [F01:ANTI_PATTERNS]. In doubt, it stays in the row.

---

## [F04:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: components and utilities read
directly in `crmadv` (read-only) at the current commit; performance numbers taken from the project's
operating notes, which record measurements rather than impressions; ARIA claims verified against
external reference documentation in this pass.

Standing caveat: the measured numbers (4.5 ms / 0.1 ms / 462 ms) were taken on one machine, on one
list, at one moment. They are cited to justify a **choice of technique**, not as a benchmark to
reproduce.

- **The reference implementation, its structure and the ARIA roles used**:
  `src/modules/clients/ui/components/ClientGridRow.jsx`, read directly — Tier 1 / **HIGH** `[CODE]`.
- **`RowDisclosureButton` exists, is generic, builds the Italian accessible names and stops click
  propagation**: `src/components/ui/RowDisclosureButton.jsx`, read in full — Tier 1 / **HIGH**
  `[CODE]`.
- **`<table>` re-layout cost vs div grid (~4.5 ms / ~2.7 ms fixed / ~0.1 ms, ≈45× lighter), and that
  `table-layout: fixed` mitigates without solving**: operating note #8, and independently stated in
  `crmadv/archivio-documenti/design-linguaggio-apple-web.md` §3.4 — Tier 2 / **HIGH** (two independent
  project sources, and the note records the measurement method).
- **Interactive widgets inside `role="table"` cells are permitted**: MDN, *ARIA: table role*,
  https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/table_role — Tier 1 /
  **HIGH** (page fetched and the sentence quoted verbatim).
- **The three conditions that require `grid` instead of `table` (selection state, two-dimensional
  navigation, cell reordering)**: same MDN page, *Warning* section — Tier 1 / **HIGH**.
- **`grid` implies managed focus (one element in the tab sequence, roving tabindex written by the
  author), whereas in a `table` all focusable elements are in the tab sequence**: W3C/WAI ARIA APG,
  *Grid Pattern* (https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and *Table Pattern*
  (https://www.w3.org/WAI/ARIA/apg/patterns/table/) — Tier 1 / **HIGH**.
- **`rowActivationProps`: default role, `tabIndex`, the interactive-selector list, the Enter/Space
  condition, `data-row-nav-ignore`**: `src/utils/rowActivation.js`, read in full — Tier 1 / **HIGH**
  `[CODE]`.
- **`CollapsibleSection` animates `transform: translateY` and not `height`, reserves space in one
  reflow, marks the closed content `inert`, honours `prefers-reduced-motion`, and sets
  `ui-collapse-animating` on `<html>`**: `src/components/ui/CollapsibleSection.jsx`, read directly
  including its header documentation — Tier 1 / **HIGH** `[CODE]`.
- **`globals.css` suspends the fixed layers' `backdrop-filter` while that class is present, for ~0.28
  s**: operating note #9, which describes the mitigation as adopted — Tier 2 / **MEDIUM** (the
  corresponding rule in `globals.css` was not read line by line in this pass).
- **React 19 supports a boolean `inert`, and the previous `inert=""` workaround stops working because
  an empty string is falsy for a boolean prop**: facebook/react PR #24730 and issue #17157,
  https://github.com/facebook/react/pull/24730 — Tier 1 / **MEDIUM** (search result; the PR was not
  opened in full). The project runs React 19 per `crmadv/CLAUDE.md`, *Stack tecnico*.
- **The 462 ms block, its cause (24 mounted rows with Dropdown and Modal), the 3 ms direct-DOM
  comparison, the fix by memoization with stable props, and the drop to zero long tasks**: operating
  note #9 — Tier 2 / **HIGH** (a measured diagnosis, with the method recorded).
- **Memoization fails silently when parent callbacks are unstable**: the comment at the top of
  `ClientGridRow.jsx`, read directly — Tier 1 / **HIGH** `[CODE]`.
- **The document/code divergence on the animation technique**:
  `crmadv/archivio-documenti/design-linguaggio-apple-web.md` §3.4 against
  `src/components/ui/CollapsibleSection.jsx`, both read directly in this pass — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **Whether a focusable `role="row"` inside a `role="table"` is semantically correct** — see
  → [F04:OPEN_QUESTION_ROW_FOCUS]. Closing it requires reading the normative ARIA specification or
  testing with a real screen reader. **Until then nothing is derived from it.**
- **`aria-controls` is in the recipe but carries little weight in practice**: several screen readers do
  not announce the relationship (→ [F05:NAMES]). Keep the attribute; do not rely on it to convey
  meaning.
- **The exact `globals.css` rule** behind `ui-collapse-animating` was not read. If a new animated
  component needs the same suppression, read it first rather than copying the class name blind.

------------------------------------------------------------------------------

End of document — [F04 — Dense lists and the expandable row] · crm-design-frontend v1.0
