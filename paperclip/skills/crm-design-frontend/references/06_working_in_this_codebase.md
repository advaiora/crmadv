# KNOWLEDGE DOCUMENT — [F06]
# Working in this codebase
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F06:USAGE_NOTE]

Read this **before creating a file** and **before declaring a piece of work finished**. It answers the
questions that have nothing to do with how a screen looks and everything to do with whether the work
survives: where the file goes, what it is called, how big it may be, what test it carries, and which
of the project's numbered notes to check first.

The laws behind several of these rules live in the sibling skill `crm-regole-codice`, generated from
`crmadv/CLAUDE.md`. This document does not restate them as law — it gives the **frontend way of
obeying them**. Traceability: → [F06:SOURCE_NOTES].

---

## PART 1 — WHERE THE FILE GOES  [F06:WHERE_THE_FILE_GOES]

`[CODE]` The frontend has three homes, and they are not interchangeable.

| Home | What lives there | Notes |
|---|---|---|
| `src/modules/<name>/` | The **modules**: clients, projects, quotes, checklists, dashboard, team, vault, web-assets, agency-os, mail, messaging, roles, departments, audit, integrations, customFields, calendar, sources, admin, core | Where new feature code belongs by default |
| `src/views/<Area>/` | The **pages** wired to the router | Historically the heaviest area, and the one the color linters **do not see** (→ [F02:LINT_GAP]) |
| `src/components/ui/` | The **shared primitives**: `card`, `button`, `input`, `select`, `textarea`, `badge`, `separator`, `skeleton`, `DetailField`, `CollapsibleSection`, `RowDisclosureButton` | Only for something genuinely reusable across modules, and it comes with its test |

**The decision, in one question:** does anything outside this module need it?
No → it stays inside the module. Yes → it is a primitive in `src/components/ui/`, and adding one is a
choice with consequences for the whole product — if it also introduces a new *look*, that is 🟡 yellow
(→ [F07:DESIGN_VS_PRODUCT]).

⚠️ **Watch out for dead files when choosing a name.** `src/views/Calendar/` holds six orphans from the
original theme that nobody imports; their existence once forced a new folder to be named `board/`
instead of `events/`, because on Windows it would have collided with `Events.jsx`. If a name feels
oddly taken, check whether what is taking it is alive.

---

## PART 2 — THE ANATOMY OF A MODULE  [F06:MODULE_ANATOMY]

`[CODE]` The worked example is `src/modules/clients/ui/`. A module that follows it looks like this:

| File | Role |
|---|---|
| `constants.js` | The module key and its permission strings — `CLIENTS_MODULE_KEY = "clients"`, `CLIENTS_PERMISSIONS = { view: "clients.view", … }` — plus the option lists (sort, filters, page sizes) |
| `<Name>ModuleGate.jsx` | The gate: loads workspace access, shows a spinner while loading, an error with a retry, `«Modulo non attivo»` if the module is off, and `«Non hai i permessi necessari per accedere a questa sezione.»` if the permission is missing |
| `<Name>Form.jsx`, `components/` | The screens and their pieces, one component per file, each with its test where it has logic |
| `helpers.js`, `listQueryParams.js`, `use*.js` | Pure functions and hooks — **each with its `.test.js` beside it** |
| `<name>-ui.css` | The module stylesheet, on tokens (→ [F03:WHERE_TO_STYLE]) |

**Two things to copy rather than reinvent:**

- **The permission strings are read from `constants.js`, never typed inline** in a component. That file
  is one of the links in the permission chain, and a string typed twice is a string that will diverge.
- **The gate's four states** — loading, error, module off, permission missing — are all four required.
  A gate that only handles the last one shows a broken page in the other three.

⚠️ **When your work involves a permission**: the frontend links are yours, the catalogue entry and the
roles are not, and they are 🔴 red (→ [F07:RED]).

---

## PART 3 — LOOK AT THE NEIGHBOURS  [F06:LOOK_AT_THE_NEIGHBOURS]

`[PROJECT-DOC]` The naming rule of this project, in the form that applies to the frontend.

**What the user reads is Italian**: page titles, labels, menu entries, buttons, empty states, error
messages. Comprehensible to whoever works in the agency, not to whoever wrote the code. English
survives only where it is the real term of the trade — the vocabulary inside Google Ads and Meta
(*Headline, Primary text, Keyword, Sitelink, Ad Group*, campaign objectives).

