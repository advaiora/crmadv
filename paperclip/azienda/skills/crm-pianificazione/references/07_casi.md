# KNOWLEDGE DOCUMENT — [R07]
# Cases — cuts and sequences that worked, and ones that failed
# Skill: crm-pianificazione (v1.0) | Internal reference
# Version 1.0

---

## USAGE NOTE  [R07:USAGE_NOTE]

Open this to check a decision of yours against something that actually happened in this project.
Every case has the same shape: **situation → move → outcome → cause → lesson**, and the cause is the
part that matters: an example without its cause teaches imitation, not judgement.

All cases are drawn from the CRM's own documents and are dated. Where a case is illustrative rather
than a recorded episode, it says so. Traceability: → [R07:SOURCE_NOTES].

---

## PART 1 — Cuts and sequences that worked  [R07:CASES]

### ✅ P1 — The mail server was planned before password recovery

**Situation.** Two milestones of the release: ① mail server and Team invitation, ② password change
and recovery.
**Move.** ① placed first, with ② depending on it — *«è il prerequisito del punto 2 se si sceglie il
recupero password via email»*.
**Outcome.** The recovery work can be built and tested against a mail server that exists.
**Cause.** The dependency is technical and hard: recovery *uses* email. Not a preference, not
tidiness.
**Lesson.** Hard dependencies come from the mechanism, not from the reading order of the plan —
and once identified they are encoded, not narrated → [R04:ENCODE_DONT_NARRATE].

### ✅ P2 — A security decision was closed *inside* the milestone that creates the risk

**Situation.** The *«Prova connessione»* button of the mail server can reach internal network
addresses. On its own, a low-weight issue.
**Move.** It was not planned separately, and not postponed: it must close **inside** milestone ②,
*«non prima, non dopo»*.
**Outcome.** The window in which the risk is real never opens.
**Cause.** The risk changes magnitude the moment recovery exists: `mail.manage` stops meaning "who
sends invitations" and starts meaning "who can take over any account in the workspace", Superadmin
included.
**Lesson.** Some couplings are not about order of work but about **when a risk becomes real**. Read
the plan for those, and do not "optimise" them into their own milestone → [R04:HARD_CONSTRAINTS].

### ✅ P3 — A wrong technical key was caught while it still cost nothing

**Situation.** On 18/8/2026 the *«Server di posta»* module was born with the key `posta` and the
permission `posta.gestisci`.
**Move.** It was renamed to `mail` / `mail.manage` **the next day**, before the migration was
committed.
**Outcome.** A cheap fix instead of an expensive one — *«l'ultimo momento in cui costava poco,
perché le migrazioni non ancora committate si riscrivono, mentre quelle già in git no»*.
**Cause.** The cost of a naming mistake is not constant over time: it rises sharply the moment the
migration enters git.
**Lesson.** Anything that creates a technical key gets rule ②-bis quoted in its issue, and the
naming question is settled **before** the migration, not after → [R03:ANATOMY].

### ✅ P4 — The permission, the roles and the data migration travelled together

**Situation.** New chat permissions had to reach existing custom roles as well, not only the five
system roles.
**Move.** The permission entry, the review of the predefined roles and an idempotent data migration
(`prisma/migrations/20260715141500_chat_permissions/migration.sql`) were planned as one piece of
work.
**Outcome.** The *«Ruoli e permessi»* page stayed aligned with the product instead of drifting
months behind it.
**Cause.** The automatic resynchronisation that runs at login only touches **system** roles; custom
roles need a migration. Splitting the migration off as "later" would have left a permission that
half the roles never receive.
**Lesson.** Rules ① and ①-bis are an **anti-split**: they belong inside the same issue, and *«che
serva una migrazione non è un buon motivo per rimandare»* → [R02:ANTI_SPLITS].

### ✅ P5 — Work believed pending had already been done, and was not queued

**Situation.** A list of residual Italianisation work was marked as deferred in the release plan.
**Move.** Before treating it as work, it was verified: it had already been executed on 7/8/2026,
and the correction of 17/8 named the five commits.
**Outcome.** No issue was created for work that existed.
**Cause.** The archive is layered: a document written in June can describe a state that changed in
August. The plan itself notes that the stale list had been read *«senza vedere la tabella sopra che
lo dichiara chiuso»*.
**Lesson.** Question 2 of the written test — *is it still current?* — is not a formality. The code
wins over the document about the state of the code → [R01:CONFLICTING_SOURCES].

### ✅ P6 — Something was correctly classified as not-development

**Situation.** The mobile tab bar under 768px still needed checking after the renaming.
**Move.** It was recorded as *«una verifica a schermo, non sviluppo»*.
**Outcome.** It goes to the tester, with no branch, no map, no reviewer stage.
**Cause.** Not everything written in a plan is code. Planning it as a development issue would have
produced a branch with nothing on it and a review of nothing.
**Lesson.** Before cutting, ask what kind of work it is. The trade determines the shape of the
issue, not the other way round → [R03:ASSIGNMENT].

