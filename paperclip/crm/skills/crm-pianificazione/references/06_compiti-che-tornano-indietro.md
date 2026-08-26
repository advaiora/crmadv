# KNOWLEDGE DOCUMENT — [R06]
# When work comes back — retry, reformulate, or take it to the board
# Skill: crm-pianificazione (v1.0) | Internal reference
# Version 1.0

---

## USAGE NOTE  [R06:USAGE_NOTE]

Open this when an issue you planned comes back: sent back by a reviewer, sitting in `blocked`, or
rejected at the gate. Work that comes back is older than work that has never started, and it is the
work that rots — so it is the **second step of every wake**, before creating anything new
(→ [SKILL:THE_LOOP]). Traceability: → [R06:SOURCE_NOTES].

---

## PART 1 — The three ways work comes back  [R06:WHEN_WORK_COMES_BACK]

| It comes back as | What happened | Who decided it |
|---|---|---|
| **Sent back after review** | the reviewer or the guardian found something. The issue returns by itself, without disturbing anyone | their green decision — sending work back is explicitly theirs, and you do not argue with it |
| **`blocked`** | the executing agent hit a wall: a permission blocked a tool, something broke and would not go green, or a decision surfaced mid-work | the brakes → [R06:BRAKES] |
| **Rejected at the gate** | the board said no, with a reason | the board. The reason is the specification of the next attempt |

**First move in all three cases: read what is written in the issue, not what you remember.** The
session that hit the wall is gone; what it left in the comments is all that exists. If the trace is
missing — no reason, no attempt recorded — that itself is the finding, and it is a defect of the
issue you wrote → [R03:MEMORY_IS_THE_ISSUE].

---

## PART 2 — The three moves  [R06:RETRY_REFORMULATE_ESCALATE]

| Move | Use it when | Do not use it when |
|---|---|---|
| **Retry, once** | the cause was transient: a flaky test, a timeout, a machine under load, a step that was simply not run | the same cause has already come back once. Retrying twice is how a company spends a night on nothing |
| **Reformulate** | the cause is the **cut**: the issue was two works, its acceptance was ambiguous, its perimeter was wrong, a dependency was missing | the cut was fine and the work was simply not finished |
| **Take it to the board** | the cause is a **decision**, a scope conflict, or the same failure twice | you have not yet read the trace, or the answer is written in a plan document you have not opened |

**Retrying once is a green decision** — it is written in the gate table. Retrying a second time is
not a decision you have.

⚠️ **A red test is not always a broken test.** On a loaded machine, a failure from a timeout or from
a worker that never started is a machine symptom: the rule in this project is to re-run the specific
file before investigating the code — *«solo un fallimento di asserzione è reale sempre»*. Do not
reformulate an issue on the strength of a timeout.

**When you reformulate, three things must be rewired** or you create silent damage:

1. **The blockers.** If you cancel the old issue, remember that **cancelled blockers do not count as
   resolved**: anything that was blocked by it stays blocked forever. Move the blockers before you
   cancel → [R04:ENCODE_DONT_NARRATE].
2. **The branch.** Work that stopped halfway leaves a branch. The rule is absolute: *«mai lasciare
   il lavoro peggio di come lo si è trovato»* — so the first sub-issue of a reformulation is
   bringing the branch back to a coherent state, not starting the new cut on top of a mess.
3. **The trace.** The new issue carries what was tried and why it failed. A reformulated issue that
   hides its history invites the next session to repeat the same attempt.

---

## PART 3 — Five things you never do here  [R06:ANTIPATTERNS]

1. **Reopen an issue without changing anything.** If nothing about the issue is different, the
   result will not be either.
2. **Loosen the acceptance criteria to make it pass.** The acceptance list is the only thing
   standing between wrong work and production → [R03:ACCEPTANCE].
3. **Remove a gate, or split an issue so that a red gate disappears.** You may add, never remove
   → [R05:GATES].
4. **Reassign to another trade to get past a reviewer.** If the guardian sent it back, the answer is
   the guardian's, not another agent's.
5. **Rewrite the plan document to match what happened.** You do not write in the archive; the
   chronicler does → [R01:READING_DISCIPLINE].

---

## PART 4 — Round trips are the thermometer  [R06:ROUND_TRIPS]

> The number that reveals degradation is not length. It is **how many times the same work comes
> back**.

- The platform gives you the ceiling directly: `maxReviewRounds` on the execution policy, **default
  3**. An issue that reaches it is not an execution problem, it is a **planning problem** — almost
  always a cut that bundled two verdicts, or acceptance criteria that were not observable.
- **An anomalous cost is a symptom of a wrong method**, not of a lazy agent. In this company that
  signal is one of the four sources of a new operational note.
- **You produce the signal; the head of personnel reads it.** Measuring the team and proposing
  changes to thresholds is that trade's job, not yours → [R03:ASSIGNMENT]. What you owe is an
  honest record inside the issue: how many rounds, and on what cause.

