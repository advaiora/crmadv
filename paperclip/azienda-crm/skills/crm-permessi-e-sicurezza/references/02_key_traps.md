# [F02] — THE THREE SILENT TRAPS
# Skill: crm-permessi-e-sicurezza v1.0 | Internal reference
# Open when: a permission key or a module key is created or renamed

---

## PART 0 — WHY THESE THREE  [F02:WHY_THESE_THREE]

Every trap in this document has three properties in common, and together they are the reason this role
exists as a separate job:

1. **No error is raised.** Compilation passes, lint passes, tests pass.
2. **The screen looks plausible.** Something is hidden or shown, and it looks like a decision somebody
   made.
3. **The delay before discovery is long.** It surfaces the day somebody needs the feature — which may be
   weeks later, in front of a client.

Each of the three has already happened in this codebase, has a date, and cost real work. They are
documented here as **cases**, not as principles: input → outcome → **cause** → what to check.

---

## PART 1 — TRAP ① · THE PERMISSION SUFFIX  [F02:TRAP_SUFFIX]

### The case (18 August 2026)

**Input.** The module «Server di posta» was created, with module key `posta` and permission
`posta.gestisci` — correct Italian, following the project's own naming rule ②.

**Outcome.** The page *Impostazioni Account* declared «Server di posta: non accessibile» **to a
Superadmin as well**. No error, no log line, no failing test. It only showed to somebody who opened that
particular page.

**Cause.** `src/views/Profiles/Account/index.jsx` recognises access to a module by the **last word of the
permission key**, against exactly three suffixes:

```js
const hasViewPermission =
  permissionSet.has(`${moduleKey}.view`)
  || permissionSet.has(`${moduleKey}.manage`)
  || permissionSet.has(`${moduleKey}.view_list`);
```

`.gestisci` matched neither of the three, so the heuristic returned false for every role — Superadmin
included, because this check reads the permission list, and being Superadmin only means *holding all
permissions*, not *bypassing the check*.

**Resolution.** Renamed to `mail` / `mail.manage` the next day. The code comment records why the timing
mattered: uncommitted migrations can be rewritten, committed ones cannot.

### What to check

- Every new permission key ends in **`.view`, `.manage`, or `.view_list`** when it is the key that grants
  entry to a module. Action keys beyond entry (`.create`, `.edit`, `.delete`, `.send`, `.reveal`,
  `.generate`, `.use`, `.run_scan`, `.publish` …) are fine and expected — but the module must **also**
  have one of the three entry suffixes, or it is unreachable from *Impostazioni Account*.
- A **new suffix** is a finding in itself. It can be made to work by adding it to the heuristic, but the
  code comment says the better answer is not to create one: *«un suffisso nuovo va aggiunto qui — ed è il
  motivo per cui i suffissi nuovi è meglio non farli nascere»*.
- The suffix is in **English**, like the sixteen already there → [F02:NAMING_CONVENTION].

**Consequence to state in the report:** the module is declared inaccessible on *Impostazioni Account*
even to roles that hold every permission, and the fault surfaces only when someone opens that page.

---

## PART 2 — TRAP ② · THE BORROWED PERMISSION  [F02:TRAP_BORROWED_PERMISSION]

### The case (resolved 7 August 2026)

**Input.** The AI chat and roughly ninety routes of the Brief / Fonti / Contenuti Web / Ads / Report /
Alert / Opportunità / Task / Performance area were built on the permissions of the `projects` module —
the Pipeline's — because those routes already required them.

**Outcome.** Two consequences, both invisible until someone reasoned about roles:

- **Sending an AI chat message, which spends money, required the same permission as renaming a card on
  the kanban board.**
- A role could not be given the Pipeline without also being given AI Production.

**Cause.** The cheapest way to satisfy rule ① is to lean on a neighbouring module's permission. It
compiles, the routes are guarded, and nothing looks wrong. What is lost is not security in the narrow
sense: it is **the ability to govern the two things separately** — which is the entire purpose of having
permissions.

