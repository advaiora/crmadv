# Quotes Phase 4 Release Checklist

## Scope
- Advanced quote lifecycle (`DRAFT/SENT/ACCEPTED/REJECTED`) with edit/cancel/resend/delete rules.
- PDF export with branding, footer and signature options.
- Quote notifications (email templates + send flow).
- Audit logs and runtime metrics for quote operations.

## Required Environment Variables
- `DATABASE_URL`
- `AUTH_JWT_SECRET`
- `ALLOWED_ORIGINS`
- `SMTP_HOST` (required for real email delivery)
- `SMTP_PORT`
- `SMTP_SECURE` (`true/false`)
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`

## Pre-Deploy Validation
1. Run database migrations:
   - `npm run db:migrate`
2. Regenerate Prisma client:
   - `npm run db:generate`
3. Run backend unit tests:
   - `npm run test:unit`
4. Run backend integration smoke tests:
   - `npm run test:integration`
5. Build frontend:
   - `npm run build`

## Staging Smoke Tests
1. Login with a user that has `quotes.view`, `quotes.create`, `quotes.edit`, `quotes.send`, `quotes.accept`.
2. Create a quote from `/apps/quotes/new`.
3. Send quote (`DRAFT -> SENT`).
4. Edit sent quote and save.
5. Export PDF with custom options.
6. Accept or reject quote and verify status transition.
7. Re-open `/apps/quotes/:id` and validate action availability.
8. Verify notifications templates from `/apps/quotes/notifications`.
9. Verify monitoring endpoint:
   - `GET /quotes/metrics` with authorized user.
10. Verify audit log entries exist for create/update/send/accept/reject/delete/template changes.

## Post-Deploy Monitoring
1. Watch API logs for `Quotes operation failed`.
2. Check `GET /quotes/metrics` per workspace for:
   - elevated `error` counters
   - slow `avgDurationMs` in `exportPdf`
3. Verify notification skip reasons (`MAIL_NOT_CONFIGURED`, `CLIENT_EMAIL_MISSING`) are within expected range.
   (`MAIL_NOT_CONFIGURED` replaced `SMTP_NOT_CONFIGURED` on 17/8/2026, when the three
   independent SMTP readers were merged into `server/core/mail.ts`.)
4. Track 4xx/5xx rates on quote routes.

## Rollback Notes
1. Disable `quotes` module in affected workspace if severe issue occurs.
2. Roll back application image/version.
3. Keep migration rollback manual and data-safe (no destructive rollback in production without backup validation).
