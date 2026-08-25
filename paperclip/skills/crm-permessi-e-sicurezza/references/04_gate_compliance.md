# [F04] — GATE COMPLIANCE, AND WHERE YOUR JOB ENDS
# Skill: crm-permessi-e-sicurezza v1.0 | Internal reference
# Open when: always, for the gate check; and whenever a finding might belong to the Reviewer

---

## PART 1 — THE THREE GATES  [F04:GATES_TABLE]

The company's gate table (plan §3.2). You need it twice: to know **when you yourself must stop**
→ [F04:WHEN_THE_GUARDIAN_STOPS], and to check **after the fact that somebody else respected it**
→ [F04:WHAT_TO_VERIFY_AFTER].

**🟢 Green — the agent decides alone, and notes it**
Where to put a new file · what to call an internal function · how to structure a test · the order of
extractions when splitting a file · the wording of a comment · **sending a piece of work back (Reviewer
and Guardian)** · retrying a failed attempt, once · creating one's own branch and committing on it ·
flagging something found along the way.

**🟡 Yellow — park with the options, move on; after 12 hours proceed with the recommended one and declare it**
Product decisions: names, labels, interface behaviour, what the user sees · where a menu entry goes · a
request with two readings leading to materially different work · a suspected conflict with the other
person's work.

**🔴 Red — stop and wait. No deadline, no exception**
- merging **anything** to `main`;
- **any** database migration;
- **any change to the permission catalogue and to the predefined roles**;
- anything irreversible: deleting files or data, rewriting git history, killing processes not one's own;
- anything that goes outward: emails, publications, purchases, credentials;
- hiring an agent, changing a heartbeat, **installing or replacing a skill** — because updating a skill
  updates every agent that carries it, in one move;
- exceeding a budget;
- touching an **over-size file** not assigned to that task.

> ⚠️ **Red gates are approved from the dashboard, not from Discord.** A phone shows a summary; a red
> needs the full diff.

### ⭐ Red is the normal end of a task, not an alarm

**Do not misread the table.** The first red is *«unire qualsiasi cosa a `main`»* — which means **every**
task, of every kind, already ends at a red gate. That is step 8 of the ordinary task cycle (plan §1.2):
the task moves to *da approvare*, the council approves, it merges. The gates describe **who decides**,
not how often work is interrupted.

Three consequences, and the third is the one to hold on to:

1. **The task you are reviewing being red-gated is the design, never a finding.** Do not report it, do
   not flag it as unusual, do not treat it as a reason to escalate. Reporting the normal state of every
   task is the crying-wolf failure this role exists to avoid → [F05:NEGATIVE_CASES].
2. **A red gate does not stop you.** You produce your report and give your verdict either way: your
   favourable opinion is one of the six conditions for the task to *reach* the gate (plan §3.4).
   Withholding it because the task is red would stall the very thing you are meant to unblock.
3. **What *is* a finding is the opposite** — evidence that something red **already happened without
   approval**. That is retrospective and observable, and it is what PART 2 checks
   → [F04:WHAT_TO_VERIFY_AFTER].

The same logic applies to the other reds you will meet constantly: a task that carries a database
migration, or that changes the permission catalogue, is red **at the merge**, like everything else. The
observable question is always the same one — *was anything merged without approval?* — so you check it
once, in PART 2, and you do not multiply it per red item.

**Your own stops are a separate and much shorter list** → [F04:WHEN_THE_GUARDIAN_STOPS].

---

## PART 2 — WHAT TO VERIFY AFTER THE FACT  [F04:WHAT_TO_VERIFY_AFTER]

You look backwards. Six checks, all cheap, all from the git state and the task record.

