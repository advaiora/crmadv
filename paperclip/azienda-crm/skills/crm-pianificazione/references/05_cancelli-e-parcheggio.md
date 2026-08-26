# KNOWLEDGE DOCUMENT — [R05]
# Gates and parking — what you decide, and how you stop when you may not
# Skill: crm-pianificazione (v1.0) | Internal reference
# Version 1.0

---

## USAGE NOTE  [R05:USAGE_NOTE]

Open this whenever you are about to decide something that is not purely mechanical, when you have
to declare an issue's gate, when you must park a decision, and at **every wake** to sweep the
decisions you already parked. It is the most delicate document of this skill: it is the one that
keeps an unattended agent from quietly deciding on the company's behalf.
Traceability: → [R05:SOURCE_NOTES].

---

## PART 1 — The criterion  [R05:CRITERION]

> **«Un agent si ferma quando la decisione è vostra. Non si ferma perché la cosa è importante.»**

Confusing the two produces the two opposite failures. Stopping at everything *important* turns the
board into an approvals desk — and after three days they approve without reading, which is **worse**
than not approving at all, because it gives the illusion of control. Never stopping brings back the
known problem: something born with the wrong name or the wrong permission, no error, discovered
weeks later.

**The test is one question:** *if I get this wrong, does another commit undo it, or do we carry it
forever?* Undone by a commit → you decide, and you write down what you decided. Carried forever →
you stop.

**Why the gates are lighter than they look:** with branches, *wrong but reversible costs little* —
a bad piece of work on a branch is thrown away with one command. That is what makes a deadline on
yellow acceptable at all.

⭐ **Reconciling this with the platform's rule.** Paperclip's base skill says *"NEVER ASK A HUMAN TO
DO WHAT AN AGENT COULD DO… don't hand it back to a human."* Both rules are right because they
answer different questions. That rule forbids **delegating difficulty**. The gates forbid
**usurping authority**. If you catch yourself stopping because the work is hard, unclear or
tedious, that is the platform rule talking and you are wrong to stop. If you are stopping because
the answer belongs to the board, stop — and say which gate applies.

---

## PART 2 — The three gates  [R05:GATES]

This is the company's table, and this skill does **not** invent a variant of it. Only the parts a
foreman actually meets are listed.

**🟢 Green — you decide alone, and you write it down**
Where a new file goes · what to call an internal function · how a test is structured · the order of
extractions when splitting a file · the wording of a comment · **sending a piece of work back**
(reviewer and guardian) · retrying a failed attempt once · creating a branch and committing on it ·
flagging something found along the way.
*For you specifically:* how to cut a written piece of plan into issues, in what order to encode
already-decided couplings, which trade gets an issue, and whether the explorer's conditions occur.

**🟡 Yellow — you stop, park with the options already prepared, and move on to something else**
Product decisions: names, labels, interface behaviour, what the user sees · where a menu entry goes
· a request with **two possible readings** that would lead to materially different work · a
**suspected conflict with the other person's work**.
⏱️ **Yellow has a 12-hour deadline** → [R05:YELLOW_DEADLINE].

**🔴 Red — you stop and wait. No deadline, no exception**
Merging anything into `main` · any database migration · any change to the permission catalogue and
the predefined roles · anything irreversible (deleting files or data, rewriting git history, killing
processes that are not yours) · anything that goes out (email, publishing, purchases, credentials) ·
**hiring an agent, changing a heartbeat, installing or replacing a skill** — that last one because
*«aggiornare una skill aggiorna tutti gli agent che ce l'hanno, in un colpo solo»* · exceeding a
budget · **restructuring** an out-of-norm file not assigned to that task → [R05:OVERSIZE_READING].

⚠️ **Red is approved from the dashboard, not from Discord.** On the phone you see a summary; a red
needs the full diff. Do not word a red request as if a yes/no button were enough.

### ⚠️ The last red says *restructure*, not *touch*  [R05:OVERSIZE_READING]

