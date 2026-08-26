# KNOWLEDGE DOCUMENT — [F03]
# Telling a real generation from a fallback, and from a silent lie
# Skill: crm-collaudo-generazioni-ai (v1.0) | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F03:USAGE_NOTE]

Read this the moment a result comes back, **before** reading a word of its content. This is where the
failures of this craft live: every one of the cases below actually happened in this project, and each
one produced a confident, wrong conclusion.

Nothing in → [F04] may be applied until this document has produced a verdict. Judging the wording of an
output that no model wrote is worse than not testing at all: it reports a model behaviour that does not
exist.

Traceability: → [F03:SOURCE_NOTES].

---

## PART 1 — THE THREE OUTCOMES  [F03:THREE_OUTCOMES]

Every generation in this CRM has a deterministic, rule-based fallback behind it. So a result is one of
three things, and they are not equally visible:

| | Outcome | What it looks like | Severity |
|---|---|---|---|
| **A** | **Real generation** | model output, grounded in the declared sources | judge it → [F04] |
| **B** | **Declared fallback** | rule-based output, mode flag says so | honest. Report it and stop |
| **C** | **Silent lie** | rule-based, empty or partial content — **flagged as AI-generated** | worst. This is what the job exists for |

**A good fallback resembles a real result, only poorer.** That is the whole difficulty. On 22 July 2026
a Discovery came back HTTP `200` with plausible sections — `«Dati insufficienti… Target non definito»`
— and looked like the model speaking. The model had in fact been called and billed, its output had
failed to parse, and the system had fallen back. Concluding "the AI marks target as not defined" was
one sentence away, and would have been false.

**Rule: never form a verdict from the prose.**

---

## PART 2 — THE MODE VOCABULARY  [F03:MODE_VOCABULARY]

Generations report what happened in a mode flag — for Discovery it is `discovery.aiGeneration.mode`.
The full vocabulary in use:

| Value | Meaning | What it implies for the run |
|---|---|---|
| `ai_with_sources` | model output accepted, grounded in sources | candidate outcome **A** — still to be confirmed → [F03:CROSS_CHECK] |
| `ai_structured` | model output accepted via structured output (spreadsheet mapping) | same |
| `fallback_rule_based` | the model failed or was unavailable; rule-based output returned | outcome **B**. The accompanying `error` field says why |
| `ai_failed_fallback_available` | the model failed; nothing generated, the previous/rule-based output stands | outcome **B** |
| `ai_not_configured` | no provider key configured | not a run at all. Stop and report → [F02:SETUP_SEQUENCE] |
| `budget_exceeded` | the daily fuse tripped before the call | not a run. Report the limit and the amount spent |

Alongside the mode, a successful generation carries observables that matter more than the mode itself:
`cacheHit`, `inputHash`, `estimatedInputTokens`, `estimatedOutputTokens`, `estimatedCostUsd`,
`durationMs`, `provider`, `model`.

The chat reports differently — `aiInvoked`, `aiConfigured`, `budgetExceeded`, `budgetMessage` — and
**returns HTTP `200` even when the budget blocked it**. A `200` from the chat is not evidence that a
model ran; `aiInvoked` is.

---

## PART 3 — THE FLAG IS NOT THE TRUTH  [F03:FLAG_IS_NOT_TRUTH]

The mode flag is **more** reliable than the prose, and **less** reliable than the evidence. It answers
"which branch did the code take", not "did a model write this".

Two established ways the flag says "AI used" over content the model did not produce:

1. **The empty structured payload** → [F03:SILENT_LIE].
2. **Field-level fallback merging.** In the Discovery, each section is written as *the model's value if
   present, otherwise the rule-based value*. A model that returns six of eight sections yields a brief
   where two sections are rule-based text — and the mode still reads `ai_with_sources`. The mode
   describes the call, not each field.

**Consequence:** a verdict of "real generation" is never based on the flag alone. It is based on the
flag **plus** the ledger **plus** the shape of the payload → [F03:CROSS_CHECK].

---

## PART 4 — THE THREE-WAY CROSS-CHECK  [F03:CROSS_CHECK]

Three independent observables. A verdict needs all three to agree.

**① The mode flag** — which branch the code took → [F03:MODE_VOCABULARY].

**② The usage ledger** (`AiUsageLog`) — one row per paid call, carrying function name, model, input and
output tokens, cost, duration and status. Read the row for this run, by function name and timestamp,
under the agent's own account.

