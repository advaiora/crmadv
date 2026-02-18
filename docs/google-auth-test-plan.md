# Google Auth Test Plan (Fase 4)

## Scope
- Frontend: React + Vite
- Backend: Fastify
- Endpoint: `POST /auth/google` (login + signup)
- Session client flow: `useSession().login()` + redirect `/dashboard`

## Preconditions
1. FE avviato su `http://localhost:5173`
2. BE avviato su `http://localhost:4000`
3. Env configurate:
   - FE: `VITE_GOOGLE_CLIENT_ID`, `VITE_API_URL=http://localhost:4000`
   - BE: `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGINS=http://localhost:5173`
4. OAuth Google client Web configurato con origin `http://localhost:5173`
5. Browser con popup non bloccati (per scenario happy path)

## Quick Sanity
1. `GET /auth/google/health` deve rispondere `200`
2. Verifica risposta con:
   - `ok: true`
   - `googleClientIdConfigured: true`
   - `metrics` presenti (`total`, `success`, `error`, `byStatusCode`, `byErrorCode`)

```bash
curl -i http://localhost:4000/auth/google/health
```

## Manual Checklist (Step-by-step)
1. Apri Login e clicca `Continua con Google`
2. Completa popup Google con account valido
3. Verifica redirect su `/dashboard`
4. Logout e apri Signup
5. Compila `workspaceName` + `workspaceSlug` validi
6. Clicca `Registrati con Google`
7. Verifica redirect su `/dashboard`
8. Controlla log BE:
   - nessun token in chiaro
   - campi: `reqId`, `provider`, `mode`, `result`, `statusCode`, `email`, `latencyMs`
9. Controlla `/auth/google/health` e verifica incremento metriche

## Scenari Principali

### 1) Nuovo utente -> Signup Google (workspace creato)
- Input: `idToken` valido + `workspaceName` + `workspaceSlug` univoco
- Expected:
  - HTTP `201`
  - Body: `data.token`, `data.user`, `data.workspace`
  - FE: login sessione + redirect dashboard

### 2) Utente esistente -> Login Google
- Input: `idToken` valido (senza campi workspace)
- Expected:
  - HTTP `200`
  - Body: `data.token`, `data.user`, `data.workspace`
  - FE: login sessione + redirect dashboard

### 3) Login Google senza workspace
- Input: `idToken` valido di utente senza membership attiva
- Expected:
  - HTTP `409`
  - Messaggio riconoscibile NO_WORKSPACE
  - FE Login: alert + CTA `Vai alla registrazione` verso `/auth/signup`

## Scenari Edge

### 1) Slug già in uso
- Input: signup Google con `workspaceSlug` duplicato
- Expected:
  - HTTP `409`
  - Messaggio contiene `slug`
  - FE Signup: errore coerente + evidenziazione campo slug

### 2) Token invalido / aud errata / scaduto
- Input: `idToken` fake
- Expected:
  - HTTP `401`
  - Messaggio: accesso Google non valido

### 3) Email conflict (stessa email, altro googleSub)
- Input: `idToken` valido con email già presente ma linkata ad altro `googleSub`
- Expected:
  - HTTP `409`
  - Messaggio: account Google non disponibile

### 4) Rete down / errore 500
- Simula backend spento o fault applicativo
- Expected:
  - FE mostra errore user-friendly generico Google
  - Nessun token/log sensibile

## Curl Commands

Nota: il token reale non si genera via curl; usa placeholder `<ID_TOKEN>`.

### Login mode
```bash
curl -i -X POST http://localhost:4000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<ID_TOKEN>"}'
```

### Signup mode
```bash
curl -i -X POST http://localhost:4000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<ID_TOKEN>","workspaceName":"Test Workspace","workspaceSlug":"test-workspace-123"}'
```

### Invalid token (401 expected)
```bash
curl -i -X POST http://localhost:4000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"fake.invalid.token"}'
```

### Signup con slug duplicato (409 expected)
```bash
curl -i -X POST http://localhost:4000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<ID_TOKEN>","workspaceName":"Dup","workspaceSlug":"existing-slug"}'
```

## Rate Limit Validation
1. Esegui >10 richieste/minuto verso `/auth/google` dallo stesso IP.
2. Expected: risposte di throttling secondo configurazione `@fastify/rate-limit`.
3. Verifica incremento `metrics.byStatusCode` su `/auth/google/health`.

## CORS / Credentials Validation
1. FE usa `credentials: "include"` su chiamata Google auth.
2. BE deve rispondere con:
   - `Access-Control-Allow-Origin: http://localhost:5173`
   - `Access-Control-Allow-Credentials: true`
3. In questo flusso il token è nel payload JSON; se in futuro si usano cookie:
   - dev: `secure=false`
   - prod: `secure=true`, `SameSite` coerente col dominio.

## Observability Notes
- Log BE safe: no `idToken`, no secret.
- Log error include `errorCode` interno:
  - `INVALID_TOKEN`, `SLUG_TAKEN`, `NO_WORKSPACE`, `EMAIL_CONFLICT`, `BAD_REQUEST`, `UNKNOWN`.
- Email nei log sempre mascherata.
