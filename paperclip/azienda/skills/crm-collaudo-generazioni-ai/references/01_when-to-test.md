# KNOWLEDGE DOCUMENT — [F01]
# When a test run is owed, and how an AI area is recognised
# Skill: crm-collaudo-generazioni-ai (v1.0) | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F01:USAGE_NOTE]

Read this document **before** deciding whether a task needs a test run at all. It answers one question
and one only: *does this branch owe a generation test?* It says nothing about how to run one
(→ [F02]) or how to judge the result (→ [F03], → [F04]).

Traceability: → [F01:SOURCE_NOTES].

---

## PART 1 — THE TRIGGER RULE  [F01:TRIGGER_RULE]

**The decision is not a judgement call. It is a script.**

```
npm run tocca-ai
```

Given the branch diff, it answers **yes or no**. Deterministic, zero tokens, and it has no bad days.
The instruction reduces to: *run the script; if it says yes, mark the task "da collaudare".*

**If the script is missing.** As of this writing the script is planned but not yet in `package.json`
`[ABSENT-VERIFIED]` — see → [F01:SOURCE_NOTES]. If `npm run tocca-ai` fails because the script is not
there, **treat the answer as yes**, run the test, and say so in the task in one line: `«Script
tocca-ai assente: collaudo eseguito per la clausola "in dubbio, si collauda".»` The absence of the
tool is not permission to skip the check — that would turn a missing script into a silent gap.

**If the script is missing *and* you must decide what to look at**, apply the five touchpoints below
by reading the diff → [F01:FIVE_TOUCHPOINTS]. That is a fallback, not the normal path: when the script
exists, the script decides.

---

## PART 2 — THE FIVE TOUCHPOINTS  [F01:FIVE_TOUCHPOINTS]

These are what the script looks for. They exist because of one structural fact:

> **A CRM feature cannot use AI without going through the AI engine. If it goes through, it shows in
> the code. If it does not go through, it is not an AI feature.**

A test run is owed when the branch touches any one of these:

| | What | Why it is on the list |
|---|---|---|
| 1 | **The code that generates** — a file that calls the AI engine, **or that reaches it through the import chain** | This is what catches *unforeseen* AI features: they can be born anywhere, but to work they must arrive at the engine |
| 2 | **The prompt text** | Changes the output without changing a line of logic |
| 3 | **The structured-output schema** (`jsonSchema`) | A failure that already happened in this project: a schema that lists no fields returns an empty object, recorded as "AI used" → [F03:SILENT_LIE] |
| 4 | **Who generates** — model catalogue, default model, provider | Same code, different generator, different output → [F01:CASE_MODEL_DEFAULT] |
| 5 | **What goes into the generation** — sources and RAG, custom fields that feed the prompt | Same prompt, different raw material |

---

## PART 3 — RECOGNISING AN AI AREA, INCLUDING ONE NOT YET BUILT  [F01:AI_AREA_RECOGNITION]

The CRM is under active development. A list of AI features goes stale the week it is written, and a
stale list produces the worst failure mode of this job: a new generation nobody tested because it was
not on the list.

**So an AI area is recognised structurally, not from a list.** An AI area is any code path that reaches
one of the **three paid sinks**:

| Sink | How to find it |
|---|---|
| The **JSON runner** | call sites of `runAgencyOpenAiJsonWithMeta` / `runAgencyOpenAiJson` |
| The **text runner** | call sites of `runAgencyAiTextWithMeta` |
| A **direct call to a provider** | `fetch` to `api.anthropic.com` or `api.openai.com` anywhere in `server/` |

Enumerating those three across the tree yields every paid path there is, today and after any future
change. **Do that enumeration rather than trusting the table below.** The table is the state at the
time of writing, kept as a starting point and as a way to notice what is new:

| `functionName` | What it generates | Engine path |
|---|---|---|
| `discovery.generateBrief` | full Discovery brief | JSON runner |
| `discovery.generateSection` | one Brief section | JSON runner |
| `web.generateProject` | site / landing structure | JSON runner |
| `web.generateBlock` | one site block | JSON runner |
| `ads.generateAsset` | ADV campaign copy | JSON runner |
| `reporting.excelMapping` | mapping of a non-standard client spreadsheet | JSON runner |
| `chat.general` · `chat.project` · `chat.client` | AI chat reply, per scope | text runner |
| `chat.summary` | context compression | text runner |
| `sources.embed.index` · `sources.embed.search` | RAG indexing and semantic search | embedder |
| *(no `functionName`)* `runAgencyOpenAiCompetitorSearch` | web search for real competitors | direct provider call |

**A path with no `functionName` is still an AI area.** The competitor search is paid, produces content
a client sees, and writes nothing to the usage ledger — which changes how it must be verified
→ [F03:LEDGER_BLIND_SPOT] and which safety net covers it → [F02:FUSE_COVERAGE].

