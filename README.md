# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

# CRM_Advaiora

## Google Sign-In Setup

Add these environment variables before using Google authentication:

- Backend (`.env`):
  - `GOOGLE_CLIENT_ID=<google-oauth-client-id>`
  - `AUTH_JWT_SECRET=<strong-secret-min-16-chars>`
  - `AUTH_JWT_EXPIRES_IN_SECONDS=604800` (optional)
  - `DATABASE_URL=<postgresql://...>`
  - `API_HOST=0.0.0.0`
  - `API_PORT=4000`
- Frontend (`.env` or `.env.local`):
  - `VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>`
  - `VITE_API_URL=http://localhost:4000`
  - `VITE_API_BASE_URL=/api` (optional, default `/api`)

Notes:
- `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` must refer to the same Google OAuth client.
- Google ID token is verified on the backend (`POST /auth/google`) before any DB write.
- Auth endpoints are unified on JWT bearer tokens:
  - `POST /auth/login`
  - `POST /auth/register`
  - `POST /auth/google`
  - `GET /auth/me`
  - `POST /auth/logout`

Production and QA docs:
- Setup dettagliato: `docs/google-auth-setup.md`
- Test manuali: `docs/google-auth-test-plan.md`
- Checklist release/deploy: `docs/release-checklist-google-auth.md`