**Practical rule:** the second time an issue comes back **for the same reason**, stop retrying and
re-cut it or take it to the board. The third time is not a further attempt, it is a pattern.

---

## PART 5 — The automatic brakes  [R06:BRAKES]

Two brakes are in force. They stop an agent mid-work, and they produce issues you will find.

1. **Something broke and will not go green.** After one serious attempt, if tests or the build stay
   red: the branch is brought back to a coherent state, the work is parked, and the agent moves on.
2. **A permission blocked a tool.** No insisting with variants for half an hour: note it, work
   around it if possible, otherwise park that piece.

A third brake — pausing the agents when consumption in the current window ran high — **was
suspended by decision of 24/8/2026 and is not being built**. Two consequences you must plan around:

- **Nobody is watching consumption.** There is no automatic warning, and the first symptom of an
  exhausted window will be the two humans getting blocked mid-task. The countermeasure in force is
  the cheap one: slow heartbeats and agents switched off when they are not needed.
- **So do not queue as if capacity were free.** A queue stuffed with parallel work has a cost that
  nothing will interrupt on your behalf.

---

## PART 6 — Stale, blocked, and merely waiting  [R06:STALE]

Paperclip's bundled **Issue Triage** skill classifies stale, blocked, in-review and stalled issues
and picks the next action; use it for the mechanics. What it cannot know is what those states mean
in this company:

- **A parked yellow past its deadline is not stale — it is due.** It proceeds with the recommended
  option, today, and says so → [R05:YELLOW_DEADLINE].
- **A red that has been waiting for days is not stale either.** It is a visible queue problem, and
  the correct response is to make it visible again, never to proceed.
- **An issue in review with no review stage was mis-created.** Fix the policy, do not chase the
  reviewer by hand → [R05:HOW_TO_ENCODE].
- **An issue blocked by a cancelled issue is a bug of yours**, and it will never wake by itself
  → [R04:ENCODE_DONT_NARRATE].

---

## [R06:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the CRM
repository (read-only), of `docs.paperclip.ing`, and of the Paperclip source on GitHub.

- **Sending work back is a green decision of the reviewer and the guardian; retrying a failed
  attempt once is green**: `archivio-documenti/piano-paperclip-2026-08-19.md` §3.2 — Tier 1 /
  **HIGH** (verbatim).
- **The issue returns by itself, without disturbing anyone**: same plan §1.2 — Tier 1 / **HIGH**.
- **The two brakes in force (red build → coherent state, park, move on; permission blocked a tool →
  note, work around, park)**: same plan §3.5 points 2-3; `.claude/commands/vado.md` §4 — Tier 1 /
  **HIGH** (verbatim in both).
- **The third brake suspended, no consumption monitoring, first symptom is the humans blocking**:
  same plan §3.5 point 1 and §12.5, decision of 24/8/2026 — Tier 1 / **HIGH**.
- **«Mai lasciare il lavoro peggio di come lo si è trovato»**: same plan §3.5; `vado.md` §4 —
  Tier 1 / **HIGH**.
- **A red from timeout or a worker that never started is not a broken test; re-run the file first;
  only an assertion failure is always real**: `crmadv/CLAUDE.md`, frontend maintenance rules —
  Tier 1 / **HIGH** (verbatim).
- **Round trips are the degradation signal, not length**: `piano-paperclip-2026-08-19.md` §4.3 —
  Tier 1 / **HIGH** (verbatim).
- **An anomalous cost is a symptom of a wrong method, and is one of the four sources of a new
  note**: same plan §5.7 — Tier 1 / **HIGH**.
- **The head of personnel reads the numbers and proposes; it does not apply**: same plan §2.2 and
  §2.3 — Tier 1 / **HIGH**.
- **`maxReviewRounds`, default 3**: `docs.paperclip.ing/guides/power/execution-policy` — Tier 1 /
  **HIGH**.
- **Cancelled blockers do not count as resolved; the blocker array replaces the set**:
  `github.com/paperclipai/paperclip`, `skills/paperclip/SKILL.md` — Tier 1 / **HIGH** (verbatim).
- **Issue Triage exists as a bundled skill**: `docs.paperclip.ing/reference/skills/bundled` —
  Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **Whether `maxReviewRounds` is enforced as a hard stop or as a warning.** The field and its
  default are documented; what exactly happens at the ceiling is not stated on the page read, so
  Part 4 treats it as a signal rather than as a mechanism. **MEDIUM.**
- **Whether the consumption brake stays suspended.** Part 5 is written on a decision dated
  24/8/2026 that explicitly says it may be resumed on request. If it is built, the last paragraph
  becomes wrong.

------------------------------------------------------------------------------

End of document — [R06 — When work comes back] · crm-pianificazione (v1.0)
