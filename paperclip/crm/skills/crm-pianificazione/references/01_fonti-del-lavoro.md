# KNOWLEDGE DOCUMENT — [R01]
# Where work comes from — the documents that may become issues
# Skill: crm-pianificazione (v1.0) | Internal reference
# Version 1.0

---

## USAGE NOTE  [R01:USAGE_NOTE]

Open this document **before creating any issue**, and whenever you are about to act on something
that is not already an issue. It answers three questions: which documents are allowed to become
work, what to do when they disagree, and what to do with everything else.

It exists because your single most dangerous failure mode is not writing a bad issue — it is
writing a **plausible** one that nobody ever asked for. Traceability and confidence for the claims
below: → [R01:SOURCE_NOTES].

---

## PART 1 — The documents that may become work  [R01:SOURCES_OF_WORK]

Only these. All paths are relative to the repository root (`crmadv`). You have **read access to
the repository**; you read them there, not from memory.

| # | Document | What it is | What it authorises |
|---|---|---|---|
| 1 | `archivio-documenti/decisioni-cliente-e-menu-2026-08-07.md`, **PARTE SECONDA** (§7.3 the work item by item, §7.5 the working order) | The plan of the September release, the current commission | The eleven milestones and everything inside them. **This is where most of your work comes from today** |
| 2 | `archivio-documenti/03-roadmap-confronto-e-build.md` | The versioned roadmap (V1→V13) plus the transversal *«Debito tecnico / tooling»* section | Work belonging to a V, and small already-written technical-debt items |
| 3 | `archivio-documenti/02-brief-operativo-definitivo-bibbia.md` (*«la bibbia»*) | The product truth: what the CRM must eventually be | Nothing on its own. It settles *what a feature means*, never *that it is due now* |
| 4 | `archivio-documenti/team-agenti.md` | The decision register and the archive of discarded alternatives | Nothing on its own. You consult it to avoid re-proposing something already refused |
| 5 | `CLAUDE.md` and `archivio-documenti/note-operative-ai.md` | The working contract and the operational notes | Nothing on its own. They constrain **how** an issue is written, not whether it exists |

Rows 3-5 are **constraints, not backlogs**. Reading the bible and finding a gap does not make the
gap due: it makes it a proposal → [R01:IDEAS_ARE_NOT_WORK].

⚠️ **The release plan lives in two places on purpose.** The roadmap carries a summary of the
release; the detail is in document 1. The roadmap says so explicitly, *"per non avere due copie che
divergono"*. When the two differ, **the detail wins** — and you report the divergence, because a
diverging summary is a defect somebody must fix.

---

## PART 2 — Which one comes first  [R01:PRIORITY]

1. **A commission with a delivery date beats everything.** Today that is the September release:
   *«finché non è chiusa viene prima di qualunque V, compresa quella in corso»*. If a new
   commission with a new deadline arrives, it takes precedence in turn — that rule is written, not
   inferred.
2. **Inside the release, the order is already decided** and is not yours to re-derive
   → [R04:HARD_ORDER].
3. **The V's resume only after the release**, in the order already stated: completion of V5, then
   V6, V7, up to V13.
4. **Technical-debt items are queue fillers, never queue jumpers.** They may be pulled only when
   no unblocked release work remains, and they must already be written, small, and free of any
   decision. This mirrors the rule the project already applies when working unattended: pull only
   *«item piccoli già scritti in roadmap»*, and never open a new V, split an oversized file, or
   touch schema and permissions to fill time.

**What "the queue is empty" means for you.** It does not mean "no issue is open". It means **no
unblocked issue is open**. If everything left is waiting on a board decision, the correct move is
not to create more work: it is to make the pending decisions visible → [R05:GATES]. A queue that
empties into parked decisions is a signal that the board is late, not that the company needs more
issues.

---

## PART 3 — The written test  [R01:THE_WRITTEN_TEST]

Before you create an issue, all four must be true. If you cannot answer with a document, a section
and a line, **you are inventing work**.

1. **Where is it written?** Name the document and the section (e.g. *«§7.3 punto ⑥-ter n.1»*).
   You will copy that pointer into the issue → [R03:ANATOMY].
2. **Is it still current?** Check whether a later dated decision has superseded it
   → [R01:CONFLICTING_SOURCES].
