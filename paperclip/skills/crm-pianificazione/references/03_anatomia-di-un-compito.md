# KNOWLEDGE DOCUMENT — [R03]
# Anatomy of an issue — what has to be inside it, and who gets it
# Skill: crm-pianificazione (v1.0) | Internal reference
# Version 1.0

---

## USAGE NOTE  [R03:USAGE_NOTE]

Open this while writing an issue. It gives the fixed template of the description (in Italian, the
language the issue is written in), the company's definition of done, the verbatim conditions for
requesting the explorer's map, the assignment table, and the platform fields you fill.
Traceability: → [R03:SOURCE_NOTES].

---

## PART 1 — The rule that generates all the rest  [R03:MEMORY_IS_THE_ISSUE]

> **«La sessione è usa e getta. La memoria è il compito.»**

The agent that executes your issue does not remember the previous session, did not read the plan,
and did not talk to you. It knows exactly two things: what is written in the issue, and whatever
skills its description happened to activate. Everything else it will **infer**, silently, and an
inference made at three in the morning is never reviewed by anyone.

Two practical consequences:

- **Never write "as agreed", "as in the previous task", "continue from where PC-14 left off".**
  Restate the substance, or the issue is unreadable the moment the context is gone.
- **Write the reasoning, not only the instruction.** What was tried and discarded, and what to
  distrust, are worth more than the to-do list: they are what a fresh session cannot reconstruct.

---

## PART 2 — The eight blocks of a description  [R03:ANATOMY]

Fixed order. Write it in Italian, inside the issue. Blocks that do not apply are written as
`— nessuno`, never omitted: an absent block is indistinguishable from a forgotten one.

```markdown
**Cosa cambia per chi usa il CRM**
<Una frase. L'effetto visibile, non i file toccati.>

**Dove è scritto**
<Documento + sezione + la frase citata. Es.: decisioni-cliente-e-menu-2026-08-07.md §7.3 ⑥-ter n.1:
«manca il cambio password, in nessun punto del CRM».>

**Perimetro**
- Dentro: <elenco puntuale>
- Fuori: <ciò che si potrebbe pensare incluso e NON lo è, col perché>

**Vincoli che valgono qui**
<Solo quelli pertinenti, citati: regola ① permesso nel catalogo · ①-bis ruoli predefiniti +
migrazione dati · ② nomi italiani per ciò che l'utente legge · ②-bis chiavi tecniche secondo la
convenzione dell'elenco · token colore · soglie 500/800 · test della zona toccata.>

**Come si sa che è finito**
<Criteri osservabili, uno per riga. Vedi il blocco «fatto» qui sotto.>

**Cancello**
<🟢 verde | 🟡 giallo | 🔴 rosso> — <perché, in una riga, col criterio: se sbaglio si disfa da sola
o ce la portiamo dietro?>

**Cosa serve prima**
<I compiti bloccanti, con identificativo e motivo. Se non ce ne sono: «bloccanti: nessuno».>

**Mappa**
<Richiesta all'esploratore: sì/no, e quale condizione ricorre. Se no: «nessuna condizione ricorre».>
```

⚠️ **The blocker line is a duplicate on purpose.** You write it in prose *and* you encode it in the
field — the prose is for the human reading the issue, the field is what actually wakes the agent
→ [R04:ENCODE_DONT_NARRATE].

**The title.** An action verb plus the concrete outcome, in Italian, saying what changes for the
person using the CRM — the same rule the project applies to commit messages. *«Aggiungi la maschera
di cambio password nel Profilo»*, not *«Modifica index.jsx e auth.route.ts»*.

---

## PART 3 — «Fatto»: the company's definition of done  [R03:ACCEPTANCE]

A task may close **without a human having looked at the page** — decided on 19/8/2026. That makes
the acceptance list the only thing standing between a wrong feature and production, so it is not
decorative. The conditions for an issue to reach the gate:

1. the tests of the touched area are green;
2. lint and the colour guard are clean;
3. the **reviewer** has given a favourable opinion;
4. the **guardian** has given a favourable opinion, **if** the task touches permissions or security;
5. the **tester** has opened the page and attached the screenshots;
6. the explorer's link list is ticked **in full**.

**Write them as observable criteria, not as intentions.** *«Il login compare nel Registro
attività con utente, esito e origine»* is observable. *«Il registro funziona bene»* is not.

⚠️ **An acceptance criterion that assumes a capability the code does not have is invented work
wearing a disguise.** Before writing *«le altre sessioni cadono»*, check that sessions can be
dropped at all. If the check is not cheap, the criterion becomes a parked decision, not a
requirement → [R01:THE_WRITTEN_TEST].

⭐ **Encode the chain, per issue, and do not narrate it.** Conditions 3, 4 and 5 are not prose: they
are stages of the issue's `executionPolicy`, which the runtime enforces — *"the moment an executor
tries to close the issue, the runtime intercepts the transition and routes the work to the right
reviewer or approver"*. A stage carries `type: "review" | "approval"`, its participants (agent or
user), and `approvalsNeeded`; the policy also carries `maxReviewRounds` (default 3). An acceptance
chain written only in the description is a chain nobody enforces → [R05:HOW_TO_ENCODE].

**Which stage goes on which issue — this is not a judgement call:**

| Stage | Goes on | Condition |
|---|---|---|
| 🔍 **Revisore** | **every issue that changes code** | **none — it is unconditional.** The reviewer is a required state of the task, not a good habit |
| 🛡️ **Guardiano** | issues touching the **entry condition** below | conditional → [R03:GUARDIAN_ENTRY] |
| 🖥️ **Collaudatore** | every issue with a visible change, with screenshots attached | conditional on there being something to look at |
| 🧪 **Collaudatore AI** | when the deterministic script says the change touches AI | conditional → [R03:AI_TESTER_TRIGGER] — and **you may add it, never remove it** |

**Attach them issue by issue.** Declaring the chain once, in a closing note or in the milestone
description, is the most common way this goes wrong: the runtime enforces what is on the issue, and
nothing else. An issue without a review stage will close unreviewed, quietly, and the note you wrote
at the bottom of the plan will not stop it.

**Screenshots and evidence live on the issue** (attachments), never in a chat message.

### ⭐ The order of the stages is fixed, and it is not cosmetic  [R03:STAGE_ORDER]

Attach them in the order the company's task cycle runs them:

> **guardian → reviewer → interface tester → gate.**

That is the order of the cycle itself: *«Il guardiano controlla permessi e sicurezza, se il compito
li tocca. Il revisore controlla il resto»* — plan §1.2, steps 5 and 6, with the tester at 7 and the
gate at 8.

**Why the order is load-bearing, and not a matter of taste.** `maxReviewRounds` defaults to **3**.
A reviewer that runs before the guardian spends one of those three rounds on work the guardian is
about to send back anyway — and sending work back is a green decision the guardian takes without
asking anyone → [R05:GATES]. Two rounds burnt on the same defect, and the third is the last one.

**Corollary for the guardian's own scope:** because it runs first, whatever the guardian passes
reaches the reviewer afterwards, never the other way round. It does not inherit a second opinion.

### The guardian's entry condition — one list, and it lives here  [R03:GUARDIAN_ENTRY]

**Attach the guardian stage when the issue touches any of these:**

> **permissions · roles · routes · modules · menu entries · authentication · anything reachable
> without logging in · security.**

**Read it widely.** A public route and a migration both qualify. The cost of the two errors is not
symmetric: a guardian attached for nothing costs one read-only pass, a guardian missing on a
permission change costs a function no role can govern — and that one does not show up until
somebody needs it.

⚠️ **This list is the company's single copy.** The guardian's own skill quotes it verbatim rather
than keeping a second one, because two lists that drift by one word produce a guardian that either
enters on everything or on nothing. If it needs to change, it changes **here**, and the quotation
follows.

