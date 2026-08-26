# KNOWLEDGE DOCUMENT — [R02]
# Cutting the work — what "the right size" means in this repository
# Skill: crm-pianificazione (v1.0) | Internal reference
# Version 1.0

---

## USAGE NOTE  [R02:USAGE_NOTE]

Open this when you have a legitimate piece of plan (→ [R01:THE_WRITTEN_TEST]) and have to decide
whether it is one issue, three issues, or one issue with children.

The bundled **Task Planning** skill already gives you the generic tests — one specialty per child,
one acceptance verdict per child, children understandable on their own. This document gives you
what is specific to this repository: the unit of measure, the splits that are mandatory here, the
splits that would be a mistake here, and what you are forbidden to queue at all.
Traceability: → [R02:SOURCE_NOTES].

---

## PART 1 — The unit of measure  [R02:THE_RIGHT_SIZE]

> **«Un compito, un ramo, un'unione.»** If a task produces more than one merge, it was two tasks.

And the principle it inherits from the unattended-work command: **the unit of work is the piece,
not the minute.** A piece is valid only if it ends at a point where the tree is coherent and
committable. Time never cuts a piece: it only decides whether to start another one.

**The five tests. An issue is the right size when all five pass.**

| # | Test | Fails when… |
|---|---|---|
| 1 | **One trade.** One specialty owns it start to finish | backend and frontend must coordinate *inside* it → split into two issues with a blocker between them |
| 2 | **One acceptance verdict.** A reviewer says yes or no, never "half done" | you catch yourself writing two independent "done when…" lines |
| 3 | **One branch, one merge.** It closes with a coherent tree | you can only describe the end state as "the first part is in, the rest follows" |
| 4 | **Self-contained.** Executable from its own title and description, without re-reading the parent | it says "continue the work of PC-14" |
| 5 | **Testable where it lands.** The tests of the touched area can go green on it alone | the only way to prove it works is to finish another issue first |

⚠️ **When something cannot be cut this way, it is one issue — a big one.** Do not manufacture a
split that leaves the repository in a state that is neither the old one nor the new one. That
intermediate state is the specific damage this project has been avoiding for a year.

---

## PART 2 — Calibrating against real work  [R02:CALIBRATION]

Do not size by intuition; size by comparison. The register of past work
(`archivio-documenti/consumi/registro-compiti.md`) records duration and cost of comparable work in
this repository, and it says something you must build into every estimate: **more than half of a
task's elapsed time can be test rounds and a slow machine.** Compare against similar entries, then
allow for that.

Two consequences for how you cut:

- **A task that looks like "half a day" and touches tests, migrations or the permission chain is
  not half a day.** Prefer the smaller cut when the tests are heavy.
- **Round trips are the real cost signal, not size.** The number that reveals a badly cut issue is
  how many times it comes back → [R06:ROUND_TRIPS].

**New code is born under the threshold and with its test.** 500 lines is the split threshold, 800
is the monster threshold. A warning about file length means *split*, not *extend*: **functions are
not added to a file already over the threshold** — something is extracted first. So when planned
work must add to an oversized file, and that file is assigned to the V you are planning, **the
extraction is the first issue of that V**, and the feature issue is blocked by it. That order is
already written; you are applying it, not inventing it. When the file is *not* assigned to the work
in hand → [R02:WHAT_YOU_MAY_NOT_QUEUE].

---

## PART 3 — Splits that are mandatory here  [R02:MANDATORY_SPLITS]

**① A database migration is always its own issue.** *«Una migrazione del database non sta mai su un
ramo lungo»*: two branches carrying two migrations merge and the database no longer knows the order
to apply them. So a migration issue is deliberately short-lived, planned to merge first and fast,
and it is a red gate → [R05:GATES]. Everything built on top of it is blocked by it, not bundled
into it.

**② A decision is its own issue, before the work it blocks.** Menu placement, a name, a product
behaviour with two readings: the decision is planned as work, the implementation is blocked by it.
Never plan the implementation and "ask along the way" — there is nobody to ask at three in the
morning → [R05:PARKING_FORMAT].

**③ Work that is three works.** The plan already names one: milestone ⑤ (Clienti) is
*«campi nuovi → import (allegato + anteprima + Excel) → ricollocazione dei campi personalizzati»* —
three distinct pieces in one milestone line. A milestone is not an issue: read the milestone, then
cut.

**④ Storage work is not a finishing touch.** Milestone ⑧ carries message attachments alongside
yellow polish items, and the plan says explicitly they are **not** polish: they need file
retention — table, upload, permissioned download, limits — *«vanno affrontati per primi dentro
quel punto»*. Cut them as their own issues and order them first inside the milestone.

---

## PART 4 — Splits that would be a mistake here  [R02:ANTI_SPLITS]

These belong **inside** the issue that creates the feature. Splitting them into "we'll add it
after" is how this project produced its most expensive defects.

- **The permission is born with the piece of CRM.** Rule ①: when a route, an area or an action that
  not everyone may perform is added, its entry in the catalogue (`server/auth/rbac-catalog.ts`) is
  created **in the same work**. A forgotten entry is *«una funzione che nessun ruolo può
  governare»*, and it stays invisible until someone needs it.
- **The predefined roles are updated in the same work.** Rule ①-bis: the five system roles are
  reviewed for every new permission, and if existing custom roles must receive it too, the data
  migration goes in the same work. *«Che serva una migrazione non è un buon motivo per rimandare.»*
  (The migration itself still travels as its own issue per → [R02:MANDATORY_SPLITS] ①, but it is
  planned **together** with the permission, not later.)
