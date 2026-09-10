---
name: crm-note-operative
description: "The numbered operating notes of the CRM project (crmadv). Use at the START of any task, to check whether a mistake you are about to make has already been paid for once, and at the CLOSE of any task, to hand back either a new note or the explicit statement that there was nothing to record. Covers where the file lives, the 'Contesto - Errore - Modo corretto' format, the progressive numbering and why a number is never reused or reordered, how to find the two or three relevant notes without loading 896 lines, how to cite a note by number, what separates a note that saves time from one that only adds weight, and the rule that a wrong note is corrected at the source instead of contradicted by a new one. Writes in Italian. Do NOT use to decide what the product should do, to record a product bug (that is an issue), to place a thing found along the way (that is the roadmap), or as a source of truth about the code — a note is a dated account of an incident, not a specification."
---

# CRM — the operating notes

## Identity

This company keeps one file of **operational mistakes already made, and the correct way to
proceed**: `archivio-documenti/note-operative-ai.md` in the `crmadv` repository. Fifty-nine
numbered notes as of 8/9/2026, in the format *Contesto → Errore → Modo corretto*.

It exists for one reason: **what nobody writes down gets rediscovered months later at full
price.** Every note in that file is a mistake somebody already paid for. Reading it is how you
avoid paying twice; writing to it is how the payment stops with you.

You work unattended. There is nobody to ask: every instruction below ends either in an action or
in a declared way of stopping.

**You write in Italian.** These files are in English; the notes themselves are in Italian, and
everything you produce — note drafts, task comments — is Italian.

## First step

Read `references/00_context.md` `[N00]` once. It carries the format, the numbering rule, who holds
the pen, the language rule, and the one caveat that matters most: **many existing notes describe
the two humans' local Windows workstation, not the machine you run on.**

## The two moments

| When | What you do | Read |
|---|---|---|
| **Before starting a task** | Pull the index of note titles, open only the two or three that touch your task | `[N01]` |
| **At the close of every task** | Exactly one of two exits: a note draft, or «in questo compito non c'era niente da annotare» | `[N02]` |

There is no third exit at the close. **Saying nothing is the failure this rule exists to remove** —
it is how the file went from 26/8/2026 to 8/9/2026 without a single line while real work shipped.

## Reference documents

| Code | File | When to open it |
|---|---|---|
| `[N00]` | `references/00_context.md` | once, first |
| `[N01]` | `references/01_reading.md` | at the start of a task: finding the relevant notes cheaply, citing them |
| `[N02]` | `references/02_writing.md` | at the close of a task: the format, the number, useful vs useless, correcting a wrong note |

Open only what the moment needs. Each file is paid for on the wake-up that loads it.

## Hard rules

- **Never load the whole file.** It is 896 lines and grows. You pull an index of titles first and
  open notes by line range → [N01:INDEX_FIRST]. An agent that reads all of it to be thorough has
  spent more than the notes saved.
- **A number is an identity, not a position.** Cite *«nota #21»*. Never renumber, never reuse a
  number, never reorder the file to tidy it — note #53 sits before note #52 and that is fine.
- **The Cronista holds the pen on the file.** Every other trade hands over a ready-to-paste draft
  in its closing comment and does not edit the file → [N02:WHO_WRITES].
- **A note that turns out to be wrong is corrected where it lives**, not contradicted by a new
  note. Other knowledge bases cite these numbers; two contradictory notes make every citation
  unreliable → [N02:CORRECT_AT_SOURCE].
- **«Niente da annotare» is a legitimate and frequent answer.** A file padded with obvious notes
  stops being read, and that costs more than the notes save → [N02:USEFUL_VS_USELESS].
- **A note is not a specification.** It records what went wrong once, on a dated occasion. Before
  acting on its *Modo corretto*, check that its *Contesto* is yours → [N00:STALENESS].
