# Release Checklist - Google Auth

## Pre-release
1. Conferma env FE:
   - `VITE_GOOGLE_CLIENT_ID` (prod)
   - `VITE_API_URL` (endpoint API prod)
2. Conferma env BE:
   - `GOOGLE_CLIENT_ID` (prod)
   - `ALLOWED_ORIGINS` con dominio FE prod
   - `AUTH_JWT_SECRET` forte e ruotato se necessario
3. Verifica Google Cloud OAuth client:
   - origins prod configurate
   - consent screen completo
4. Verifica CORS:
   - `Access-Control-Allow-Origin` verso FE prod
   - `Access-Control-Allow-Credentials: true`
5. Verifica rate-limit su `/auth/google` attivo.
6. Esegui:
   - `npm run test:unit`
   - `npm run test:integration`
   - `npm run build`

## Deployment
1. Deploy backend con env prod.
2. Deploy frontend build con `VITE_API_URL` prod.
3. Smoke check health:
   - `GET /auth/google/health`
   - `googleClientIdConfigured: true`

## Post-deploy Smoke Tests

### 1) Nuovo utente -> signup Google
- Atteso: 201, workspace creato, redirect dashboard/onboarding.

### 2) Utente esistente -> login Google
- Atteso: 200, redirect dashboard.

### 3) Login Google senza workspace
- Atteso: 409, FE mostra CTA `Crea workspace`.

### 4) Slug gia in uso
- Atteso: 409, messaggio contiene `slug`.

### 5) Token fake
- Atteso: 401.

## Curl Smoke Commands
```bash
curl -i -X POST https://api.tuodominio.com/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<ID_TOKEN>"}'
```

```bash
curl -i -X POST https://api.tuodominio.com/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<ID_TOKEN>","workspaceName":"Prod Test","workspaceSlug":"prod-test-123"}'
```

## Rollback Criteria
- Spike di `401`/`409` non atteso su `/auth/google`.
- Login/signup Google non completabile per utenti validi.
- Errori CORS cross-origin in produzione.

## Rollback Actions
1. Rollback FE all'ultima release stabile.
2. Rollback BE all'ultima release stabile.
3. Ripristina env precedenti se mismatch client ID/origins.