**A technical key entering an existing list follows that list's convention**, which today is English:
module keys, permission keys, route paths, activity-log event names. A key out of convention breaks the
code that reads keys **by their ending** — that is not hypothetical, it is how a module once rendered
as `«Server di posta: non accessibile»` even to a Superadmin, because its permission ended in
`.gestisci` and the page recognised only `.view`, `.manage`, `.view_list`.

> **The operative instruction: before naming anything, open the list it will join and look at the
> sixteen already there.** If yours would be the only one shaped differently, yours is the one that is
> wrong. For labels: `SidebarMenu`, the surrounding page. For keys: `server/auth/rbac-catalog.ts`, the
> route table in `src/routes/RouteList.jsx`.

**A label and a key may speak different languages, and that is correct**, not an inconsistency: the
page is `«Server di posta»` on screen and `mail` in the code. Two audiences (→ [F00:LANGUAGE]).

---

## PART 4 — SIZE AND TESTS  [F06:SIZE_AND_TESTS]

`[PROJECT-DOC]` `[CODE]`

**The thresholds.** Over **500 lines** a file must be split; **800** is the monster line, past which the
file is not opened whole. Enforced as an ESLint warning: `max-lines: ['warn', 500]`, plus
`max-lines-per-function: ['warn', 200]`.

> **A `max-lines` warning means split, not lengthen.** Nothing new is added to a file already over
> threshold: you extract first, or you park.

**New code is born with its test.** Always for helpers and pure functions; for components whenever they
carry logic of their own — conditions, variants, states. When you extract logic out of an existing
file, the extracted part gets covered.

⚠️ **Files over threshold exist on purpose — do not tidy them.** There is a census naming every one of
them and who will split it and when, in
`crmadv/archivio-documenti/03-roadmap-confronto-e-build.md`, entry *«Dimensione dei file: il censimento
completo e chi spezza cosa»*. Finding many over threshold does **not** mean the project is untidy: it
means their cleanup is planned elsewhere. Touching a monster file not assigned to your task is 🔴 red
(→ [F07:RED]).

**And the corollary that catches people:** if your task legitimately reopens a file that is already
over threshold, splitting it is the **first step** of that task, not an afterthought — and splitting a
monster is a job of its own, never done in passing.

---

## PART 5 — HOW A TEST IS WRITTEN HERE  [F06:TESTS]

`[CODE]` Vitest with Testing Library, jsdom. The test file sits **beside the source**: `X.test.js` for
a function, `X.test.jsx` for a component. Models to imitate: `src/lib/brandingPalette.test.ts` (pure
function) and `src/components/ui/DetailField.test.jsx` (component render).

**Commands:** `npm run test:frontend` (whole suite), `npm run test:frontend:watch` (while working).
**During the work run only the folder you touched** — `npx vitest run src/modules/<area>`, or the single
file. **The whole suite once**, before the final review, **in the background**, with nothing else heavy
running alongside.

**Test names are written in Italian**, like the rest of what people read: `it('rende etichetta e
valore', …)`.

**Four things about this setup that will otherwise cost you a round:**

- **`@testing-library/user-event` is not installed.** `[VERIFY]` Write interactions with `fireEvent`
  instead, or check `package.json` before importing it — operating note #44 records the failure.
- **`testTimeout` is 15 s on purpose**, because starting jsdom on these machines is chronically slow.
  A red from **timeout**, or from a worker that never started, under load **is not a broken test**:
  re-run the single file before suspecting the code. Only an assertion failure is always real.
- **The pool is `threads`, and `isolate: false` must not be added.** It was tried and it shares the
  module registry between files, breaking the per-file `vi.mock` of the API modules — producing false
  passes, which is worse than false failures.
- **Do not edit files while the suite is running**, and remember that **running dev servers alone can
  make the test workers fail to start** — which looks exactly like a defect in the file you just wrote.

**Before writing a test for a hook**, check operating note #41: `await act(async () => await promise)`
deadlocks when the promise is resolved by an effect. It is a trap you will otherwise rediscover.

---

## PART 6 — GUARDRAILS  [F06:GUARDRAILS]

`[PROJECT-DOC]` The automatic checks that concern the frontend, and the rule that governs all of them.

