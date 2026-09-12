import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../core/errors.js';

const STEP_UP_WINDOW_MS = 5 * 60 * 1000;
const STEP_UP_MAX_REQUESTS = 5;
const REVEAL_WINDOW_MS = 5 * 60 * 1000;
const REVEAL_MAX_REQUESTS = 30;
const UNLOCK_WINDOW_MS = 5 * 60 * 1000;
const UNLOCK_MAX_FAILED_ATTEMPTS = 5;

type RateLimitWindow = {
  startedAtMs: number;
  count: number;
};

// TODO(vault-phase-6.5): move rate limiting to Redis/shared storage for multi-instance deployments.
// ⚠️ Questo contenitore vive nella memoria DEL SINGOLO PROCESSO: con più istanze dell'API
// ogni processo tiene il proprio conteggio, quindi il tetto effettivo va moltiplicato per il
// numero di processi. È una limitazione nota e accettata (meglio di nessun limite), annotata
// anche in `server/modules/vault/THREAT_MODEL.md`.
const inMemoryVaultRateLimitStore = new Map<string, RateLimitWindow>();

const readSingleHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getForwardedClientIp = (request: FastifyRequest) => {
  const forwardedFor = readSingleHeaderValue(request.headers['x-forwarded-for']);
  if (forwardedFor && forwardedFor.trim().length > 0) {
    const [firstHop] = forwardedFor.split(',');
    const normalized = firstHop?.trim();
    if (normalized) {
      return normalized;
    }
  }

  const realIp = readSingleHeaderValue(request.headers['x-real-ip']);
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  return null;
};

export const resolveRequestClientIp = (request: FastifyRequest): string => {
  const proxiedIp = getForwardedClientIp(request);
  if (proxiedIp) {
    return proxiedIp;
  }

  if (typeof request.ip === 'string' && request.ip.trim().length > 0) {
    return request.ip.trim();
  }

  return 'unknown';
};

// Controlla la finestra senza toccare il conteggio: serve a chi conta solo i tentativi
// FALLITI, dove il controllo precede l'operazione e l'incremento la segue.
const assertInMemoryRateLimitNotExceeded = (input: {
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
  nowMs: number;
}) => {
  const activeWindow = inMemoryVaultRateLimitStore.get(input.key);

  if (!activeWindow || input.nowMs - activeWindow.startedAtMs >= input.windowMs) {
    return;
  }

  if (activeWindow.count >= input.maxRequests) {
    throw new HttpError(429, 'RATE_LIMITED', input.message);
  }
};

// Segna un colpo nella finestra, aprendone una nuova se quella in corso è scaduta.
const countInMemoryRateLimitHit = (input: {
  key: string;
  windowMs: number;
  nowMs: number;
}) => {
  const activeWindow = inMemoryVaultRateLimitStore.get(input.key);

  if (!activeWindow || input.nowMs - activeWindow.startedAtMs >= input.windowMs) {
    inMemoryVaultRateLimitStore.set(input.key, {
      startedAtMs: input.nowMs,
      count: 1,
    });
    return;
  }

  activeWindow.count += 1;
  inMemoryVaultRateLimitStore.set(input.key, activeWindow);
};

const enforceInMemoryRateLimit = (input: {
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
  nowMs?: number;
}) => {
  const nowMs = input.nowMs ?? Date.now();

  assertInMemoryRateLimitNotExceeded({
    key: input.key,
    maxRequests: input.maxRequests,
    windowMs: input.windowMs,
    message: input.message,
    nowMs,
  });

  countInMemoryRateLimitHit({
    key: input.key,
    windowMs: input.windowMs,
    nowMs,
  });
};

export const enforceVaultStepUpRateLimit = (input: {
  userId: string;
  workspaceId: string;
  clientIp: string;
  nowMs?: number;
}) => {
  enforceInMemoryRateLimit({
    key: `vault:stepup:${input.workspaceId}:${input.userId}:${input.clientIp}`,
    maxRequests: STEP_UP_MAX_REQUESTS,
    windowMs: STEP_UP_WINDOW_MS,
    message: 'Too many Vault step-up requests. Retry in a few minutes.',
    nowMs: input.nowMs,
  });
};

export const enforceVaultRevealRateLimit = (input: {
  userId: string;
  workspaceId: string;
  nowMs?: number;
}) => {
  enforceInMemoryRateLimit({
    key: `vault:reveal:${input.workspaceId}:${input.userId}`,
    maxRequests: REVEAL_MAX_REQUESTS,
    windowMs: REVEAL_WINDOW_MS,
    message: 'Too many Vault reveal requests. Retry in a few minutes.',
    nowMs: input.nowMs,
  });
};

// Lo sblocco del Vault verifica la password maestra: è il cancello che protegge tutte le
// credenziali dei clienti, quindi il limitatore qui conta i tentativi FALLITI, non le
// richieste. Due conseguenze volute:
//   · chi digita la password giusta non consuma budget e non si blocca mai da sé;
//   · un successo NON azzera il conteggio, quindi non si può intercalare uno sblocco
//     riuscito fra due raffiche per rimettere a zero il contatore.
// La chiave NON include l'indirizzo IP, a differenza dello step-up: `resolveRequestClientIp`
// legge `x-forwarded-for`, che senza un proxy fidato davanti è scrivibile da chi chiama —
// e un IP nella chiave darebbe a ogni valore inventato un secchiello nuovo. Senza l'IP il
// secchiello è uno per utente e workspace, cioè strettamente più stretto. Non apre un modo
// per bloccare altri: l'attore è già autenticato, quindi il secchiello è il suo.
const buildVaultUnlockRateLimitKey = (input: { workspaceId: string; userId: string }) =>
  `vault:unlock:${input.workspaceId}:${input.userId}`;

export const enforceVaultUnlockRateLimit = (input: {
  userId: string;
  workspaceId: string;
  nowMs?: number;
}) => {
  assertInMemoryRateLimitNotExceeded({
    key: buildVaultUnlockRateLimitKey(input),
    maxRequests: UNLOCK_MAX_FAILED_ATTEMPTS,
    windowMs: UNLOCK_WINDOW_MS,
    message: 'Troppi tentativi di sblocco del Vault. Riprova fra qualche minuto.',
    nowMs: input.nowMs ?? Date.now(),
  });
};

export const registerVaultUnlockFailure = (input: {
  userId: string;
  workspaceId: string;
  nowMs?: number;
}) => {
  countInMemoryRateLimitHit({
    key: buildVaultUnlockRateLimitKey(input),
    windowMs: UNLOCK_WINDOW_MS,
    nowMs: input.nowMs ?? Date.now(),
  });
};

export const resetVaultRateLimitStoreForTests = () => {
  inMemoryVaultRateLimitStore.clear();
};

