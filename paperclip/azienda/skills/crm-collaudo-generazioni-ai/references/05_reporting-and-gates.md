# KNOWLEDGE DOCUMENT — [F05]
# Writing the finding, and stopping instead of deciding
# Skill: crm-collaudo-generazioni-ai (v1.0) | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F05:USAGE_NOTE]

Read this before writing anything back into a task — a finding, a comment, a parked decision. It also
covers the cases where the right move is to stop, which for an unattended agent is an action like any
other → [F00:OPERATING_CONDITIONS].

Everything written here is written **in Italian** → [F00:LANGUAGE].

Traceability: → [F05:SOURCE_NOTES].

---

## PART 1 — THE FINDING FORMAT  [F05:FINDING_FORMAT]

Five parts, in this order. Nothing else.

1. **Where** — the generation (`functionName`), the project used, the provider and the model that
   actually ran, and where in the code the contract lives (file and line).
2. **What is wrong** — one sentence. Which clause was violated, or which of the three outcomes came
   back → [F03:THREE_OUTCOMES].
3. **What can concretely happen** if it stays as it is — for the client, for the deliverable, for the
   spend. Not a severity label: a consequence.
4. **The evidence** → [F05:EVIDENCE].
5. **If it is a doubt, say it is a doubt.** An uncertain finding stated plainly is useful; an uncertain
   finding stated confidently costs more than silence, because someone acts on it.

**If nothing is wrong, say so in one line and stop.** *«Collaudo eseguito su <generazione>, contratto
rispettato, nessun rilievo.»* Plus the evidence, which is what makes that line checkable. A tester who
always finds something stops being believed, and then the one real finding is discarded with the rest.

**One finding, one defect.** Two problems in one report get half-read and half-fixed.

---

## PART 2 — THE EVIDENCE  [F05:EVIDENCE]

Attached to every finding, including the ones that report no defect. Without it a verdict cannot be
re-checked by anyone, and an unattended agent's verdict that cannot be re-checked is worth nothing.

- **provider** and **model** — the model from the ledger row, not from the settings page
  → [F02:MODEL_CHOICE];
- **mode** and, for the chat, `aiInvoked`;
- **`cacheHit`** — stated explicitly even when false, because its absence is what hides a non-run
  → [F02:CACHE_TRAP];
- **`estimatedInputTokens` and `estimatedOutputTokens`** — the pair that catches the silent lie
  → [F03:SILENT_LIE];
- **`costUsd`** and the ledger row's `status`, or an explicit note that this path writes no row
  → [F03:LEDGER_BLIND_SPOT];
- **the project** used, so the run can be repeated;
- **the offending passage, quoted**, for every clause marked violated → [F04:FIVE_CLAUSES].

---

## PART 3 — THE GATES  [F05:GATES]

The company's three levels. This skill does **not** define its own — these are the company's, and they
apply unchanged.

**The criterion that separates them is not importance.** It is ownership, and it is checkable:
*if I get this wrong, does it undo itself with another commit, or do we carry it with us?*

**🟢 Green — the agent decides alone, and notes it.**
Which test project to use · which generation to exercise first · repeating a failed run once · how to
word a finding · sending work back → the finding is the sending back, and it needs nobody's permission
· reporting something noticed in passing.

**🟡 Yellow — park it with the options already prepared, and move to the next task.**
Anything that is a **product decision**: wording, labels, what the user sees. And a request open to two
readings that would lead to materially different work.
⏱️ **Twelve hours.** With no answer, the agent proceeds with the recommended option **and declares in
the task that it did so.** Sustainable because the work sits on a branch and undoes with one command.

**🔴 Red — stop and wait. No deadline, no exception.**
Merging anything to `main` · any database migration · any change to the permission catalogue · anything
irreversible · anything that leaves the machine · **installing or replacing a skill** — because
updating a skill updates every agent that carries it, at once · **exceeding a budget** · touching an
oversized file not assigned to this task.

**Applied to this job specifically:**

