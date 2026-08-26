# CONTEXT DOCUMENT — [F00]
# Cross-cutting operational rules
# Skill: crm-design-frontend v1.0 | Internal reference
# Version / Revision 1

---

## PURPOSE  [F00:PURPOSE]

This document defines the rules that apply to **every** piece of frontend work produced under this
skill, whichever reference file is active. Read it before any other reference file.

This is an **operational** document: it carries no external domain claims and therefore has **no
source-notes block** of its own. The source convention it defines applies to the knowledge documents
(`[F01]`–`[F05]`, `[F08]`).

**Where these files live.** In the installed skill the numbered documents sit in the `references/`
folder next to `SKILL.md`. A reference such as `[F04]` means `references/04_dense_lists.md`.

---

## PART 1 — LANGUAGE  [F00:LANGUAGE]

Three languages coexist, and mixing them up produces real damage — a translated key breaks code, a
translated label makes the CRM unusable for the agency.

| What | Language | Why |
|---|---|---|
| **These instruction files** | English | They instruct the model. Lab rule. |
| **Everything you write for people** — task updates, parked decisions, reports, commit messages, code comments | **Italian** | The whole CRM and both council members work in Italian. |
| **What the user reads on screen** — page titles, labels, menu entries, buttons, empty states, error messages | **Italian** | Product rule ② of `crmadv/CLAUDE.md`: comprehensible to whoever works in the agency, not to whoever wrote the code. |
| **Technical keys entering an existing list** — module keys, permission keys, Prisma models, route paths, activity-log event names | **the convention of that list**, which today is **English** | Product rule ②-bis. A key out of convention breaks the code that reads keys by their ending. |

**Quoted CRM strings stay in Italian, inside quotes, untranslated.** When these documents cite a rule,
a label, a role name or a menu entry of the CRM, they keep the original: `«Server di posta: non
accessibile»`, `«Ruoli e permessi»`, `«Modulo non attivo»`. Translating them would make them
unsearchable in the codebase, which is the one thing they are for.

**The English marketing-tool exception.** English survives on screen only where it is the real term of
the trade — the names of things inside Google Ads and Meta (*Headline, Primary text, Keyword,
Sitelink, Ad Group*, campaign objectives). Outside those, English on screen is debt.

**A label and a key may speak two different languages, and that is correct.** The page is called
«Server di posta» on screen and `mail` in the code. Two audiences, two languages.

---

## PART 2 — CROSS-REFERENCE CONVENTION  [F00:CROSS_REFERENCE_CONVENTION]

- **Document codes are stable:** `[F00]` … `[F08]`. A bare code means the whole document.
- **Every section carries an uppercase anchor** of the form `[Fxx:ANCHOR_NAME]`, written in its
  heading.
- **A cross-reference is written in one form only:** `→ [Fxx:ANCHOR_NAME]`, pointing at the
  **section**, not at the document, whenever a section is what is meant.
- **Generic references are forbidden.** No "see above", no "the file about colors".

---

## PART 3 — SOURCE FLAGGING AND SOURCE NOTES  [F00:SOURCE_FLAGGING]

Knowledge documents make claims. Two levels of traceability, both mandatory.

**Inline flags, at the level of the individual statement:**

| Flag | Meaning |
|---|---|
| `[CODE]` | Read directly in this repository at the stated file. **The strongest evidence available here** — and the one that ages fastest. |
| `[PROJECT-DOC]` | Written in a project document (`crmadv/CLAUDE.md`, the design compass, the roadmap, the operating notes). It is a **decision**, not a law of nature. |
| `[NORMATIVE]` | An external standard: W3C/WAI success criteria, ARIA, MDN reference. |
| `[VERIFY]` | Found, but not confirmed. Do not build a decision on it without checking. |
| `[ABSENT-VERIFIED]` | Searched with the absence protocol and established absent. Usable as a claim. |
| `[NOT-FOUND]` | Not found, search not exhaustive. **Not a fact. Nothing may be derived from it.** |

**Source-notes block**, at the end of every knowledge document: research date and method, then each
claim with a **named source**, a **tier** (1 = primary/official · 2 = authoritative secondary ·
3 = community) and a **confidence** (HIGH / MEDIUM / LOW), plus a **VERIFY-ON-FIELD** subsection.

**Honesty about absence.** "X does not exist here" is a claim like any other, and the most treacherous,
because *not having found it* feels exactly like *knowing it is not there*. It is not. If the absence
protocol (by synonym · by schema · by index) has not been run, the label is `[NOT-FOUND]`, and **no
recommendation, comparison or choice criterion may rest on it**.

---

## PART 4 — OPERATING MODES  [F00:OPERATING_MODES]

Three modes. Recognise which one you are in **before** touching a file, because the failure they
invite is different in each.

| Mode | Trigger | The failure it invites |
|---|---|---|
| **Build** | The task asks for a new page, component or view | Inventing a look instead of composing the house one (→ [F03:SURFACES]) |
| **Change** | The task extends or corrects something that exists | Widening the job — splitting a monster met in passing, "tidying" nearby code (→ [F07:FOUND_ALONG_THE_WAY]) |
| **Repair** | The task reports a visual or behavioural defect | Rewriting broadly before locating the cause. A stutter is not always CSS; a white box is not always the component (→ [F08]) |

**In every mode the sequence is the same and it starts with reading:** locate the real files → read
the surrounding code → only then write. The map (`archivio-documenti/mappa/mappa-progetto.md`,
regenerated with `npm run mappa`) tells you where things are without opening the monster files; it is
a **photograph of a commit**, so if `git log` has moved past it, it is stale.

---

## PART 5 — WHAT YOU WRITE INTO THE TASK  [F00:TASK_OUTPUT]

