# KNOWLEDGE DOCUMENT — [R04]
# Order and dependencies — the sequence that is already decided
# Skill: crm-pianificazione (v1.0) | Internal reference
# Version 1.0

---

## USAGE NOTE  [R04:USAGE_NOTE]

Open this when you are putting issues in order, encoding what must come before what, or judging
whether the plan is slipping. The ordering constraints below are **decided, written and dated**:
your job is to encode them, not to re-derive them. Traceability: → [R04:SOURCE_NOTES].

---

## PART 1 — Encode, don't narrate  [R04:ENCODE_DONT_NARRATE]

> A sequence written in prose wakes nobody.

Paperclip has a first-class dependency field, and it drives execution:

- **`blockedByIssueIds`** expresses *"A is blocked by B"*, on creation or update. The reverse
  relation (`blocks`) is derived.
- **Wakes fire when all blockers reach `done`.** This is the whole reason to encode: the moment the
  last blocker closes, the blocked work wakes by itself. Nobody has to notice.
- **Cancelled blockers do not count as resolved.** A cancelled dependency leaves the work blocked
  forever — so when you cancel an issue, check what it was blocking.
- **The array replaces the current set each time.** Sending one id removes the others. Read before
  you write.
- **Circular chains are rejected**, so a rejection is information: your model of the order is
  wrong, not the platform.
- **Parent/child nesting does not block execution.** A child is not "after" its parent unless a
  blocker says so → [R02:SUBTASKS].

**The rule for you:** every hard dependency is encoded. Parallel work says so explicitly —
*«bloccanti: nessuno»* — because an empty field is indistinguishable from a forgotten one.

**What is *not* a blocker:** "it would be tidier to do this first", "the same person is working on
both". Preference is not dependency. Encoding preferences as blockers serialises a company that
was built to run in parallel.

---

## PART 2 — The order of the release  [R04:HARD_ORDER]

The September release is one initiative with **eleven milestones in a decided order**. The sequence
was designed to *degrade well*: if time runs short, what is left behind is the last item on the
list, not a piece that blocks the others. It was confirmed on 18/8/2026 with none removed.

| # | Milestone | Trades | Gate |
|---|---|---|---|
| 1 | Server di posta (coda) + invito Team | backend + esploratore | 🔴 real email sending · 🟡 two open product points on *«Prova connessione»* |
| 2 | Cambio e recupero password | backend + esploratore + 🛡️ | 🔴 migration |
| 3 | Controllo automatico dei permessi, metà 1 | backend | 🟢 |
| 4 | Le due correzioni rosse dei Messaggi | backend + frontend | 🟢 |
| 5 | Clienti (campi, import, campi personalizzati) | backend + frontend + esploratore | 🟡 names and labels of the new fields |
| 6 | Registro attività | backend + esploratore | 🔴 blocked at the start: menu placement needs a discussion |
| 7 | Cestino sulle entità in perimetro | backend + frontend + esploratore + 🛡️ | 🔴 migration across entities |
| 8 | Allegati ai messaggi + rifiniture | backend + frontend + 🛡️ | 🔴 file retention |
| 9 | Riordino del menu | frontend | 🟡 product decision |
| 10 | Spegnimento dei moduli fuori perimetro | frontend | 🟡 the board decides what is switched off |
| 11 | Audit di sicurezza | 🛡️ in extended mode | 🔴 with the code frozen, last by definition |

**Six of eleven carry a red gate and five a yellow one.** Two out of three need a human. That is
the nature of this release — it touches permissions, migrations and email — and not a defect of the
plan. Plan the queue expecting it: **the company will not run unattended for days on this
release**, and a queue that stalls on approvals is the system working as designed
→ [R01:PRIORITY].

---

## PART 3 — The hard constraints, one by one  [R04:HARD_CONSTRAINTS]

These are written couplings. Encode each as a blocker; never reorder them on your own judgement.

| Constraint | Why it exists |
|---|---|
| **① before ②** — the mail server precedes password change/recovery | recovery uses email; without the mail server it cannot be built or tested |
| **The «Prova connessione» decision closes *inside* ②** — *«non prima, non dopo»* | from the moment recovery exists, whoever holds `mail.manage` can redirect anyone's reset emails. It stops being "who sends invitations" and becomes "who can take over any account" |
| **④ (first correction) before ⑥** | the activity log is flooded by a *«ha letto»* row every 1.5s per open conversation; build the log first and it is born unreadable |
| **The menu-placement discussion before ⑥** | explicitly *«si decide in un confronto con Jacopo, non da soli»* → a decision issue that blocks the build → [R02:MANDATORY_SPLITS] ② |
| **⑤ before ⑦** — Clienti before the recycle bin | deliberately after, so that which entities are really in play is settled first |
| **Attachments first inside ⑧** | they are not polish: they need retention (table, upload, permissioned download, limits) |
| **⑪ last, with the code frozen** | an audit of moving code audits nothing |

⚠️ **Two things about this table.** It reflects the plan as written; if you find the repository
contradicting it, the finding wins over the document about the *state* of the code — but never
over what is *wanted* → [R01:CONFLICTING_SOURCES]. And it is a picture of the current release: when
the release closes, this part is stale by construction, and the V order takes over.

---

## PART 4 — Migrations set the rhythm  [R04:MIGRATIONS]

- **A migration never sits on a long branch.** Two branches with two migrations merge and the
  database no longer knows in which order to apply them.
- Therefore migration issues are **short, planned to merge first and fast**, and each is a red
  gate: they pass one at a time, with the board's approval.
- **Never rewrite a migration already applied** — it changes its checksum and breaks the
  environments where it already works. So a "fix the previous migration" issue is not a thing:
  the fix is a new migration.