> ⚠️ **The ledger row is written *before* the result is used.** "Cost logged" therefore does **not**
> imply "result used". A row with `status: success` sitting next to fallback output means the model ran,
> was billed, and its output was thrown away — a defect between the call and the use of its result,
> typically in parsing. That is a finding in itself, and an expensive one: the money was spent for
> nothing.

**③ The shape of the payload** — the keys actually present, and the output token count. This is the
observable that catches what the other two cannot.

| ① mode | ② ledger row | ③ payload | Verdict |
|---|---|---|---|
| `ai_with_sources` | present, `success`, output tokens in the hundreds or more | expected keys, populated | **A — real** |
| `fallback_rule_based` | **absent** | rule-based text | **B — declared fallback**, model never called |
| `fallback_rule_based` | **present**, `success` | rule-based text | **B**, but with a defect: paid and discarded. Report it |
| `ai_with_sources` | present, output tokens ≈ 4 | one key, or only keys beginning `_` | **C — silent lie** → [F03:SILENT_LIE] |
| `ai_with_sources` | present | some fields populated, others verbatim rule-based text | **C, partial** — field-level merge → [F03:FLAG_IS_NOT_TRUTH] |
| any | `cacheHit: true`, tokens `0` | anything | **not a run at all** → [F02:CACHE_TRAP] |

---

## PART 5 — THE SILENT LIE  [F03:SILENT_LIE]

The most dangerous outcome, and the reason this job exists.

**What happened (23 July 2026).** Structured output was introduced so the model would always return
valid JSON: it is forced to answer by calling a tool whose `input_schema` describes the expected object.
The schema passed was generic — an object with no declared properties — on the reasoning that the shape
was already described in the system prompt. The model, given nothing to fill, answered with a
placeholder: **`{"_dummy": …}`, four output tokens.** Perfectly valid JSON, completely empty. The code
took it for a successful generation and marked the brief as AI-generated, while its content came
entirely from the rule-based fallback.

**A silent fallback had been replaced by a silent lie** — which is worse, because a declared fallback
tells you what it is.

**Why it happens.** In structured output **the schema drives the generation, not the system prompt.**
A schema that declares no properties gives the model no fields to fill.

**What to check, in order:**

1. **Does the caller pass a schema at all?** Structured output only engages when the caller supplies
   one. Without it the code stays on the older behaviour — JSON asked for in the prompt and parsed out
   of the text — which is the path that produced the July failure with Anthropic
   → [F02:PROVIDER_MATRIX].
2. **Does the schema list the real fields?** An `object` with an empty `properties` map, or with only
   `additionalProperties: true`, is the failure above. The schema should be derived from the constants
   that already define the fields, so it cannot drift when a field is added.
3. **Output tokens.** A number in the single digits for a generation that should produce a document is
   the signal. The July run went from 4 tokens to 1029 once the schema was real.
4. **Payload keys.** A single key, or keys beginning with `_`, means placeholder. The engine already
   treats such a payload as a failure rather than a success — an empty tool result raises instead of
   returning — so if one reaches the output anyway, that guard has been bypassed and it is a finding.

**General rule that generalises beyond this case:** after any change that "fixes" a generation, do not
stop at the mode flag. **Look at the output token count and at the payload keys.**

---

## PART 6 — THE LEDGER BLIND SPOT  [F03:LEDGER_BLIND_SPOT]

The cross-check in → [F03:CROSS_CHECK] assumes the ledger sees the call. For one path it does not.

**The competitor web search writes no ledger row** `[ABSENT-VERIFIED]` → [F02:SOURCE_NOTES]. For that
path the inference **inverts**: "no row in the ledger" does **not** mean "no model ran". It means
nothing at all. Verify it by its own output — competitors returned, with URLs and stated reasons — and
by the provider-side accounting, never by the absence of a ledger row.

**A second blind spot, of a different kind: swallowed errors.** The spreadsheet-mapping generation
wraps its engine call in a `catch` that discards the error and continues with the rule-based mapping.
A budget refusal there therefore surfaces as `fallback_rule_based` with no explanation, not as
`budget_exceeded`. So on that path:

- `fallback_rule_based` may mean the model failed, **or** that the fuse tripped, **or** that AI is not
  configured — the mode alone cannot distinguish them;
- resolve it with the ledger and with the fuse state → [F02:FUSE_COVERAGE], not by re-reading the mode.

**Rule:** before trusting a mode value, know whether that particular generation reports its failures or
swallows them. When in doubt, treat the mode as a hint and the ledger as the record.

---

## PART 7 — VERDICT PROCEDURE  [F03:VERDICT_PROCEDURE]

