import type { FastifyReply, FastifyRequest } from 'fastify';
import { extractBearerToken } from '../../auth/jwt.js';
import { unauthorized } from '../../core/errors.js';
import { appendSetCookieHeader, parseCookies, serializeCookie } from '../security/stepup/cookie.js';
import { getVaultUnlockRuntimeConfig } from './unlock-config.js';
import {
  hashAccessTokenForVaultUnlock,
  issueVaultUnlockToken,
  validateVaultUnlockToken,
} from './unlock-token.js';

const readSingleHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getAccessTokenFromRequest = (request: FastifyRequest) => {
  const accessToken = extractBearerToken(readSingleHeaderValue(request.headers.authorization));
  if (!accessToken) {
    throw unauthorized('Authentication token is missing');
  }

  return accessToken;
};

const createUnlockCookie = (token: string, maxAgeSeconds: number) => {
  const config = getVaultUnlockRuntimeConfig();

  return serializeCookie({
    name: config.cookieName,
    value: token,
    path: config.cookiePath,
    maxAgeSeconds,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    httpOnly: true,
  });
};

const createClearUnlockCookie = () => {
  const config = getVaultUnlockRuntimeConfig();
  return createUnlockCookie('', 0);
};

const getUnlockTokenFromRequest = (request: FastifyRequest) => {
  const config = getVaultUnlockRuntimeConfig();
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[config.cookieName];

  if (typeof token === 'string' && token.trim().length > 0) {
    return token;
  }

  return null;
};

type VaultUnlockServiceDependencies = {
  nowMsFn: () => number;
};

const defaultDependencies: VaultUnlockServiceDependencies = {
  nowMsFn: () => Date.now(),
};

export const buildVaultUnlockService = (
  dependencies: VaultUnlockServiceDependencies = defaultDependencies,
) => {
  return {
    issueUnlockToken(input: {
      request: FastifyRequest;
      reply: FastifyReply;
      userId: string;
      workspaceId: string;
      ttlMinutes?: number;
    }) {
      const config = getVaultUnlockRuntimeConfig();
      const ttlSeconds = input.ttlMinutes
        ? Math.max(60, Math.floor(input.ttlMinutes * 60))
        : config.ttlSeconds;

      const accessToken = getAccessTokenFromRequest(input.request);
      const sessionHash = hashAccessTokenForVaultUnlock(accessToken);
      const { token } = issueVaultUnlockToken({
        userId: input.userId,
        workspaceId: input.workspaceId,
        ttlSeconds,
        sessionHash,
        nowMs: dependencies.nowMsFn(),
      });

      appendSetCookieHeader(input.reply, createUnlockCookie(token, ttlSeconds));
    },

    verifyUnlock(input: {
      request: FastifyRequest;
      userId: string;
      workspaceId: string;
    }) {
      const accessToken = getAccessTokenFromRequest(input.request);
      const sessionHash = hashAccessTokenForVaultUnlock(accessToken);

      const token = getUnlockTokenFromRequest(input.request);
      const validation = validateVaultUnlockToken({
        token,
        userId: input.userId,
        workspaceId: input.workspaceId,
        sessionHash,
        nowMs: dependencies.nowMsFn(),
      });

      return validation.valid;
    },

    clearUnlock(reply: FastifyReply) {
      appendSetCookieHeader(reply, createClearUnlockCookie());
    },
  };
};

export const vaultUnlockService = buildVaultUnlockService();
