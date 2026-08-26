# KNOWLEDGE DOCUMENT — [F02]
# Setting up a test run before anything is generated
# Skill: crm-collaudo-generazioni-ai (v1.0) | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F02:USAGE_NOTE]

Read this **before** starting any generation. Everything here is decided before the first paid call:
who calls, from where, on what data, with which generator, and which safety net is holding. A run set
up wrong does not fail loudly — it produces a result that looks fine and means nothing.

Traceability: → [F02:SOURCE_NOTES].

---

## PART 1 — CALL THE CRM AS A USER  [F02:CALL_AS_USER]

**The agent has its own dedicated CRM account, and it calls the CRM through the same routes a person
would** — authenticate at `/auth/login`, then hit the generation route.

Two independent reasons, and either one alone would be enough:

1. **Fidelity.** Going through the real route tests what the client actually receives, not an internal
   shortcut.
2. **The fuse only exists if there is a user in the request context.** The daily budget guard reads the
   user id from the request context and **returns immediately when there is none** — system jobs are
   deliberately exempt. An agent calling the engine outside a user request is therefore running with
   the fuse removed, without any error to say so.

**The dedicated account is also where the accounting separates.** Every paid call that reaches the
ledger is stamped with workspace, user, project, function name, model, tokens, cost, duration and
outcome. One account gives both things at once: the agent's spend distinguishable from everyone else's,
and the single place where the fuse is set.

---

## PART 2 — THE FUSE, AND WHAT IT ACTUALLY COVERS  [F02:FUSE_COVERAGE]

**What it is.** `AiBudget` — a **daily limit in dollars, per user**, checked *before* each paid call.
Over the limit it raises `AiBudgetExceededError`. Decided value on the agent's account: **10 $/day**.

**It is a fuse against a malfunction, not a spending policy.** In normal operation the number of runs
is bounded by the tasks that touch AI. In a malfunction it is bounded by nothing: a retry loop makes
two calls per turn and has no reason to stop; break on a Friday evening and that is sixty hours
unattended. A run costs cents → [F02:COST_REALITY]; the agent works freely.

**Two traps, or the fuse is not there at all:**

1. **No user in context → the check is skipped** → [F02:CALL_AS_USER].
2. **`0` does not mean "blocked", it means "no limit".** A limit of zero — or no `AiBudget` row at all,
   which resolves to zero — disables the guard. Confirming "the budget is set to 0" is confirming that
   nothing is holding.

**Limit resolution order:** personal override for the user → workspace default row → **no limit**.
So an account with no row of its own inherits the workspace default, and if that is missing too, it
runs unbounded.

**What the fuse actually covers.** `[ABSENT-VERIFIED]` — the guard is invoked from exactly **two**
call sites, both of them the runners. The other two paid paths are outside it:

| Paid path | Fuse | Usage ledger |
|---|---|---|
| JSON runner — `discovery.*`, `web.*`, `ads.*`, `reporting.excelMapping` | ✅ | ✅ |
| Text runner — `chat.*` | ✅ | ✅ |
| RAG embeddings — `sources.embed.index`, `sources.embed.search` | ❌ **not covered** | ✅ |
| Competitor web search — `runAgencyOpenAiCompetitorSearch` | ❌ **not covered** | ❌ **no row written** |

Two operational consequences:

- **Embeddings spend against the budget without being stopped by it.** Their cost *is* written to the
  ledger, so it counts toward the day's total that the guard sums — but no embedding call is ever
  refused. A day heavy on re-indexing can therefore exhaust the headroom that a later generation needs.
- **The competitor search is invisible on both counts**, which changes how its result must be verified
  → [F03:LEDGER_BLIND_SPOT].

Neither is a defect to fix — this agent does not fix things → [F00:OUT_OF_SCOPE]. Both are facts the
run must be planned around, and are worth stating in a finding if a task touches those paths.

---

## PART 3 — TEST WORKSPACE AND TEST DATA  [F02:TEST_DATA]

**Generate against the development workspace (slug `demo`) and its test projects. Never against real
client data.** That workspace exists precisely for this and has been the development environment since
the beginning of the project.

Three reasons, in descending order of severity: a generation writes its output back onto the entity, so
a test on a live client project corrupts deliverable material; a test on real data puts client content
through paid calls for no client benefit; and a test project can be created fresh, which is also how
the cache trap is avoided → [F02:CACHE_TRAP].