The plan's wording is *«toccare un file fuori norma per dimensione non assegnato a quel compito»*
(§3.2). **Taken literally it produces false reds**, and this is measured rather than supposed: on a
diff that corrected **a single character** inside a file of ~10,000 lines, six agents out of six
escalated it to a red gate, some declaring the task unclosable.

Three cases, and they are not the same thing:

| What the diff does to an out-of-norm file it was not assigned | Verdict |
|---|---|
| **splits, extracts, reorganises or substantially rewrites it** — the work that already has an assigned moment elsewhere | 🔴 **red.** It pre-empts planned work, which is what the rule exists to stop |
| **a marginal edit unrelated to the task** — a semicolon, an import, one line | **a low-grade note**: *«questo hunk non appartiene a questo ramo»*. Not a gate |
| **an edit the task genuinely required** | nothing. The file's size is not the point |

For you as foreman this cuts both ways: **do not queue the restructuring** of an out-of-norm file
that has an assigned moment → [R02:WHAT_YOU_MAY_NOT_QUEUE], and **do not size an issue as if
brushing one were forbidden** — that is how a legitimate one-line fix gets split into a milestone.

⚠️ **Where you cannot tell restructuring from contact, park it rather than escalating.** A red
raised on a semicolon teaches the board that your reds are not worth opening, and that costs more
than the one you missed.

**Two rules about the gates themselves:**
1. **You may add a gate; you may never remove one.** In doubt, the stricter one wins.
2. **A parked task does not stop the queue.** You leave it and move to the next. If the queue
   empties of unblocked work, that is the signal that the board is late — not that you should
   start deciding.

---

## PART 3 — How a gate is expressed in Paperclip  [R05:HOW_TO_ENCODE]

A gate written only in prose is a gate nobody enforces.

- **Review and approval stages go in the issue's `executionPolicy`.** The runtime intercepts the
  attempt to close the issue and routes it to the right reviewer or approver. Each stage has
  `type: "review" | "approval"`, its participants (agent or user) and `approvalsNeeded`; the policy
  carries `maxReviewRounds` (default 3). This is where conditions 3-5 of *«fatto»* live
  → [R03:ACCEPTANCE].
- **A parked decision is an approval request.** The types available are `hire_agent`,
  `approve_ceo_strategy`, `budget_override_required` and `request_board_approval`; a foreman's
  parked decision is a **`request_board_approval`**, with the five-point text in its free-form
  `payload` and the affected issues in `issueIds`. After the decision, the requester is woken
  automatically.
- **The blocked work is marked blocked**, by a blocker on the decision issue → [R04:ENCODE_DONT_NARRATE].
  Do not leave dependent issues in `todo` hoping the executing agent reads the prose.
- ⚠️ **`[ABSENT-VERIFIED]` the execution policy does not cover git**: it routes work inside
  Paperclip and says nothing about branches, merges or repository-level required reviewers.
  (Protocol: schema of the policy interface; index of the *Power Features* section; synonym search
  for merge/branch protection. Confidence MEDIUM.) **So "never merge into `main`" is a rule that
  only holds because the agents obey it** — nothing stops it mechanically. Write it into the issue
  every time it is relevant.

---

## PART 4 — The five-point parking format  [R05:PARKING_FORMAT]

Inherited from `/vado`, to be respected to the letter. **A parked item is not "something I did not
do": it is a decision ready to be taken in thirty seconds.**

```markdown
**Cosa stavo facendo**
<Il compito e il punto esatto in cui mi sono fermato.>

**Cosa mi ha fermato**
<Una frase. E quale cancello: 🟡 o 🔴.>

**Le opzioni**
- **A — <nome>**: <cosa comporta, conseguenza concreta.>
- **B — <nome>**: <cosa comporta, conseguenza concreta.>
- **C — <nome>**: <solo se esiste davvero. Mai riempire per fare tre.>

**Quale sceglierei e perché**
<Una, dichiarata, con la ragione. Se è un 🟡, questa è l'opzione che parte a scadenza.>

**Cosa resta bloccato**
<Gli identificativi dei compiti fermi e cosa succede se restano fermi.>
```

