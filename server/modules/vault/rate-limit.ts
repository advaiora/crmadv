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