**Clean up what the run creates.** If a run creates rows, assets or projects, delete them at the end
**and verify they are gone** by re-listing and counting. A failed delete passes unnoticed and leaves
debris in the demo workspace — this has happened before.

---

## PART 4 — THE CACHE TRAP  [F02:CACHE_TRAP]

Generations cache their payload by `inputHash` — a hash of system prompt, user payload, function name
and model. **Re-generating on the same project with unchanged sources returns the cached payload
without calling anyone.**

The result looks like a successful generation. It carries `cacheHit: true` and zero token counts, and
that is the only thing distinguishing it.

**Therefore:**
- To test a change to the engine, use a **different project** (or change the input so the hash changes).
- **Always read `cacheHit` before judging anything.** `cacheHit: true` means the run tested the
  previous state of the world. It is not a result; it is a non-run.
- A run that returns `estimatedInputTokens: 0` **and** `estimatedOutputTokens: 0` is a cache hit even
  if you did not check the flag.

There is a second, unrelated de-duplication in the same area: concurrent identical calls share one
in-flight promise. Two simultaneous requests can therefore produce one paid call and two identical
results. Sequential runs avoid it.

---

## PART 5 — THE PROVIDER MATRIX  [F02:PROVIDER_MATRIX]

**The two providers take different code paths, and one can be broken while the other works.** This is
not theoretical: on 22 July 2026 the OpenAI branch was fine and the Anthropic branch was silently
falling back, because the two ask for JSON in different ways.

- **Anthropic** — Messages API. When the caller supplies a schema, JSON is produced by forcing a tool
  call, so it is valid by construction. Without a schema, JSON is requested in the prompt and parsed
  out of free text.
- **OpenAI** — Responses API with a JSON object format, with a fallback to Chat Completions if the
  first endpoint is rejected. JSON is always parsed from text.

**Rule:** where a change can affect JSON production — the schema, the prompt, the runner itself — test
**both providers**. Testing only the workspace default exercises one branch and reports on two.

**Which one is the default decides which path is really exercised**, so record in the finding which
provider each result came from. A result without its provider named is not reproducible.

---

## PART 6 — WHICH MODEL  [F02:MODEL_CHOICE]

**Use the workspace's configured model. Not a cheap one.**

This is a deliberate reversal of the earlier practice of preferring cheap models during manual
testing. The reason is the purpose of the job: the run must reproduce **what the client actually
receives**, and cost is no longer the constraint → [F02:COST_REALITY]. A brief judged on a cheap model
tells you about a model nobody uses.

**Record the model that actually ran, not the one configured.** Model resolution has a safety net that
substitutes the provider's default when the configured string does not look like that provider's — the
mechanism behind the 21 July incident → [F01:CASE_MODEL_DEFAULT]. The authoritative answer is the
`model` field on the usage-ledger row, not the settings page.

---

## PART 7 — COST REALITY  [F02:COST_REALITY]

A complete run is **two calls** — one that produces the generation, one that judges it — and costs
**3 to 9 US cents**. Two hundred runs a month is 6 to 18 dollars.

There is **no spending cap as a working policy**. The agent does not ration runs, does not skip a run
to save money, and does not choose a weaker model for cost. The only ceiling is the malfunction fuse
→ [F02:FUSE_COVERAGE], and a legitimately heavy day does not come near it.

⚠️ The 3–9 ¢ figure is established for the five costed generation functions. It is **not** established
for `reporting.excelMapping` or the competitor web search, which are absent from that costing —
measure rather than quote → [F02:SOURCE_NOTES].

---

## PART 8 — THE SETUP SEQUENCE  [F02:SETUP_SEQUENCE]

In order. Each step has a stop condition, because there is nobody to ask → [F00:OPERATING_CONDITIONS].

| # | Step | Stop if |
|---|---|---|
| 1 | Authenticate as the agent's own CRM user | authentication fails → park it: without a user there is no fuse → [F02:CALL_AS_USER] |
| 2 | Confirm the daily limit resolving for that user is **greater than zero** | it resolves to `0` or to `source: 'none'` → park it: the fuse is not armed → [F02:FUSE_COVERAGE] |
| 3 | Read the configured provider and model | AI is not configured → report `ai_not_configured` and stop; there is nothing to judge |
| 4 | Choose or create a **fresh test project** in the `demo` workspace | only live client projects are available → park it → [F02:TEST_DATA] |
| 5 | Decide whether both providers must be exercised | → [F02:PROVIDER_MATRIX] |
| 6 | Generate | — |
| 7 | Before judging anything, check `cacheHit` and the token counts | `cacheHit: true` → not a run; change project or input and repeat → [F02:CACHE_TRAP] |
| 8 | Establish what kind of result came back | → [F03:VERDICT_PROCEDURE] |
| 9 | Delete what the run created and verify it is gone | delete fails → say so in the finding → [F02:TEST_DATA] |