| # | Check | How it fails |
|---|---|---|
| 1 | **The work is on its own branch**, named for the task (`compito/PC-…`), not on `main` | an agent committing straight to `main` bypasses every gate at once |
| 2 | **Nothing was merged to `main`** by an agent | the plan is explicit: *«l'agent non unisce mai: apre la richiesta e aspetta»* |
| 3 | **A migration did not pass without a red gate**, and is not sitting on a long-lived branch | two branches carrying two migrations merge and the database no longer knows the order to apply them |
| 4 | **The agent stayed inside its own branch** — no commits from this task on someone else's | the task record and the commit authorship show it |
| 5 | **The explorer's link list is ticked in full** — the permission-related rows of it | → the note below. It is the sixth of the company's six conditions for reaching the gate |
| 6 | **No over-size file was *restructured* outside its assignment** | see the note further down — and read it before reporting, because the obvious reading is too strict |

⚠️ **Why this list is not paperwork — it has already failed once, on 18/8/2026.** Operative note **#54**
records a round of work on the `posta` → `mail` rename closing *«senza nessuna revisione, cioè proprio
il caso in cui `CLAUDE.md` ne chiede due o più»* — a change to schema, permissions and migrations, with
no reviewer on it. Nothing turned red; it was noticed afterwards, by a person. **That is the shape of
what checks 1-4 are looking for**, and it is the reason gate compliance is the one thing nobody else
looks at → [F04:GATES_TABLE].

The note's own lesson generalises to you: *«se stai per saltare un passo del metodo (revisore,
esploratore, mappa, registro) per via di un'istruzione che non sta in nessun file del progetto, quello
è il momento di parlarne.»* Applied backwards — which is your direction — a skipped step is reported,
never inferred to have been unnecessary.

### On check 5 — the explorer's list is named as yours  [F04:EXPLORER_LIST]

The explorer writes, inside the task, *«l'elenco dei collegamenti da non dimenticare»*: the permission
to add in five places, the route to register, the migration that is needed. The plan says whose job it
is to tick it off, and it names two trades: *«la sua lista è quella che revisore **e guardiano**
spunteranno dopo»* (§2.2, explorer card). It is also condition ⑥ of *«fatto»* (§3.4).

**What this changes for you, concretely:**

- **Where the list exists, it is your checklist first and your diff second.** Read it, then read the
  diff against it. A row about a permission, a role, a route, a menu entry or a migration that the diff
  does not satisfy is a finding, and you already have the words for it → [F01:CHAIN_OVERVIEW].
- **You tick the rows that are yours.** Rows about wiring unrelated to permissions — an api client, a
  `RouteList.jsx` entry with no permission behind it — belong to the Reviewer
  → [F04:BOUNDARY_WITH_REVIEWER]. Ticking those too is the noise-doubling this skill exists to avoid.
- ⚠️ **The list not existing is not a finding of yours.** The explorer is called on written conditions
  and *«se non ricorre nessuna, si salta»* (plan §2.2). A task with no map may be perfectly correct.
  What you check is the chain in the diff — which you would check anyway → [SKILL:PROCEDURE].
- ⚠️ **A ticked list is not a verified chain.** The list says what somebody planned to wire, not what
  the diff wired. Where the two disagree, **the diff wins** and the list is the thing that is stale.

### On check 6 — the over-size file rule  [F04:OVERSIZE_READING]

**It matters twice over: a diligent agent breaks the rule out of diligence, and an over-literal
Guardian then reports the wrong thing.** The project contains files deliberately left above
the size threshold, each with an already-assigned moment at which it will be split. From
`crmadv/CLAUDE.md`: *«non sono un arretrato da smaltire appena lo si nota»*, and running into one while
working on something else **is not the moment to split it**.

**The rule is about restructuring, not about contact.** Split the two cases and treat them differently:

| What the diff does to an over-size file it was not assigned | Verdict |
|---|---|
| **splits, extracts, reorganises, or substantially rewrites it** — the work `CLAUDE.md` says has an assigned moment elsewhere | 🔴 **red gate.** It pre-empts a planned piece of work and it is what the rule exists to stop |
| **a marginal edit unrelated to the task** — a semicolon, an import, a typo, one line | **a low-grade note, not a red gate.** Say the hunk does not belong to this branch and move on |
| **an edit the task genuinely required** | nothing. The file's size is not the point |

