# Team Module Hardening (Phase 5)

## Security Decisions
- Duplicate invite policy: if a `PENDING` invite exists for the same `workspaceId + email`, token is regenerated and `expiresAt` refreshed.
- Invite token hashing: `tokenHash = HMAC-SHA256(token, TEAM_INVITE_TOKEN_SECRET || AUTH_JWT_SECRET)`.
- Default invite duration: 7 days (`expiresInDays` max 30).
- Dev fallback when SMTP is missing: API returns `inviteLink` only in non-production.
- Dev email delivery fallback: if SMTP is not configured, invite email uses Ethereal test SMTP and API can return `invitePreviewUrl` (openable link to inspect the message in dev).
- `roles_assign` is enforced as Superadmin-only on server, even with permission grants.

## QA Checklist
- Scenario A: workspace with 1 active Superadmin -> deactivate or remove Superadmin role must return `403`.
- Scenario B: workspace with 2 active Superadmin -> demote/deactivate one should succeed and write audit events.
- Scenario C: invite -> revoke -> accept must fail with `410` (revoked/expired token).
- Scenario D: invite -> accept -> accept again returns `200` idempotent (no duplicate membership).
- Scenario E: disable `team` module in workspace -> all `/api/team*` routes return `403`.
- Scenario F (dev email): create invite and verify `invitePreviewUrl` is returned and opens the delivered message when no local SMTP is configured.