---

## PART 9 — CASES  [F02:CASES]

### Setup done right — the fresh project  [F02:CASE_FRESH_PROJECT]

**Input:** a change to the Discovery schema must be verified. The agent creates a new test project in
`demo`, attaches two sources, generates.
**Outcome:** real call, `cacheHit: false`, non-zero token counts, a ledger row under the agent's own
account.
**Cause:** the new project produces an `inputHash` never seen before, so nothing can be served from
cache.
**Lesson:** the cheapest way to defeat the cache trap is a project that has no history.

### Setup done wrong — the confirmed non-result  [F02:CASE_CACHE_HIT]

**Input:** the agent re-generates the Discovery of the project used last time to check that a schema
fix worked.
**Outcome:** a full, plausible brief comes back. `cacheHit: true`, `estimatedOutputTokens: 0`, no new
ledger row. The agent reports "fix confirmed".
**Cause:** identical inputs, identical hash, cached payload — **the fix was never exercised.** The
report certifies the state of the world *before* the change.
**Lesson:** this is the worst failure mode of the whole job, because it produces a confident false
positive. `cacheHit` is read before anything else → [F02:CACHE_TRAP].

### Setup done wrong — the fuse that was not there  [F02:CASE_NO_FUSE]

**Input:** the agent calls the engine through an internal entry point rather than the user-facing
route, because it is simpler.
**Outcome:** generations work, results look normal, and the daily limit is never enforced — the guard
returned immediately for want of a user in the context. A retry loop that night would have run to
exhaustion.
**Cause:** the exemption for system jobs is deliberate and silent. Nothing distinguishes a guarded call
from an unguarded one in the response.
**Lesson:** the route is not a convenience, it is the safety mechanism → [F02:CALL_AS_USER].

---

## [F02:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research 24 August 2026. Method: direct reading of the `crmadv` sources
(primary, first-hand) plus the project's decision and test-plan documents. Standing caveat: line
numbers reflect the working tree on that date; the named symbol is the stable reference.

- **The fuse: daily per-user dollar limit, checked before each paid call, raising
  `AiBudgetExceededError`**: `assertWithinAiBudget` (`agency.service.ts:2425`), `AiBudgetExceededError`
  (`:2400`), model `AiBudget` (`prisma/schema.prisma:691`) — Tier 1 / **HIGH**.
- **The check is skipped when there is no user in the request context, and `0` means "no limit"**:
  same function, explicit early returns on `!userId` and on `dailyLimitUsd <= 0`; the comment above it
  says so in as many words — Tier 1 / **HIGH**.
- **Limit resolution: personal override → workspace default → none**:
  `aiBudgetRepository.resolveLimitForUser` (`server/repositories/ai-budget.repository.ts`), with the
  sentinel `AI_BUDGET_DEFAULT_USER = '__workspace_default__'` — Tier 1 / **HIGH**.
- **The value 10 $/day, the dedicated CRM account, and "fuse not policy"**:
  `crmadv/archivio-documenti/piano-paperclip-2026-08-19.md` §12.6 D–E — Tier 1 / **HIGH** (decision
  document, 24/8/2026).
- **The fuse covers the two runners only; embeddings and the competitor search are outside it**
  `[ABSENT-VERIFIED]`: absence protocol executed — (1) *by synonym*: no occurrence of `budget`,
  `dailyLimit`, `assertWithin` or `Limit` guarding a call in `server/modules/sources/*.ts`;
  (2) *by call chain*: `createLoggingOpenAiEmbedder` (`sources.rag.ts:168`) is reached from
  `sources.indexing.ts:27` and from `agency.service.ts:2628` / `:2674` / `:3064` without passing the
  guard, and `runAgencyOpenAiCompetitorSearch` (`agency.service.ts:3747`) performs its own `fetch`;
  (3) *by index*: `grep -rn "assertWithinAiBudget" server/` returns exactly three hits — the definition
  at `:2425` and the two call sites at `:3173` (JSON runner) and `:3421` (text runner) — Tier 1 /
  **HIGH**.