**Resolution.** The `ai_production` module was created with five permissions, and `generate` was kept
separate on an explicit principle recorded in the code: it is *the only action that consumes the
agency's AI budget*. The same separation had already been applied to the chat, `view` apart from `use`.

### What to check

- A new route or action is guarded by a permission **of its own module**. A `moduleKey` in
  `SYSTEM_PERMISSION_CATALOG` that does not match the module the feature belongs to is the signature of
  this trap → [F01:LINK_1_CATALOG_LIST].
- **Ask what the action costs.** If it spends money, deletes data, sends something outward, or reveals a
  secret, it needs its own key — it is never folded into a broader one. Precedents to cite:
  `ai_production.generate`, `chat.use` versus `chat.view`, and `vault.reveal`, whose policies file says
  it in the code: *"Critical action: never treat reveal as equivalent to view/list"*.
- Watch for the same trap in reverse in the menu: an array `requiredPermission` that mixes a narrow key
  with a broad one lets the broad one open an entry the narrow one was meant to guard
  → [F01:LINK_5_SIDEBAR].

**Consequence to state in the report:** two capabilities of different weight become impossible to
separate, and whoever grants the lighter one grants the heavier one without knowing.

---

## PART 3 — TRAP ③ · THE SILENT WIDENING  [F02:TRAP_SILENT_WIDENING]

### The case (7 August 2026, prevented rather than suffered)

**Input.** `ai_production.manage_settings` and `ai_production.manage_budget` were added to the
catalogue. Before that date those routes were guarded by a hand-written check on the **role name**
(`'superadmin'`), outside the catalogue entirely.

**Outcome, had nothing else been done.** Admin would have received both — because Admin is defined as
`{ mode: 'all_except', exclude: [...] }`, so **every new catalogue permission reaches it by default**.
Turning a hand-written Superadmin-only check into a real permission would have quietly handed AI
settings and AI budget to every Admin.

**Cause.** The defect here is created by **doing nothing**. In the other two traps somebody wrote
something wrong; here the file writes it for you. The code comment names it: adding the permission to
the catalogue without excluding it would have been *«un allargamento silenzioso»*.

**Resolution.** Both were added to Admin's `exclude` list, with a comment recording the reasoning, next
to the same treatment already given to `modules.manage`.

### What to check

- For **every** new permission, the diff shows a decision about Admin. Absence of a decision **is** a
  decision, and it is "yes".
- Powers that configure the workspace rather than operate it belong in `exclude`. The list already holds
  `modules.manage`, `roles.view`, `roles.manage`, `roles.assign`, `team.roles_assign`,
  `ai_production.manage_settings`, `ai_production.manage_budget`, plus `team.manage` kept there as a
  guard against a legacy broad grant surviving in older databases.
- ⚠️ **A route moving from a hand-written role-name check to a real permission is exactly this case.**
  Look for a removed `=== 'superadmin'` (or equivalent) in the diff: the behaviour must stay identical
  after the change, and staying identical usually requires an `exclude` entry.
- The mirror image is also a finding: an operational permission that Manager or Operativo held through a
  broader key, and that the explicit lists were not updated to include → [F01:RULE_ONE_BIS_ROLES].

**Consequence to state in the report:** a power intended for the Superadmin reaches every Admin from the
next login, with nothing in the diff that looks like a grant.

---

## PART 4 — THE NAMING CONVENTION FOR KEYS  [F02:NAMING_CONVENTION]

The project has two naming rules that appear to contradict each other and do not. Knowing which applies
is what keeps a report from being wrong.

**Rule ② — what the user reads is Italian.** On-screen labels, page titles, menu entries, and **the
descriptions of permissions** are born in Italian, understandable to whoever works in the agency.
Anglicisms only where they are the real term of the trade (Google Ads and Meta vocabulary: *Headline,
Primary text, Keyword, Sitelink, Ad Group*).