---

## PART 2 — Cuts and sequences that failed  [R07:FAILED_CASES]

### ❌ N1 — A permission key that followed the naming rule and broke the product anyway

**Situation.** The new module was named in Italian, as the project's rule ② requires: key `posta`,
permission `posta.gestisci`.
**Outcome.** The *«Impostazioni Account»* page declared **«Server di posta: non accessibile»** even
to a Superadmin. No error, no log, nothing failing — visible only to whoever opened that page.
**Cause.** That page recognises access by reading the **termination** of the permission (`.view`,
`.manage`, `.view_list`). `.gestisci` matched none of them. The rule that was violated is ②-bis:
a key entering an existing list follows **that list's** convention, which today is English.
**Lesson.** Two audiences, two languages: the page is *«Server di posta»* on screen and `mail` in
the code, and that is correct. When an issue creates a key, its perimeter block must say which list
it enters and quote ②-bis → [R03:ANATOMY]. **This is the archetype of the failure this whole
company is built against: it works, and it lies.**

### ❌ N2 — A feature leaned on another module's permission

**Situation.** The AI chat needed a permission. The routes of the `projects` module already required
one.
**Outcome.** Sending a message that **spends money** required the same permission as read-only
access.
**Cause.** The most common fallback, and the one rule ① names explicitly: *«appoggiarsi al permesso
di un altro modulo perché "tanto le rotte lo richiedono già"»*.
**Lesson.** "A permission already exists here" is never a reason to reuse it. The permission is born
with the piece of CRM, in the same work → [R02:ANTI_SPLITS].

### ❌ N3 — A milestone treated as a single issue

**Situation.** Milestone ⑤, *Clienti*, reads as one line in the working order.
**What it would produce.** One issue containing new fields, the import rework (attachment, preview,
Excel) and the relocation of custom fields into the onboarding flow.
**Cause.** A milestone is a unit of **planning**, not of **execution**. The plan itself spells the
three works out. A reviewer receiving that issue can only say *«this is half done»*, which is
exactly the test for splitting.
**Lesson.** Read the milestone, then cut. One acceptance verdict per issue → [R02:THE_RIGHT_SIZE].

### ❌ N4 — Storage work classified as a finishing touch

**Situation.** Message attachments sit in milestone ⑧ next to yellow polish items.
**What it would produce.** Attachments planned last, inside the last stretch before delivery.
**Cause.** They are not polish: they need file retention — table, upload, permissioned download,
limits. The plan flags the misreading explicitly and orders them **first** inside that milestone.
**Lesson.** Where an item sits in a list is not its size. Weigh the work, not its position
→ [R02:MANDATORY_SPLITS].

### ❌ N5 — Building the activity log before stopping the flood

**Situation.** Milestone ⑥ (activity log) and correction ④ (the *«ha letto»* row written every 1.5s
per open conversation).
**What it would produce.** An activity log born unreadable, and a second piece of work to make it
readable.
**Cause.** The defect is upstream of the feature: the log is fed by the data the flood produces.
**Lesson.** A cut can be perfect and the **order** still wrong. Correctness of sequence is a
separate check from correctness of size → [R04:HARD_CONSTRAINTS].

### ❌ N6 — Finding out about the recycle bin at the end

**Situation.** Milestone ⑦ is written twice as the number-one risk of the release.
**What it would produce.** A half-finished recycle bin the day before delivery — *«peggio di nessun
cestino»*.
**Cause.** It is the piece whose real size is least known in advance, and the scope decision of
18/8 kept it in rather than dropping it, moving the date instead.
**Lesson.** For the item flagged as the main risk, the check happens **when it starts**, not when it
is due. And if the days do not match, it is parked with options — the scope is not yours to trim
→ [R04:TIMELINE].

### ❌ N7 — Fixing a real defect that was written as out of scope

**Situation.** `checklists.complete_item` also covers marking an item *«non applicabile»*, a
terminal state — so it lets someone push a project past a gate without holding
`checklists.override_gate`.
**What it would produce.** An issue to fix a genuine permission defect.
**Cause.** It is a **product choice** with three possible routes already written down, and the
module is hidden at launch. The plan says it: *«Non risolvere d'iniziativa»*.
**Lesson.** Being right is not the test; being written is. A finding goes to the chronicler or to the
board, never into the queue → [R01:IDEAS_ARE_NOT_WORK].

### ❌ N8 — A measured, expensive defect that still is not yours to schedule

**Situation.** The first login after an API restart can answer 500: `ensureWorkspaceAccessDefaults`
runs one `upsert` at a time for every module, permission and system role inside a single 5-second
Prisma transaction. Measured cold on 18/8/2026: **5015 ms against a 5000 ms ceiling** — `P2028`,
which the user sees as *Errore interno del server*. Warm, the same login costs 1.3-1.5 s.
**What it would produce.** An issue picking the obvious fix.
**Cause.** There are three routes — raise the timeout, move the catalogue sync out of the login, or
replace the one-by-one upserts with idempotent bulk inserts — and the good one *«cambia quando il
catalogo si allinea, quindi va decisa e non fatta di straforo»*. Also: every new permission of the
release brings the ceiling closer, so it is genuinely urgent **and** genuinely not yours.
**Lesson.** Urgency does not convert a decision into a task. Park it with the three options and
their consequences → [R05:PARKING_FORMAT].

