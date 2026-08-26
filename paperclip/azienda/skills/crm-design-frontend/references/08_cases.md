# KNOWLEDGE DOCUMENT — [F08]
# What has already gone right and wrong here
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F08:USAGE_NOTE]

Read this **before diagnosing** something — a stutter, a white box in dark mode, a selector that
matches nothing, a layout that will not behave. A good part of what can go wrong in this frontend
**has already gone wrong here**, and the cause was written down.

Also read it before a piece of work that will be **copied later**: the successes below are successes
for a reason that generalises, and the reason is more useful than the artefact.

Every case is written the same way: **what was done → what happened → the cause → the lesson**, with
the document that governs it. Traceability: → [F08:SOURCE_NOTES].

---

## HOW TO READ THESE  [F08:HOW_TO_READ]

**The failures are here at the same weight as the successes, and deliberately.** A skill that only
shows the right answer teaches you to recognise it; it does not teach you to recognise the moment
before the wrong one. Every failure below was committed by someone competent, working carefully, who
had a **plausible reason** — that is exactly what makes them worth reading.

⚠️ **None of these is a task.** Several describe defects that are still open. Finding one in passing
does not make it yours: report it (→ [F07:FOUND_ALONG_THE_WAY]).

---

## PART 1 — WHAT WENT WRONG  [F08:NEGATIVE]

### N1 · The expandable row inside a `<table>`

**Done:** the Clienti list was built as an HTML `<table>`, with rows expanding to reveal details.
**Happened:** the animation stuttered on real machines.
**Cause:** animating a row's height inside a `<table>` forces the browser to re-lay out the **whole
table** on every frame — measured at ~4.5 ms per re-layout (~2.7 ms with `table-layout: fixed`).
`fixed` helped and did not solve it. Moving to `div`s in a CSS grid put the animation in a block
formatting context: ~0.1 ms, roughly 45× lighter.
**Lesson:** the layout element is a **performance decision**, not a semantic one, the moment anything
animates. → [F04:WHY_NOT_TABLE]

### N2 · The stutter that was not CSS

**Done:** after N1 the layout was featherweight, and the animation still stuttered. The hunt continued
in the CSS.
**Happened:** several rounds spent in the wrong place.
**Cause:** a **~462 ms main-thread block on click**. Toggling `expandedIds` re-rendered all 24 mounted
rows, each carrying a Bootstrap `Dropdown` and a `Modal`. The same change made directly on the DOM cost
3 ms. The whole difference was React. Memoizing the row with stable props took it to **zero long
tasks**.
**Lesson:** *"an animation stutters"* does not imply *"the CSS is wrong"*. Measure which side the cost
is on — direct DOM versus React — before optimising either. → [F04:PERFORMANCE]

### N3 · The area stylesheet that overrode the theme

**Done:** the Agency area was given its own stylesheet, `src/views/Agency/agency-ui.css`, defining its
colors as fixed light hex values (`#ffffff`, `#f8fafc`) and imposing them with `!important`, with **no
dark block**.
**Happened:** inside that whole area, boxes and form fields stayed white in dark mode.
**Cause:** two reinforcing mistakes. The colors bypassed the token system — and the area lives under
`src/views/**`, which **neither color linter looks at**, so nothing reported it. The fix was to point
the area's own aliases (`--agency-*`) at the global tokens.
**Lesson:** the color law is not paperwork, and **a clean lint proves nothing outside
`src/modules/**`**. → [F02:COLOR_LAW] · → [F02:LINT_GAP]

### N4 · The selector that matched nothing

**Done:** a CSS override targeting the Dashboard blocks, written as `.dashboard-flat .card`.
**Happened:** it matched **zero** elements. A whole verification round was spent on a rule that could
never fire.
**Cause:** the Dashboard had already been rebuilt on the React primitives, which render
`div.glass-edge` **without** `.card`. The assumption that "a block is a `.card`" was true for the legacy
pages and false for the redone ones.
**Lesson:** before writing an override aimed at blocks, establish which family you are hitting — by
reading the JSX or by counting the matches. → [F03:SURFACES]

### N5 · The file that grew instead of being split

**Done:** the Team invite work added features to `src/views/Team/index.jsx`, already over the 500-line
threshold. The genuinely extractable part **was** extracted, with its test.
**Happened:** the file went 694 → 771 lines on 17 August 2026, and stands at **778** today — 22 lines
from the 800 monster line, past which every future job there costs more.
**Cause:** the rule *"nothing is added to a file already over threshold"* loses to the pressure of a
release, one small addition at a time. Nobody decided to break it; it eroded.
**Lesson:** the threshold is checked **before** adding, not after. If the task legitimately reopens that
file, splitting it is the task's **first step**. → [F06:SIZE_AND_TESTS]

