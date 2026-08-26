# [F01] — THE PERMISSION CHAIN
# Skill: crm-permessi-e-sicurezza v1.0 | Internal reference
# Open when: the diff touches a permission, a role, a route, a module or a menu entry

---

## PART 1 — THE SIX LINKS  [F01:CHAIN_OVERVIEW]

A permission in this CRM is not one entry in one file. It is **six points in five files**, and the
work is only finished when all six agree. Two of the six live in the *same* file at different places —
which is exactly why one of them gets forgotten.

| # | Where | What must be there | If it is missing |
|---|---|---|---|
| 1 | `server/auth/rbac-catalog.ts` → `SYSTEM_PERMISSION_CATALOG` | the permission key, its `moduleKey`, and a description that says what it really enables | the permission cannot be granted from *Ruoli e permessi*: it exists only in code → [F01:LINK_1_CATALOG_LIST] |
| 2 | `server/auth/rbac-catalog.ts` → `SYSTEM_ROLE_DEFINITIONS` | the decision, for each of the five system roles, whether it gets the permission | nobody holds it — or, on Admin, **everybody does** without anyone deciding → [F01:LINK_2_ROLE_ASSIGNMENT] |
| 3 | `server/modules/<module>/policies.ts` | the key in the module's permission map, and the routes calling `ensure<Module>Access` with it | the route is either unguarded or guarded by the wrong permission → [F01:LINK_3_MODULE_POLICIES] |
| 4 | `src/modules/<module>/ui/constants.js` **and** `src/views/Profiles/Account/index.jsx` → `CORE_PERMISSIONS` | the same permission string, **hand-copied** | the UI shows or hides the wrong thing, and *Impostazioni Account* misreports access → [F01:LINK_4_FRONTEND_CONSTANTS] |
| 5 | `src/layout/Sidebar/SidebarMenu.jsx` | `requiredPermission` on the menu entry | the sidebar entry appears to people who cannot use it, or hides from people who can → [F01:LINK_5_SIDEBAR] |
| 6 | `src/layout/Mobile/MobileBottomNav.jsx` → `PRIMARY_ITEMS` | `requiredModule` **and** `requiredPermission` on the item | the mobile nav and the sidebar disagree: the same person sees the area on one and not on the other → [F01:LINK_6_MOBILE_NAV] |

### How to walk it

1. **Open the generated map first**: `archivio-documenti/mappa/mappa-progetto.md`. Its §3 already lists
   the catalogue permissions with no frontend counterpart, and its §4 lists the switchboards to align.
   Use it as a checklist. ⚠️ It carries a date and a commit at the top: **if it is older than the diff
   you are reviewing, the code wins** → [F00:SOURCE_FLAGGING].
2. **Then confirm on the code**, link by link, in the order above. Navigate by symbol name
   (`SYSTEM_PERMISSION_CATALOG`, `requiredPermission`, `CORE_PERMISSIONS`), never by line number: line
   numbers move at every commit.
3. **Report per link.** "The chain is incomplete" is not a finding. "Il permesso `x.y` è nel catalogo ma
   non in `SidebarMenu.jsx`" is.

> ⚠️ Some files here are very large. `server/modules/agency-os/agency.service.ts` exceeds ten thousand
> lines. Open the parts you need, not whole files.

---

## PART 2 — LINK 1 · THE CATALOGUE LIST  [F01:LINK_1_CATALOG_LIST]

`server/auth/rbac-catalog.ts` holds two catalogues:

- `SYSTEM_MODULE_CATALOG` — one entry per module: `{ key, name, isCore, description }`. `name` is the
  Italian on-screen label («Produzione AI», «Credenziali», «Server di posta»); `key` is the technical
  English key. **The two speaking different languages is correct, not an inconsistency**: they address
  two different audiences → [F02:NAMING_CONVENTION].
- `SYSTEM_PERMISSION_CATALOG` — one entry per permission: `{ key, moduleKey, description }`.

**What to check**

- The new permission has an entry, with the **right `moduleKey`**. A permission filed under another
  module's key is the *borrowed permission* defect → [F02:TRAP_BORROWED_PERMISSION].