- **The test is born with the code.** Not a follow-up issue.
- **The whole link chain.** When the explorer's map lists five places to touch, those five are one
  issue. Splitting the chain is precisely how a change ends up working at half — the silent failure
  this company is built to prevent.

---

## PART 5 — Children or siblings  [R02:SUBTASKS]

- **A child** (`parentId`) is a detail *inside* the same committable piece — the plan's own example
  is *«Test del vincolo di robustezza»* under the password issue. It does not get its own merge.
- **A sibling** is anything that closes with its own commit. It gets its own issue and, where the
  order matters, its own blocker.

⚠️ **Nesting does not sequence anything.** *"Parent/child nesting alone does not block execution."*
A child is not "after" its parent unless you say so with a blocker → [R04:ENCODE_DONT_NARRATE].
This is the easiest planning mistake to make on this platform, and it fails silently: the work
simply starts in the wrong order.

---

## PART 6 — What you may not queue at all  [R02:WHAT_YOU_MAY_NOT_QUEUE]

1. **The restructuring of files over the size threshold that are not part of the work in hand.**
   They are out of norm on purpose and each has an assigned moment: split by the V that touches
   them, or by V13, or never (theme, schema, tests, generated files). *«Non sono un arretrato da
   smaltire appena lo si nota.»* An unattended agent that "tidies up while it's there" does more
   damage than one in a conversation, because nobody sees it happen.
   ⚠️ **The prohibition is on restructuring, not on contact.** An issue whose real work happens to
   include a one-line edit inside an out-of-norm file is a normal issue: do not split it, do not
   gate it, do not write the file's size into its acceptance criteria. Reading the rule the strict
   way is a measured failure, not a hypothetical one → [R05:OVERSIZE_READING].
2. **Anything on the out-of-scope list** of the release (§7.6). Written there means written as
   excluded → [R01:THE_WRITTEN_TEST].
3. **A new V while the release is open**, and generally anything that jumps the priority
   → [R01:PRIORITY].
4. **Work invented to fill an empty queue** → [R01:IDEAS_ARE_NOT_WORK].
5. **Cleanup issues without observable acceptance criteria.** If you cannot say what "done" looks
   like from outside, it is not an issue yet.
6. **Anything you would assign to yourself.** You plan; you do not execute.

Worked examples of good and bad cuts, with their causes → [R07:CASES].

---

## [R02:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the CRM
repository (read-only) and of the official Paperclip documentation. CRM documents are primary
sources: they are the company's own written decisions.

- **«Un compito, un ramo, un'unione»; a task producing more than one merge was two tasks**:
  `archivio-documenti/piano-paperclip-2026-08-19.md` §7.3 — Tier 1 / **HIGH** (verbatim).
- **The unit of work is the piece, not the minute; a piece must end committable**:
  `.claude/commands/vado.md`, opening principle and §2 — Tier 1 / **HIGH** (verbatim).
- **One child issue per specialty / per acceptance verdict; children understandable alone; no
  cleanup issues without acceptance criteria**: Paperclip bundled skill *Task Planning*,
  `docs.paperclip.ing/reference/skills/bundled/paperclip-operations/task-planning` — Tier 1 /
  **HIGH** (verbatim).
- **Nesting does not block execution**: same source, and `skills/paperclip/SKILL.md` in
  `github.com/paperclipai/paperclip` — Tier 1 / **HIGH**.
- **More than half of a task's time can be test rounds and slow machine; compare with similar
  entries**: `.claude/commands/vado.md` §3.2, quoting
  `archivio-documenti/consumi/registro-compiti.md` — Tier 1 / **HIGH**.
- **Thresholds 500/800; a warning means split, not extend; no functions added to a file already
  over threshold; out-of-norm files have an assigned moment and are not to be fixed on initiative**:
  `crmadv/CLAUDE.md`, section *«Dimensione dei file»* — Tier 1 / **HIGH**.
- **A migration never travels on a long branch, and is a red gate**:
  `piano-paperclip-2026-08-19.md` §7.3 and §3.2; `crmadv/CLAUDE.md` §2 — Tier 1 / **HIGH**.
- **Rules ① and ①-bis (permission and predefined roles born with the feature; data migration for
  custom roles; "not a good reason to postpone")**: `crmadv/CLAUDE.md`, section *«Come nasce una
  cosa nuova»* — Tier 1 / **HIGH**.
- **Milestone ⑤ is three distinct works; attachments in ⑧ are not polish and come first**:
  `archivio-documenti/decisioni-cliente-e-menu-2026-08-07.md` §7.5 — Tier 1 / **HIGH** (verbatim).
- **New code is born with its test**: `crmadv/CLAUDE.md`, frontend maintenance rules — Tier 1 /
  **HIGH**.
- **The example sub-issue «Test del vincolo di robustezza»**:
  `piano-paperclip-2026-08-19.md` §8.2 — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **The size register keeps being fed on Paperclip.** Part 2 assumes
  `registro-compiti.md` stays meaningful. The plan replaces its tooling
  (`npm run consumi:compito` → Paperclip's own duration and cost, plus which agents were involved
  and how many review rounds). Until that replacement exists, calibration data may go stale, and
  estimates should lean conservative.
- **The automatic size check covers only `src/**/*.{js,jsx}`.** On the backend the threshold is a
  working rule, not a lint failure — so a backend file can cross it without any tool saying so.

------------------------------------------------------------------------------

End of document — [R02 — Cutting the work] · crm-pianificazione (v1.0)