**What is not an AI area even though its name suggests it.** The SEO audit is **not** a generation:
`server/modules/web-assets/seo-analyzer.ts` states in its own header that it uses no network, no
database and no AI, and is deterministic and rule-based `[ABSENT-VERIFIED]`. Project documents list
"audit SEO" among the AI outputs to be tested; the code contradicts them, and the code wins. Testing it
as a generation would produce a run with nothing to judge, and — worse — a report claiming an AI
behaviour that no model produced.

---

## PART 4 — WHAT DOES NOT TRIGGER A RUN  [F01:WHAT_DOES_NOT_TRIGGER]

Without this list the rule fires on everything, and a rule that fires on everything is discarded within
a week.

- **The look of pages that display a generation.** Showing a generation is not generating it. That
  belongs to the interface tester → [F00:OUT_OF_SCOPE].
- **Tests.**
- **Documentation.**
- **Non-AI permissions.**

The boundary case worth stating: a change to a page that renders a Discovery brief is out. A change to
what gets *put into* the prompt that produces that brief is in — touchpoint 5.

---

## PART 5 — THE ASYMMETRY THAT CLOSES THE GAPS  [F01:ASYMMETRY]

**The script, the planner (🧭 Capocantiere) and the reviewer (🔍 Revisore) may all *add* a test run.
No agent may *remove* one when the script says yes — only the council may, explicitly.**

The two errors are not equivalent:

- a test run made for nothing costs **three to nine US cents** — two calls, one that generates and one
  that judges;
- a test run skipped lets a broken generation reach a client.

**Closing clause: when in doubt, test.** This is not vague encouragement, it is arithmetic: the cost of
the unnecessary run is known and tiny, the cost of the missed one is not.

**Consequence for this agent, stated so it cannot be reasoned around:** if the script says yes and the
task looks trivial, the run happens anyway. "It is obviously fine" is not an available conclusion —
it is exactly the reasoning that a 3 a.m. run with nobody watching should not be making
→ [F00:OPERATING_CONDITIONS].

---

## PART 6 — CASES  [F01:CASES]

Positive and negative at equal weight, each with its cause.

### Correctly triggered — prompt only  [F01:CASE_PROMPT_ONLY]

**Input:** a commit that edits only the system-prompt string of `web.generateProject`, e.g. tightening
`«Non inserire placeholder, non inventare prove sociali o dati non presenti»`.
**Outcome:** run owed (touchpoint 2).
**Cause:** no logic changed, every test stays green, the reviewer sees a string edit — and the output
changes for every client from that commit on. Nothing downstream of the diff can catch this.
**Lesson:** the prompt is code that nothing else tests.

### Correctly triggered — the unforeseen feature  [F01:CASE_IMPORT_CHAIN]

**Input:** a new module that never names the AI engine, but imports a helper that imports
`agency.service`, and ends up calling a runner.
**Outcome:** run owed (touchpoint 1, via the import chain).
**Cause:** this is precisely the case a list of known AI features cannot see. The feature was not
planned, so nobody thought to add it anywhere — but to work at all it had to reach the engine.
**Lesson:** follow the import chain, not the feature name → [F01:AI_AREA_RECOGNITION].

### Correctly not triggered — showing is not generating  [F01:CASE_DISPLAY_ONLY]

**Input:** a restyle of the page that displays the Discovery brief: spacing, typography, a new button
that copies the text.
**Outcome:** no run owed.
**Cause:** nothing in the diff reaches a paid sink. The generation is unchanged; only its rendering
moved.
**Lesson:** if the rule fired here it would fire on most of the roadmap, and would then be ignored.

### Wrongly skipped — the expensive one  [F01:CASE_MODEL_DEFAULT]

**Input (real, 21 July 2026):** the workspace default model was set to the string `"sonnet 4.5"`. It
looks like configuration: no prompt touched, no logic touched, tests green.
**Outcome:** every AI function using the default silently ran on `claude-opus-4-8` instead of Sonnet —
roughly +67% cost, and a different generator behind identical code. The cause was
`resolveAgencyProviderModel`, which falls back to `DEFAULT_ANTHROPIC_MODEL` whenever the configured
model string does not begin with `claude`. It was found only by reading `AiUsageLog` afterwards.
**Cause of the miss:** "who generates" does not look like AI work. It looks like a settings change.
**Lesson:** touchpoint 4 exists because of this exact case. A model, catalogue or provider change is a
generation change, and the guard that made this silent is still in the code as a safety net.

---

## [F01:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research 24 August 2026. Method: direct reading of the `crmadv` sources
(primary, first-hand) plus the project's own archive documents. Standing caveat: line numbers are
those of the working tree on that date and drift with edits — the named symbol is the stable
reference, the line is a convenience.