**Rule ②-bis — a key entering an existing structure follows that structure.** When the name is not a
label but a **key slotting into an already populated list** — module keys, permission keys, Prisma table
and model names, API and frontend route paths, activity-log event names — the convention of that list
wins, **until phase B of the renaming changes them all together**. Today that convention is **English**.

Two consequences to hold on to:

- **The label and the key may speak different languages, and that is correct.** The page is «Server di
  posta» on screen and `mail` in code. Two audiences, not an inconsistency.
- **When in doubt, look at the neighbours.** Before judging a key, open the list it lands in
  (`server/auth/rbac-catalog.ts` for modules and permissions, `prisma/schema.prisma` for models,
  `src/routes/RouteList.jsx` for routes) and read how the existing ones are named. *«Se la tua sarebbe
  l'unica diversa, è la tua a essere sbagliata.»*

**What to check**

- A new key is English, lowercase, `module.action`, with `snake_case` for multi-word actions
  (`view_list`, `manage_templates`, `manage_settings`, `move_stage`, `run_scan`).
- A new **label** is Italian. A key in Italian, or a label in English outside the trade vocabulary, is a
  finding — but a *naming* finding, ranked below a broken chain link.
- ⚠️ **Before proposing any name, check whether the area already has one.** The decided names, the
  rejected alternatives and the reasons live in `archivio-documenti/03-roadmap-confronto-e-build.md`,
  entry «Re-naming delle aree». Reporting "this should be called X" without looking there re-opens a
  settled decision.

---

## SOURCE_NOTES  [F02:SOURCE_NOTES]

**Traceability.** Compiled 24 August 2026. Every case below is documented **twice** in the CRM — once as
a written rule and once as a comment in the code it concerns — and the two agree. Tier 1 = the code or a
written project rule · Tier 2 = generated artefact · Tier 3 = inference.

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| The suffix heuristic and its three accepted suffixes | `src/views/Profiles/Account/index.jsx` (code read directly, with its own explanatory comment) | 1 | HIGH |
| The `posta.gestisci` case, its date, its symptom and its resolution | `crmadv/CLAUDE.md` rule ②-bis + comment in `server/auth/rbac-catalog.ts` | 1 | HIGH — two independent sources agreeing |
| Superadmin is not exempt from the suffix heuristic | the check reads the permission set; recorded symptom «anche a un Superadmin» | 1 | HIGH |
| The AI chat / `projects` borrowed-permission case and its ninety routes | `crmadv/CLAUDE.md` rule ① + comment in `rbac-catalog.ts` on `AI_PRODUCTION_MODULE_KEY` | 1 | HIGH |
| `generate` separated because it is the only action spending the AI budget | comment in `rbac-catalog.ts` on `AI_PRODUCTION_PERMISSIONS` | 1 | HIGH |
| «Critical action: never treat reveal as equivalent to view/list» | `server/modules/vault/policies.ts` | 1 | HIGH |
| Admin is `all_except`, so a new permission reaches it by default | `rbac-catalog.ts` → `SYSTEM_ROLE_DEFINITIONS` | 1 | HIGH |
| The AI settings/budget exclusion and the phrase «allargamento silenzioso» | inline comment in `rbac-catalog.ts` | 1 | HIGH |
| Before 7/8/2026 those routes were guarded by a hand-written check on the role name | same comment | 1 | MEDIUM — asserted by the comment; the removed check itself was not read |
| Rules ② and ②-bis, and the «guarda i vicini» instruction | `crmadv/CLAUDE.md` | 1 | HIGH |

**VERIFY-ON-FIELD**

- The three accepted suffixes are the ones present on 24/8/2026. If a fourth has since been added to the
  heuristic, the code wins → [F00:SOURCE_FLAGGING].
- Admin's `exclude` list grows. Read it on the file rather than trusting the enumeration above.
- `team.manage` is kept in `exclude` as a guard against older databases; whether it is still in the
  catalogue at all was not established here — **[NOT-FOUND]**. Do not build a finding on its presence or
  absence without checking the catalogue first.

---

End of document — [F02] · crm-permessi-e-sicurezza v1.0
