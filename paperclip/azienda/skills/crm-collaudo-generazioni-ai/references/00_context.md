# CONTEXT DOCUMENT — [F00]
# Cross-cutting operational rules
# Skill: crm-collaudo-generazioni-ai (v1.0) | Internal reference
# Version / Revision 1

---

## PURPOSE  [F00:PURPOSE]

This document defines the rules that apply to **every** action this skill governs, whatever the task
at hand. Read it before any other reference file.

This is an **operational** document: it makes no external domain claims, and therefore carries no
source-notes block of its own. The source-traceability convention it defines applies to the knowledge
documents → [F00:SOURCE_FLAGGING].

---

## PART 1 — LANGUAGE  [F00:LANGUAGE]

Three distinct rules. They do not override one another.

1. **These reference files are written in English.** They are internal knowledge, not output.
2. **CRM literals stay in Italian, inside quotation marks** — never translated. Role names, menu
   entries, permission strings, error messages, prompt fragments, field labels, and quoted sentences
   from CRM documents. Example: the system prompt clause `«Non inventare target, offerta, CTA, USP o
   dati di mercato non presenti»` is quoted as-is, because it must stay searchable in the codebase.
   A translated literal is a literal that no longer matches anything.
3. **Everything the agent writes is in Italian.** Findings, task comments, parked decisions, screenshot
   captions, commit messages. The CRM, its documents and the two people who read them are Italian. An
   unattended agent does not guess this rule: it is stated here so it cannot be missed.

---

## PART 2 — CROSS-REFERENCE CONVENTION  [F00:CROSS_REFERENCE_CONVENTION]

| Code | File | Covers |
|---|---|---|
| `[F00]` | `references/00_context.md` | this document — cross-cutting rules |
| `[F01]` | `references/01_when-to-test.md` | when a test run is owed, and how an AI area is recognised |
| `[F02]` | `references/02_test-setup.md` | how a test run is set up before anything is generated |
| `[F03]` | `references/03_real-vs-fallback.md` | telling a real generation from a fallback and from a silent lie |
| `[F04]` | `references/04_domain-criteria.md` | judging the content of a generation against its contract |
| `[F05]` | `references/05_reporting-and-gates.md` | how a finding is written, and when to stop instead of deciding |

- Every section heading carries an **uppercase anchor** of the form `[Fxx:ANCHOR_NAME]`.
- Every cross-reference uses **one resolvable form**: `→ [Fxx:ANCHOR_NAME]` for a section, or the bare
  code `[Fxx]` for a whole document.
- **Generic references are forbidden** — no "see above", no "the setup file". An unattended agent
  cannot ask which file was meant.

---

## PART 3 — SOURCE FLAGGING AND SOURCE NOTES  [F00:SOURCE_FLAGGING]

Documents `[F01]`–`[F05]` assert verifiable facts about the CRM codebase and about Paperclip. Each of
them therefore ends with a **source-notes block** carrying, per claim: the named source (file and,
where useful, symbol), a **tier** (1 = primary/official · 2 = authoritative secondary · 3 = community),
a **confidence** label (HIGH / MEDIUM / LOW) with a short reason, and a **VERIFY-ON-FIELD** subsection
for what still needs confirming.

**Statements of absence are claims too.** "The CRM has no X", "this path is not covered by Y" — these
are the most dangerous sentences in this skill, because *not finding* something looks exactly like
*knowing it is not there*. Three labels, never interchangeable:

| Label | Meaning | What may be derived from it |
|---|---|---|
| `[ABSENT-VERIFIED]` | searched under the absence protocol below, and established absent | it is a claim: carries source, tier, confidence. **Usable** |
| `[NOT-FOUND]` | not found, search not exhaustive | **nothing.** Not a fact. No comparison, recommendation or criterion may rest on it |
| `[SCOPE]` | delimits this skill's own perimeter, asserts nothing about the CRM | not a claim about anything external |

**The absence protocol — all three searches, before `[ABSENT-VERIFIED]` may be written:**
by **synonym** (the codebase's vocabulary is not yours), by **schema / call chain** (a guard may live
in a wrapper, an import chain or a route, not in the file you opened), and by **index** (enumerate every
occurrence of the symbol across the tree, rather than searching for the one you imagine).

Applied inside this skill, that means: before writing "this path is not covered by the budget guard",
enumerate **every** call site of the guard, not just the one nearby.

---

## PART 4 — OPERATING CONDITIONS: NOBODY IS WATCHING  [F00:OPERATING_CONDITIONS]

This skill is read by an agent that works alone, often at night, with no one to ask. Four consequences
that change what a valid instruction looks like:

1. **"Ask the user" is not an available fallback.** There is nobody. Every instruction must end in an
   executable action or in a **declared way of stopping** → [F05:GATES].
2. **The memory is the task, not the session.** The agent does not remember previous runs. Nothing in
   its work may depend on "as last time". Whatever must survive goes **into the task**.
3. **Vague instructions do more damage here than in a conversation.** "Evaluate carefully" produces a
   question when a person is present, and an arbitrary 3 a.m. decision when nobody is. Where this skill
   cannot give a rule, it gives a stopping condition instead.
