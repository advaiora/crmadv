# Vault Module (Phase 1)

## Scope
Phase 1 defines Vault security policy and enforcement rules only.

Out of scope for this phase:
- encryption implementation
- Vault DB schema/repository
- full Vault API/UI

## Permissions
Stable permission keys:
- `vault.view_list`
- `vault.create`
- `vault.edit`
- `vault.reveal`
- `vault.delete`

`vault.view_list` and `vault.reveal` are intentionally separated.

## Non-negotiable rules
- Server-side enforcement only: auth + workspace + module enabled + permission are mandatory on every Vault endpoint.
- Workspace isolation is mandatory (`workspaceId` scope on all operations).
- `vault.reveal` is a critical action and must always be audited.
- Secrets/plaintext must never appear in logs, errors, or audit metadata.
- UI hiding is not considered a security control.

## Enforcement pattern
Use `ensureVaultAccess` from `guards.ts` in each route handler before business logic:
1. `requireAuth`
2. `requireWorkspace`
3. `requireModuleEnabled("vault")`
4. `requirePermission("vault.*")`

## Step-up security
For any `vault.reveal` operation, step-up authentication (re-auth) is required.

Implementation note:
- explicit TODO already present in `guards.ts`
- to be implemented in Phase 4