**The asymmetry, same shape as the AI tester's** → [R03:AI_TESTER_TRIGGER]: you may **add** the
guardian to an issue this list does not require; **you may never remove** it from one the list
does. And if the guardian wakes on an issue where the stage was not attached and it sees one of
these, it reports anyway — it cannot excuse itself.

### The AI tester's trigger, and its declared fallback  [R03:AI_TESTER_TRIGGER]

The decision is not a judgement call — it is a script: `npm run tocca-ai`, given the branch diff,
answers **yes or no** (plan §12.6 B). Run it; if it says yes, attach the AI tester stage.

⚠️ **The script is planned but not yet in `package.json`** `[ABSENT-VERIFIED]` — protocol and
sources in the AI tester's own skill, which owns this rule. **If `npm run tocca-ai` fails because
the script is not there, treat the answer as yes**, attach the stage, and say so in the issue in
one line:

```
«Script tocca-ai assente: collaudo eseguito per la clausola "in dubbio, si collauda".»
```

The absence of the tool is not permission to skip the check — that would turn a missing script
into a silent gap. Same wording as `crm-collaudo-generazioni-ai`, deliberately: two fallbacks
phrased differently are two different rules.

⚠️ **Note also that the AI tester trade is not switched on yet** — its accensione is planned after
the September release (plan §12.6 F). Until then the stage you attach has no agent behind it: say
so in the issue rather than assuming somebody will pick it up.

---

## PART 4 — The map request  [R03:MAP_REQUEST]

The explorer produces the exact list of files to touch and — the part that matters — **the list of
links not to forget**. That list is what the reviewer and the guardian will tick off afterwards.

**The conditions are verifiable, and they are quoted here on purpose. Request the map when at
least one occurs:**

- the change touches a file over ~800 lines;
- it **adds or changes a permission, a route, a table or a column**;
- it touches **Agency, Web Assets or the chat**;
- **the complete list of files to touch is not already known with certainty.**

**«Se non ricorre nessuna, si salta.»** This is not "when it seems useful": do not request a map to
feel safe, and do not skip one because the work looks small.

**How you request it:** a blocking issue assigned to the explorer, or a child issue, depending on
whether the map must exist before work starts (usually it must). The map is written **inside the
issue** — document or comment — where it stays for whoever picks the work up later.

⚠️ **The economic reason for the explorer is gone; the real one is not.** On the old setup it also
existed to keep large-file reading out of the main conversation. Here every agent has its own
space. It stays because **the incomplete-link error is silent**: the feature appears to work and
works at half.

---

## PART 5 — Who gets it  [R03:ASSIGNMENT]

| Trade | Gets | Never gets |
|---|---|---|
| 🔨 **Sviluppatore backend** | `server/`, Prisma, migrations, permission catalogue, backend tests | frontend work |
| 🎨 **Sviluppatore frontend** | `src/`, pages, components, colour tokens, design language, frontend tests | backend work |
| 🗺️ **Esploratore** | the map, read-only, on the conditions above | anything that writes |
| 🔍 **Revisore** | review of a finished piece — as a policy stage, not a separate issue | code |
| 🛡️ **Guardiano** | permissions and security, on the entry condition → [R03:GUARDIAN_ENTRY] — as a policy stage, running **before** the reviewer → [R03:STAGE_ORDER] | code |
| 🖥️ **Collaudatore** | opening the page, trying it, attaching screenshots | code |
| 📋 **Cronista** | documents, daily digest, promoting notes, session handover | code, decisions |
| 📊 **Capo del personale** | weekly measurement and proposals about the team | applying its own proposals |
| 🧪 **Collaudatore AI** | verifying AI generations when the change touches AI | judging the product |
| 🧭 **You** | planning | everything else |

**Three assignment rules that are not obvious:**

1. **Backend and frontend are separate on purpose**, and not as artificial parallelism: they have
   different rules in this project (types on one side, colour tokens and the Apple language on the
   other, two different test suites). An issue that needs both is **two issues** → [R02:THE_RIGHT_SIZE].