- A new module has an entry in `SYSTEM_MODULE_CATALOG`, and `isCore` is a deliberate choice: `isCore:
  true` means the module cannot be switched off from *Gestione Moduli*. It is right for system
  configuration (`modules`, `branding`, `audit`, `mail`, `dashboard`) and wrong for a business feature.

**⚠️ The `description` is a governance surface, not documentation.** It is the sentence a Superadmin
reads while deciding whether to grant the permission. If it undersells what the permission does, it
produces a grant nobody intended to make. The codebase already carries three worked examples of
descriptions written precisely for that reason:

- `mail.manage` — «Configurare il server di posta da cui il CRM spedisce le email (inviti compresi)».
  Whoever holds it can redirect the workspace's mail to their own server. Described as "see a
  configuration screen", it would be granted as if it were read-only.
- `team.deactivate` — «Disattivare e riattivare una persona del team, e rimuoverla (la rimozione resta
  comunque al solo Superadmin)». It governs **three** actions, not one.
- `roles.assign` vs `team.roles_assign` — near-identical names governing two different screens. The
  descriptions say **from where** one acts, otherwise whoever grants one thinking they granted the other
  ends up with a 403 and no idea why.

→ **Report a description that describes the screen instead of the power.** Consequence to state: the
permission gets granted on a false understanding of what it allows.

---

## PART 3 — LINK 2 · THE ROLE ASSIGNMENT  [F01:LINK_2_ROLE_ASSIGNMENT]

Same file, further down: `SYSTEM_ROLE_DEFINITIONS`. The five system roles are `Superadmin`, `Admin`,
`Manager`, `Operativo`, `Viewer` (`SYSTEM_ROLE_NAME`). They use **three different assignment modes**,
and the difference is the whole point of this link:

| Role | Mode | What a new permission does by default |
|---|---|---|
| Superadmin | `permissions: 'all'` | **receives it automatically** |
| Admin | `{ mode: 'all_except', exclude: [...] }` | **receives it automatically**, unless explicitly excluded |
| Manager · Operativo · Viewer | explicit list | **receives nothing** unless added by hand |

**What to check**

- The diff shows a **deliberate decision for each of the five roles**, not silence. Silence on
  Manager/Operativo/Viewer means "no"; silence on Admin means "yes" — and that asymmetry is where the
  silent widening happens → [F02:TRAP_SILENT_WIDENING].
- Configuration-of-workspace powers stay with Superadmin only. The file already excludes
  `modules.manage`, `roles.view`, `roles.manage`, `roles.assign`, `team.roles_assign`,
  `ai_production.manage_settings` and `ai_production.manage_budget` from Admin, each with a comment
  saying why. A new permission of that nature belongs in the same list.
- **The second question of rule ①-bis is asked**: not only *who receives it*, but *who was already
  doing this with another permission* → [F01:RULE_ONE_BIS_ROLES].

---

## PART 4 — LINK 3 · THE MODULE POLICIES  [F01:LINK_3_MODULE_POLICIES]

Every backend module owns `server/modules/<module>/policies.ts`. Canonical shape, from
`server/modules/quotes/policies.ts`:

- `QUOTES_MODULE_KEY = 'quotes'` — the module key;
- `QUOTES_PERMISSIONS = { view, create, edit, delete, send, accept, manageTemplates } as const` — the
  permission map, plus a `type` derived from it;
- `ensureQuotesAccess(request, permissionKey)` — built by `buildEnsureQuotesAccess()` with injectable
  dependencies, which runs **four guards in this order**:
  `requireAuth` → `requireWorkspace` → `requireModuleEnabled` → `requirePermission`.

The guards live in `server/guards/`: `requireAuth.ts`, `requireWorkspace.ts`, `requireModule.ts`,
`requirePermission.ts`, `requirePlatformAdmin.ts`.

**What to check**

- The new key is in the module's permission map, and every new route calls `ensure<Module>Access` with
  **that** key — not with a neighbouring one because "the route already required it".
- The **order of the four guards** is unchanged. Checking the permission before the workspace would
  answer a question about the wrong tenant.
- `requireModuleEnabled` is present. A permission granted while the module is switched off must still
  refuse.
