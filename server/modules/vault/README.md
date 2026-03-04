# Vault Module (Workspace Password Gate)

## Scope
Vault now includes a workspace-level password gate (Bitwarden-like):
- Vault can be `locked` or `unlocked` per `user + workspace` session.
- Locked state blocks Vault APIs server-side with `VAULT_LOCKED`.
- Unlock is short-lived (default 15 minutes) via HttpOnly cookie.
- Workspace password is shared by workspace members, never stored in plaintext.

## Permissions
- `vault.view_list`
- `vault.create`
- `vault.edit`
- `vault.reveal`
- `vault.delete`
- `vault.manage_settings` (setup workspace vault password)

Policy: setup is restricted to `vault.manage_settings`.

## Security Rules
- Server-side enforcement only.
- Workspace isolation is mandatory on every query.
- `list != reveal`: list endpoints return metadata only.
- `vault.reveal` remains audited.
- Unlock events are audited: `vault.unlock_success`, `vault.unlock_fail`.
- Never log secrets/passwords/tokens.

## Workspace Vault Policy Model
`WorkspaceVaultPolicy`:
- `workspaceId` (unique)
- `masterPasswordHash` (bcrypt hash)
- `passwordVersion`
- `createdAt`, `updatedAt`

## Unlock Token
Cookie: `vault_unlock` (HttpOnly)
- payload bound to: `userId`, `workspaceId`, `iat`, `exp`, `sessionHash`
- encrypted + signed token (AES-GCM + HMAC)
- TTL default: `15m` (`VAULT_UNLOCK_TTL_SECONDS`)
- cookie defaults:
  - path: `/vault`
  - sameSite: `Lax`
  - secure: `true` in production

Environment (optional overrides):
- `VAULT_UNLOCK_TOKEN_SECRET` (fallback: `AUTH_JWT_SECRET`)
- `VAULT_UNLOCK_TTL_SECONDS`
- `VAULT_UNLOCK_COOKIE_NAME`
- `VAULT_UNLOCK_COOKIE_PATH`
- `VAULT_UNLOCK_COOKIE_SAME_SITE`
- `VAULT_UNLOCK_COOKIE_SECURE`

## API Endpoints
- `GET /vault/status`
  - requires `vault.view_list`
  - returns `{ exists, unlocked }`
  - does not require current unlock

- `POST /vault/setup`
  - requires `vault.manage_settings`
  - body: `{ password }`
  - creates workspace vault password only if not already configured
  - returns `201` and issues unlock cookie
  - if already configured: `409`

- `POST /vault/unlock`
  - requires `vault.view_list`
  - body: `{ password }`
  - on success: `204` + issues unlock cookie + audit `vault.unlock_success`
  - on invalid password: `401` + audit `vault.unlock_fail`

- `POST /vault/lock`
  - requires `vault.view_list`
  - clears unlock cookie
  - returns `204`

- Existing Vault CRUD/reveal:
  - `GET /vault`
  - `POST /vault`
  - `PATCH /vault/:id`
  - `DELETE /vault/:id`
  - `POST /vault/:id/reveal`

All above (except status/setup/unlock/lock) require vault unlocked server-side.
If locked: `423` + code `VAULT_LOCKED`.

## Enforcement Order
`ensureVaultAccess`:
1. `requireAuth`
2. `requireWorkspace`
3. `requireModuleEnabled('vault')`
4. `requirePermission('vault.*')`
5. `requireVaultUnlocked` (unless explicitly skipped)
6. optional `requireStepUp` for reveal (route-configurable)

## UI Flow
- Open Vault page:
  - call `GET /vault/status`
  - if `exists=false`: show setup form (permission-gated)
  - if `exists=true && unlocked=false`: show unlock form
  - if unlocked: load metadata list and allow reveal
- Client hygiene:
  - reveal masked by default
  - reveal auto-hide after 15s
  - no secret persistence in localStorage/global state

## TODO (Phase 4.5)
- Stronger second factor for reveal flow (WebAuthn/TOTP) where required.
- Optional reset/recovery workflow for workspace vault password.