4. **This text is paid for on every wake-up in which the skill fires.** Length is a recurring cost, not
   a one-off. `SKILL.md` stays short; depth lives in these files, which load only when opened.

---

## PART 5 — WHAT THIS AGENT ACTUALLY DOES  [F00:MANDATE]

In order, on a task that reaches it:

1. Establish whether a test run is owed at all → [F01:TRIGGER_RULE].
2. Set the run up before generating anything → [F02:SETUP_SEQUENCE].
3. **Start the generation itself.** This agent does not wait for someone else's output: it produces the
   output it judges.
4. Establish whether what came back is a real generation, a declared fallback, or a silent lie
   → [F03:THREE_OUTCOMES].
5. Judge the content against the generation's own contract → [F04:CONTRACT_RULE].
6. Write the finding, or park the decision → [F05:FINDING_FORMAT].

It is the only agent on the team that makes **real paid calls**. That is not a reason to test less
→ [F02:COST_REALITY]; it is a reason to know exactly which safety net is holding
→ [F02:FUSE_COVERAGE].

### ⚠️ This trade starts switched off — what that means on your first wake  [F00:TRADE_NOT_YET_ON]

The company plan lists ten trades, nine on and **this one off**: *«L'accensione resta dopo la release
di settembre, alla riapertura della V5»* (§12.6 F, and the table in §2.2 marks it `spento`). What the
decision of 24/8/2026 replaced was **the criterion for when you intervene** — no longer "when the V5
changes", but the five observable touchpoints in the diff → [F01:FIVE_TOUCHPOINTS]. It did not move
the switch-on date.

Two consequences you must not misread:

- **If you are awake, somebody switched you on.** Do not treat this note as permission to decline
  work. It exists so you do not assume an established routine around you: on the first tasks you may
  well be the first agent of your kind this company has run.
- ⚠️ **Two preconditions are stated as "before the first test", and nothing guarantees they were
  done**: the dedicated CRM user account and its **10 $/day** fuse (plan §12.6 F). Step 2 of the setup
  sequence is written to **notice their absence** rather than assume them → [F02:SETUP_SEQUENCE]. If
  the account is missing, or the daily cap reads `0` — which means *no limit*, not *blocked* — you
  stop and park before generating anything. Generating first and discovering the fuse afterwards is
  the one mistake this trade cannot undo, because the money is already spent.

---

## PART 6 — READING DIRECTIVE  [F00:READING_DIRECTIVE]

- **Always**: this document `[F00]`.
- **Then, by moment**: `[F01]` when deciding whether to test · `[F02]` before generating · `[F03]` the
  moment a result comes back — **never skip it**, it is where the failures of this craft live · `[F04]`
  once the result is established as real · `[F05]` when writing anything back.
- **Never read all six because "it is safer".** Each file loaded is paid for. Loading `[F04]` before
  `[F03]` has decided the result is real means judging the wording of an output that no model produced.

---

## PART 7 — OUT OF SCOPE  [F00:OUT_OF_SCOPE]

This skill **does not cover**, and the agent must not produce: `[SCOPE]`

- **Judgement on the product.** Whether a feature should exist, how a page should be laid out, what an
  AI feature ought to do, whether the CRM's strategy is right. The domain experts are Jacopo and
  Claudio. This agent **measures output against given criteria**; it does not offer opinions on design.
  A plausible-but-wrong opinion costs more than no opinion, because someone who already knew the answer
  has to read it and discard it.
- **Fixing what it finds.** It does not modify application code, prompts, schemas or settings. It runs,
  observes, reports.
- **Interface testing.** Clicking through pages, screenshots, navigation checks belong to the other
  tester (🖥️ Collaudatore), not to this one. Overlap point: a page that *shows* a generation is that
  agent's; the generation itself is this one's → [F01:WHAT_DOES_NOT_TRIGGER].
- **General AI or prompt-engineering theory** not applicable to this CRM.

---

## PART 8 — SKILL-LEVEL ERRORS  [F00:SKILL_LEVEL_ERRORS]

The recurring ways this job goes wrong. Each has a real precedent in this project.

| Error | Why it happens | Where the rule is |
|---|---|---|
| Believing the prose of the output | a well-built fallback **resembles** a real result, only poorer | → [F03:THREE_OUTCOMES] |
| Believing the mode flag | the flag can say "AI used" over content the model never wrote | → [F03:SILENT_LIE] |
| Reading a rule-based warning as an AI statement | some warnings are computed by code, not generated | → [F04:NOT_THE_MODEL] |
| Re-testing the same project and "confirming" the old result | the cache returns the previous payload without calling anyone | → [F02:CACHE_TRAP] |
| Testing only the configured provider | the two providers take different code paths; one can be broken while the other works | → [F02:PROVIDER_MATRIX] |
| Assuming the daily fuse protects every paid call | it guards two of the three paid paths | → [F02:FUSE_COVERAGE] |
| Dropping a test run because it looks unnecessary | this agent may **add** a run, never remove one | → [F01:ASYMMETRY] |
| Deciding a product question because nobody answered | some questions have no deadline | → [F05:GATES] |

---

End of document — [F00] · crm-collaudo-generazioni-ai (v1.0)
