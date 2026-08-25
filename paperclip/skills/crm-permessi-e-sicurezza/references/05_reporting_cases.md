# [F05] — THE REPORT, AND WHAT IS WORTH REPORTING
# Skill: crm-permessi-e-sicurezza v1.0 | Internal reference
# Open when: always, before writing the report

---

## PART 1 — THE FORMAT  [F05:REPORT_FORMAT]

The format is **inherited from the CRM's Reviewer, not invented here**. It is already the shape both
readers are used to, and keeping the two roles legible in the same way is worth more than any
improvement. Written **in Italian** → [F00:LANGUAGE].

**Structure**

1. **No preamble.** No "ho analizzato il diff e…". Start with the findings.
2. **An ordered list, most severe first** → [F05:SEVERITY_ORDER].
3. **Each finding, four elements, in this order:**
   - `percorso/file.ts:riga` — where it is. Without this it is not actionable at three in the morning;
   - **what is missing or wrong**, in one sentence;
   - **what can concretely happen** if it stays. *«Se non sai dirlo, la segnalazione probabilmente non
     vale la pena»*;
   - **whether it is a doubt**, said explicitly, when you are not certain.
4. **One closing line**: whether the work is clear from your side or not.

**Worked example, in the output language.**

⚠️ **Read this line before the example, not after it.** What follows is an **illustration of the
form**, not a finding from a real diff. The **paths and line numbers are placeholders on purpose** —
`percorso/file.ext:NN` — precisely because this example has the exact shape of a real report, and an
invented location that looks real is the fastest way to produce a perfect false alarm
→ [F05:NEGATIVE_CASES]. **Never copy a location from here.** Every `file:riga` you write comes from
the diff you are reading, checked by symbol name → [F01:CHAIN_OVERVIEW].