**Never write *«cosa vuoi fare?»***. A question without options is work handed back, and there is
nobody on the other side to do it.

**Two or three options, each with its consequence.** If you can only find one, it is not a
decision: either it is a green (decide it) or it is a finding to report.

---

## PART 5 — The yellow deadline is yours to keep  [R05:YELLOW_DEADLINE]

> ⏱️ Twelve hours without an answer → **you proceed with the recommended option and declare it in
> the issue.** Twelve hours means "by the next morning".

This is sustainable because the work sits on a branch and is undone with one command, and it is
necessary because otherwise the company stops on the first doubt of a Saturday.

⚠️ **`[ABSENT-VERIFIED]` Paperclip does not implement this deadline.** The approval record has no
expiry, auto-approval or escalation field — its create body is `type`, `payload`,
`requestedByAgentId`, `issueIds`, and the stored record adds only status, decision note, decider and
decision time. (Protocol: approvals API schema; index of the approvals section; synonym search on
auto-approve / timeout / expiry. Confidence MEDIUM → re-verify at first installation.)

**Therefore the deadline is a discipline you execute, and it has three steps:**

1. **When you park**, write the deadline explicitly in the issue and in the payload, as an absolute
   time: *«🟡 Scade: 25/08/2026 09:00 — a scadenza procedo con l'opzione A.»* A relative "in 12
   hours" is unreadable to the session that finds it later.
2. **At every wake, before anything else**, sweep your parked decisions. Answered → the work
   resumes. Expired → you proceed with the recommended option.
3. **When you proceed on expiry, you declare it in the issue**, in one line, saying which option
   ran and that nobody answered. The person coming back must be able to read what was decided
   automatically — that reading is part of the handover ritual.

**Red never expires.** No deadline, no exception, no "it has been three days". A red that has been
waiting for days is a queue problem to be made visible, never a permission to proceed.

---

## PART 6 — What is never yours  [R05:NEVER_YOURS]

Even when you are certain, even when the answer looks obvious, even at three in the morning with
the queue empty.

| Not yours | Where it goes |
|---|---|
| **Names, labels, anything the user reads** — the renaming method is explicitly non-delegable: *«i nomi li propone il capocantiere, li sceglie il consiglio»* | park with the range of options |
| **Menu placement** | park; it is already written that it is decided in a discussion |
| **Changing the scope of the release** — dropping, adding or reordering milestones | park with the cost of each move → [R04:TIMELINE] |
| **Migrations, permission catalogue, predefined roles** | plan them, gate them red, never decide them |
| **Merging into `main`** | it is not a decision of any agent |
| **Hiring an agent, changing a heartbeat, installing or replacing a skill** | proposal to the board. A skill update hits every agent that carries it, at once |
| **Creating or changing a routine**, or creating goals and projects | structural: propose, do not do → [R03:FIELDS] |
| **A defect you found that is written as out of scope** | report it; do not queue it → [R01:IDEAS_ARE_NOT_WORK] |

**And the one that is easiest to get wrong:** *«pianificazione ≠ via libera al codice»*. Creating an
issue is not approving it — on this platform the point is enforced, not merely stated: *"The CEO
cannot move tasks to 'in progress' until you approve its strategy."* A plan of yours that has not
been approved is a proposal, however well written.

---

## [R05:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the CRM
repository (read-only), of `docs.paperclip.ing`, and of the Paperclip source on GitHub.

- **The criterion («si ferma quando la decisione è vostra»), the two opposite failures, and the
  reversibility test**: `archivio-documenti/piano-paperclip-2026-08-19.md` §3.1 — Tier 1 / **HIGH**
  (verbatim).
- **The three-gate table, including the skill-update red and the dashboard-not-Discord rule**: same
  plan §3.2 — Tier 1 / **HIGH** (verbatim).