- **The competitor search writes no usage-ledger row** `[ABSENT-VERIFIED]`: (1) *by synonym*: no
  `aiUsageRepository`, `costUsd`, `inputTokens` or `usage` reference inside the function body;
  (2) *by index*: `grep -rn "aiUsageRepository.create" server/` returns exactly three hits —
  `agency.service.ts:3321`, `:3534`, `sources.rag.ts:148` — none in that path; (3) *by schema*: the
  function has no `functionName` parameter, unlike every logged path — Tier 1 / **HIGH**.
- **Embedding cost is written to the ledger and therefore counts toward the day's sum**:
  `recordEmbeddingUsage` (`sources.rag.ts:136`) writes `costUsd` from
  `estimateEmbeddingCostUsd`; `assertWithinAiBudget` sums the day via
  `aiUsageRepository.sumCostForUser` — Tier 1 / **HIGH** (both read; the interaction between them is
  inference from two directly-read facts, hence flagged below).
- **Cache by `inputHash`, `cacheHit` flag, and shared in-flight promise**: `buildAgencyAiInputHash`
  (`agency.service.ts:2529`), `agencyAiInFlight` (`:2184`), `cacheHit` in the returned meta (`:3352`)
  and in the Discovery `aiGeneration` block (`:9762`); the cache trap is documented from the field in
  `crmadv/archivio-documenti/note-operative-ai.md` #32, "Trappola collaterale (cache)" — Tier 1 /
  **HIGH**.
- **The demo workspace (slug `demo`) is the development environment**: `prisma/seed-demo-agency.ts:199`,
  `prisma/seed-demo-enrich.ts:64`, plus the demo users in `prisma/seed-demo.ts` — Tier 1 / **HIGH**;
  confirmed as the environment in use by Jacopo, 24/8/2026 — Tier 1 / **HIGH**.
- **Cleaning up what a test run creates, and verifying the delete**:
  `crmadv/archivio-documenti/note-operative-ai.md` #31 — Tier 1 / **HIGH** (documented incident: two
  test assets left behind in the demo workspace).
- **Provider branching and the 22/7/2026 Anthropic-only failure**: `agency.service.ts:3211`–`:3310`
  (Anthropic branch, tool-use when a schema is supplied; OpenAI branch with the Chat Completions
  fallback); incident in `note-operative-ai.md` #30 — Tier 1 / **HIGH**.
- **Model resolution safety net**: `resolveAgencyProviderModel` (`agency.service.ts:2274`) with
  `DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8'` (`:2266`) — Tier 1 / **HIGH**.
- **Use the workspace model rather than a cheap one** — reversal of the guidance in
  `crmadv/archivio-documenti/piano-collaudo-chiavi-ai.md` "Premesse", decided by Jacopo on 24/8/2026 in
  line with §12.6 (*«prova ciò che il cliente riceve davvero»*) — Tier 1 / **HIGH** (decision recorded
  in this session).
- **Run cost 3–9 ¢ and the 200-runs-a-month arithmetic**:
  `piano-paperclip-2026-08-19.md` §12.6 C, costed from `AGENCY_AI_ESTIMATABLE_FUNCTIONS`
  (`agency.service.ts:2376`) at Claude Sonnet rates — Tier 1 / **HIGH** for the five listed functions.

VERIFY-ON-FIELD:
- **Embeddings eroding the generation budget** is an inference from two directly-read facts (embeddings
  write `costUsd`; the guard sums the day's `costUsd` for the user). Confirm on a real day by
  re-indexing heavily and then checking whether a generation is refused. Until then, do not quote a
  figure for how much headroom indexing consumes.
- **The 10 $/day limit and the dedicated account** are decided but were not yet created at the time of
  writing — the plan lists both under "cosa resta da fare, prima del primo collaudo". Step 2 of
  → [F02:SETUP_SEQUENCE] is what catches their absence; run it, do not assume.
- **Whether the daily window is server-local midnight** matters if the agent works at night: the guard
  computes the start of the day from the server's local time. Confirm the server timezone before
  reasoning about a limit "resetting overnight".
- **Cost of `reporting.excelMapping` and of the competitor search** `[NOT-FOUND]`: not established. Measure from the
  ledger for the first, and by provider-side accounting for the second, which writes no row.

------------------------------------------------------------------------------

End of document — [F02 — Setting up a test run] · crm-collaudo-generazioni-ai (v1.0)
