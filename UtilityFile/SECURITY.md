# Security – Agency OS

## 1) Regole generali
- Tutti i dati sono isolati per workspace (`workspaceId`).
- Nessuna query senza filtro workspace.
- UI hiding NON è sicurezza: i controlli si fanno lato server.

## 2) Auth
- Gestita via NextAuth/Auth.js (boilerplate).
- Sessione con riferimento al workspace attivo.

## 3) RBAC (permessi)
- Tutte le API devono verificare:
  - utente autenticato
  - workspace valido
  - modulo attivo
  - permesso richiesto

## 4) Module enforcement
- Modulo disabilitato => 403 sempre (API).
- UI deve nascondere il modulo ma non basta.

## 5) Audit log (minimo)
Audit obbligatorio per:
- cambi permessi/ruoli
- attivazione/disattivazione moduli
- cambi branding
- (MVP 2) reveal di credenziali nel Vault
- completamento checklist item critici (opzionale ma utile)

AuditLog deve includere:
- workspaceId
- actorUserId
- action (stringa)
- targetType + targetId (se applicabile)
- timestamp
- metadata (JSON, senza segreti)

## 6) Vault (MVP 2) – policy non negoziabili
Se il Vault viene implementato:
- cifratura server-side (envelope o simmetrica con chiave da env)
- separare `view_list` da `reveal`
- loggare ogni reveal in audit
- MAI loggare il segreto
- permessi granulari per reveal/edit
- rotazione chiavi: non MVP, ma documentare limiti

Env richieste:
- `ENCRYPTION_KEY` (32+ bytes, base64 o hex)

## 7) Protezione dati sensibili
- Non salvare password in chiaro.
- Non includere segreti in errori, log, o payload.

## 8) Rate limit (futuro)
- per login, reveal vault, seo scan: rate limit in piani successivi.

## 9) Out of scope sicurezza (MVP)
- SSO enterprise, SCIM, advanced DLP: non MVP.
