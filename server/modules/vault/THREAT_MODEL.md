# Vault Threat Model (MVP - Phase 1)

## Protected assets
- Vault secrets (credentials, tokens, API keys, private values)
- Metadata linked to secrets (labels, target systems, ownership, tags)
- Reveal events and audit trail integrity
- Workspace boundary (`workspaceId`) for every Vault object

## Actors
- Authenticated user with limited Vault permissions
- Workspace admin/superadmin with broad permissions
- Attacker with stolen session/token
- Internal misuse (privilege abuse or over-permissioned role)

## Primary attack surfaces
- `vault.reveal` API abuse
- Online guessing of the workspace master password via `POST /vault/unlock`: it is the gate
  that protects every secret at rest, so once it is passed, encryption at rest protects
  nothing — the key is handed to whoever guessed
- Logs/errors accidentally containing secret plaintext
- DB exfiltration/leak of Vault rows
- Session hijacking and replay
- Privilege escalation via missing permission checks
- Cross-workspace access caused by missing workspace scoping

## Required mitigations (MVP)
- Strict server-side enforcement on every endpoint:
  - authenticated user
  - valid workspace
  - module `vault` enabled
  - explicit permission check
- Mandatory workspace scoping (`workspaceId`) for all reads/writes.
- Permission split is mandatory:
  - list access (`vault.view_list`) is not reveal access (`vault.reveal`).
- `vault.reveal` is critical and must always produce an audit event.
- Audit metadata must never include plaintext secrets.
- Logs and error payloads must never contain secrets.
- Step-up security for `vault.reveal` is required in a later phase (re-auth before reveal).
- Every endpoint that verifies a password must be rate limited. bcrypt slows a single attempt
  down, it does not cap how many are made: `POST /vault/unlock` allows 5 **failed** attempts
  per 5 minutes per `workspace + user`, then answers `429 RATE_LIMITED`
  (`enforceVaultUnlockRateLimit` / `registerVaultUnlockFailure` in `rate-limit.ts`).
  Failures only, so a legitimate unlock never consumes budget; a success does not reset the
  counter, so failed bursts cannot be laundered by unlocking correctly in between.

## Known limitations accepted for now
- **Vault rate limiting lives in the memory of a single process**
  (`inMemoryVaultRateLimitStore`, `rate-limit.ts`). With more than one API instance each
  process keeps its own counters, so the effective ceiling is the configured one multiplied by
  the number of processes. Accepted on purpose — incomparably better than no limit at all —
  and tracked by `TODO(vault-phase-6.5)`: moving the counters to Redis (or any shared store)
  is what closes it. Anyone adding a new Vault limiter inherits the same caveat.
- The step-up limiter keys its bucket on the client IP too, and that IP is read from
  `x-forwarded-for` (`resolveRequestClientIp`). Without a trusted proxy in front, a caller can
  write that header and get a fresh bucket per value. The unlock limiter deliberately leaves
  the IP out of the key for this reason: one bucket per `workspace + user` is strictly tighter.

## Known future hardening (outside Phase 1)
- Encryption at rest + key management/rotation
- Step-up enforcement for reveal (Phase 4)
- Rate limiting specific to reveal endpoints

