# KNOWLEDGE DOCUMENT — [F04]
# Judging the content of a generation against its contract
# Skill: crm-collaudo-generazioni-ai (v1.0) | Internal reference
# Version / Revision 1

---

## USAGE NOTE  [F04:USAGE_NOTE]

Read this **only after** → [F03:VERDICT_PROCEDURE] has established that a real generation took place.
Applied to a fallback, everything here produces a report about a model that never spoke.

This document says how the content is judged. It does **not** say whether the product is well designed
→ [F00:OUT_OF_SCOPE].

Traceability: → [F04:SOURCE_NOTES].

---

## PART 1 — THE CONTRACT RULE  [F04:CONTRACT_RULE]

> **A generation's contract is its system prompt plus its output schema. The output is judged against
> that contract, and against nothing else.**

This is the whole method, and it is deliberately narrow.

**Why the contract and not a standard of quality.** The domain experts are Jacopo and Claudio. They
have already written what each generation must and must not do — in the system prompt, which is the
instruction the model actually received, and in the `jsonSchema`, which is what drives the shape of
what it produces. Judging against anything else would mean this agent inventing a standard nobody
agreed to, at three in the morning, with nobody to correct it.

**Why it survives the CRM growing.** A generation not yet built will still have a system
prompt and a schema. The method does not need updating when a new AI feature appears — which is the
same reason an AI area is recognised structurally rather than from a list
→ [F01:AI_AREA_RECOGNITION].

**Where to read the contract.** Both are in the code, at the call site of the generation being tested:
the `system` argument passed to the runner, and the `jsonSchema` argument. Read them from the branch
under test, not from this document — this document records what they said on 24 August 2026, and prompt
text is exactly the thing that changes without anything else changing → [F01:CASE_PROMPT_ONLY].

**A violated contract is a finding. A contract you disagree with is not.** If the prompt forbids
something the agent thinks would be useful, that is a product opinion and it stays unsaid — with one
exception, recorded at → [F04:OPEN_POINT].

---

## PART 2 — THE FIVE CLAUSES  [F04:FIVE_CLAUSES]

The same five obligations recur across every generation contract in this CRM. They are the checklist.

| | Clause | How it reads in the prompts | What a violation looks like |
|---|---|---|---|
| ① | **Grounding** | `«usando solo le fonti dichiarate»`, `«usando solo brief, fonti e file dichiarati»`, `«esclusivamente fonti, brief e output corrente»` | a statement traceable to no declared source |
| ② | **No invention** | `«Non inventare target, offerta, CTA, USP o dati di mercato non presenti»`, `«non inventare prove sociali o dati non presenti»`, `«Non inventare aziende, URL o prove»` | an invented figure, company, testimonial, market claim or URL |
| ③ | **No placeholder** | `«Non inserire placeholder»` | `[nome cliente]`, `lorem ipsum`, `XX%`, an empty bracket left to be filled |
| ④ | **Attribution** | `«Ogni claim importante deve indicare fonte o assunzione»` | an important claim with neither a source nor a stated assumption |
| ⑤ | **Declared gap** | `«Se una informazione manca, scrivi che va validata e proponi domande operative»`, `«Se mancano dati, scrivi domande concrete da fare al cliente»` | a gap passed over in silence, or noted without the operative question the clause requires |

**Clause ⑤ is the one most often judged wrongly**, in both directions. Saying "this is missing" is not
enough to satisfy it — the contract asks for the missing item to be flagged **as needing validation**
*and* for concrete questions to ask the client. Conversely, a generation that fills a gap with a
plausible guess violates ② even though it reads better.

**Each verdict cites the passage that supports it.** A clause marked violated without the offending
sentence quoted is not a finding, it is an opinion → [F05:EVIDENCE].

---

## PART 3 — THE CONTRACT OF EACH GENERATION  [F04:FAMILY_GRID]

State on 24 August 2026. Re-read the contract from the branch under test → [F04:CONTRACT_RULE].