3. **Is it in scope?** The release plan has an explicit out-of-scope list (§7.6). Something
   written there is written **as excluded**, which is the opposite of authorised.
4. **Does it need a decision before it can start?** If yes, the decision is the first piece of
   work, and the implementation issue is blocked by it — not started optimistically.

> Worked example. *«Registro attività»* passes test 1 (§7.3 ⑥), passes 2, passes 3 — and **fails
> 4**: its menu placement *«si decide in un confronto con Jacopo, non da soli»*. So the first issue
> is the decision, the build issues are blocked by it, and nobody discovers this at three in the
> morning halfway through the work.

---

## PART 4 — What is not a source  [R01:NOT_A_SOURCE]

- **Conversations.** Discord messages, comments on other issues, anything said in passing. The
  project's own rule is that questions deserving a decision *«non restano appese in chat (la chat
  finisce), finiscono nella roadmap con le opzioni già istruite»*. The same applies to work.
- **Your own inference from the code.** Reading the repository and concluding that something is
  missing produces a **finding**, not a task → [R01:IDEAS_ARE_NOT_WORK].
- **Generated files.** `archivio-documenti/mappa/mappa-progetto.md` is a photograph produced by a
  script; it tells you *where* things are, never *what* is due. Same for the HTML progress report.
- **Handoffs and the return report** (`archivio-documenti/handoff/`, `rapporto-al-rientro.md`).
  They are historical records of sessions that no longer exist. They may tell you a piece of work
  was interrupted — that is a lead to verify against documents 1-2, not an authorisation.
- **`archivio-documenti/idee-fuori-roadmap.md`.** The name is the rule: ideas kept *outside* the
  roadmap are, by construction, not scheduled.
- **Another agent's opinion**, including a reviewer's. A reviewer returning work is legitimate
  → [R06:WHEN_WORK_COMES_BACK]; a reviewer suggesting a new feature is a proposal like any other.

---

## PART 5 — Ideas, and things found along the way  [R01:IDEAS_ARE_NOT_WORK]

The project has one rule here, and it predates Paperclip: *«le cose trovate per strada vanno nella
roadmap, non nel lavoro in corso»* — written down where it will not be lost, then straight back to
the current objective. On Paperclip the owner of that writing is the **chronicler** (`📋 cronista`),
the only agent who writes in the archive.

**What you do with a finding — the three legitimate moves:**

| The finding | Your move |
|---|---|
| Something to fix or improve, unplanned | A note to the chronicler so it lands in the roadmap. **You do not queue it** |
| Something that changes the shape of planned work (a hidden dependency, a wrong assumption in the plan) | Park it as a decision with options → [R05:PARKING_FORMAT], and block the affected issues |
| An idea of yours about the product | A proposal to the board. Never an assignment, not even to another agent |

⚠️ **Why the ban is absolute for you specifically.** An unattended foreman who is allowed to add
"obviously useful" work will fill the queue with plausible, unrequested tasks, and every other
agent will execute them faithfully. The damage is not the wasted work: it is that the queue stops
being a picture of what was decided. That is why *«non inventa lavoro»* is written as a hard limit
on this trade and not as a preference.

**Negative case, real.** The permission `checklists.complete_item` also covers marking an item as
*«non applicabile»*, which is a terminal state — so whoever holds it can push a project past a gate
without holding the permission created for it (`checklists.override_gate`). This is a genuine
defect, it is written in the plan, and it is written as **out of scope**, with an explicit
instruction: *«Non risolvere d'iniziativa: è una scelta di prodotto»*. A foreman who queues it
because "it is clearly a bug" has broken rule 2 of → [SKILL:HARD_RULES] while being technically
right. Being right is not the test; being written is.

---

## PART 6 — When documents disagree  [R01:CONFLICTING_SOURCES]

This archive is layered: documents from June still sit next to decisions from August. Two rules
resolve almost everything.

1. **The most recent dated decision wins**, and the older text is usually left in place on purpose
   as a record of the reasoning. Example: the plan of 19/8 says the AI test agent *«nasce spento»*
   and has a spending cap; the decisions of 24/8 (§12.6) replace both. Neither is a mistake — the
   later one is simply the one in force.
2. **The code wins over the document about the state of the code.** If a document says a feature
   is missing and you can see it in the repository, the document is stale. Report it; do not queue
   work to build something that exists. The release plan carries a live example of this exact
   correction (§7.6: a list of residual work marked as pending had in fact already been executed,
   with the commits named).

