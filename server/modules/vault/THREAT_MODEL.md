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

## Known future hardening (outside Phase 1)
- Encryption at rest + key management/rotation
- Step-up enforcement for reveal (Phase 4)
- Rate limiting specific to reveal endpoints

