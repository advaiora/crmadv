# WRITING DOCUMENT — [N02]
# The moment, the format, the number, and what separates a useful note from weight
# Skill: crm-note-operative (v1.0) | Internal reference
# Version 1.0

---

## PART 1 — THE MOMENT  [N02:THE_MOMENT]

**At the close of every task, in the comment with which you hand the work back.** Not "when you
notice something", not "at the end of the day", not "when you have time". A duty without a moment
never fires — and that is not a hypothesis: between 26/8/2026 and 8/9/2026 this company shipped
twenty-two branches and three merged pull requests, and the notes file was not touched once.

**Exactly one of two exits. There is no third.**

| Exit | When | What it looks like |
|---|---|---|
| **A** | Something went wrong, or took longer than it should have, in *how* you worked | A ready-to-paste draft, in the format below |
| **B** | Nothing did | The explicit sentence: *«In questo compito non c'era niente da annotare.»* |

Exit B is legitimate and will be the more frequent one. What is **not** legitimate is silence:
closing a task without either. Silence is indistinguishable from having forgotten, and forgetting
is what this rule exists to remove.

**The prompt to ask yourself, once, at the close:** *did I lose time on something that a future
agent will lose the same time on?* Not *was there a bug* — bugs are issues. Not *did I learn
something* — learning is not a note. **Did I lose time in a way that is repeatable.**

---

## PART 2 — WHO WRITES  [N02:WHO_WRITES]

- **The Cronista edits the file.** On its own branch, following the project's branch convention.
- **Every other trade hands over a draft** in its closing comment, complete and ready to paste, and
  does not touch the file. A draft sitting in a task comment is already durable: it survives your
  session even if it is filed a day later.
- **The Cronista, when it closes a task of its own, also sweeps** the closing comments of tasks
  closed since its last pass, and files the pending drafts. This is what stops drafts from
  accumulating unwritten.

---

## PART 3 — THE FORMAT  [N02:FORMAT]

Copy this shape exactly. It is the shape all fifty-nine existing notes have.

```markdown
## <numero>. <titolo: la lezione in una riga, non l'argomento>

**Contesto:** <l'operazione concreta durante la quale è successo, abbastanza precisa perché
qualcuno riconosca di esserci dentro>

**Errore:** <la mossa sbagliata e cosa ha prodotto — l'errore vero, il tempo perso, il sintomo
che traeva in inganno>

**Modo corretto:**
- <l'azione da fare, eseguibile senza ricavarla di nuovo>
- <l'eventuale verifica che dice che è andata bene>
```

Then a `---` separator line, and the note goes **at the end of the file**.

**The title carries the lesson, not the topic.** Compare:

- ❌ *«Test frontend»* — tells a future reader nothing from the index.
- ✅ *«I DEV SERVER ACCESI bastano a far fallire l'avvio dei worker dei test — e sembra un difetto
  del file nuovo»* — the index alone saves the afternoon.

This matters more than it looks: the index of titles is what everybody reads →
[N01:INDEX_FIRST]. A note with a vague title is a note nobody will ever open.

---

## PART 4 — THE NUMBER  [N02:THE_NUMBER]

**The next number is the highest existing number plus one** — not the count of notes. The file is
not in perfect numeric order, so counting gives the wrong answer.

```
grep -n "^## [0-9]" archivio-documenti/note-operative-ai.md | tail -5
```

Take the highest number you see, add one. Highest as of 8/9/2026 is **59**, so the next note is
**#60**.

Never reuse a number, never renumber, never reorder the file → [N00:NUMBERING].

---

## PART 5 — USEFUL AGAINST USELESS  [N02:USEFUL_VS_USELESS]

**The test, in one sentence:** a useful note is one that, had it existed this morning, would have
saved you the time you just lost.

A **useful** note has all four of these:

1. **A recognisable context.** Concrete enough that a future agent knows it is in that situation —
   the command, the tool, the file, the moment.
2. **The misleading symptom.** What it looked like while you were wrong. This is often the most
   valuable line in the note: *«sembrava un difetto del file nuovo»*, *«non dava errore»*.
3. **An executable corrective move.** Something to do, not something to keep in mind.
4. **Evidence.** The command, the `file:riga`, the error string — so the reader can confirm the
   match instead of guessing.

A note is **useless**, and adds weight instead, when it is:

| Shape | Why it fails | Where it belongs |
|---|---|---|
| A general principle — *«attenzione alle migrazioni»* | Nobody acts differently for having read it | nowhere |
| A defect of the CRM | It needs fixing, not remembering | a Paperclip issue |
| Something found along the way, unrelated | It needs placing, not recording | the roadmap |
| A one-off hiccup with no repeatable move | It will never match anyone's context again | nowhere |
| A restatement of a note that already exists | It splits one lesson across two numbers | correct the existing one |
| Written at the close of a task where nothing went wrong, to look diligent | It is the main way this file dies | exit B |

⚠️ **A padded file stops being read**, and a file that stops being read costs more than every note
it ever saved. Writing nothing when there is nothing is protecting the instrument.

**Before writing, check the theme is not already there.** Scan the index for your keywords →
[N01:ROUTING]. If a note on that theme exists, you are in the next section.

---

## PART 6 — A WRONG NOTE IS CORRECTED WHERE IT LIVES  [N02:CORRECT_AT_SOURCE]

If a task proves an existing note wrong, **do not add a new note contradicting it.**

- Edit the note in place, and mark the correction with its date, in the note itself.
- Keep the number. Everything that cites it must keep landing on it.
- Say in your closing comment which number you corrected and on what evidence.

The reason is mechanical, not stylistic: the project's other knowledge bases quote these numbers
and are generated from this file. Two notes saying opposite things make every citation to either
one unreliable — and there is no way for a reader to tell which of the two is current.

This has been done once already and done right: note #14 stated that `<Alert variant="light">` was
not themed; when that stopped being true, the note itself was corrected, at the source, rather than
being superseded by a note #60.

---

## PART 7 — WHAT A CLOSING COMMENT LOOKS LIKE  [N02:CLOSING_COMMENT]

Exit B, complete:

> Lavoro consegnato sul ramo `…`. In questo compito non c'era niente da annotare nelle note
> operative.

Exit A, complete — the draft is ready to paste, so the Cronista adds nothing but the number:

> Lavoro consegnato sul ramo `…`. **Bozza per le note operative** (prossimo numero libero: #60):
>
> **Titolo:** …
> **Contesto:** …
> **Errore:** …
> **Modo corretto:** …
>
> Prova: `<comando o file:riga>`.

---

## SOURCE_NOTES  [N02:SOURCE_NOTES]

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| The *Contesto → Errore → Modo corretto* shape, the `---` separator, notes appended at the end | `crmadv/archivio-documenti/note-operative-ai.md`, notes #1–#59 read first-hand | 1 | HIGH |
| Highest number is 59; the file is not in numeric order, so counting misleads | heading index of the same file, 8/9/2026 | 1 | HIGH |
| Twenty-two branches and three merged pull requests since 27/8/2026 with no note added | `git branch -a`, `git log` on `main` and on the file | 1 | HIGH |
| Note #46 is the «dev server accesi» note quoted as a good title | heading of note #46 | 1 | HIGH |
| Note #14 was corrected in place, and the knowledge bases are generated from this file | `crm-design-frontend/references/02_tokens_and_themes.md`, which records both | 1 | HIGH |

---

------------------------------------------------------------------------------

End of document — [N02 — Writing a note] · crm-note-operative (v1.0)