- **Look for a second gate inside the service.** A permission can be split further down: `team.deactivate`
  passes `requirePermission`, but removal is gated again in `server/modules/team/team.service.ts`
  (around lines 416-419) and stays with Superadmin only. When a diff adds a second gate like that, check
  that the catalogue description says so → [F01:LINK_1_CATALOG_LIST].
- A critical action is never folded into a broad one. `server/modules/vault/policies.ts` states it in
  the code: *"Critical action: never treat reveal as equivalent to view/list"*. Same principle behind
  `ai_production.generate` (the only action that spends the AI budget) and `chat.use` versus
  `chat.view`. **If a new action spends money, deletes data, or reveals a secret, it needs its own
  key.**

---

## PART 5 — LINK 4 · THE HAND-COPIED FRONTEND CONSTANTS  [F01:LINK_4_FRONTEND_CONSTANTS]

⚠️ **This is the weakest link in the chain, and the reason is structural: the strings are copied by
hand.** There is no shared type, no import from the backend, no build-time check. The project map says
it outright in its §4: *«le stringhe-permesso sono copiate a mano in `src/modules/<nome>/ui/constants.js`»*.

There are **two** hand-copied lists, not one. Check both.

**① The module's own constants** — `src/modules/<module>/ui/constants.js`. Shape, from
`src/modules/vault/ui/constants.js`:

```js
export const VAULT_PERMISSIONS = {
    viewList: 'vault.view_list',
    create: 'vault.create',
    ...
};
```

Present for: `calendar`, `clients`, `dashboard`, `messaging`, `quotes`, `team`, `vault`, `web-assets`.
A module without one is not automatically a defect — some areas read the permission string inline — but
a module that *has* one and does not carry the new key is.

**② `CORE_PERMISSIONS` in `src/views/Profiles/Account/index.jsx`** — a flat list of the permissions
considered "core", used by the *Impostazioni Account* page, next to a `MODULE_LABELS` map of module key
to Italian label. This list is cited by no rule and by no map: it is the one people forget. It is also
the file where the suffix trap lives → [F02:TRAP_SUFFIX].

**What to check**

- The permission string is **identical**, character by character, on both sides. A typo here fails
  silently: `hasPermission()` in `src/utils/workspaceAccess.js` is a plain `Array.includes()`, so a
  mistyped key simply never matches and the feature stays invisible with no error anywhere.
- A new module added to `MODULE_LABELS` gets its Italian label, or the page shows the raw key.
- The check the frontend runs is `hasPermission(access, key)` and `hasModuleEnabled(access, moduleKey)`;
  `isPlatformAdmin(access)` is a **global identity above workspaces, not a permission** — a diff that
  treats it as one is a finding.

⚠️ **This is a known shape of defect in this project, not a peculiarity of permissions — see operative
note #49.** Its own corollary names the family: *«Vale per qualsiasi mappa costruita a mano su valori
che nascono altrove: etichette di stato, permessi, chiavi di moduli, nomi di funzione. Il segnale
d'allarme è scrivere un oggetto letterale senza aver appena guardato la sorgente.»* Both lists above
are exactly that — hand-built maps of values born in `rbac-catalog.ts`.

**The part of #49 to carry into your verdict:** *«Un test che verifica il dizionario contro sé stesso
passa sempre. La suite verde non dice niente sulla completezza di una mappa.»* A green test suite is
therefore **not** evidence that the chain is complete, and a diff that adds tests over its own new
constants has not demonstrated anything about links 4-6. Say so in those words when it comes up: the
author usually believes the tests covered it.

---

## PART 6 — LINK 5 · THE SIDEBAR  [F01:LINK_5_SIDEBAR]

`src/layout/Sidebar/SidebarMenu.jsx` declares the menu tree; `src/layout/Sidebar/menuUtils.js` decides
what each person sees. Two forms are accepted:

- `requiredPermission: "clients.view"` — a single key;
- `requiredPermission: [ ... ]` — an **array, satisfied by any one** of the keys (`.some()` in
  `menuUtils.js`). Useful, and easy to misuse: an array that includes a broad key defeats the narrow one
  next to it.

**What to check**