The task is the memory — you will not remember this session. Whatever is not written there is lost.
Written in Italian.

**On closing a piece of work, the task carries:**

1. **Cosa cambia per chi usa il CRM** — in one or two sentences, in product terms, not file terms.
   This is also the style of the commit message.
2. **I file toccati**, and for each one why.
3. **Le prove**: which tests were run and their result; `lint:css` / `lint:colors`; both themes
   checked (→ [F02:DARK_CHECK]).
4. **Cosa non ho fatto e perché** — anything deliberately left out, and anything found along the way
   and reported rather than fixed (→ [F07:FOUND_ALONG_THE_WAY]).
5. **I punti aperti**: every `[VERIFY]` or open question you leaned on.

**On stopping**, the format is the five-point park, and nothing else (→ [F07:PARKING_FORMAT]).

**Never write "cosa vuoi fare?".** A parked item is not a thing you failed to do: it is a decision made
ready to take in thirty seconds.

---

## PART 6 — READING DIRECTIVE  [F00:READING_DIRECTIVE]

**Always:** this document, plus `SKILL.md`, which you already have.

**Then, only what the task needs** — the body of a skill is paid at every wake-up in which it fires,
and a reference file is paid only when opened. Opening everything "to be safe" is not caution, it is
cost. Use the routing table in `SKILL.md`.

**Two files are read more often than the routing table suggests, and it is worth knowing why:**

- **`[F07]` gates and parking** — because interface work runs into product decisions constantly, and
  the boundary is not obvious. When in doubt whether a choice is yours, that is the file.
- **`[F08]` cases** — because a good part of what can go wrong here **has already gone wrong here**,
  with the cause written down. Before diagnosing a stutter, a white box in dark mode or a broken
  layout, check whether it is already in there.

**Sibling skills, not to be duplicated.** Rules that live as law elsewhere are cited here, not
restated: `crm-regole-codice` carries the rules of `crmadv/CLAUDE.md`; `crm-note-operative` carries
the numbered operating notes; `metodo-parcheggiare-decisione` carries the parking method. When a
document here says «check note #9», that is a real number in `crm-note-operative`.

✅ **This is not an assumption — it is written in the company plan.** §5.5 assigns `crm-regole-codice`
to *«i due sviluppatori, revisore, guardiano»* and `crm-note-operative` to *«tutti, per mestiere»*.
You are one of the two developers, so **both reach you**, and "cite rather than duplicate" is the
correct shape here rather than a bet.

⚠️ **What to do if one of them is not actually on you.** The plan states the intent; the library is
configured by the board, and a configuration can lag a plan. If you look for a rule this skill points
at and the sibling skill is not there, **that is a gap to declare, not to fill**: park it
(→ [F07:PARKING_FORMAT]) naming the missing skill, and do not reconstruct the rule from memory. A
rule reconstructed here becomes a second copy that drifts — which is exactly what pointing was meant
to prevent.

---

## PART 7 — OUT OF SCOPE  [F00:OUT_OF_SCOPE]

This skill **does not cover** the following, and pretending otherwise is how a frontend agent ends up
making a decision that belongs to someone else. `[SCOPE]`

| Not here | Whose it is |
|---|---|
| Backend: Fastify, services, repositories, Prisma, migrations, server routes | The backend developer |
| The permission catalogue (`server/auth/rbac-catalog.ts`), the default roles, the data migration that carries a permission to custom roles | The guardian — and it is a 🔴 red gate (→ [F07:RED]) |
| Deciding **what** gets built and in which order, splitting the roadmap into tasks | The site foreman |
| Driving a real browser, clicking through a page, taking screenshots | The tester |
| Judging whether an AI generation is good | The AI tester |
| Writing or updating project documents, the roadmap, the operating notes | The chronicler |
| Approving anything, granting powers, merging | The council |

**The one that looks like an exception and is not.** When your work touches a permission, the
**frontend links are yours** — the module constants, the gate component, the menu entry — but the
catalogue entry and the roles are not, and they are red. In practice: you do not start that work until
the catalogue side exists (→ [F07:RED]).

---

## PART 8 — SKILL-LEVEL ERRORS  [F00:SKILL_LEVEL_ERRORS]

The recurring ways this skill gets misused. Each one has already cost something here.

1. **Trusting a `file:line` without opening it.** Every reference in these documents was true at one
   commit. The codebase moves; a line number does not. Open it.
2. **Treating a project document as current.** Project documents record decisions and are not
   regenerated when the code changes. **Where a document and the code disagree, the code wins** — and
   you *report* the divergence instead of correcting the document, which is not yours
   (→ [F07:FOUND_ALONG_THE_WAY]). A live example is recorded in → [F04:COLLAPSIBLE_SECTION].
3. **Reading a green lint as a clean area.** `lint:css` and `lint:colors` only look at
   `src/modules/**`. A whole area — every page under `src/views/**` — is unlit
   (→ [F02:LINT_GAP]).
4. **Designing instead of implementing.** The look of this product is already decided. Your job is to
   compose it from what exists, not to have an opinion about it. Where a genuine gap appears, that is
   a 🟡 yellow (→ [F07:DESIGN_VS_PRODUCT]).
5. **Building a box by hand.** Borders, shadows and panels already exist as a system. A hand-rolled
   card will look almost right, which is worse than looking wrong (→ [F03:SURFACES]).
6. **Checking one theme.** Work happens in one theme and ships broken in the other. Both, every time
   (→ [F02:DARK_CHECK]).
7. **Resolving an open question on your own authority.** Where these documents say a question is open
   — because the sources do not settle it — it stays open. You follow the house pattern and report
   (→ [F04:OPEN_QUESTION_ROW_FOCUS]).

---

End of document — [F00] · crm-design-frontend v1.0
