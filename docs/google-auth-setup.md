# Google Auth Setup

## Overview
- Frontend (React + Vite) ottiene Google ID token con GIS.
- Backend (Fastify) valida token e gestisce login/signup via `POST /auth/google`.
- Risposta compatibile FE: `payload.data ?? payload`, con `token`, `user`, `workspace` e flag onboarding.

## Environment Variables

### Frontend (`.env` / `.env.local`)
- `VITE_GOOGLE_CLIENT_ID=<google_oauth_client_id>`
- `VITE_API_URL=https://api.tuodominio.com` (dev: `http://localhost:4000`)

### Backend (`.env`)
- `GOOGLE_CLIENT_ID=<google_oauth_client_id>`
- `ALLOWED_ORIGINS=https://app.tuodominio.com` (dev: `http://localhost:5173`)
- `AUTH_JWT_SECRET=<strong-secret>`
- `AUTH_JWT_EXPIRES_IN_SECONDS=604800` (optional)
- `DATABASE_URL=<postgresql://...>`
- `API_HOST=0.0.0.0`
- `API_PORT=4000`

## Google Cloud Console
1. `APIs & Services` -> `OAuth consent screen`
2. `APIs & Services` -> `Credentials` -> OAuth Client (Web application)
3. Authorized JavaScript origins:
   - `https://app.tuodominio.com`
   - `https://tuodominio.com` (se FE serve anche qui)
   - `http://localhost:5173` (solo dev)
4. Redirect URIs: solo se usi redirect flow (non necessario nel popup callback flow attuale)
5. Verifica branding, support email e domini del consent screen.

## Backend Security Notes
- Nessun log di `idToken` o secret.
- `/auth/google` con rate-limit dedicato (`10 req/min` per IP via plugin).
- CORS allowlist stretta + `Access-Control-Allow-Credentials: true`.
- Validazioni server-side sempre attive su slug/workspaceName.

## Account Linking Policy (Option 1)
1. Match per `googleSub` se presente.
2. Se non trovato, match per email:
   - se `googleSub` nullo: link automatico
   - se `googleSub` diverso: `409 EMAIL_CONFLICT`
3. Se utente non esiste: creazione nuovo utente Google.

## Workspace Selection
- Login Google senza payload workspace usa workspace attivo piu recente.
- Se utente senza workspace: `409 NO_WORKSPACE` (CTA su signup lato FE).
- Multi-workspace picker dedicato non incluso in questa fase.

## Response Shape
Success (`/auth/google`):
```json
{
  "data": {
    "token": "<jwt>",
    "user": { "id": "u1", "email": "user@example.com", "role": "member" },
    "workspace": { "id": "w1", "slug": "acme" },
    "onboardingRequired": true,
    "isNewUser": true,
    "isNewWorkspace": true
  }
}
```

## Troubleshooting

### Popup blocked / canceled
- Sintomo FE: `Popup Google bloccato o accesso annullato...`
- Azione: abilita popup del browser e riprova.

### 401 invalid token / aud mismatch
- Verifica che `VITE_GOOGLE_CLIENT_ID` (FE) e `GOOGLE_CLIENT_ID` (BE) siano lo stesso client.
- Verifica origin autorizzate in Google Cloud.

### 409 slug conflict
- Messaggio contiene `slug`.
- Cambia `workspaceSlug` e riprova.

### 409 email conflict
- Email gia legata ad altro accesso Google.
- Usa login email/password o contatta supporto.
