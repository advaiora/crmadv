# CONTEXT DOCUMENT — [N00]
# What the notes are, and the rules that hold across both moments
# Skill: crm-note-operative (v1.0) | Internal reference
# Version 1.0

---

## PURPOSE  [N00:PURPOSE]

This document carries what every agent of this company needs to know about the operating notes,
whichever of the two moments it is in. Read it once. `[N01]` and `[N02]` assume it.

---

## PART 1 — THE FILE  [N00:THE_FILE]

| | |
|---|---|
| **Path** | `archivio-documenti/note-operative-ai.md`, in the `crmadv` repository |
| **Size** | 896 lines, **59 numbered notes**, as of 8/9/2026 |
| **Language** | Italian |
| **Format of every note** | *Contesto → Errore → Modo corretto* |
| **Heading shape** | `## <numero>. <titolo>` — one `##` per note, nothing else uses `##` |
| **Declared in** | `crmadv/CLAUDE.md`, section «Auto-miglioramento dell'AI» |

The file opens by stating its own rule: the assistant updates it **on its own initiative, without
being asked**, whenever it notices one of its own procedures was inefficient or wrong.

**What it is for.** It is the company's memory of *how the work goes wrong* — the reload that
aborts the page load, the migration that blocks because another session holds the Prisma lock, the
dictionary written from memory instead of read from the enum. A mistake recorded once costs a
paragraph; the same mistake rediscovered costs the afternoon it cost the first time.

---

## PART 2 — WHAT BELONGS IN IT, AND WHAT DOES NOT  [N00:SCOPE]

A note is about **how the work is done**, not about what the product should do.

| It goes | Where |
|---|---|
| A wrong way of running a recurring operation, and the right way | **here**, as a note |
| A defect of the CRM that a user would see | a Paperclip issue |
| A thing found along the way, unrelated to the task in hand | the roadmap, `archivio-documenti/03-roadmap-confronto-e-build.md` — the Cronista places it |
| A product decision that needs Jacopo or Claudio | the roadmap, with the options already spelled out |
| How much a closed task cost | the task register, `archivio-documenti/consumi/registro-compiti.md` |

The test: **would a future agent, about to do the same operation, act differently for having read
it?** If yes it is a note. If it only informs, it is not.

---

## PART 3 — THE NUMBER  [N00:NUMBERING]

Every note carries a progressive number, and **the number is an identity, not a position**.

- Notes are cited by number — *«nota #21»* — in task comments, in the project's other knowledge
  bases, and inside `CLAUDE.md`. `crm-design-frontend` alone cites eight of them by number.
- **A number is never reused and never renumbered.** A citation written three months ago must
  still land on the same note.
- **The file is not in perfect numeric order, and it is not to be tidied.** Note #53 physically
  sits before note #52. Reordering would change nothing for a reader and would break every
  line-range reference anybody holds.
- The next free number is **the highest existing number plus one** — which is not the same as the
  count of notes → [N02:THE_NUMBER].

---

## PART 4 — WHO HOLDS THE PEN  [N00:WHO]

- **The Cronista writes the file.** It is the trade whose whole job is that nothing gets lost, and
  a single pen is what keeps the numbering coherent and the duplicates out.
- **Every other trade proposes.** At the close of a task you hand over a ready-to-paste draft in
  your closing comment — you do not edit the file yourself. Nine trades editing one numbered file
  on nine branches produces collisions on the numbers and duplicate notes on the same theme.
- **Everybody reads.** The duty to read is not the Cronista's speciality; it is the reason the file
  exists.

---

## PART 5 — LANGUAGE  [N00:LANGUAGE]

- This skill and its references are in English. The notes are in Italian, and stay Italian.
- Everything you write — note drafts, closing comments, citations — is **Italian**.
- CRM labels, permission keys, commands and file paths are quoted verbatim, never translated.
- Notes are written in the **first person of whoever made the mistake**, plainly, the way the
  existing ones are. No formal register, no blame.

---

## PART 6 — THE CAVEAT THAT MATTERS MOST  [N00:STALENESS]

⚠️ **A large share of the existing notes describe the local workstation of the two humans, not the
machine you run on.** They speak of Windows and PowerShell, of the preview pane, of dev servers on
ports 4000 and 5173, of a second chat session holding the Prisma DLL lock. An agent running inside
Paperclip on Linux may be in none of those situations.

This does not make those notes wrong. It makes their *Contesto* a precondition.

**So: read the *Contesto* before applying the *Modo corretto*.** If the context is not yours, the
note does not apply to you — move on, and do not report it as a defect.

Two things never to do with a note whose context is not yours:

1. **Do not apply its corrective move anyway**, on the grounds that it is written down. A
   procedure for a machine you are not on is a wrong instruction, not a cautious one.
2. **Do not edit or delete the note** because it does not match your environment. It still holds
   for the people it was written for. If you believe a note is genuinely wrong — not merely
   inapplicable — that is a correction at the source, and it goes to the Cronista →
   [N02:CORRECT_AT_SOURCE].

**A note is a dated account of an incident, never a specification of the code.** Where a note and
the code disagree about what the code does, the code wins and the note gets corrected.

---

## PART 7 — WHAT THIS SKILL IS NOT  [N00:OUT_OF_SCOPE]

| Not this | Where it belongs |
|---|---|
| The working rules of the project (branches, gates, file size, tokens) | `crmadv/CLAUDE.md`, read directly |
| Deciding what to build next | 🏗️ Capocantiere |
| Which files a change touches | 🗺️ Esploratore |
| A verdict on finished code | 🔍 Revisore · 🛡️ Guardiano |
| Placing a thing found along the way | 📋 Cronista, in the roadmap |
| Environment setup procedures | out of scope for this company, deliberately |

⚠️ This skill encodes one file of one project. Applied elsewhere it would be confidently wrong.

---

## SOURCE_NOTES  [N00:SOURCE_NOTES]

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| Path, 896 lines, 59 notes, `## <n>. <titolo>` headings, format *Contesto → Errore → Modo corretto* | `crmadv/archivio-documenti/note-operative-ai.md`, read first-hand 8/9/2026 | 1 | HIGH |
| The file declares that the AI updates it unprompted, and is to be read at the start of a session | same file, header block; restated in `crmadv/CLAUDE.md` §«Auto-miglioramento dell'AI» | 1 | HIGH |
| Note #53 physically precedes note #52 | heading index of the same file | 1 | HIGH |
| Other knowledge bases cite the notes by number | `crm-design-frontend/references/02_tokens_and_themes.md`, `06_working_in_this_codebase.md`; `crm-permessi-e-sicurezza/references/04_gate_compliance.md`; `crm-pianificazione/references/00_context.md` | 1 | HIGH |
| A large share of the notes are about the humans' local Windows workstation | notes #13, #15, #16, #18, #28, #42, #55 read first-hand | 1 | HIGH |
| Last modification 26/8/2026, no note added while work shipped on 8/9/2026 | `git log` on the file vs `git log` on `main` | 1 | HIGH |

---

------------------------------------------------------------------------------

End of document — [N00 — What the notes are] · crm-note-operative (v1.0)
