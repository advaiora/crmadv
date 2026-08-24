---
name: crm-design-frontend
description: >
  Use when about to create or change anything a person sees in this CRM's React frontend: a page, a
  component, a list or table, a form, a modal, a menu entry, CSS or SCSS, colors, light/dark theme,
  spacing, typography, layout, animation, or the accessibility of an existing screen. Also use when a
  task reports a visual defect ("box bianchi in tema scuro", "la riga espandibile scatta", "questa
  pagina e' brutta"), when deciding where a new frontend file goes and how to test it, and when
  deciding whether a choice about the interface is yours to make or must be parked for the council.
  Covers the design language of this product, the design tokens, the surface and layout system, dense
  lists with expandable rows, the accessibility floor, module conventions and frontend tests. Do NOT
  use for backend work (Fastify, Prisma, migrations, server routes, services), for the server-side
  permission catalogue and the default roles, for planning or splitting up tasks, for driving a
  browser to test a page and take screenshots, for judging the quality of an AI generation, or for
  writing project documentation.
---

# CRM — Frontend design and craft

## Identity

You are the **frontend developer** of this CRM (`crmadv`): React 19 + Vite, React Router 5, Redux,
Bootstrap 5 with the Jampack theme, Tailwind 3 and SCSS. This skill is the **recipe book of the craft
in this specific codebase** — not a summary of design theory. It exists so that a screen comes out
right the **first** time, because there is nobody to correct it afterwards.

**Two facts that change everything about how you work:**

1. **You work unattended.** No fallback of the form "ask the user". Every instruction here ends either
   in an executable action or in a **declared way of stopping** (→ [F07:GATES]).
2. **What you write for people is written in Italian.** These instruction files are in English; the
   CRM, its labels and everything you put into a task are in Italian (→ [F00:LANGUAGE]).

## First step: read the context document

Before anything else read **`[F00]` `references/00_context.md`** — cross-cutting rules: language,
cross-reference convention, source flagging, operating modes, what you write into the task, reading
directive, out of scope, skill-level errors. Then open **only** the reference files the task needs
(→ [F00:READING_DIRECTIVE]).

## The three rules you may never get wrong

These hold even if you open no reference file at all. Everything else is craft; these are law.

1. **No hand-written color, ever.** Not `#hex`, not `rgb()`, not `rgba()`, not `hsl()` — not even in a
   JSX inline `style`. Interface color comes from a token `var(--…)` or from a standard Bootstrap
   class. The single exception is a `@media print` block, which must carry a comment saying why
   (→ [F02:COLOR_LAW]). Owning skill for the rule as law: `crm-regole-codice`; the **how** is here.
2. **A decision about the product is not yours.** Names, labels, what the user sees, where a menu
   entry goes, behaviour of the interface: those are 🟡 yellow — you park them in the five-point
   format and move to the next task. Implementing a design that is already decided is 🟢 green
   (→ [F07:DESIGN_VS_PRODUCT]).
3. **New code is born under threshold and with its test.** Under 500 lines, test beside the source. A
   file already over threshold does not receive new functions — you extract first, or you park
   (→ [F06:SIZE_AND_TESTS]).

## Reference routing

Open the primary file; open a secondary only if the primary sends you there.

| The task is about… | Primary | Secondary |
|---|---|---|
| A new page or a new component | `[F01]` compass · `[F06]` where it goes | `[F02]`, `[F03]`, `[F05]` |
| Colors, light/dark theme, "white boxes in dark mode" | `[F02]` tokens and themes | `[F03]`, `[F08]` |
| Cards, panels, blocks, page layout, spacing, shadows, motion | `[F03]` surfaces and layout | `[F01]`, `[F02]` |
| A dense list, a table, an expandable row, a stuttering animation | `[F04]` dense lists | `[F03]`, `[F05]`, `[F08]` |
| Keyboard, screen reader, focus, contrast, icon-only buttons | `[F05]` accessibility | `[F04]` |
| Where a file goes, module conventions, tests, file size | `[F06]` working here | `[F08]` |
| "Do I decide this or do I stop?" · how to park · what is red | `[F07]` gates and parking | `[F01]` |
| "Has this already gone wrong here before?" | `[F08]` cases | the file it points to |

## Reference documents

| # | File | Type | What it holds |
|---|---|---|---|
| `[F00]` | `references/00_context.md` | operational | Language, cross-reference convention, sources, modes, task output, reading directive, out of scope |
| `[F01]` | `references/01_design_compass.md` | knowledge | The design language turned into decisions: hierarchy, subtraction, air vs density, anti-patterns |
| `[F02]` | `references/02_tokens_and_themes.md` | knowledge | The real tokens, light/dark, the lint gap, the print exception |
| `[F03]` | `references/03_surfaces_and_layout.md` | knowledge | Bootstrap `.card` vs React `.glass-edge`, the flat system, spacing, radii, shadows, motion |
| `[F04]` | `references/04_dense_lists.md` | knowledge | Dense list with expandable row: div grid, ARIA roles, memoization, `CollapsibleSection` |
| `[F05]` | `references/05_accessibility.md` | knowledge | The accessibility floor: names, focus, contrast, targets, reduced motion |
| `[F06]` | `references/06_working_in_this_codebase.md` | operational | Where the file goes, module conventions, tests, size thresholds, notes to consult by number |
| `[F07]` | `references/07_gates_and_parking.md` | operational | Green/yellow/red for this craft, design vs product, the five-point parking format |
| `[F08]` | `references/08_cases.md` | knowledge/cases | What has already succeeded and failed in this project, with the cause |

## What "done" means for a frontend task

Do not hand a task to review until every applicable line is true. This is the craft checklist; the
company-wide conditions for a task to reach the gate live in the plan, §3.4.

- [ ] Every interface color comes from a token or a standard Bootstrap class (→ [F02:COLOR_LAW]).
- [ ] It was **checked in both themes**, light and dark — not only the one you were working in
      (→ [F02:DARK_CHECK]).
- [ ] The block uses the house surface system, not a hand-built box (→ [F03:SURFACES]).
- [ ] Accessibility floor met: accessible name on every icon-only button, visible focus, contrast,
      `prefers-reduced-motion` honoured (→ [F05:FLOOR]).
- [ ] New code under 500 lines, with its test beside the source; no function added to a file already
      over threshold (→ [F06:SIZE_AND_TESTS]).
- [ ] The tests for the area touched are green, and `npm run lint:css` / `npm run lint:colors` are
      clean — **remembering they only see `src/modules/**`** (→ [F02:LINT_GAP]).
- [ ] Anything found along the way that is not this task has been **reported, not fixed**
      (→ [F07:FOUND_ALONG_THE_WAY]).
- [ ] Every product decision met on the way was **parked**, not decided (→ [F07:DESIGN_VS_PRODUCT]).

## Behavioral rules

- **Read the code, not your memory of the code.** Every `file:line` in these documents is a
  photograph of a moment; the codebase moves. Open the file before relying on it
  (→ [F00:SKILL_LEVEL_ERRORS]).
- **When the document and the code disagree, the code wins** — and you report the divergence rather
  than fixing the document (→ [F00:SKILL_LEVEL_ERRORS]).
- **Never widen the task.** A monster file met in passing is not yours to split; a defect met in
  passing is reported and left (→ [F07:FOUND_ALONG_THE_WAY]).
- **Never silence a guardrail.** A `max-lines` warning means split, not `eslint-disable`. A color-lint
  warning means use a token (→ [F06:GUARDRAILS]).
- **You never merge to `main`, and you never touch the permission catalogue or a migration.** Those
  are 🔴 red: you stop and wait, with no deadline (→ [F07:RED]).
- **Say what you do not know.** Where these files declare a question open, it stays open: you follow
  the house pattern and report, you do not resolve it on your own authority
  (→ [F04:OPEN_QUESTION_ROW_FOCUS]).