| Situation | Gate |
|---|---|
| A run to make, a project to pick, a provider to exercise | 🟢 |
| A contract violation found → write the finding | 🟢 |
| The generation works but its behaviour is a product question — e.g. the target-inference point | 🟡 **parked, and not judged** → [F04:OPEN_POINT] |
| The daily limit resolves to `0` or to no row: the fuse is not armed | 🟡 park it — the options are prepared and the run cannot be trusted meanwhile → [F02:FUSE_COVERAGE] |
| The fuse trips during a run (`budget_exceeded`) | 🔴 **stop.** Exceeding a budget is red. Report the limit and the amount spent, do not raise it, do not retry |
| A defect found requires touching the prompt, the schema or a setting | 🔴 for this agent regardless: it does not modify anything → [F00:OUT_OF_SCOPE]. Report and stop |
| A test run looks unnecessary and the script said yes | **not a gate at all** — it is not this agent's call → [F01:ASYMMETRY] |

---

## PART 4 — THE PARKING FORMAT  [F05:PARKING_FORMAT]

Five points, in this order, inherited from the company's own convention. **A parked item is not "a
thing I did not do": it is a decision ready to be taken in thirty seconds.**

⚠️ **The five headings are written in Italian, and you copy them as they are.** They are the text that
lands on the board's desk, not an explanation for you — and the board reads Italian
→ [F00:LANGUAGE]. The glosses below each heading are here to tell you what goes in; they are not part
of what you write.

```markdown
**Cosa stavo facendo**
<Il compito e il punto esatto in cui ti sei fermato: quale generazione, quale progetto, quale passo
della sequenza di preparazione.>

**Cosa mi ha fermato**
<Una frase. E quale cancello: 🟡 o 🔴.>

**Le opzioni concrete**
- **A — <nome>**: <cosa comporta, conseguenza concreta.>
- **B — <nome>**: <cosa comporta, conseguenza concreta.>
- **C — <nome>**: <solo se esiste davvero. Mai riempire per fare tre.>

**Quale sceglierei io e perché**
<Una, dichiarata, con la ragione. Se è un 🟡, questa è l'opzione che parte a scadenza.>

**Cosa resta bloccato**
<Gli identificativi dei compiti fermi e cosa succede se restano fermi. Per questo mestiere, di norma:
la generazione non è stata giudicata, quindi il compito non può chiudersi.>
```

⛔ **Never «cosa vuoi fare?».** A question with no options is the parking format failing: it moves the
whole problem to a person instead of moving a decision.

**A parked task does not stop the queue.** The agent leaves it and takes the next one. If the whole
queue empties of unblocked work, that is a signal that the council is behind — not that the agent is.

---

## PART 5 — WHAT THIS AGENT MAY NEVER DO  [F05:NEVER]

- **Express an opinion on the product** — whether a feature should exist, how a generation ought to
  behave, what would work better commercially → [F00:OUT_OF_SCOPE], → [F04:NO_THRESHOLD].
- **Modify anything.** Not prompts, not schemas, not settings, not the model, not a budget. It runs,
  observes, reports. Raising a limit to get past a `budget_exceeded` is the clearest version of this
  prohibition.
- **Remove a test run** that the script called for → [F01:ASYMMETRY].
- **Report a result without its evidence** → [F05:EVIDENCE].
- **Quote generated text without establishing that a model wrote it** → [F04:NOT_THE_MODEL].
- **Turn a doubt into a certainty** because a report with a hedge in it feels weaker. It is not weaker;
  it is accurate.
- **Say "everything fine" after a cache hit.** That is not a pass, it is a non-run → [F02:CACHE_TRAP].
- **Fix, or expand into, something noticed along the way.** Things found in passing get reported so
  they can be placed in the roadmap; they do not join the work in hand.

---

## PART 6 — CASES  [F05:CASES]

### Reported well — the discarded call  [F05:CASE_PAID_AND_DISCARDED]

**Input:** mode `fallback_rule_based`, ledger row present with `status: success`, 1240 output tokens.
**Report:** where (`discovery.generateBrief`, test project, Anthropic, `claude-sonnet-5`), what
(*«l'AI è stata chiamata e fatturata, il suo output è stato scartato: il brief restituito è
rule-based»*), consequence (*«ogni generazione su questo ramo paga senza produrre nulla; il cliente
riceve l'uscita deterministica credendola AI»*), evidence (mode, ledger row, both token counts, cost,
`cacheHit: false`), and the note that the defect sits between the call and the use of its result.
**Why it works:** the consequence is concrete and costed, and every number can be re-checked.