- The new area or action has its entry, with the permission that actually guards its routes — not the
  parent's.
- Where an array is used, every key in it is one that *should* open that entry. Report an array that
  mixes a narrow permission with a broad one.
- `requiredModule` and `requiredPermission` agree: an entry gated on a module but not on a permission
  shows up for anyone inside the workspace.

---

## PART 7 — LINK 6 · THE MOBILE NAVIGATION  [F01:LINK_6_MOBILE_NAV]

`src/layout/Mobile/MobileBottomNav.jsx` keeps its **own** array, `PRIMARY_ITEMS`, each entry carrying
`key`, `label`, `path`, `icon`, `requiredModule` and `requiredPermission`, filtered by a local
`canAccessItem()`. It does **not** read the sidebar tree.

**What to check**

- Whether the area belongs in the mobile primary items at all is a product decision, not yours: if the
  answer is unclear, park it → [F00:OUTPUT_FORMAT].
- What *is* yours: if the entry exists, its `requiredModule` and `requiredPermission` must match the
  sidebar's. **Two switchboards that disagree produce the worst kind of bug** — the same person sees the
  area on the phone and not on the desktop, and each screen looks correct on its own.

---

## PART 8 — RULE ① · THE PERMISSION IS BORN WITH THE FEATURE  [F01:RULE_ONE_SAME_WORK]

From `crmadv/CLAUDE.md`, in force since 7/8/2026:

> «Quando si aggiunge un pezzo di CRM — una rotta, un'area, un'azione che non tutti devono poter fare —
> la voce corrispondente nel catalogo si crea **nello stesso lavoro**, senza che l'utente debba
> chiederlo. […] è parte di ciò che significa **finito**.»

And the consequence, which is the sentence to quote in a report:

> «una voce dimenticata non è un difetto estetico, è **una funzione che nessun ruolo può governare** —
> e non si vede finché qualcuno non ne ha bisogno.»

**What to check.** The diff adds a route, an area, or an action not everyone should perform → the
catalogue entry is in the **same** diff. "We'll add it later" fails this rule. So does the most common
fallback, which has its own section → [F02:TRAP_BORROWED_PERMISSION].

---

## PART 9 — RULE ①-BIS · THE ROLES MOVE WITH THE PERMISSION  [F01:RULE_ONE_BIS_ROLES]

Also from `crmadv/CLAUDE.md`: adding a catalogue entry is not enough. The five system roles are
**reviewed in the same work**, deciding for each whether the new permission belongs to it.

**The double question to ask at every new permission:**

1. *Who receives it among the system roles?*
2. *Who was already doing this with another permission?* — **because those must lose nothing.**

Question 2 is the one that gets skipped, and it is the one that breaks working setups: when a route
starts asking `chat.use` instead of `projects.view`, everyone who was using the chat through
`projects.view` loses it the moment the route changes.

> Explicit instruction from Jacopo, 7/8/2026, to quote when a diff defers this: «che serva una
> migrazione **non è un buon motivo per rimandare**» — the predefined roles must be aligned and up to
> date at all times.

---

## PART 10 — THE CARRY-OVER DATA MIGRATION  [F01:DATA_MIGRATION]

`ensureWorkspaceSystemRoles` runs at **every login** and re-synchronises the **system roles only**.
Custom roles (`Role.isSystem = false`) are touched by nothing. Therefore:

⚠️ **Before you conclude that a catalogue change did not take effect, read operative note #50.** The
catalogue is rewritten only when `ensureRbacCatalog` runs, and that sits **inside**
`ensureWorkspaceSystemRoles`, called at every `/auth/me`. So querying the database first shows the
**old** values, and that is normal — not evidence of a broken diff. #50 also records how to force the
re-synchronisation from a script: `ensureRbacCatalog` is not exported, `ensureWorkspaceSystemRoles` is
(`server/auth/workspace-bootstrap.ts`), and it takes `{ tx, workspaceId, actorUserId, sourceAction }`.
Reporting *«il permesso non arriva a schermo»* on an unsynchronised read is a false alarm of exactly
the kind → [F05:NEGATIVE_CASES].