Executable, in order. Every branch ends in an action or in a declared stop.

1. **Read `cacheHit` and the token counts.** `cacheHit: true`, or both counts `0` → **not a run**.
   Change project or input, run again → [F02:CACHE_TRAP]. Do not judge, do not report a result.
2. **Read the mode.** `ai_not_configured` or `budget_exceeded` → **not a run**. Report the state and
   stop; there is nothing to judge.
3. **Fetch the ledger row** for this function and timestamp, under the agent's account. Record `model`,
   `status`, `inputTokens`, `outputTokens`, `costUsd`. If the path is one that writes no row, say so
   explicitly rather than reading the absence as evidence → [F03:LEDGER_BLIND_SPOT].
4. **Read the payload keys and the output token count.** Single key, `_`-prefixed keys, or output
   tokens in the single digits → **outcome C**, silent lie. Report it as such and stop
   → [F03:SILENT_LIE].
5. **Compare the output field by field against the rule-based output** for the same input — obtainable
   by regenerating from sources without AI. Fields identical to the rule-based text inside an
   `ai_with_sources` result → **outcome C, partial**. Name which fields.
6. **Mode says fallback, ledger has a row** → **outcome B with a defect**: paid and discarded. Report
   both facts.
7. **All three agree** → **outcome A**. Only now proceed to → [F04:CONTRACT_RULE].

**Record the evidence, not the conclusion alone.** Provider, model, mode, `cacheHit`, both token
counts, cost, and the payload keys. A verdict without them cannot be re-checked by anyone
→ [F05:EVIDENCE].

---

## PART 8 — CASES  [F03:CASES]

### Caught correctly — the code fence  [F03:CASE_CODE_FENCE]

**Input (22 July 2026):** a Discovery generation on real RAG sources. HTTP `200`, plausible sections.
**Outcome:** the mode read `fallback_rule_based` while the ledger held a `discovery.generateBrief` row
with `status: success`. Verdict: outcome **B with a defect** — the model ran, was billed, and its
output was discarded because the JSON arrived wrapped in a markdown code fence that the stripper did
not remove.
**Cause:** the fence-stripping pattern only matched when the entire response was a clean fenced block;
any preamble left the fence in place and `JSON.parse` failed.
**Lesson:** the ledger is what separates "the model was not called" from "the model was called and
wasted". The prose could not have told them apart.

### Caught correctly — four tokens  [F03:CASE_FOUR_TOKENS]

**Input (23 July 2026):** verification that the new structured output worked.
**Outcome:** mode `ai_with_sources`, ledger row present with `status: success` — and
`estimatedOutputTokens: 4` with a single `_dummy` key. Verdict: outcome **C**, silent lie.
**Cause:** the schema declared no properties, so the model had no fields to fill; the flag reported the
branch, not the content.
**Lesson:** the two observables that caught it were the **token count** and the **payload keys** —
neither of which is the mode flag → [F03:SILENT_LIE].

### Missed — the single provider  [F03:CASE_ONE_PROVIDER]

**Input:** the same JSON-production change tested only on the configured provider, OpenAI.
**Outcome:** everything passed. The Anthropic branch was silently falling back for every generation.
**Cause:** the two providers ask for JSON in different ways; OpenAI's JSON-object format was holding
while Anthropic's prompt-and-parse path was not.
**Lesson:** a change to how JSON is produced is tested on both branches, or the report covers half of
what it claims → [F02:PROVIDER_MATRIX].

### Missed — the confident non-run  [F03:CASE_CACHED_CONFIRMATION]

**Input:** re-generating the same project to confirm a schema fix.
**Outcome:** a complete brief, mode `ai_with_sources`, "fix confirmed" reported. In fact
`cacheHit: true`, zero tokens, no new ledger row: the payload predated the fix.
**Cause:** identical inputs produce an identical `inputHash`, and the cached payload carries the mode
of the run that created it.
**Lesson:** step 1 of → [F03:VERDICT_PROCEDURE] exists for this. A cache hit is not a weak result, it
is **no result**, and reporting it as confirmation is the one error that actively misleads.

---

## [F03:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research 24 August 2026. Method: direct reading of the `crmadv` sources
(primary, first-hand) plus the project's field notes, which record the incidents as they happened.
Standing caveat: line numbers reflect the working tree on that date; the named symbol is stable.

- **Every generation has a rule-based fallback behind it, and a good fallback resembles a real result**:
  `crmadv/archivio-documenti/note-operative-ai.md` #30 (incident of 22/7/2026) — Tier 1 / **HIGH**
  (first-hand field note); mechanism visible in `agency.service.ts` at the Discovery, Web and Ads
  `catch` blocks.