| Command | What it looks at |
|---|---|
| `npm run lint` | ESLint over the project — includes `max-lines` |
| `npm run lint:css` | Hand-written colors in **module** CSS files |
| `npm run lint:colors` | Hand-written colors in **inline JSX styles**, in modules |
| `npm run test:frontend` | The Vitest suite |
| `npm run mappa` | Regenerates the structural map — sub-second, free, regenerate without thinking |

> **A warning is never silenced.** No `eslint-disable` to quiet `max-lines`; no exception to quiet a
> color warning. Lint blocks only on red, which makes the warnings easy to ignore — and that is
> precisely why the rule is written down.

⚠️ **A clean run of the two color checks does not mean the area is clean**: they only see
`src/modules/**` (→ [F02:LINT_GAP]). In `src/views/**` you search by hand.

---

## PART 7 — NOTES TO CONSULT BEFORE TOUCHING SOMETHING  [F06:NOTES_TO_CONSULT]

The project's numbered operating notes live in the sibling skill `crm-note-operative`. They are cited
**by number**, which is what makes it visible afterwards whether one was consulted. These are the ones
that belong to this craft.

| Before you… | Check note |
|---|---|
| Write a CSS override aimed at blocks or cards | **#3** — two kinds of card, and the selector that matched nothing |
| Make a row expandable, or debug a stuttering one | **#8** (table vs div grid) and **#9** (the cost was the React re-render) |
| Do a light/dark cleanup pass on an area | **#14** — where the colors hide and what is already handled |
| Inspect or toggle the theme | **#22** — the attribute is `data-bs-theme`, not `data-theme` |
| Lay out a container of text with flex | **#25** — `display: flex` breaks the sentence at every tag |
| Rename a frontend file | **#40** — one search pass over the imports can miss occurrences |
| Write a test for a hook | **#41** — the `act` deadlock |
| Reach for `user-event` | **#44** — it is not installed |
| Interpret a red suite | **#46** (running dev servers break the workers) and **#48** (editing files mid-run is a race, not a defect) |
| Write a translation dictionary or a status label map | **#49** — read the enum, do not write from memory |
| Add a new parameter to anything | **#21** — a new parameter must be wired into **all** the routes, not only the ones you are testing |

---

## PART 8 — THE DEVELOPMENT ENVIRONMENT  [F06:DEV_ENVIRONMENT]

`[PROJECT-DOC]` The data server (port 4000) and the page server (port 5173) run **together** — the
frontend alone shows an empty or broken CRM, because the data comes from the API.

⚠️ **The rule that governs them has changed object, and the change is not yet written into
`crmadv/CLAUDE.md`.** That file still says "one session running at a time", meaning the two laptops.
Since **24 August 2026** the whole development environment — database, API and Vite — **lives on the
VPS**, and the plan states explicitly that the rule is to be rewritten when phase 0 runs.

**What follows for you, concretely:**

- **The servers are shared infrastructure, not yours.** They serve everyone working on that machine.
  Do not assume you may start or stop them freely, and never terminate a process that is not yours —
  from a port you see a PID, not an owner.
- **Check the ports are free before starting anything**, and if they are occupied, say so instead of
  starting.