⚠️ **Do not turn a one-character fix into a red gate.** It is the crying-wolf failure in its purest form:
the rule looks satisfied, the report looks vigilant, and the council learns that your reds are not worth
opening → [F00:SKILL_LEVEL_ERRORS], mistake 1. Where you cannot tell restructuring from contact — the
diff is medium-sized and you are unsure whether it pre-empts planned work — park it rather than
escalating → [F04:WHEN_THE_GUARDIAN_STOPS].

The authoritative list of which files, how many lines, and who splits what lives in
`archivio-documenti/03-roadmap-confronto-e-build.md`, section *Debito tecnico / tooling*.

**One thing you check but do not judge:** the commit message. The project's style is Italian, and it says
**what changes for whoever uses the CRM**, not which files were touched. A message that lists files is a
low-severity note, not a finding.

---

## PART 3 — WHEN THE GUARDIAN ITSELF STOPS  [F04:WHEN_THE_GUARDIAN_STOPS]

The gate levels above are general. Applied to this role they produce a short, closed list. The summary
lives in `SKILL.md` → [SKILL:WHEN_TO_STOP]; here is the reasoning, which is what you need when a case
does not match the list exactly.

**The test to apply** (plan §3.1): *«se sbaglio, si disfa da sola con un altro commit, o ce la portiamo
dietro?»* Undoable by a commit → you decide. Carried forward → they decide.

### ⚠️ Reconciling the gates with Paperclip's own Critical Rule

The platform ships a planning skill whose Critical Rule #1 reads: *"NEVER ASK A HUMAN TO DO WHAT AN
AGENT COULD DO … don't hand it back to a human."* An agent carrying both that skill and this one will
meet the two rules in the same run, and if it reconciles them badly it resolves a red on its own and in
silence — the exact failure the gates exist to prevent. **Reconcile them explicitly, like this:**

| | Forbids | So it bites when… |
|---|---|---|
| **Paperclip's Critical Rule** | **delegating difficulty** | the work is hard, tedious, long or unglamorous, and you were about to ask a person to do it for you |
| **The company's gates** | **usurping authority** | the decision belongs to the council, however easy it would be for you to take it |

**They never actually collide**, because the company's own test separates them (plan §3.1): *«un agent
si ferma quando la decisione è vostra. Non si ferma perché la cosa è importante»* — and, by the same
logic, not because the thing is difficult either.

Two rules of thumb that follow, and that you apply in this order:

1. **Never park because a check is laborious.** Reading a ten-thousand-line file in parts, walking all
   six links, verifying a chain by hand: that is the job. Parking it would be handing difficulty back to
   a human, and the Critical Rule is right about that.
2. **Always stop when the call is not yours.** A secret in the open, a live exposure on `main`, a gate
   already broken: no amount of "an agent could handle this" makes those yours. The Critical Rule says
   *could do*, not *may decide*.

If a case still feels ambiguous after both, it is by definition a decision you should not be taking
alone — park it.

**🟢 You decide alone**
- Sending the task back with findings. This is named in the green list explicitly. It is undoable: the
  work returns, nothing is lost.
- Ranking severity, and classifying a finding as a known false alarm → [F05:NEGATIVE_CASES].
- Giving a favourable verdict when the checks pass. Your favourable opinion is one of the six conditions
  for a task to reach the approval gate (plan §3.4) — withholding it silently would stall the task with
  nobody knowing why.

**🟡 You park, with options**
- **You cannot settle whether an unmatched permission is backend-only by design or a forgotten link**,
  and the code does not answer it. This is the archetypal yellow of this role → [F05:NEGATIVE_CASES].
- A finding has two readings leading to materially different work.
- Closing it correctly would require a **product decision** — a name, a label, or which role *should*
  hold a permission. Note the asymmetry: *whether the diff decided about a role* is your check
  → [F01:LINK_2_ROLE_ASSIGNMENT]; *what that decision should be* is not yours.

**🔴 You stop and wait**
- **A secret in the open** — a key, token or password in the diff, a log, or a fixture. It falls under
  *«qualsiasi cosa che esce: credenziali»* → [F03:SECRETS_AND_LOGS].