| Generation | Contract, in short | Clauses in force | Also check |
|---|---|---|---|
| `discovery.generateBrief` | `«Sei un senior strategist per agenzie digitali. Genera un brief Discovery strutturato usando solo le fonti dichiarate.»` Semantic excerpts (`relevantExcerpts`) are to be preferred as primary evidence over truncated ones | ①②④⑤ | the schema declares the eight section keys, plus `missingFields`, `confidenceBySection` (`low\|medium\|high`) and `usedSourcesBySection`; a section returned empty is silently replaced by rule-based text → [F03:FLAG_IS_NOT_TRUTH] |
| `discovery.generateSection` | same role; `«Rigenera una sola sezione Discovery usando solo le fonti dichiarate. Non copiare blocchi grezzi: sintetizza in modo operativo.»` | ①②⑤ | the anti-copying clause is specific to this one: verbatim source paste is a violation here and not elsewhere |
| `web.generateProject` | `«Sei un lead strategist e conversion copywriter per landing page. Genera output Web v2 usando solo brief, fonti e file dichiarati.»` | ①②③④ | ④ is explicit here: every important claim carries a source **or a stated assumption** |
| `web.generateBlock` | `«Rigenera un solo blocco Web usando esclusivamente fonti, brief e output corrente.»` | ①② | the block must stay consistent with the current output it is regenerated inside |
| `ads.generateAsset` | `«Sei un ads strategist per Google Ads e Meta Ads. Rigenera un singolo asset Ads usando solo fonti progetto, Discovery, Web e campagne correnti.»` | ①② | `«non inventare … promesse non presenti»` — a promise the client never made is the characteristic failure of ad copy |
| `reporting.excelMapping` | maps a non-standard client spreadsheet: identify what one row represents, the date column, the economic value column, the source/channel column, and the reading rules (date format, Italian numeric separators). `«Usa SEMPRE i nomi ESATTI delle intestazioni fornite»` | ②③ | the mapping is rejected downstream unless the date column it names is one that really occurs in the headers — an invented column name fails the run, not just the judgement |
| `chat.general` · `chat.project` · `chat.client` | conversational reply within a scope | ①②④ | the contract is assembled per scope from the conversation context; read it at the call site |
| competitor web search | `«Sei un market research analyst per agenzie digitali. Devi cercare online competitor reali e pertinenti per il progetto. Non inventare aziende, URL o prove: inserisci solo competitor trovati tramite ricerca web.»` Directories, marketplaces, generic portals and the client's own domain are to be excluded unless direct competitors | ①② | this path writes no ledger row, so the reality check is the output itself: each competitor must carry a URL that resolves and a stated reason → [F03:LEDGER_BLIND_SPOT] |

---

## PART 4 — WHAT THE MODEL DID NOT WRITE  [F04:NOT_THE_MODEL]

**Some of the most quotable sentences in a generation are computed by code, not generated.**

The Discovery warnings `«Target non definito nelle fonti disponibili.»`, `«Differenzianti/USP non
evidenti nelle fonti disponibili.»` and their siblings in the Web and Ads alerts are **rule-based**:
they are emitted when an evidence array comes back empty. No model produces them.

Attributing one of these to the model is the exact mistake of 22 July 2026 — "the AI marks target as
not defined" — and it is worse than a wrong judgement, because it reports a model behaviour that does
not occur, and someone then goes looking for it in the prompt.

**Before quoting any sentence as model output, establish that a model produced it:**

- warnings, alerts, readiness badges and `missingWarnings` entries are computed → treat as code
  behaviour, not generation quality;
- a section identical to the rule-based text for the same input is a merged fallback field, not a poor
  generation → [F03:VERDICT_PROCEDURE] step 5;
- when unsure, regenerate the same input **without** AI and diff. What appears in both came from the
  code.

---

## PART 5 — NO THRESHOLD BEYOND THE CONTRACT  [F04:NO_THRESHOLD]

**Judgement is on the five clauses. There is no scoring threshold, no minimum number of grounded
sections, no quality score.** `[SCOPE]`

This is a decision, not an omission: recorded by Jacopo on 24 August 2026 — *«nessuna soglia, giudica
sul contratto»*. It is stated here explicitly because an unattended agent that finds no threshold will
invent one, and an invented threshold is a product standard nobody agreed to.

So: the agent does **not** write "the brief is weak", "quality is mediocre", "this would not convince a
client". It writes which clause was violated, in which passage, and what follows from it. If every
clause holds and the result still seems thin, the finding is *«contratto rispettato»* plus, if useful,
one observation clearly labelled as such → [F05:FINDING_FORMAT].

---

## PART 6 — THE OPEN POINT, WHICH IS NOT JUDGED  [F04:OPEN_POINT]

One known tension must be recognised and **not** decided.

**The case.** Generating the Discovery of a project whose sources do not state the target, the system
marks it as undefined instead of inferring it from the available clues. It looks like a defect. It is
not: the strict-grounding clause ② is the same choice that makes the RAG and the chat trustworthy, and
the warning itself is rule-based → [F04:NOT_THE_MODEL].