### N6 · The button that says "pulsante"

**Done:** the theme switcher was placed in the top bar with an icon and no text.
**Happened:** it is the only button up there with neither `aria-label` nor `title`. A screen-reader user
hears *"pulsante"*; tests cannot reach it by label.
**Cause:** an icon looks self-evident **to whoever chose it**. All its neighbours have a name, and they
even share a convention (`«Apri …»`), so this was not a house style — it was one omission.
**Lesson:** an icon is never a name. The convention was already there to copy. → [F05:NAMES]

### N7 · Two functions deciding the same thing

**Done:** the quick-search palette (`Ctrl+K`) built its destinations by iterating the `SidebarMenu`
array, with its **own** filter function, `canAccessEntry`.
**Happened:** that copy checks `requiredModule` and `requiredPermission` but **never**
`requirePlatformAdmin`. So any logged-in user is offered `«Console piattaforma»` in the palette,
although the sidebar correctly hides it. Not a security hole — the page and the backend defend
themselves — but a navigation suggestion that should not appear.
**Cause:** a second implementation of a decision that already had one (`canRenderMenuEntry` in
`menuUtils.js`). Two lists deciding the same thing in different ways: the classic defect that only
worsens with time, because each is maintained without the other.
**Lesson:** when a rule already exists as a function, **call it**. Re-implementing it is how the two
copies drift. → [F06:MODULE_ANATOMY]

### N8 · The fallback that can never fire

**Done:** a project header wrote
`project?.clientName?.trim() || workingContext?.client?.name?.trim() || ""`.
**Happened:** when the project does not carry the client name, the header reads *«Cliente non
assegnato»* even though the client exists.
**Cause:** the second branch cannot work — the working context that arrives from the server has **no
`client` key**; the name lives at `project.clientName`. The fallback was written from an assumed shape
rather than a verified one, and it fails **silently**, since the first branch works in the normal case.
**Lesson:** a fallback written against a shape you did not check is not a safety net, it is a lie that
waits. Verify the shape, or do not write the branch. → [F00:SKILL_LEVEL_ERRORS]

---

## PART 2 — WHAT WENT RIGHT  [F08:POSITIVE]

### P1 · The dense list, rebuilt

**Done:** `div` grid with ARIA roles, disclosure button with `aria-expanded` and a full Italian
accessible name, `CollapsibleSection` for the panel, the row extracted into `React.memo` with stable
props, a separate memoized mobile card.
**Happened:** smooth animation, zero long tasks, semantics preserved, and a row component **under 100
lines**.
**Cause of the success:** the work was distributed instead of concentrated. The row is small because
the avatar, the badge, the tags, the actions menu and the detail panel are each their own component
with their own test.
**Lesson:** this is the pattern to copy for any dense list. → [F04:DENSE_LIST_RECIPE]

### P2 · The glass edge applied from one place

**Done:** rather than adding the house edge to hundreds of blocks, `apple-foundation.css` made it the
**default for every `.card` in the application**, resolving the Jampack `.card-border` shorthand
collision once, and sharing the same pseudo-element with the blocks that already carried
`.glass-edge`.
**Happened:** the legacy pages got the house look **without a single JSX file being touched**, with no
double borders, and the whole thing reversible by removing one import.
**Cause of the success:** the problem was solved in the **cascade**, where it is one rule, instead of in
the components, where it would have been hundreds of edits and a migration that never finishes.
**Lesson:** before opening many files, ask whether the change belongs one layer down. ⚠️ And note the
matching gate: precisely because it changes every page at once, such a change is 🟡 yellow
(→ [F07:DESIGN_VS_PRODUCT]). → [F03:GLASS_EDGE]

### P3 · A page experiment turned into a system

**Done:** the "no boxes" layout was tried on the Dashboard. Instead of staying a Dashboard hack, it was
generalised into named classes — `.page-flat`, `.flat-cols`, `.flat-list`, `.glass-sep`, `.flat-keep` —
with the breakpoints and the caveats written in the comments.
**Happened:** it was extended to the clean pages by adding classes, and it carries its own opt-out for
the mixed approach on dense pages.
**Cause of the success:** the generalisation happened **at the second use**, not the fifth — early
enough that the shape was still malleable, late enough that it was known to work.
**Lesson:** the second time you write something, write it as a system. → [F03:FLAT_SYSTEM]