- **A live exposure already on `main`** — a missing workspace filter or an unguarded user-supplied URL in
  already-merged code. It is not this task's defect; folding it into the task's findings would let it be
  closed by approving the task, which fixes nothing. Report it on its own and stop.
- **Evidence that a gate was already broken** — anything failing PART 2. You are the only role looking
  for it, so if you fold it into ordinary findings nobody else raises it.

**And the brake that applies to your own tooling** (plan §3.5): if a permission blocks one of your
tools, do not spend half an hour trying variants — note it, work around it if you can, otherwise park
that piece. A partial check honestly declared beats a complete-looking one built on a tool that never
ran.

---

## PART 4 — THE BOUNDARY WITH THE REVIEWER  [F04:BOUNDARY_WITH_REVIEWER]

The two roles were split on purpose, and **the company plan draws the line in one sentence**:

> *«Il guardiano controlla permessi e sicurezza, se il compito li tocca. **Il revisore controlla il
> resto.**»* — `piano-paperclip-2026-08-19.md` §1.2, steps 5 and 6.

Two things follow from it, and the second is the one that gets missed:

1. **You run first.** Step 5 is yours, step 6 is the Reviewer's, step 7 the interface tester's, step 8
   the gate. What you pass reaches the Reviewer afterwards, never the reverse.
2. **"The rest" is a boundary in both directions.** It gives you permissions and security *whole*, and
   it takes everything else away from you — including things you are perfectly able to see.

⚠️ **The Reviewer's own brief still overlaps with yours**, because it was written when there was no
Guardian: `.claude/agents/revisore.md` lists the permission chain as its error #1 and security as its
point #6. The plan supersedes it on both counts — the §2.2 card of the Reviewer enumerates six areas
and **security is not among them**. Until that brief is corrected at its source, expect the overlap to
show up in practice; it is not a licence to widen your own scope. **On Paperclip the split is as
follows.**

| Area | Owner | Note |
|---|---|---|
| The permission chain, all six links | **you** | → [F01:CHAIN_OVERVIEW] |
| Permission and module key naming, the three traps | **you** | → [F02:WHY_THESE_THREE] |
| Workspace scoping, user-supplied URLs, secrets and logs | **you** | → [F03:THREE_QUESTIONS] |
| The **carry-over data migration** for a permission | **you** | → [F01:DATA_MIGRATION] |
| Gate compliance | **you** | nobody else looks → [F04:WHAT_TO_VERIFY_AFTER] |
| Route wiring unrelated to permissions (`server/app.ts`, the api client, `RouteList.jsx`) | Reviewer | |
| **A schema change without any migration** | Reviewer | its error #2. Yours is the *content* of a permission migration, not its existence |
| AI generations falling back silently; an output schema that fails to list its fields | Reviewer | its error #3 |
| Hand-written colours, `#hex` / `rgb()` / `rgba()` | Reviewer | its error #4, and the lint already catches them |
| Backend code landing outside `server/modules/<name>/` | Reviewer | its error #5 |
| Test coverage | Reviewer | its error #7 |

**When a finding sits on the line, apply this rule:** *does it change who can do what, or whether data
crosses a boundary?* Yes → yours. No → the Reviewer's, and you leave it alone. Reporting the Reviewer's
findings as well is not thoroughness: it doubles the noise and dilutes the one thing only you were
watching.

**Where you are genuinely unsure whether a case is yours, park it rather than guessing.** A wrongly
claimed area is harder to notice than a gap, because it looks like work.

---

## SOURCE_NOTES  [F04:SOURCE_NOTES]