**Its status.** Loosening the prompt for the Discovery only — allowing a reasoned hypothesis explicitly
marked as *«da validare»* — is a **proposal under discussion**, recorded in the roadmap as requiring a
decision by Jacopo and Claudio before anything is done, with a comparison note listing options A/B/C.
It is an open product decision.

**What the agent does with it.** If a run shows this behaviour: report it as *«comportamento previsto
dal contratto (grounding stretto); punto aperto noto, in attesa di decisione»*, cite the clause, and
move on. Do **not** record it as a violation, do **not** recommend loosening the prompt, do **not**
treat it as evidence that the generation is poor. Deciding it would be taking a product decision that
belongs to the council → [F05:GATES].

---

## PART 7 — HOW A JUDGEMENT IS PRODUCED  [F04:JUDGEMENT_PROCEDURE]

1. **Collect the contract** from the branch under test: the `system` string and the `jsonSchema` at the
   call site.
2. **Collect the declared inputs**: the sources, brief and files the generation was allowed to use.
   Clause ① cannot be judged without knowing what "declared" meant for this run.
3. **Separate what the model wrote from what the code computed** → [F04:NOT_THE_MODEL].
4. **Walk the five clauses in order** → [F04:FIVE_CLAUSES]. For each: `rispettata` / `violata` /
   `non applicabile`, with the passage quoted for anything other than `rispettata`.
5. **Check the schema was honoured**: every declared field present and populated. A field present but
   empty is a finding — it is how the silent lie begins → [F03:SILENT_LIE].
6. **Write the finding** → [F05:FINDING_FORMAT].

**Where step 4 is delegated to a model call** — the second of the two calls a complete run is costed at
→ [F02:COST_REALITY] — that call receives the contract text and the declared inputs, and returns a
verdict **per clause with the supporting passage quoted**. A judging call that returns a global
impression is unusable: it cannot be checked, and it drifts straight into the product opinions this
skill is forbidden to produce → [F00:OUT_OF_SCOPE].

---

## PART 8 — CASES  [F04:CASES]

### Violation caught — the invented proof  [F04:CASE_INVENTED_PROOF]

**Input:** a landing page generated for a test project whose sources contain no customer numbers. The
output opens with *«oltre 500 clienti soddisfatti»*.
**Outcome:** clause ② violated, clause ④ violated. Finding written, with the sentence quoted.
**Cause:** social proof is the field where invention is most tempting and least detectable — it reads
exactly like real copy.
**Lesson:** ② is checked against the declared inputs, not against plausibility. A believable number is
the dangerous kind.

### Compliance confirmed — the declared gap  [F04:CASE_DECLARED_GAP]

**Input:** a Discovery whose sources say nothing about tracking. The output states that tracking is not
documented in the sources, marks it for validation, and asks two concrete questions of the client.
**Outcome:** clauses ②, ⑤ satisfied. No finding.
**Cause:** the contract asks precisely for this — flag it, and propose operative questions.
**Lesson:** an output that admits a gap in the required form is a **success**, not a weak result. Read
against a vague notion of quality it would look poor; read against the contract it is exactly right.

### Wrong judgement — the rule-based sentence  [F04:CASE_RULE_BASED_QUOTE]

**Input:** a Discovery containing `«Target non definito nelle fonti disponibili.»`. The agent reports
that the model refuses to infer the target and suggests softening the prompt.
**Outcome:** two errors in one finding. The sentence was computed by code, so the report describes a
model behaviour that did not happen; and the suggestion is a product decision that is explicitly
pending.
**Cause:** quoting the output without establishing who wrote the sentence.
**Lesson:** → [F04:NOT_THE_MODEL] runs before the clause walk, not after. And → [F04:OPEN_POINT]
exists so this particular sentence is recognised on sight.

### Wrong judgement — the invented threshold  [F04:CASE_INVENTED_THRESHOLD]

**Input:** a brief where six of eight sections are anchored to a source and two rest on stated
assumptions. All five clauses hold.
**Outcome:** the agent reports *«qualità insufficiente: solo 6 sezioni su 8 ancorate»*.
**Cause:** the criteria carry no threshold of that kind; the agent supplied one because a bare "contract respected" felt
like too little to report.
**Lesson:** "contract respected" **is** the report. Anything beyond it is a standard nobody agreed to
→ [F04:NO_THRESHOLD].

---