- **Running dev servers can make the test suite fail to start** (note #46). If the suite behaves
  strangely, that is the first thing to check.
- **Do not rewrite that rule in `crmadv/CLAUDE.md`.** It is outside the delivery point and it is not
  yours. Report it (→ [F07:FOUND_ALONG_THE_WAY]).

---

## [F06:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: repository structure, configuration
files and example modules read directly in `crmadv` (read-only) at the current commit; rules and
thresholds cross-checked against `crmadv/CLAUDE.md`, the roadmap and the operating notes.

Standing caveat: this document deliberately **cites** rules that live as law in the sibling skill
`crm-regole-codice` rather than restating them, so that the two cannot drift apart. Where a rule is
quoted here it is because the frontend way of obeying it needed saying.

- **The three homes of the frontend and the list of modules**: directory listing of `src/`,
  `src/modules/`, `src/views/` and `src/components/ui/`, read directly — Tier 1 / **HIGH** `[CODE]`.
- **Module anatomy, the four gate states with their Italian strings, and `constants.js` holding the
  module key and permission strings**: `src/modules/clients/ui/ClientsModuleGate.jsx` and
  `src/modules/clients/ui/constants.js`, read directly — Tier 1 / **HIGH** `[CODE]`.
- **The six dead files in `src/views/Calendar/` and the naming collision that produced `board/`**:
  `crmadv/archivio-documenti/03-roadmap-confronto-e-build.md`, *Debito tecnico*, entry of 5/8/2026 —
  Tier 1 / **MEDIUM** (project document read directly; the files were not re-verified as still
  unimported in this pass).
- **Naming rules ② and ②-bis, and the `.gestisci` failure that produced `«Server di posta: non
  accessibile»`**: `crmadv/CLAUDE.md`, *Come nasce una cosa nuova* — Tier 1 / **HIGH**.
- **Thresholds 500 and 800, and the ESLint rules that enforce them**: `crmadv/CLAUDE.md`, *Dimensione
  dei file*, corroborated in `eslint.config.js` (`'max-lines': ['warn', 500]`,
  `'max-lines-per-function': ['warn', 200]`) — Tier 1 / **HIGH** `[CODE]`.
- **Over-threshold files are deliberate exceptions with an assigned moment, and the census is the
  single source of truth**: `crmadv/archivio-documenti/03-roadmap-confronto-e-build.md`, entry
  *«Dimensione dei file: il censimento completo e chi spezza cosa»*, and `crmadv/CLAUDE.md` which
  points at it — Tier 1 / **HIGH**.
- **Test conventions: file beside the source, the two models to imitate, run only the folder touched,
  the whole suite once in the background**: `crmadv/CLAUDE.md`, *Frontend `.jsx` — regole di
  manutenzione* — Tier 1 / **HIGH**.
- **Vitest configuration: jsdom, `testTimeout: 15000`, `pool: 'threads'`, the explicit ban on
  `isolate: false` with its reason, `setupFiles`, the `@hk-gantt` exclusion**: `vite.config.js`, test
  block read directly, including the comments recording why each choice was made — Tier 1 / **HIGH**
  `[CODE]`.
- **Tests are written with Italian names**: `src/components/ui/DetailField.test.jsx`, read directly —
  Tier 1 / **HIGH** `[CODE]`.
- **`@testing-library/user-event` is not installed**: operating note #44 — Tier 2 / **MEDIUM**
  `[VERIFY]`. Not re-verified against `package.json` in this pass, which is why the document says to
  check before importing rather than asserting it flatly.
- **A timeout red or a worker that never started is not a broken test; running dev servers can prevent
  the workers from starting; do not edit files mid-run**: operating notes #37, #46, #48, and
  `crmadv/CLAUDE.md` — Tier 2 / **HIGH** (all three recorded from real incidents).
- **The guardrail commands and the "never silence a warning" rule**: `crmadv/CLAUDE.md`, *Frontend
  `.jsx`* and *Colori e temi*; the commands themselves read in `package.json` — Tier 1 / **HIGH**.
- **The development environment moved to the VPS on 24/8/2026, and the `CLAUDE.md` rule is to be
  rewritten at phase 0**: `crmadv/archivio-documenti/piano-paperclip-2026-08-19.md` §12.4 — Tier 1 /
  **HIGH** (decision recorded with a date and an author).
- **The two servers must run together, ports must be checked first, and a process that is not yours is
  never terminated**: `crmadv/CLAUDE.md`, *Ciclo di vita dei dev server* — Tier 1 / **HIGH** for the
  rule as written; ⚠️ its **object** has changed (see above).
- **The numbered notes cited in → [F06:NOTES_TO_CONSULT]**: `crmadv/archivio-documenti/note-operative-ai.md`,
  index read directly; notes #3, #8, #9, #14 read in full — Tier 2 / **HIGH** for those four,
  **MEDIUM** for the others (cited by number and title from the index, which is the intended use: the
  note itself is read from `crm-note-operative` at the moment of need).

VERIFY-ON-FIELD:
- **`@testing-library/user-event`**: confirm against `package.json` before either importing it or
  telling someone it is missing.
- **The dev-server rule**: it is stated in `crmadv/CLAUDE.md` in a form that no longer matches reality.
  Until phase 0 rewrites it, treat the *rule* as valid and the *object* as the VPS.
- **The six dead Calendar files** may have been removed since 5 August 2026. Verify with a search
  before relying on their absence or their presence.

------------------------------------------------------------------------------

End of document — [F06 — Working in this codebase] · crm-design-frontend v1.0
