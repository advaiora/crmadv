import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../core/errors.js';
import { resolveRequestClientIp } from '../vault/rate-limit.js';

const INVITE_CREATE_WINDOW_MS = 60 * 1000;
const INVITE_CREATE_MAX_REQUESTS = 12;
const INVITE_ACCEPT_IP_WINDOW_MS = 5 * 60 * 1000;
const INVITE_ACCEPT_IP_MAX_REQUESTS = 20;
const INVITE_ACCEPT_TOKEN_WINDOW_MS = 15 * 60 * 1000;
const INVITE_ACCEPT_TOKEN_MAX_REQUESTS = 8;

type RateLimitWindow = {
  startedAtMs: number;
  count: number;
};

const inMemoryTeamRateLimitStore = new Map<string, RateLimitWindow>();

const hashKey = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 24);

const enforceInMemoryRateLimit = (input: {
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
  nowMs?: number;
}) => {
  const nowMs = input.nowMs ?? Date.now();
  const activeWindow = inMemoryTeamRateLimitStore.get(input.key);

  if (!activeWindow || nowMs - activeWindow.startedAtMs >= input.windowMs) {
    inMemoryTeamRateLimitStore.set(input.key, {
      startedAtMs: nowMs,
      count: 1,
    });
    return;
  }

  if (activeWindow.count >= input.maxRequests) {
    throw new HttpError(429, 'RATE_LIMITED', input.message);
  }

  activeWindow.count += 1;
  inMemoryTeamRateLimitStore.set(input.key, activeWindow);
};

export const resolveTeamRequestClientIp = (request: FastifyRequest) =>
  resolveRequestClientIp(request);

export const enforceTeamInviteCreateRateLimit = (input: {
  workspaceId: string;
  actorUserId: string;
  clientIp: string;
  nowMs?: number;
}) => {
  enforceInMemoryRateLimit({
    key: `team:invite:create:${input.workspaceId}:${input.actorUserId}:${hashKey(input.clientIp)}`,
    maxRequests: INVITE_CREATE_MAX_REQUESTS,
    windowMs: INVITE_CREATE_WINDOW_MS,
    message: 'Too many invite creation requests. Retry in a minute.',
    nowMs: input.nowMs,
  });
};

export const enforceTeamInviteAcceptRateLimit = (input: {
  clientIp: string;
  tokenHash: string;
  nowMs?: number;
}) => {
  enforceInMemoryRateLimit({
    key: `team:invite:accept:ip:${hashKey(input.clientIp)}`,
    maxRequests: INVITE_ACCEPT_IP_MAX_REQUESTS,
    windowMs: INVITE_ACCEPT_IP_WINDOW_MS,
    message: 'Too many invite accept attempts. Retry in a few minutes.',
    nowMs: input.nowMs,
  });

  enforceInMemoryRateLimit({
    key: `team:invite:accept:token:${hashKey(input.tokenHash)}`,
    maxRequests: INVITE_ACCEPT_TOKEN_MAX_REQUESTS,
    windowMs: INVITE_ACCEPT_TOKEN_WINDOW_MS,
    message: 'Too many attempts for this invite token. Retry later.',
    nowMs: input.nowMs,
  });
};

export const resetTeamRateLimitStoreForTests = () => {
  inMemoryTeamRateLimitStore.clear();
};