### P4 · The animation changed on evidence, with the trade-off written down

**Done:** `CollapsibleSection` moved from animating `height` to animating `transform: translateY`,
reserving the space in a single reflow.
**Happened:** the animation stopped touching page layout frame by frame, which also stopped the fixed
`backdrop-filter` layers being re-rasterised. The **cost** — neighbours jump to their final position
instead of growing — is written in the file's own header, as a stated compromise.
**Cause of the success:** the change followed a measurement, and the **price** was recorded rather than
hidden. Anyone reading it later knows both what was gained and what was given up.
**Lesson:** write down what a solution costs, not only what it fixes.
✅ **The project's design document has since been corrected — 25/8/2026.** When this case was written it
still described the old technique, which is how the divergence was caught; `design-linguaggio-apple-web.md`
§3.4 now describes the transform-based mechanism, with its reason and its trade-off.
⚠️ **The rule that caught it is unchanged, and it is the part that matters:** when a project document and
the code disagree, **the code wins**, and you report the divergence rather than editing the document from
inside a skill (→ [F00:SKILL_LEVEL_ERRORS]). → [F04:COLLAPSIBLE_SECTION]

### P5 · One helper instead of a pattern re-typed per list

**Done:** "clicking the row opens the record" was written once, in `src/utils/rowActivation.js`, with
the list of interactive elements it must not swallow and an explicit escape hatch
(`data-row-nav-ignore`).
**Happened:** every list in the CRM behaves the same way, keyboard included, and a new one gets it by
spreading props.
**Cause of the success:** the **hard part** was centralised — not "handle the click", but "do not steal
the click from the button, the menu, the link or the input inside the row", which is the part everyone
gets wrong the first time.
**Lesson:** centralise the part that is easy to get wrong, not the part that is easy to write.
→ [F04:ROW_ACTIVATION]

### P6 · The dark-mode fix that did not rewrite the components

**Done:** the Agency area of N3 was repaired by pointing its own aliases (`--agency-*`) at the global
tokens, rather than by rewriting every component that looked suspicious.
**Happened:** the area started following the theme by itself, and the components already correct were
left alone.
**Cause of the success:** before the sweep, someone checked **what the global layer already handled** —
and found that `badge bg="light"`, `btn-light` and `bg-white` in dark were already remapped, so
rewriting them would have been work done for nothing.
**Lesson:** in a cleanup, the first question is *what is already handled*, not *what looks wrong*.
→ [F02:ALREADY_HANDLED]

### P7 · The extraction that did happen

**Done:** during the Team invite work, the deliverable logic was pulled out into
`src/modules/team/ui/inviteDelivery.js`, **with its test**.
**Happened:** the new logic is covered and reusable, and it is out of the oversized file.
**Cause of the success:** the extraction was done **while** writing the feature, when the boundary was
obvious to the person holding it in their head — not postponed to a cleanup pass, when it would have
had to be reconstructed.
**Lesson:** the cheapest moment to extract something is while you are writing it. ⚠️ And the honest
half: this is the good part of N5. The extraction happened and the file **still grew**, because the
feature added more than the extraction removed. Doing the right thing partially still left the file
worse. → [F06:SIZE_AND_TESTS]

---

## PART 3 — THE PATTERN UNDERNEATH  [F08:PATTERN]

Read together, the failures share one shape and the successes share the opposite one.

**Every failure above is silent.** The stutter raised no error. The white boxes raised no lint warning.
The selector that matched nothing returned no error — it simply did nothing. The unnamed button
announces itself perfectly happily as *"pulsante"*. The palette suggests a page it should not, without
complaint. The impossible fallback shows a plausible sentence. The oversized file only emits a warning
that nothing blocks on.

> **In this frontend, what breaks does not shout.** So the question *"did anything go red?"* is a weak
> check, and *"did I verify the thing I assumed?"* is the strong one.

**Every success above moved the work one layer down** — into the cascade, into a shared helper, into a
primitive, into a system of classes — where the decision is taken **once** and cannot be typed
differently the second time.

And **two successes were built on a measurement** (P1, P4), which is the only reason it is known that
they are successes at all.

---

## [F08:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: cases reconstructed from the
project's own records — the numbered operating notes, the roadmap's technical-debt section and the
design compass — and, where possible, **corroborated against the code** in `crmadv` (read-only) at the
current commit.