> 1. **`server/auth/rbac-catalog.ts` — il permesso `<modulo>.export` è nel catalogo ma non risulta
>    assegnato a nessuno dei cinque ruoli di sistema.**
>    Nessun ruolo predefinito può usare quella funzione: esiste e non è governabile da nessuno finché
>    non si crea un ruolo personalizzato apposta.
>
> 2. **`percorso/file.jsx:NN` — la voce `<Voce>` del menu mobile chiede `<modulo>.view` mentre quella
>    della sidebar chiede l'array `['<modulo>.view', '<modulo>.view_all']`.**
>    Chi ha solo `<modulo>.view_all` vede la voce da desktop e non da telefono. Ogni schermata sembra
>    corretta guardata da sola. *(Dubbio: l'array in sidebar potrebbe essere intenzionale — se lo è, va
>    allineato il mobile, non tolto l'array.)*
>
> **Il lavoro non è pronto: la voce 1 va chiusa prima del cancello.**

**What the example is teaching, and it is not the content:** the severity ordering, the one-sentence
statement, the concrete consequence, the doubt declared as a doubt, and the closing line. The two
shapes — *«a permission exists in the catalogue but reaches no role»* and *«two entry points ask for
different permissions for the same thing»* — are real recurring shapes in this codebase. **The
locations are not.**

**Three things the format forbids**

- **Do not write the fix.** «Manca la voce in `SidebarMenu.jsx`» is a finding; «aggiungi
  `requiredPermission: 'seo.view'` alla riga 188» is the developer's work → [F00:SKILL_LEVEL_ERRORS].
- **Do not restate project rules.** Cite them: «regola ①-bis di `CLAUDE.md`», «piano §3.2».
- **Do not report without a location.**

**Where a red gate applies** → [F04:WHEN_THE_GUARDIAN_STOPS], the report changes shape: the red item is
written **on its own**, outside the numbered list, above it, and marked as such — because a red must not
be closeable by approving the task.

---

## PART 2 — SEVERITY ORDER  [F05:SEVERITY_ORDER]

Rank by **what it costs when it goes wrong**, never by how odd the code looks.

| Rank | Class | Why here |
|---|---|---|
| 1 | **A secret in the open, or a live exposure already on `main`** | it is already happening, and it is not undone by fixing this branch |
| 2 | **Data crossing a workspace boundary** | one agency reads another's data, with a 200 and nothing in the logs → [F03:WORKSPACE_SCOPING] |
| 3 | **A power granted to somebody who should not have it** — silent widening, borrowed permission | the grant is invisible in the diff → [F02:TRAP_SILENT_WIDENING] |
| 4 | **A gate bypassed** | it invalidates the route to production, whatever the code is worth → [F04:WHAT_TO_VERIFY_AFTER] |
| 5 | **A broken chain link** — a permission nobody can govern, or a feature nobody can reach | *«una funzione che nessun ruolo può governare»* → [F01:CHAIN_OVERVIEW] |
| 6 | **A missing carry-over migration** | custom roles lose a feature in silence → [F01:DATA_MIGRATION] |
| 7 | **A catalogue description that undersells the power it grants** | it produces a grant nobody meant to make → [F01:LINK_1_CATALOG_LIST] |
| 8 | **A naming or convention issue** with no access consequence | real, but it costs an edit, not an incident → [F02:NAMING_CONVENTION] |

---

## PART 3 — CASES WORTH REPORTING  [F05:POSITIVE_CASES]

Six real shapes, each with the **cause** — because recognising the cause is what lets you spot the
seventh, which is not in this list.

**① The permission is in the catalogue and in one menu only.**
*Cause:* the two menus are two separate arrays and neither reads the other → [F01:LINK_6_MOBILE_NAV].
*Consequence to state:* the same person sees the area on one device and not on the other, and each
screen looks right on its own.

**② The permission is added, and there is no decision about Admin.**
*Cause:* Admin is `all_except`, so silence means "yes" → [F02:TRAP_SILENT_WIDENING].
*Consequence to state:* a power meant for the Superadmin reaches every Admin from the next login, with
nothing in the diff that looks like a grant.

**③ A new module key comes with an unfamiliar suffix.**
*Cause:* a heuristic reads the last word of the key against three known suffixes
→ [F02:TRAP_SUFFIX].
*Consequence to state:* *Impostazioni Account* declares the module inaccessible even to a Superadmin,
without raising an error, until somebody opens that page.

**④ A query reaches the database without its workspace condition.**
*Cause:* `ensure<Module>Access` proves the caller belongs somewhere, and it is easy to read that as
proof the rows do too → [F03:WORKSPACE_SCOPING].
*Consequence to state:* the endpoint returns another workspace's data to an authenticated user.

**⑤ A bare `fetch` on an address that came from a user.**
*Cause:* the first layer of the guard looks like enough, and the redirect case is invisible until
somebody uses it → [F03:USER_SUPPLIED_URLS].
*Consequence to state:* the server can be made to call the internal network from inside the VPS.

**⑥ The permission moves to a new key, and existing custom roles are not carried over.**
*Cause:* `ensureWorkspaceSystemRoles` re-synchronises system roles only → [F01:DATA_MIGRATION].
*Consequence to state:* whoever uses a custom role loses the feature in silence the moment the routes
start asking for the new key.

---

## PART 4 — CASES **NOT** WORTH REPORTING  [F05:NEGATIVE_CASES]

⚠️ **Read this part before writing any finding.** The characteristic failure of this role is not missing
a defect: it is **reporting things that are not defects**, until the one real finding stops being read.
*«Un revisore che trova sempre qualcosa smette di essere creduto.»*

Seven shapes that look wrong and are not. Each carries the **cause of the illusion**, which is the part
that transfers to cases outside this list.

**① Backend permissions with no counterpart in the frontend.**
The generated map (`archivio-documenti/mappa/mappa-progetto.md` §3) lists ten of them, compared against
522 frontend sources: `chat.moderate`, `chat.use`, `chat.view`, `checklists.delete`,
`projects.move_stage`, `projects.view_all`, `quotes.reject`, `seo.export`, `seo.manage_settings`,
`team.manage`.
*Cause of the illusion:* the absence of a frontend match is machine-verified, so it reads as a verdict.
It is not one — the map says so itself: *«alcuni sono solo-backend e va bene, altri potrebbero essere un
collegamento dimenticato»*. Some permissions guard routes with no UI, by design.
⚠️ **None of the ten has been classified — [NOT-FOUND].** Therefore: **do not report any of them as a
defect, and do not count them.** If your task touches one and you cannot settle it from the code,
**park it with the two options** → [F04:WHEN_THE_GUARDIAN_STOPS].

**② The label is in Italian and the key is in English.**
«Server di posta» on screen, `mail` in the code; «Produzione AI» and `ai_production`.
*Cause of the illusion:* it looks like a mismatch between two halves of one thing. It is two audiences,
and it is the rule → [F02:NAMING_CONVENTION].

**③ A module has no `ui/constants.js`.**
Eight modules have one; the others read the permission string where they use it.
*Cause of the illusion:* a missing file among sibling directories reads as an omission. It is a defect
only when the module **has** the file and the new key is absent from it → [F01:LINK_4_FRONTEND_CONSTANTS].

**④ `isPlatformAdmin` is absent from the permission catalogue.**
*Cause of the illusion:* it grants access, so it looks like a permission. It is a **global identity
above workspaces**, deliberately outside the catalogue. Reporting it as a missing entry proposes
weakening the boundary it exists to hold.

**⑤ Superadmin is absent from the explicit permission lists.**
*Cause of the illusion:* four roles enumerate their permissions and one does not. Superadmin is
`permissions: 'all'` → [F01:LINK_2_ROLE_ASSIGNMENT]. Adding it to the lists would be the defect.

**⑥ A file well over the size threshold, met while reviewing something else.**
*Cause of the illusion:* it violates a written rule, so flagging it feels correct — and the rule mentions
a red gate, which makes escalating feel obligatory. Those files are deliberate, each has an assigned
moment, and the list lives in the roadmap → [F04:WHAT_TO_VERIFY_AFTER]. Reporting their size re-opens a
settled decision.
⚠️ **And watch the trap inside the trap: the red gate is about *restructuring* the file, not about
touching it.** A semicolon, an import or a one-line fix in a large file is at most a low-grade note —
«questo hunk non appartiene a questo ramo» — never a red. Escalating a one-character change to a red
gate is the crying-wolf failure in its purest form: it looks vigilant and it teaches the council that
your reds are not worth opening. Full split of the cases → [F04:WHAT_TO_VERIFY_AFTER].

**⑦ Frontend code without tests.**
*Cause of the illusion:* the backend has tests and the frontend largely does not, so it reads as
neglect. It is a known and accepted choice, and test coverage belongs to the Reviewer anyway
→ [F04:BOUNDARY_WITH_REVIEWER].

### The rule that generalises all seven

Before writing that something is missing, run the three searches of the absence protocol — **by
synonym** (the key, the constant name, the module label), **by structure** (the catalogue, the policies
file, the menu arrays), **by index** (the project map) → [F00:SOURCE_FLAGGING]. If you have not run all
three, what you hold is *«non l'ho trovato»*, and it goes into the report **as a doubt or not at all**.

---

## PART 5 — WHEN THERE IS NOTHING  [F05:NOTHING_FOUND]

**Say it in one line and stop.**

> «Permessi e sicurezza a posto: catena completa sui sei punti, nessuna query fuori workspace, nessun
> segreto esposto. Il lavoro è pronto per il cancello.»

Three rules around it:

- **Never invent a finding to justify having been called.** The cost is not the noise: it is that the
  next real finding is read as more of the same.
- **Never stay silent instead.** Your favourable opinion is one of the six conditions for the task to
  reach the approval gate (plan §3.4). Silence stalls it with nobody knowing why.
- **Say which checks you actually ran**, in that same line, when you skipped some because the diff did
  not call for them — and say so explicitly if a tool was blocked and you worked around it by reading
  → [F03:VAULT_HYGIENE]. A partial check honestly declared is worth more than a complete-looking one.

---

## SOURCE_NOTES  [F05:SOURCE_NOTES]

**Traceability.** Compiled 24 August 2026. Tier 1 = the code or a written project rule · Tier 2 =
generated artefact · Tier 3 = inference.

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| The report format: path and line, one sentence, concrete consequence, doubt declared, one closing line | `crmadv/.claude/agents/revisore.md`, section «Come rispondere» | 1 | HIGH |
| «Se non sai dirlo, la segnalazione probabilmente non vale la pena» | same | 1 | HIGH |
| «Un revisore che trova sempre qualcosa smette di essere creduto» | same | 1 | HIGH |
| Nothing found → one line, then stop | same | 1 | HIGH |
| The Guardian's favourable opinion is one of the six conditions to reach the gate | `piano-paperclip-2026-08-19.md` §3.4 | 1 | HIGH |
| The ten backend permissions with no frontend match, and the map's own caveat | `archivio-documenti/mappa/mappa-progetto.md` §3 (generated 24/8/2026, commit `3e3cb50`) | 2 | HIGH that the list exists and was machine-produced over 522 sources; **[NOT-FOUND]** on the classification of any single one |
| Eight modules own a `ui/constants.js` | enumerated on the filesystem | 1 | MEDIUM — a dated snapshot, it grows with the product |
| `isPlatformAdmin` is an identity above workspaces, not a permission | `src/utils/workspaceAccess.js`, with its own comment | 1 | HIGH |
| Superadmin is `permissions: 'all'` | `server/auth/rbac-catalog.ts` → `SYSTEM_ROLE_DEFINITIONS` | 1 | HIGH |
| Over-size files are deliberate, listed in the roadmap | `crmadv/CLAUDE.md`, «Dimensione dei file» | 1 | HIGH |
| Frontend test scarcity is a known accepted choice | `crmadv/.claude/agents/revisore.md`, point 7 | 1 | HIGH |
| The severity order in PART 2 | derived: it orders the documented consequences by cost and reversibility | 3 | MEDIUM — reasoned, not quoted from any document |

**VERIFY-ON-FIELD**

- The list of ten permissions is a snapshot of 24/8/2026 and is regenerated by `npm run mappa`. **Read
  the current map, never this list**, before touching the subject.
- The severity order (PART 2) is this skill's proposal. If the council orders them differently in
  practice, the council wins.
- The two worked examples in PART 1 are illustrations built on real code shapes; they are not real
  findings from a real diff, and **their paths and line numbers are placeholders**. The same warning
  now sits immediately above the example itself, where it is actually read — it used to live only
  here, roughly 180 lines away, inside a block an agent opens only if it gets that far.

---

End of document — [F05] · crm-permessi-e-sicurezza v1.0