## [F04:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research 24 August 2026. Method: direct reading of the system prompts and
schemas at each generation's call site in `crmadv/server/`, plus the project's roadmap and field notes.
Standing caveat: prompt text is the single most volatile thing in this document — the line numbers
below locate it, they do not preserve it. Re-read at the branch under test.

- **Discovery brief contract**: `agency.service.ts:9640`–`:9645`, quoted verbatim; `requiredOutput`
  declaring the section keys, `missingFields` (`target`, `offer`, `CTA`, `USP`, `geo`, `tracking`,
  `socialProof`, `creativeMaterials`), `confidenceBySection` and `usedSourcesBySection` at `:9625`;
  schema `DISCOVERY_AI_JSON_SCHEMA` passed at `:9668` — Tier 1 / **HIGH**.
- **Discovery section contract**: `agency.service.ts:9946`–`:9950`, including the
  `«Non copiare blocchi grezzi: sintetizza in modo operativo»` clause specific to this generation —
  Tier 1 / **HIGH**.
- **Web project contract**: `agency.service.ts:6454`–`:6457` — Tier 1 / **HIGH**.
- **Web block contract**: `agency.service.ts:6660`–`:6662` — Tier 1 / **HIGH**.
- **Ads asset contract**: `agency.service.ts:7064`–`:7066` — Tier 1 / **HIGH**.
- **Competitor search contract**: `agency.service.ts:3772`–`:3776` — Tier 1 / **HIGH**.
- **Spreadsheet mapping contract, and the rejection of a mapping whose date column is not among the
  real headers**: `reporting/excel-ingestion.service.ts:178`–`:185` (prompt) and `:202`–`:205`
  (acceptance condition) — Tier 1 / **HIGH**.
- **The five recurring clauses** are a distillation across the six contracts above, not a quotation
  from any single one — Tier 1 sources, **HIGH** for each individual clause (each is quoted verbatim
  from at least one prompt), **MEDIUM** for the claim that these five are *the* recurring set (it is an
  inference from six prompts read in full; a seventh generation could carry a clause not on the list).
- **The Discovery warnings are rule-based, emitted on empty evidence arrays**: `agency.service.ts:3985`
  (`«Target non definito nelle fonti disponibili.»`), `:3988` (`«Differenzianti/USP non evidenti nelle
  fonti disponibili.»`), with the Web/Ads alert equivalents at `:5689`, `:5699`, `:5729` — Tier 1 /
  **HIGH** (read directly); the consequence for diagnosis is stated independently in
  `crmadv/archivio-documenti/note-operative-ai.md` #30.
- **The target-inference question is an open product decision**:
  `crmadv/archivio-documenti/03-roadmap-confronto-e-build.md`, V5 residue — records the strict-grounding
  cause, the rule-based nature of the alerts, the proposed remedy (a reasoned hypothesis marked
  `«da validare»`), and the explicit condition *«Jacopo vuole confrontarsi con Claudio PRIMA di
  procedere»*, with the comparison note
  `crmadv/archivio-documenti/nota-confronto-claudio-2026-07-22.md` (options A/B/C) — Tier 1 / **HIGH**.
- **No threshold beyond the contract**: decided by Jacopo, 24 August 2026, in this skill's development
  session — Tier 1 / **HIGH** (direct instruction).
- **Domain criteria belong to Jacopo and Claudio; this skill is the container, not the author**:
  `crmadv/paperclip/consegna-ai-skill-lab.md` §4 and
  `crmadv/archivio-documenti/piano-paperclip-2026-08-19.md` §2.4 (*«gli esperti di dominio siete voi …
  un parere plausibile ma sbagliato costa più di nessun parere»*) — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **The chat contracts** (`chat.general` / `chat.project` / `chat.client`) were not read in full: they
  are assembled per scope from the conversation context rather than written as one literal string.
  Before judging a chat generation, read the assembled system message at the call site; do not assume
  the five clauses apply unchanged.
- **The second call — the judging one** `[NOT-FOUND]`. Where it runs, which account it is billed to and whether it
  appears in any ledger was not established here. Confirm before the first real run, because a judging
  call outside the CRM is outside the daily fuse → [F02:FUSE_COVERAGE].
- **Whether the five clauses cover a generation added after 24 August 2026**: re-derive them from that
  generation's own prompt rather than assuming the list is complete.

------------------------------------------------------------------------------

End of document — [F04 — Judging the content against its contract] · crm-collaudo-generazioni-ai (v1.0)