- **Only tracked migrations, never `db push`.** An untracked change leaves no trace, which is how a
  backlog accumulated in this project once already.
- Planning consequence: when two milestones both carry migrations (② and ⑦ do), **do not let them
  run in parallel**. Sequence them with a blocker even if nothing else couples them.

---

## PART 5 — What may run at the same time  [R04:PARALLELISM]

The company is built to run several agents at once, so serialising by habit is a real cost.

**Legitimately parallel:**
- work in different areas with no shared file and no shared schema change;
- a backend issue and a frontend issue of the same milestone, **once the contract between them is
  decided** (route, payload, permission key) — that decision belongs to the earlier issue;
- anything read-only: the explorer's map, the audit preparation.

**Not parallel:**
- two migrations → [R04:MIGRATIONS];
- two issues that both edit the same oversized file — the merge will be hostile;
- anything that lands on the same permission catalogue entries.

⚠️ **Suspected conflict with the other person's work is a yellow gate**, not a judgement call. The
rule predates Paperclip and is explicit: when a request may contradict what the other has already
decided or built, it is flagged and waited on → [R05:GATES].

---

## PART 6 — Slippage: the signal, not the feeling  [R04:TIMELINE]

The delivery date is **mid-September 2026** (moved from early September on 18/8/2026 to keep both
heavy items — recycle bin and attachments — inside the scope). The plan's indicative distribution:
milestones 1-6 in the first stretch, 7 and 8 in the second, 9-11 at the end.

**The signal is mechanical, and you are the one who reads it:** if milestones 1-6 are not closed at
the end of the first stretch, the slippage eats the days budgeted for the recycle bin. The plan
asks for that to be **reported immediately, not on the eve**.

**The recycle bin is risk number one.** Written twice, in two documents. *«Un cestino a metà il
giorno prima della consegna è peggio di nessun cestino — quindi il momento per accorgersene è
quando lo si comincia, non alla fine.»* Concretely: when milestone ⑦ opens, that is the moment to
compare its shape against the days left and to raise the alarm if they do not match.

**How you raise it.** Not by re-planning: re-ordering the release, or dropping a milestone, is a
board decision — the scope was set explicitly and *«nessuna voce esce»*. You park it with options
→ [R05:PARKING_FORMAT]: what is late, by how much, what it costs downstream, and the two or three
possible moves.

---

## [R04:SOURCE_NOTES]
------------------------------------------------------------------------------

Traceability and confidence. Research date: 24 August 2026. Method: direct reading of the CRM
repository (read-only), of `docs.paperclip.ing`, and of the Paperclip source on GitHub.

- **`blockedByIssueIds` is first-class; the array replaces the set; circular chains rejected;
  wakes fire when all blockers reach `done`; cancelled blockers do not count**:
  `github.com/paperclipai/paperclip`, `skills/paperclip/SKILL.md` — Tier 1 / **HIGH** (verbatim).
- **Encode every hard dependency as `blockedByIssueIds`; nesting alone does not block; parallel
  children should say `blockers: none`**: Paperclip bundled skill *Task Planning* — Tier 1 /
  **HIGH** (verbatim).
- **The eleven milestones, their trades and their gates**:
  `archivio-documenti/piano-paperclip-2026-08-19.md` §8.3 — Tier 1 / **HIGH**.
- **Six red and five yellow; "the company will not run alone for days on this release"**: same
  §8.3 — Tier 1 / **HIGH**.
- **The working order and its couplings (① before ②; «Prova connessione» inside ②, "non prima, non
  dopo"; ④ before ⑥; the discussion before ⑥; ⑦ after ⑤; attachments first inside ⑧; ⑪ last)**:
  `archivio-documenti/decisioni-cliente-e-menu-2026-08-07.md` §7.5, confirmed 18/8/2026 — Tier 1 /
  **HIGH** (verbatim).
- **Why the «Prova connessione» decision is coupled to recovery (`mail.manage` could redirect reset
  emails)**: same document §7.7 point 7, raised by the reviewer on 18/8/2026 — Tier 1 / **HIGH**.
- **The message-read flood (a row every ~1.5s per open conversation) and its ordering
  consequence**: same document §7.3 ⑥-bis and §7.5 point 4 — Tier 1 / **HIGH**.
- **Migrations: never on a long branch; only tracked; never rewrite an applied one**:
  `piano-paperclip-2026-08-19.md` §7.3; `crmadv/CLAUDE.md` §2 and the database method section —
  Tier 1 / **HIGH**.
- **Suspected conflict with the other person's work is a yellow gate**:
  `piano-paperclip-2026-08-19.md` §3.2 and §6-F; `crmadv/CLAUDE.md`, conflict rule — Tier 1 /
  **HIGH**.
- **Delivery mid-September; the date moved to keep recycle bin and attachments in scope; nothing
  leaves the scope**: `decisioni-cliente-e-menu-2026-08-07.md` §7.7 point 2 and §7.11 — Tier 1 /
  **HIGH**.
- **The recycle bin is risk number one; notice when you start it, not at the end; report slippage
  immediately**: same document §7.7 point 3; `piano-paperclip-2026-08-19.md` §8.4 — Tier 1 /
  **HIGH**.

VERIFY-ON-FIELD:
- **The dates.** Part 6 deliberately avoids hard-coding the day-by-day schedule, which was written
  on 19/8/2026 and ages; the *signal* (milestones 1-6 closed before the heavy pair starts) is what
  survives. Re-read the plan for the current dates before acting on timing.
- **Part 2 expires with the release.** Once the September release closes, the ordering authority
  moves to the V sequence in `03-roadmap-confronto-e-build.md`, and this table must be replaced.

------------------------------------------------------------------------------

End of document — [R04 — Order and dependencies] · crm-pianificazione (v1.0)