- **The five touchpoints, the asymmetry, the "in doubt, test" clause, and the 3–9 ¢ figure**:
  `crmadv/archivio-documenti/piano-paperclip-2026-08-19.md` §12.6 A–D (decision recorded 24/8/2026,
  costed from `AGENCY_AI_ESTIMATABLE_FUNCTIONS`, `agency.service.ts:2376`) — Tier 1 / **HIGH**
  (project's own decision document, cross-checked against the constants it cites).
- **⭐ This trade is not switched on yet** → [F00:TRADE_NOT_YET_ON]: same plan §12.6 F, *«L'accensione
  resta dopo la release di settembre, alla riapertura della V5»*, and §2.2 / §2.3, where the trade is
  the one of ten marked `spento` — Tier 1 / **HIGH** (verbatim). ⚠️ **What the 24/8 decision
  superseded is the *criterion* of intervention** (no longer tied to the V5 but to the five
  touchpoints), **not the switch-on date**: the two statements coexist, and reading the first as
  cancelling the second is the misreading to avoid. **Recorded 25/8/2026.**
- **The dedicated CRM user and the 10 $/day cap are stated as prerequisites "before the first test",
  and their existence is not guaranteed**: same plan §12.6 D and F — Tier 1 / **HIGH** for the
  requirement, **VERIFY-ON-FIELD** for whether it was done.
- **`npm run tocca-ai` is the intended mechanism, and is not yet implemented** `[ABSENT-VERIFIED]`:
  absence protocol executed — (1) *by synonym*: no script under any similar name in the `scripts`
  section of `crmadv/package.json`, whose siblings `mappa` and `lint:colors` are the named analogues;
  (2) *by schema*: `package.json` `scripts` is the exhaustive index of npm scripts, read in full;
  (3) *by index*: `grep -rn "tocca-ai"` across the repository (excluding `node_modules`) returns only
  document mentions — the plan itself and `team-agenti.md` — and no implementation. The plan lists it
  under "cosa resta da fare, all'accensione del collaudatore AI" — Tier 1 / **HIGH**.
- **The three paid sinks, and the enumeration method**: `agency.service.ts` — JSON runner
  (`runAgencyOpenAiJsonWithMeta`), text runner (`runAgencyAiTextWithMeta`), direct provider calls at
  `agency.service.ts:3226` / `:3269` / `:3291` / `:3450` / `:3480` / `:3501` / `:3794` and
  `server/modules/sources/sources.rag.ts:18` — Tier 1 / **HIGH** (read directly).
- **The `functionName` inventory**: enumerated from every `functionName:` literal under `server/`, plus
  the dynamic `chat.${scope}` at `agency.service.ts:8852` with scopes `general` / `project` / `client`
  — Tier 1 / **HIGH**.
- **The competitor search has no `functionName` and writes no usage row**: `runAgencyOpenAiCompetitorSearch`
  (`agency.service.ts:3747`, called once at `:7912`) performs its own `fetch` to
  `https://api.openai.com/v1/responses` at `:3794` — Tier 1 / **HIGH**. Coverage consequences are
  claimed and sourced in → [F02:SOURCE_NOTES].
- **The SEO audit is not an AI generation** `[ABSENT-VERIFIED]`: `server/modules/web-assets/seo-analyzer.ts`
  header states *«Analyzer SEO puro … Nessuna rete, nessun DB, nessuna AI: e' deterministico e
  rule-based»*; absence protocol — (1) *by synonym*: no `openai`/`anthropic`/`fetch` reference in the
  file; (2) *by chain*: the module is called from `web-assets/service.ts`, which does not reach any
  paid sink; (3) *by index*: no `seo` `functionName` appears among the enumerated usage-log function
  names — Tier 1 / **HIGH**. ⚠️ This **contradicts** `piano-paperclip-2026-08-19.md` §2.2 and
  `paperclip/consegna-ai-skill-lab.md` §4, which both list "audit SEO" among the AI outputs to test.
- **The model-default case of 21/7/2026**: `crmadv/archivio-documenti/piano-collaudo-chiavi-ai.md`,
  section "Migliorie e correzioni emerse durante il collaudo"; mechanism confirmed in code at
  `resolveAgencyProviderModel` (`agency.service.ts:2274`) with `DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8'`
  (`:2266`) — Tier 1 / **HIGH** (documented incident plus the code that caused it, both read).

VERIFY-ON-FIELD:
- **`npm run tocca-ai` once it exists**: confirm its exit contract (exit code vs. printed answer) and
  whether it reports *which* touchpoint fired. This document assumes only "yes or no"; if it reports
  the touchpoint, → [F02:SETUP_SEQUENCE] can be narrowed to the affected generation instead of the
  whole family.
- **The inventory table** is a snapshot. Re-run the three-sink enumeration at each use; treat any new
  path found as an AI area even if it appears nowhere in this table.
- **`reporting.excelMapping` and the competitor search are absent from the costed list**
  (`AGENCY_AI_ESTIMATABLE_FUNCTIONS` covers five functions only), so the 3–9 ¢ figure is not
  established for them — do not quote that cost range for those two without measuring.

------------------------------------------------------------------------------

End of document — [F01 — When a test run is owed] · crm-collaudo-generazioni-ai (v1.0)
