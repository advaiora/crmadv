# READING DOCUMENT — [N01]
# Finding the two or three notes that concern you, without paying for 896 lines
# Skill: crm-note-operative (v1.0) | Internal reference
# Version 1.0

---

## WHEN THIS DOCUMENT APPLIES  [N01:WHEN]

**At the start of a task, once**, before you write anything. Not during, not at the end.

The question you are answering is narrow: *has somebody already paid for the mistake I am about to
make?* Sixty seconds spent here is the cheapest insurance the company has.

---

## PART 1 — THE INDEX COMES FIRST  [N01:INDEX_FIRST]

⚠️ **Never open the whole file.** 896 lines today, more tomorrow. Reading it in full at every wake
of every agent is exactly the weight this skill exists to avoid.

**Step 1 — pull the index of titles.** One command, about sixty lines out:

```
grep -n "^## [0-9]" archivio-documenti/note-operative-ai.md
```

You get every note as `<riga>:## <numero>. <titolo>`. The titles are unusually explicit — they were
written to be scanned — so the index alone usually answers the question.

**Step 2 — pick at most two or three.** Match against what your task actually touches. If a title
does not clearly speak to your task, it does not.

**Step 3 — open only those, by line range.** The line number from the index is the start; the next
note's line number is the end. Use a ranged read (offset and limit), not a full-file read.

**Step 4 — read the *Contesto* first.** If the context is not yours, stop there and move on →
[N00:STALENESS]. Do not read on out of curiosity: you are paying for it.

If nothing in the index matches, that is a complete answer. Say so in one line and get to work.

---

## PART 2 — WHERE TO LOOK, BY WHAT YOU ARE ABOUT TO DO  [N01:ROUTING]

Themes, not numbers — numbers move as the file grows, themes do not. Scan the index for these
words when your task is of that kind.

| If your task touches | Scan the index for |
|---|---|
| The interface, themes, colours, cards | *tema*, *card*, `data-bs-theme`, *colori*, *anteprima* |
| Frontend or backend tests | *test*, *Vitest*, *suite*, *worker*, *hook* |
| Prisma, migrations, the database | *Prisma*, *migrate*, *lock*, *seed* |
| An AI generation of the CRM | *AI*, *fallback*, *structured output*, *collaudo* |
| Permissions, roles, dictionaries, enums | *permessi*, *catalogo*, *RBAC*, *dizionari*, *enum* |
| Verifying something over HTTP or by script | `curl`, *script*, *endpoint*, *porta*, *host* |
| Renaming or moving files | *rinominare*, *import*, *censimento* |
| Measuring consumption or cost | *consumi*, *limite*, *registro*, *campione* |
| Reading project documents as if they were specs | *documenti*, *decisioni*, *specifiche* |

Two notes are worth knowing by heart because they change how you read everything else:

- **#56** — the project's documents are *dated decisions, not specifications*: cite them as a lead,
  then open the code before acting.
- **#54** — an instruction of the current session that contradicts `CLAUDE.md` is reported
  immediately, never resolved quietly on your own.

---

## PART 3 — CITING A NOTE  [N01:CITING]

When a note changed what you did, **say so by number in your closing comment**: *«applicata la
nota #21»*, *«la nota #46 spiega il rosso: erano i dev server accesi»*.

Three reasons, all practical:

1. It lets whoever reads your work check you in one step.
2. It is the only evidence that the mechanism is working. A note nobody ever cites is a note that
   is not earning its place, and the company counts citations to find out.
3. It stops the same explanation being paraphrased into five task comments, each drifting a little
   further from the note.

**Cite, do not paraphrase.** Whoever reads you can open the note. A summary in your own words is a
second copy that will diverge from the first.

---

## PART 4 — WHEN A NOTE LOOKS WRONG  [N01:NOTE_LOOKS_WRONG]

You will occasionally find a note that the code contradicts. Do not act around it silently, and do
not edit it yourself.

1. **Check it is genuinely wrong, not merely inapplicable.** A note whose *Contesto* is a Windows
   workstation is not wrong when you are on Linux — it is somebody else's → [N00:STALENESS].
2. **Follow the code, not the note.** The code is what runs.
3. **Report it at the close of your task**, naming the number and the evidence (`file:riga`, the
   command output). It becomes a correction at the source, which the Cronista makes →
   [N02:CORRECT_AT_SOURCE].

This has happened for real: note #14 used to state that `<Alert variant="light">` was not themed.
It was corrected in place, at the source, precisely because the other knowledge bases quote it.

---

## SOURCE_NOTES  [N01:SOURCE_NOTES]

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| Every note heading matches `^## [0-9]`, and the index is ~59 lines | `grep -n "^## [0-9]" archivio-documenti/note-operative-ai.md`, run 8/9/2026 | 1 | HIGH |
| Contents of notes #54 and #56 as summarised | headings and bodies read first-hand | 1 | HIGH |
| Note #14 was corrected in place rather than superseded | `crm-design-frontend/references/02_tokens_and_themes.md`, which records the correction and why it was made at the source | 1 | HIGH |
| The company counts citations of a note to judge whether it works | `crm-pianificazione/references/00_context.md` §CROSS_REFERENCE_CONVENTION, citing plan §5.7 | 2 | MEDIUM |

---

------------------------------------------------------------------------------

End of document — [N01 — Reading the notes] · crm-note-operative (v1.0)