> **If the new permission must also reach existing custom roles, the work needs a data migration.**
> Without it, whoever uses a custom role loses the feature **in silence** the moment the routes start
> asking for the new key.

The model to compare against is `prisma/migrations/20260715141500_chat_permissions/migration.sql`. What
makes it correct, and what to check in any imitation of it:

- **Idempotent everywhere** — `ON CONFLICT ... DO NOTHING` on every insert, so it coexists with the
  bootstrap that upserts the same rows at login.
- **It creates the `Permission` rows first**, then attaches roles to them.
- **It carries inheritance forward**: a section that grants the new permission to whoever already held
  the old one. This is question 2 of rule ①-bis in SQL form → [F01:RULE_ONE_BIS_ROLES].

**What to check**

- The migration is in the **same** diff as the catalogue change, when custom roles are in play.
- It is a **new** migration file. Existing migrations are never rewritten once committed.
- ⚠️ **A migration is a red gate** and must never sit on a long branch: two branches carrying two
  migrations merge and the database no longer knows the order → [F04:GATES_TABLE].

---

## SOURCE_NOTES  [F01:SOURCE_NOTES]

**Traceability.** Compiled 24 August 2026 by direct reading of the `crmadv` sources at commit `3e3cb50`.
Tier 1 = the code or a written project rule · Tier 2 = generated artefact · Tier 3 = inference.

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| The chain has six points across five files | `rbac-catalog.ts`, a module `policies.ts`, `ui/constants.js` + `Account/index.jsx`, `SidebarMenu.jsx`, `MobileBottomNav.jsx` — all read directly | 1 | HIGH |
| `SYSTEM_MODULE_CATALOG` / `SYSTEM_PERMISSION_CATALOG` / `SYSTEM_ROLE_DEFINITIONS` shapes | `server/auth/rbac-catalog.ts` | 1 | HIGH |
| The three role assignment modes (`all`, `all_except`, explicit list) | `server/auth/rbac-catalog.ts` → `SYSTEM_ROLE_DEFINITIONS` | 1 | HIGH |
| Descriptions written to prevent mis-granting (`mail.manage`, `team.deactivate`, `roles.assign`) | inline comments in `server/auth/rbac-catalog.ts` | 1 | HIGH |
| The four-guard order in `ensure<Module>Access` | `server/modules/quotes/policies.ts` read in full | 1 | HIGH |
| Second gate on removal at `team.service.ts:416-419` | comment in `rbac-catalog.ts` citing it | 1 | MEDIUM — the citing comment was read, the service file itself was not |
| «Critical action: never treat reveal as equivalent to view/list» | `server/modules/vault/policies.ts` | 1 | HIGH |
| Permission strings are hand-copied in the frontend | `archivio-documenti/mappa/mappa-progetto.md` §4 | 2 | HIGH |
| `CORE_PERMISSIONS` is a second hand-copied list | `src/views/Profiles/Account/index.jsx` | 1 | HIGH |
| `menuUtils.js` accepts an array satisfied by any one key | `src/layout/Sidebar/menuUtils.js` | 1 | HIGH |
| `MobileBottomNav.jsx` keeps its own `PRIMARY_ITEMS` array | `src/layout/Mobile/MobileBottomNav.jsx` | 1 | HIGH |
| Rules ① and ①-bis, and Jacopo's instruction of 7/8/2026 | `crmadv/CLAUDE.md` | 1 | HIGH |
| `ensureWorkspaceSystemRoles` touches system roles only; carry-over migration needed | `crmadv/CLAUDE.md` + `prisma/migrations/20260715141500_chat_permissions/migration.sql` header comment | 1 | HIGH |

**VERIFY-ON-FIELD**

- The list of modules owning a `ui/constants.js` (eight at the time of writing) grows with the product:
  enumerate it on the code, do not trust this list.
- The exact line range of the second gate in `team.service.ts` was not opened directly. Confirm by
  symbol before citing a line number in a report.
- The count of catalogue permissions (76 on 24/8/2026) and every line number in this document are dated
  snapshots. **Navigate by symbol name** → [F00:SOURCE_FLAGGING].

---

End of document — [F01] · crm-permessi-e-sicurezza v1.0