2. **The AI tester can be added, never removed.** When the deterministic script says a change
   touches AI, the check goes in — script, foreman and reviewer may all *add* it; nobody may take
   it away except the board. **In doubt, it is tested** → [R03:AI_TESTER_TRIGGER].
3. **Never self-assign**, and never assign an issue to a human as a shortcut for work an agent
   could do. Stopping is legitimate only at a gate → [R05:CRITERION].

---

## PART 6 — The fields you fill  [R03:FIELDS]

Our vocabulary maps onto the platform like this — three containers, not five. Goals nest, which is
where the two missing levels come from.

| Ours | In Paperclip |
|---|---|
| Iniziativa (*«Release settembre 2026»*) | a **goal**, `level: company` |
| Traguardo (a line of the working order) | a **child goal** (`parentId` = the release goal) |
| Area (*«Clienti»*, *«Registro attività»*) | a **project** — it binds repository, budget, target date |
| Compito | an **issue** (`projectId` + `goalId`) |
| Sotto-compito | an **issue** with `parentId` |

On creation you set: `title` · `description` · `projectId` · `goalId` · `parentId` (children only) ·
`blockedByIssueIds` · `priority` · `labelIds` · `executionPolicy` · `assigneeAgentId`. Status
defaults to `backlog`; move it to `todo` when it is ready to be picked up — not before, because
`todo` is what the executing agents scan.

**Priority means schedule pressure, not importance:** *Critical* is blocking work that must be done
immediately, *High* is "important this week", *Medium* is normal workload, *Low* is "nice to have;
do when nothing else is waiting". A queue where everything is high is a queue with no priority.

**The long plan goes in the issue's `plan` document, not in the description.** Reference it from
comments rather than pasting it again.

⚠️ **Creating goals and projects is not your job.** You hang issues under the structure the board
has created. If the structure you need is missing, that is a proposal → [R05:NEVER_YOURS].

---

## [R03:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the CRM
repository (read-only), of `docs.paperclip.ing`, and of the Paperclip source on GitHub.

- **«La sessione è usa e getta. La memoria è il compito»**, and what a session handover must carry
  (what was tried and discarded, what to distrust):
  `archivio-documenti/piano-paperclip-2026-08-19.md` §4.2-§4.3 — Tier 1 / **HIGH** (verbatim).
- **The six conditions for reaching the gate, and that a task may close without a human looking at
  the page**: same plan §3.4 — Tier 1 / **HIGH** (decision dated 19/8/2026).
- **The reviewer is unconditional while the guardian is conditional**: same §3.4 states the reviewer
  with no condition attached and the guardian *«se il compito tocca permessi o sicurezza»*;
  `crmadv/CLAUDE.md` reinforces it — the reviewer is called *«a ogni tappa conclusa»*, and §6-C of
  the plan records that on Paperclip it goes *«da buona abitudine a stato obbligatorio del
  compito»* — Tier 1 / **HIGH**.
- **The order of the stages — guardian before reviewer, tester, then gate**:
  `piano-paperclip-2026-08-19.md` §1.2, steps 5-8, *«Il guardiano controlla permessi e sicurezza,
  se il compito li tocca. Il revisore controlla il resto»* — Tier 1 / **HIGH** (verbatim).
- **`maxReviewRounds` defaults to 3**: Paperclip execution-policy documentation, already cited in
  → [R05:HOW_TO_ENCODE] — Tier 1 / **HIGH**. *That two burnt rounds out of three is the practical
  consequence of the wrong order is our reading of the two facts together — Tier 3 / **MEDIUM**,
  and it is stated as a reason, not as a measured effect.*