---

## PART 3 — What the failures have in common  [R07:THE_PATTERN]

Read together, N1 to N8 are not eight different mistakes. They are three:

1. **Something that works and lies** (N1, N2). No error, no failing test — a page that says
   *«non accessibile»* to a Superadmin, a permission that guards spending as if it were reading.
   These are the reason six of the ten trades write no code at all.
2. **Right work, wrong moment** (N3, N4, N5, N6). The cut was defensible; the sequence was not. This
   is the failure mode a foreman produces more than anyone else, and the one nobody notices for
   days.
3. **Being right about something that is not yours** (N7, N8). The defect is real, the analysis is
   correct, and queueing it is still a mistake — because the queue would stop being a picture of
   what was decided.

**If you can name which of the three you are about to commit, you are already out of it.**

---

## [R07:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the CRM
repository (read-only). Every case is drawn from a dated company document; none is reconstructed
from memory. Case P6 and the "what it would produce" branches of N3-N8 are **counterfactuals**: the
situation, the cause and the rule are documented, the bad outcome is the one the document exists to
prevent.

- **P1 — mail server is the prerequisite of password recovery**:
  `archivio-documenti/decisioni-cliente-e-menu-2026-08-07.md` §7.5 points 1-2 — Tier 1 / **HIGH**.
- **P2 — the «Prova connessione» decision closes inside milestone ②, "non prima, non dopo"; the
  `mail.manage` escalation**: same document §7.5 point 2 and §7.7 point 7 (raised by the reviewer
  on 18/8/2026) — Tier 1 / **HIGH** (verbatim).
- **P3 / N1 — `posta` → `mail`, the termination check, «Server di posta: non accessibile» to a
  Superadmin, and the cost window closing when a migration enters git**: `crmadv/CLAUDE.md`, rule
  ②-bis (18/8/2026) — Tier 1 / **HIGH** (verbatim).
- **P4 — permission + predefined roles + idempotent data migration in one work; system-role-only
  resynchronisation**: `crmadv/CLAUDE.md`, rules ① and ①-bis; migration
  `prisma/migrations/20260715141500_chat_permissions/migration.sql` named there — Tier 1 / **HIGH**.
- **P5 — the Italianisation list already executed on 7/8/2026, five commits named**:
  `decisioni-cliente-e-menu-2026-08-07.md` §7.6, correction of 17/8 — Tier 1 / **HIGH**.
- **P6 — the mobile tab bar check is «una verifica a schermo, non sviluppo»**: same document §7.6 —
  Tier 1 / **HIGH** (verbatim).
- **N2 — the AI chat under the `projects` module, spending guarded like reading**:
  `crmadv/CLAUDE.md`, rule ① — Tier 1 / **HIGH** (verbatim).
- **N3 — milestone ⑤ is three works**: `decisioni-cliente-e-menu-2026-08-07.md` §7.5 point 5 —
  Tier 1 / **HIGH**.
- **N4 — attachments are not polish and come first inside ⑧**: same document §7.5 preamble
  (confirmation of 18/8) — Tier 1 / **HIGH** (verbatim).
- **N5 — the read-receipt flood and its ordering constraint**: same document §7.3 ⑥-bis and §7.5
  point 4 — Tier 1 / **HIGH**.
- **N6 — the recycle bin as risk number one; "notice when you start it"; the scope decision that
  moved the date instead of dropping it**: same document §7.7 point 3 and §7.11 — Tier 1 / **HIGH**
  (verbatim).
- **N7 — `checklists.complete_item` covering a terminal state; out of scope; «Non risolvere
  d'iniziativa»**: same document §7.6 — Tier 1 / **HIGH** (verbatim).
- **N8 — the 5015 ms transaction, `P2028`, `server/routes/auth.route.ts:562`, the three routes and
  «va decisa e non fatta di straforo»**: same document §7.7 point 8, measured 18/8/2026 — Tier 1 /
  **HIGH** (verbatim).

VERIFY-ON-FIELD:
- **N8 may already be fixed** by the time this skill runs: it was open on 18/8/2026 and it is the
  kind of defect the release itself makes worse. Check the current state before citing it as open.
- **N1 and N2 are historical.** Both were corrected; they are kept because the *cause* recurs, not
  because the defects are live.
- **The counterfactual branches** (P6 aside) describe outcomes the documents were written to
  prevent, not incidents that were recorded happening. They are argued, not observed.

------------------------------------------------------------------------------

End of document — [R07 — Cases] · crm-pianificazione (v1.0)