- **The out-of-norm red says *restructure*, not *touch*, and the three cases**
  → [R05:OVERSIZE_READING]: the plan's wording is same §3.2; that out-of-norm files are deliberate
  and *«non sono un arretrato da smaltire appena lo si nota»* is `crmadv/CLAUDE.md`, section
  *«Dimensione dei file»* — both Tier 1 / **HIGH** (verbatim). **The three-case split is a
  correction adopted on 25/8/2026** across the three skills that state the rule, so they do not
  legitimise different exceptions — Tier 3 / **HIGH**, because it rests on a measurement rather
  than on a reading.
- **The measurement behind it — six agents out of six escalating a one-character diff inside a
  ~10,000-line file to a red gate**: an M7 run of `crm-permessi-e-sicurezza`, lab
  `ai-skill-lab`, 24/8/2026 — Tier 1 / **HIGH** for the observation. ⚠️ It was run on a
  **synthetic diff**, not on this company in production: the effect is demonstrated, its frequency
  in real work is not → **VERIFY-ON-FIELD**, at the first out-of-norm file brushed by a real task.
- **The 12-hour yellow deadline and its justification; a parked task does not stop the queue**:
  same plan §3.2 and §3.3 — Tier 1 / **HIGH**.
- **The five-point parking format**: same plan §3.3, inherited from `.claude/commands/vado.md` §5 —
  Tier 1 / **HIGH** (verbatim in both).
- **The renaming method is non-delegable: proposed by the foreman, chosen by the board**: same plan
  §6-E — Tier 1 / **HIGH**.
- **«Pianificazione ≠ via libera al codice», to be made explicit because a *created* task is not an
  *approved* task**: same plan §6-F — Tier 1 / **HIGH**.
- **Execution policy: runtime-enforced stages, `type`, participants, `approvalsNeeded`,
  `maxReviewRounds` default 3**: `docs.paperclip.ing/guides/power/execution-policy` — Tier 1 /
  **HIGH**.
- **`[ABSENT-VERIFIED]` no git coverage in the execution policy** — same page; protocol run on
  schema, section index and synonyms — Tier 1 / **MEDIUM** → VERIFY-ON-FIELD.
- **Approval types, statuses, create body (`type`, `payload`, `requestedByAgentId`, `issueIds`) and
  decision endpoints**: `docs.paperclip.ing/reference/api/approvals` — Tier 1 / **HIGH**.
- **`[ABSENT-VERIFIED]` no expiry / auto-approval / escalation on approvals** — same API reference
  plus the approvals guide; protocol run on schema, index and synonyms — Tier 1 / **MEDIUM** →
  VERIFY-ON-FIELD. An unconfirmed 60-minute expiry mentioned in community-level material concerns
  **tool-level confirmations** (`PAPERCLIP_APPROVAL_ID`), not board approvals: `[VERIFY]`, and
  nothing here rests on it.
- **The requester is woken automatically after a decision; the CEO cannot move tasks to
  `in_progress` before its strategy is approved**:
  `docs.paperclip.ing/guides/agent-developer/handling-approvals` — Tier 1 / **HIGH** (verbatim).
- **Critical Rule #1 («never ask a human to do what an agent could do»)**:
  `github.com/paperclipai/paperclip`, `skills/paperclip/SKILL.md` — Tier 1 / **HIGH** (verbatim).
- **A skill update reaches every agent carrying it, in one go**:
  `piano-paperclip-2026-08-19.md` §3.2 and §4.2 of the delivery brief — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **The two absence claims above** (approval expiry; git coverage of the execution policy). Both are
  MEDIUM. If either turns out false at installation, Part 5 changes from "a discipline you execute"
  to "a setting you configure", and Part 3 gains a mechanical lock.
- **Whether the board approves reds from a Paperclip dashboard view that shows full diffs.** The
  rule is the company's; the affordance is the platform's, and it is stated in the plan rather than
  observed here.

------------------------------------------------------------------------------

End of document — [R05 — Gates and parking] · crm-pianificazione (v1.0)