Standing caveat: several of these describe defects **recorded as open at the date given**. Some may
have been fixed since. Before reporting one as still present, check
(→ [F07:FOUND_ALONG_THE_WAY]).

- **N1** — measurements and the technique change: operating note #8, and
  `crmadv/archivio-documenti/design-linguaggio-apple-web.md` §3.4 — Tier 2 / **HIGH** (two independent
  project sources; the note records the measurement method).
- **N2 / P1** — the 462 ms block, its cause, the 3 ms direct-DOM comparison, the memoization fix and
  the drop to zero long tasks: operating note #9 — Tier 2 / **HIGH**. Corroborated in code by the
  header comment of `src/modules/clients/ui/components/ClientGridRow.jsx` and by the file's size
  (86 lines) — `[CODE]`.
- **N3 / P6** — `agency-ui.css` with fixed hex and `!important` and no dark block; the fix via
  `--agency-*` aliases; and what the global layer already remaps: operating note #14 — Tier 2 /
  **HIGH**. The remapping claims independently verified in `src/styles/scss/globals.css` — Tier 1 /
  **HIGH** `[CODE]`.
- **N4 / P2** — the `.dashboard-flat .card` selector matching zero elements, and the two families of
  block: operating note #3 — Tier 2 / **HIGH**. Corroborated in `src/components/ui/card.jsx` and in
  `src/styles/scss/apple-foundation.css`, blocks 1-2 — Tier 1 / **HIGH** `[CODE]`.
- **N5 / P7** — `views/Team/index.jsx` at 694 → 771 lines on 17/8/2026, and the extraction of
  `src/modules/team/ui/inviteDelivery.js` with its test:
  `crmadv/archivio-documenti/03-roadmap-confronto-e-build.md`, entry *«Dimensione dei file»* — Tier 1 /
  **HIGH**. **The 778-line figure is this pass's own measurement** (`wc -l`, current commit) — Tier 1 /
  **HIGH** `[CODE]`: the file has grown a further 7 lines since the roadmap note.
- **N6** — the theme switcher without `aria-label` or `title`, all its neighbours having one, and the
  `«Apri …»` convention: same roadmap document, entry of 5/8/2026 — Tier 1 / **MEDIUM** (the component
  was not opened in this pass, and the defect may have been fixed since).
- **N7** — `CommandPalette.jsx` iterating `SidebarMenu` with its own `canAccessEntry` (lines 25-33)
  which ignores `requirePlatformAdmin`, against `canRenderMenuEntry` in `menuUtils.js` (lines 56-59),
  and the fact that the page and the backend defend themselves anyway: same roadmap document, entry of
  5/8/2026, found by the explorer — Tier 1 / **MEDIUM** (a detailed project record with line
  references; the files were not opened in this pass).
- **N8** — the impossible fallback in `AgencyProjectPageTemplate.jsx` and the real shape of
  `buildProjectWorkingContext`: same roadmap document, entry of 6/8/2026 — Tier 1 / **MEDIUM** (same
  reason; the record states it was deliberately left unfixed so as not to widen the work in hand).
- **P3** — the flat system generalised from a Dashboard experiment, with its classes, breakpoints and
  caveats: `src/styles/scss/apple-foundation.css`, block 5, read in full including the comment
  recording the origin — Tier 1 / **HIGH** `[CODE]`.
- **P4** — the transform-based animation, the single reflow, the stated compromise, and the divergence
  from the design document: `src/components/ui/CollapsibleSection.jsx` header, read directly, against
  `design-linguaggio-apple-web.md` §3.4 — Tier 1 / **HIGH** `[CODE]`.
- **P5** — `rowActivation.js`: the interactive-selector list, the Enter/Space condition and
  `data-row-nav-ignore`: read in full — Tier 1 / **HIGH** `[CODE]`.

VERIFY-ON-FIELD:
- **N6, N7, N8** are recorded as open as of early August 2026 and were **not** re-verified in the code
  in this pass. Check before reporting any of them again.
- **N5**: the 778-line figure was true at this pass's commit. The file is a moving target — measure,
  do not quote.
- **The `«Apri …»` convention** of the top-bar buttons is asserted by the roadmap entry; the buttons
  themselves were not enumerated in this pass.

------------------------------------------------------------------------------

End of document — [F08 — What has already gone right and wrong here] · crm-design-frontend v1.0