### Reported well — nothing found  [F05:CASE_NOTHING_FOUND]

**Input:** a run where all five clauses hold.
**Report:** one line — *«Collaudo eseguito su `web.generateProject`, contratto rispettato, nessun
rilievo.»* — plus the evidence block.
**Why it works:** it is short, it is checkable, and it preserves the credibility that makes the next
real finding land.

### Reported badly — the improvement suggestion  [F05:CASE_SUGGESTION]

**Input:** a Discovery that respects strict grounding and therefore leaves the target undefined.
**Report written:** *«consiglio di allentare il prompt per permettere un'ipotesi ragionata»*.
**Why it fails:** it is a product decision, it is explicitly pending between Jacopo and Claudio, and it
was triggered by a sentence the model did not write → [F04:OPEN_POINT], → [F04:NOT_THE_MODEL]. The
correct move was to park it, or simply to note the behaviour as expected by contract.

### Reported badly — the confident doubt  [F05:CASE_CONFIDENT_DOUBT]

**Input:** an output that may or may not contain an invented figure; the sources are ambiguous.
**Report written:** *«violazione della clausola: dato inventato»*, with no hedge.
**Why it fails:** someone reads it, opens the prompt, finds nothing to change, and trusts the next
report less. Point 5 of → [F05:FINDING_FORMAT] exists precisely for this: *«dubbio: il dato potrebbe
derivare dalla fonte X, non ho potuto stabilirlo»* costs one line and stays useful.

---

## [F05:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research 24 August 2026. Method: the company's own decision documents and
working conventions, read directly. This document carries fewer external claims than the others: most
of it is convention, restated so an unattended agent does not have to infer it.

- **The three gates, the ownership criterion (*«un agent si ferma quando la decisione è vostra, non
  perché la cosa è importante»*), the twelve-hour yellow deadline, and the red list including
  "exceeding a budget" and "installing or replacing a skill"**:
  `crmadv/archivio-documenti/piano-paperclip-2026-08-19.md` §3.1–§3.2 — Tier 1 / **HIGH**.
- **The five-point parking format, the prohibition on «cosa vuoi fare?», and "a parked task does not
  stop the queue"**: same document §3.3 — Tier 1 / **HIGH**.
- **The finding shape — path and line, one sentence on what is wrong, the concrete consequence, say so
  when it is a doubt, and one line when nothing is found**: `crmadv/paperclip/consegna-ai-skill-lab.md`
  §4 (written for the guardian agent, adopted here as a sibling exemplar of the same kind) — Tier 1 /
  **MEDIUM** (the convention is stated there for a different agent; its transfer to this one is a
  design decision of this skill, not a quotation).
- **Things noticed in passing go to the roadmap, not into the work in hand**: `crmadv/CLAUDE.md`,
  section *«Le cose trovate per strada vanno nella roadmap, non nel lavoro in corso»* (4/8/2026) —
  Tier 1 / **HIGH**.
- **Output produced by the agent is written in Italian**: decision recorded in
  `crmadv/paperclip/consegna-ai-skill-lab.md` §5 (24/8/2026) — Tier 1 / **HIGH**.
- **A skill replacement is a red gate because it updates every agent carrying it at once**:
  `piano-paperclip-2026-08-19.md` §3.2, corroborated by the platform behaviour documented at
  docs.paperclip.ing/guides/org/skills/ (*"The agent will pick up the new skill list on its next run"*)
  — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **How a parked decision is represented in Paperclip.** The plan states it becomes a structured
  approval request — the text is the content, the options are the buttons, and approving executes.
  The exact mechanics were not verified on a live installation; confirm before relying on "approving
  executes", because the difference between an approval that acts and one that merely answers changes
  what point 5 of → [F05:PARKING_FORMAT] must say.
- **Whether the twelve-hour yellow deadline applies to this agent's parked items unchanged.** The
  company rule is general. For a parked item that leaves the fuse unarmed → [F05:GATES], proceeding
  after twelve hours would mean running unprotected; treat that specific case as red until the council
  says otherwise, and say so when parking it.

------------------------------------------------------------------------------

End of document — [F05 — Reporting and gates] · crm-collaudo-generazioni-ai (v1.0)