- **The mode vocabulary**: enumerated from every `mode:` literal under `server/` —
  `ai_with_sources` (`agency.service.ts:9759` and four more), `fallback_rule_based` (`:9793`, `:9910`
  and more), `ai_failed_fallback_available` (`:6560`, `:6758`, `:7156`), `ai_not_configured`,
  `budget_exceeded` (`:9777`), `ai_structured`
  (`server/modules/agency-os/reporting/excel-ingestion.service.ts:203`) — Tier 1 / **HIGH**.
- **The observables carried by a successful generation** (`cacheHit`, `inputHash`,
  `estimatedInputTokens`, `estimatedOutputTokens`, `estimatedCostUsd`, `durationMs`, `provider`,
  `model`): Discovery `aiGeneration` block, `agency.service.ts:9758`–`:9769`; runner meta at `:3344`
  — Tier 1 / **HIGH**.
- **The chat returns HTTP `200` with `aiInvoked: false` when the budget blocks it**:
  `agency.service.ts:8862`, with `aiInvoked` also at `:8763`, `:8768`, `:8881`; verified end-to-end on
  21/7/2026 and recorded in `crmadv/archivio-documenti/piano-collaudo-chiavi-ai.md` §10.5 — Tier 1 /
  **HIGH**.
- **The ledger row is written before the result is used, so "cost logged" ≠ "result used"**:
  `aiUsageRepository.create` at `agency.service.ts:3321` sits ahead of the `JSON.parse` in the returned
  payload at `:3343`; stated independently in `note-operative-ai.md` #30 — Tier 1 / **HIGH**.
- **`AiUsageLog` fields**: `prisma/schema.prisma:828` — Tier 1 / **HIGH**.
- **Field-level fallback merging in the Discovery**: `agency.service.ts:9674`–`:9681`, each section
  written as `String(aiSections.<key> || fallback.sections.<key>)` inside the branch that returns
  `mode: 'ai_with_sources'` — Tier 1 / **HIGH** (read directly; the consequence for the mode flag is a
  direct reading of the same code path).
- **The silent lie of 23/7/2026 — generic schema, `{"_dummy": …}`, 4 output tokens, 1029 after the fix**:
  `note-operative-ai.md` #32 and the header comment of
  `server/modules/agency-os/anthropic-json.ts` (*«ATTENZIONE (verificato dal vivo il 23/7/2026)»*) —
  Tier 1 / **HIGH** (field note plus the code comment written from it).
- **Structured output engages only when the caller supplies a schema; an empty tool result is treated
  as a failure**: `agency.service.ts:3215` (`useStructuredOutput = Boolean(input.jsonSchema)`), `:3222`,
  and `:3244` which raises on `isEmptyStructuredPayload`; helper at `anthropic-json.ts:70` — Tier 1 /
  **HIGH**.
- **The code-fence incident and its cause**: `stripJsonCodeFence` (`agency.service.ts:2463`), whose own
  comment records that the previous anchored pattern removed the fence only when the whole response was
  a clean block, silently sending JSON generations to the rule-based fallback — Tier 1 / **HIGH**.
- **The spreadsheet-mapping path swallows engine errors**:
  `excel-ingestion.service.ts:186`–`:199`, `catch (_error) { result = null; }`, returning
  `mode: 'fallback_rule_based'` at `:205` — Tier 1 / **HIGH**.
- **The competitor search writes no ledger row** `[ABSENT-VERIFIED]`: absence protocol and sources in
  → [F02:SOURCE_NOTES] — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **The mode field's exact location varies by generation.** It is `discovery.aiGeneration.mode` for the
  Discovery and an `aiGeneration` block for Web and Ads; the spreadsheet mapping returns `mode`
  alongside its result. Confirm the path in the actual response before asserting a mode value in a
  finding, rather than assuming the Discovery shape everywhere.
- **Whether a generation other than the spreadsheet mapping also swallows engine errors**: only that
  one was read in full. Before trusting a `fallback_rule_based` on a path not listed here, check
  whether its `catch` preserves the error.
- **Token counts are estimates**, not provider-reported figures: they come from a character-based
  estimator, not from the API response. They are reliable as an order of magnitude — 4 versus 1029 —
  and should not be quoted as exact.

------------------------------------------------------------------------------

End of document — [F03 — Real generation, fallback, or silent lie] · crm-collaudo-generazioni-ai (v1.0)