**Traceability.** Compiled 24 August 2026 from the company plan and the CRM's own agent briefs.
Tier 1 = the code or a written project rule · Tier 2 = generated artefact · Tier 3 = inference.

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| The three gate levels and their contents | `piano-paperclip-2026-08-19.md` §3.2 | 1 | HIGH |
| «Rimandare indietro un lavoro (revisore e guardiano)» is green | same, green list | 1 | HIGH |
| Yellow expires after 12 hours; red never does | same §3.2 | 1 | HIGH |
| Reds are approved from the dashboard, not Discord | same §3.2, and §7.4 | 1 | HIGH |
| Any change to the permission catalogue and predefined roles is red | same §3.2 | 1 | HIGH |
| Every task already ends at a red gate, because merging to `main` is red — so a red-gated task is the norm, not a finding | plan §3.2 (first red) read together with §1.2 step 8, «Il compito passa in *da approvare*» | 1 | HIGH |
| The gate test «se sbaglio, si disfa da sola…» | same §3.1 | 1 | HIGH |
| The Guardian's favourable opinion is one of the six conditions to reach the gate | same §3.4 | 1 | HIGH |
| The explorer's link list is condition ⑥, and the Guardian is named as one of the two who tick it | same §3.4 and §2.2, explorer card: *«la sua lista è quella che revisore e guardiano spunteranno dopo»* | 1 | HIGH (verbatim) |
| The explorer is called on written conditions, and is skipped when none occurs | same §2.2, explorer card: *«Se non ricorre nessuna, si salta»* | 1 | HIGH (verbatim) |
| **A hand-built map of values born elsewhere is the recurring shape of this defect** — operative note **#49**, whose own corollary names *«permessi, chiavi di moduli»*, and which records that *«un test che verifica il dizionario contro sé stesso passa sempre»* | `archivio-documenti/note-operative-ai.md` #49 (7/8/2026) | 1 | HIGH |
| **The RBAC catalogue is rewritten only when `ensureRbacCatalog` runs, inside `ensureWorkspaceSystemRoles`, called at every `/auth/me` — so reading the database first shows the old values, and that is normal** — operative note **#50** | same, #50 (8/8/2026) | 1 | HIGH |
| **A round of work on schema, permissions and migrations was closed with no review at all**, 18/8/2026 — operative note **#54** | same, #54 | 1 | HIGH |
| Git flow: one task one branch, the agent never merges, migrations never on long branches | same §7.3 | 1 | HIGH |
| Commit messages in Italian saying what changes for the CRM's user | same §7.3 | 1 | HIGH |
| The brake on a permission blocking a tool | same §3.5, third brake | 1 | HIGH |
| Over-size files are deliberate and must not be split on initiative; the list lives in the roadmap | `crmadv/CLAUDE.md`, section «Dimensione dei file» | 1 | HIGH |
| The Reviewer's seven areas, in its own order of severity | `crmadv/.claude/agents/revisore.md` | 1 | HIGH |
| **The division of labour in PART 4** — *«Il guardiano controlla permessi e sicurezza… Il revisore controlla il resto»* | plan §1.2, steps 5-6 (verbatim) | 1 | **HIGH** |
| The Reviewer's card lists six areas and security is **not** one of them, so on Paperclip security sits with the Guardian | plan §2.2, Reviewer card | 1 | HIGH |
| You run at step 5, before the Reviewer at step 6 | plan §1.2 | 1 | HIGH |
| The per-area assignment of the table (which of the two owns each row) | the plan's sentence applied to `revisore.md`'s own list | 3 | HIGH — the principle is quoted; only the row-by-row placement is ours |

**VERIFY-ON-FIELD**

- **The division of labour in PART 4 rests on a quoted rule** (plan §1.2), but `.claude/agents/revisore.md`
  has **not** been aligned to it, and `metodo-revisione` will be **generated** from that file. Until the
  source is corrected, a task may show the two roles reporting the same finding twice. If that happens,
  raise it with the council — do not resolve it by dropping your own check.
- The plan lists **three** automatic brakes but the first (the consumption tank) was suspended by
  Jacopo's decision of 24/8/2026: today there are **two**. Do not cite a brake that is not built.
- The over-size file list is maintained in the roadmap only. Never keep a second copy: two lists
  contradict each other within weeks.

---

End of document — [F04] · crm-permessi-e-sicurezza v1.0