**What you may not do:** resolve a conflict about **what should be built** by choosing. That is a
product decision, and it is the textbook yellow gate — *«una richiesta con due letture possibili
che porterebbero a lavori materialmente diversi»* → [R05:GATES]. Rules 1 and 2 above settle *what
is current*, never *what is wanted*.

---

## PART 7 — How you read  [R01:READING_DISCIPLINE]

- **Read the section, not the document.** These files are large; several are over the size at which
  the project forbids opening a file whole. Cite section numbers, and open those.
- **Start from the generated map** (`archivio-documenti/mappa/mappa-progetto.md`) when you need to
  know where something lives. It is cheap and deterministic. If its date looks old relative to the
  work in hand, treat it as a lead and verify — do not treat it as truth.
- **Never restate a document from memory in an issue.** Quote the pointer and, where it matters,
  the sentence. A session that reads your issue will not have read the plan.
- **You read the repository; you do not change it.** Not the plan documents, not the roadmap, not
  `CLAUDE.md`. The chronicler updates documents; you point at them.

---

## [R01:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the CRM
repository (`crmadv`, read-only) and of the official Paperclip documentation. The CRM documents are
**primary sources** for this skill: they are not commentary about the company, they are the
company's own written decisions.

- **The five documents that may become work, and their roles**: `crmadv/archivio-documenti/`
  (`decisioni-cliente-e-menu-2026-08-07.md` PARTE SECONDA, `03-roadmap-confronto-e-build.md`,
  `02-brief-operativo-definitivo-bibbia.md`, `team-agenti.md`) + `crmadv/CLAUDE.md` §4 — Tier 1 /
  **HIGH** (read directly; `CLAUDE.md` names the bible and the roadmap as the sources of truth).
- **Release beats every V; a new commission beats the release**: `03-roadmap-confronto-e-build.md`,
  *«🚩 FUORI NUMERAZIONE — RELEASE DI SETTEMBRE 2026»* — Tier 1 / **HIGH** (stated verbatim).
- **Detail wins over the summary**: same section, *"il dettaglio si legge lì, ed è lì che va
  aggiornato (per non avere due copie che divergono)"* — Tier 1 / **HIGH**.
- **Queue fillers must be small, already written, decision-free**: `.claude/commands/vado.md` §3
  — Tier 1 / **HIGH** (the rule was written for unattended work, which is this agent's normal
  condition).
- **Menu placement of the activity log is a decision before the work**:
  `decisioni-cliente-e-menu-2026-08-07.md` §7.3 ⑥ and §7.7 point 5 — Tier 1 / **HIGH**.
- **Things found along the way go to the roadmap, not into the work in hand**; questions do not
  stay in chat: `crmadv/CLAUDE.md`, section *«Le cose trovate per strada…»* — Tier 1 / **HIGH**.
- **The chronicler is the only agent writing in the archive**:
  `archivio-documenti/piano-paperclip-2026-08-19.md` §5.7 — Tier 1 / **HIGH**.
- **The foreman does not invent work and does not write code**: same plan, §2.2 (foreman card) —
  Tier 1 / **HIGH**.
- **The `checklists.complete_item` defect is out of scope and must not be fixed on initiative**:
  `decisioni-cliente-e-menu-2026-08-07.md` §7.6 — Tier 1 / **HIGH**.
- **The 24/8 decisions supersede parts of the 19/8 plan**: same plan §12.2 and §12.6 — Tier 1 /
  **HIGH**.
- **A stale "still to do" list already executed on 7/8/2026**, with commits named:
  `decisioni-cliente-e-menu-2026-08-07.md` §7.6 correction of 17/8 — Tier 1 / **HIGH**.
- **The generated map is a script output, not a plan**: `crmadv/CLAUDE.md`, *«Mappa del progetto»* —
  Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **Whether the chronicler agent exists and is running at the time this skill is installed.** Part 5
  routes findings to it. If the company is started without the chronicler, findings must go to the
  board instead, and this document needs one line changed.
- **Whether `idee-fuori-roadmap.md` stays out of scope.** It is treated here as explicitly
  unscheduled on the strength of its name and position; if the board ever promotes it to a backlog,
  Part 4 becomes wrong.

------------------------------------------------------------------------------

End of document — [R01 — Where work comes from] · crm-pianificazione (v1.0)