- **The guardian's entry condition, widened beyond the plan's short formula**: the plan §2.2
  (guardian card) lists what it controls — the permission chain including *«il menu, laterale e
  mobile»*, the security of new code, and gate compliance — and §2.2 (its heartbeat) says it wakes
  *«sui compiti che toccano permessi o sicurezza»*. The list in → [R03:GUARDIAN_ENTRY] is the
  union of that card with the guardian's own scope gate — Tier 1 for the items, **Tier 3 /
  MEDIUM** for the decision to hold the single copy here *(decision of 25/8/2026, Jacopo)*.
- **The AI tester's five triggers, the script, and the asymmetry**: plan §12.6 A-B — Tier 1 /
  **HIGH**. **The script is not implemented yet** `[ABSENT-VERIFIED]`, and **the fallback wording**
  is owned by `crm-collaudo-generazioni-ai`, quoted here rather than restated — Tier 1 / **HIGH**.
- **The AI tester trade is not switched on yet**: plan §12.6 F, *«L'accensione resta dopo la
  release di settembre, alla riapertura della V5»* — Tier 1 / **HIGH** (verbatim).
- **Commit-message style (Italian, what changes for the user, not which files)**: same plan §7.3;
  `.claude/commands/vado.md` §3 — Tier 1 / **HIGH**.
- **Explorer call conditions, verbatim**: `crmadv/CLAUDE.md`, *«Team di agent»*, and the plan §2.2
  (explorer card) — Tier 1 / **HIGH**. Both state *«Se non ricorre nessuna, si salta»* / *«non sono
  un "quando ti sembra utile"»*.
- **Why the explorer survives although its economic reason is gone**: plan §2.2 — Tier 1 / **HIGH**.
- **Backend and frontend separated because the rules differ (314 `.js/.jsx` vs 8 `.ts`, tokens,
  two test suites)**: plan §2.2 (frontend card) — Tier 1 / **HIGH**.
- **The AI tester can be added by script, foreman or reviewer and removed only by the board; "in
  doubt, it is tested"**: plan §12.6 (decision of 24/8/2026) — Tier 1 / **HIGH**.
- **Issue creation fields** (`title`, `description`, `status` default `backlog`, `priority` default
  `medium`, `projectId`, `goalId`, `parentId`, `blockedByIssueIds`, `labelIds`, `executionPolicy`,
  `assigneeAgentId`): `docs.paperclip.ing/reference/api/issues` — Tier 1 / **HIGH**.
- **Priority semantics (Critical / High / Medium / Low)**:
  `docs.paperclip.ing/guides/day-to-day/issues` — Tier 1 / **HIGH** for the semantics; the exact key
  strings beyond `medium`/`high` are **MEDIUM** → VERIFY-ON-FIELD.
- **Execution policy enforced by the runtime; stages `review`/`approval`, participants,
  `approvalsNeeded`, `maxReviewRounds` default 3**:
  `docs.paperclip.ing/guides/power/execution-policy` — Tier 1 / **HIGH**.
- **Goal → Project → Issue; goals nest via `parentId`; goal levels `company|team|agent|task`;
  projects bind repository and budget and carry `targetDate`**:
  `docs.paperclip.ing/guides/projects-workflow/goals`, `.../projects`, and
  `reference/api/goals-and-projects` — Tier 1 / **HIGH**.
- **Plans belong in the issue `plan` document; attachments endpoint for evidence**:
  `github.com/paperclipai/paperclip`, `skills/paperclip/SKILL.md`, and
  `docs.paperclip.ing/reference/api/issues` — Tier 1 / **HIGH**.

VERIFY-ON-FIELD:
- **`goalId` on an issue.** The API exposes it and the bundled skill says to always set it on
  subtasks, while the projects guide says issues inherit the goal through their project. The two
  are not contradictory but not identical either — confirm at the first real creation. **MEDIUM.**
- **The exact `priority` key strings** beyond `medium` and `high`.
- **The agent names** used in `executionPolicy` participants: they exist only once the company is
  built, so the stages here are described by trade, not by identifier.

------------------------------------------------------------------------------

End of document — [R03 — Anatomy of an issue] · crm-pianificazione (v1.0)
