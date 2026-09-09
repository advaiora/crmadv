import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../core/errors.js';

const STEP_UP_WINDOW_MS = 5 * 60 * 1000;
const STEP_UP_MAX_REQUESTS = 5;
const REVEAL_WINDOW_MS = 5 * 60 * 1000;
const REVEAL_MAX_REQUESTS = 30;

type RateLimitWindow = {
  startedAtMs: number;
  count: number;
};

const inMemoryVaultRateLimitStore = new Map<string, RateLimitWindow>();

/**
 * Il valore restituito quando dalla richiesta non si ricava un indirizzo IP
 * attendibile. Chi lo scrive a database deve tradurlo in `null` (lo fa
 * `toStoredIp` in `password-reset.route.ts`): usarlo come chiave vera
 * metterebbe tutte le richieste senza IP leggibile nello stesso secchio.
 */
export const UNKNOWN_CLIENT_IP = 'unknown';

/**
 * Il piu' lungo indirizzo che `net.isIP` accetta e' un IPv6 in forma completa
 * con coda IPv4 (`0000:0000:0000:0000:0000:ffff:255.255.255.255`): 45
 * caratteri. Il tetto e' quindi gia' implicito nella validazione, ma resta
 * scritto perche' e' il tetto che protegge la colonna `VarChar(64)` di
 * `PasswordResetToken.requestIp`, e chi un domani allentasse la validazione
 * deve inciampare qui prima che in PostgreSQL.
 */
const MAX_CLIENT_IP_LENGTH = 45;

const normalizeClientIp = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CLIENT_IP_LENGTH) {
    return null;
  }

  // `isIP` torna 0 (non un IP), 4 o 6. Tutto cio' che non e' un indirizzo
  // valido viene trattato come assente.
  return isIP(trimmed) === 0 ? null : trimmed;
};

/**
 * L'indirizzo del chiamante, per le chiavi dei limiti di frequenza e per la
 * colonna `PasswordResetToken.requestIp`.
 *
 * ⚠️ NON si leggono qui `X-Forwarded-For` ne' `X-Real-IP`, e non e' una
 * dimenticanza: sono intestazioni che scrive il client, e fino al 9/9/2026
 * questa funzione le prendeva per buone. Due conseguenze, entrambe rilevate dal
 * Guardiano su CRMA-25:
 *
 *  1. il valore finiva tale e quale in `PasswordResetToken.requestIp`, che e'
 *     `VarChar(64)`. PostgreSQL su un valore troppo lungo NON tronca: da'
 *     errore. E poiche' la `create` sta solo nel ramo «utente trovato», la
 *     stessa richiesta con un'intestazione di 100 caratteri rispondeva `500`
 *     per gli indirizzi registrati e `200` per gli altri — cioe' diceva a
 *     chiunque quali email hanno un account, scavalcando tutte le difese sui
 *     tempi di risposta della nota 1 di `password-reset.service.ts`;
 *  2. cambiando l'intestazione a ogni richiesta ci si creava un secchio nuovo
 *     ogni volta, e i limiti per IP non limitavano piu' niente.
 *
 * La fonte e' ora `request.ip`, che e' l'indirizzo vero della presa di rete —
 * non falsificabile — a meno che l'applicazione non sia dichiaratamente dietro
 * un proxy: in quel caso e' l'opzione `trustProxy` di Fastify (variabile
 * d'ambiente `TRUST_PROXY`, vedi `server/app.ts`) a far ricavare a Fastify
 * l'indirizzo dal `X-Forwarded-For` dei soli hop fidati. E' anche la stessa
 * fonte che usa gia' il `keyGenerator` predefinito di `@fastify/rate-limit`:
 * prima le due difese guardavano due indirizzi diversi.
 *
 * Il valore torna comunque validato: un proxy fidato che mandasse spazzatura
 * non deve poter arrivare al database.
 */
export const resolveRequestClientIp = (request: FastifyRequest): string =>
  normalizeClientIp(request.ip) ?? UNKNOWN_CLIENT_IP;

const enforceInMemoryRateLimit = (input: {
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
  nowMs?: number;
}) => {
  // TODO(vault-phase-6.5): move rate limiting to Redis/shared storage for multi-instance deployments.
  const nowMs = input.nowMs ?? Date.now();
  const activeWindow = inMemoryVaultRateLimitStore.get(input.key);

  if (!activeWindow || nowMs - activeWindow.startedAtMs >= input.windowMs) {
    inMemoryVaultRateLimitStore.set(input.key, {
      startedAtMs: nowMs,
      count: 1,
    });
    return;
  }

  if (activeWindow.count >= input.maxRequests) {
    throw new HttpError(429, 'RATE_LIMITED', input.message);
  }

  activeWindow.count += 1;
  inMemoryVaultRateLimitStore.set(input.key, activeWindow);
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

export const resetVaultRateLimitStoreForTests = () => {
  inMemoryVaultRateLimitStore.clear();
};

