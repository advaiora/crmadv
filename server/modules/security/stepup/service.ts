import bcrypt from 'bcrypt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { extractBearerToken, verifyAccessToken } from '../../../auth/jwt.js';
import { HttpError, badRequest, unauthorized } from '../../../core/errors.js';
import { userRepository } from '../../../repositories/user.repository.js';
import { getStepUpRuntimeConfig } from './config.js';
import { appendSetCookieHeader, serializeCookie } from './cookie.js';
import { stepUpPurposeToScope, stepUpPurposes } from './scopes.js';
import { hashAccessTokenForStepUp, issueStepUpToken } from './token.js';

const PASSWORD_SALT_ROUNDS = 12;

const stepUpRequestBodySchema = z.object({
  purpose: z.enum(stepUpPurposes),
  password: z.string().trim().min(1).max(1024).optional(),
}).strict();

const setVaultPasswordRequestBodySchema = z.object({
  password: z.string().min(8).max(1024),
  currentPassword: z.string().min(1).max(1024).optional(),
}).strict();

const parseStepUpRequestBody = (body: unknown) => {
  const parsed = stepUpRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('Invalid step-up payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseSetVaultPasswordRequestBody = (body: unknown) => {
  const parsed = setVaultPasswordRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('Invalid vault password payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const readSingleHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getAccessTokenFromRequest = (request: FastifyRequest) => {
  const accessToken = extractBearerToken(readSingleHeaderValue(request.headers.authorization));
  if (!accessToken) {
    throw unauthorized('Authentication token is missing');
  }

  return accessToken;
};

const createStepUpCookie = (token: string) => {
  const config = getStepUpRuntimeConfig();
  return serializeCookie({
    name: config.cookieName,
    value: token,
    path: config.cookiePath,
    maxAgeSeconds: config.ttlSeconds,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    httpOnly: true,
  });
};

type StepUpServiceDependencies = {
  userRepositoryApi: typeof userRepository;
  comparePasswordFn: (password: string, hash: string) => Promise<boolean>;
  hashPasswordFn: (password: string, rounds: number) => Promise<string>;
  verifyAccessTokenFn: typeof verifyAccessToken;
  nowMsFn: () => number;
};

const defaultDependencies: StepUpServiceDependencies = {
  userRepositoryApi: userRepository,
  comparePasswordFn: bcrypt.compare,
  hashPasswordFn: bcrypt.hash,
  verifyAccessTokenFn: verifyAccessToken,
  nowMsFn: () => Date.now(),
};

export const buildStepUpService = (dependencies: StepUpServiceDependencies = defaultDependencies) => {
  const assertRecentLoginForOAuthAccount = async (
    accessToken: string,
    nowSeconds: number,
    maxAgeSeconds: number,
  ) => {
    const tokenClaims = await dependencies.verifyAccessTokenFn(accessToken);
    const issuedAt = tokenClaims.issuedAt;
    const isRecentLogin =
      typeof issuedAt === 'number' && (nowSeconds - issuedAt) <= maxAgeSeconds;

    if (!isRecentLogin) {
      throw new HttpError(
        403,
        'STEP_UP_RECENT_LOGIN_REQUIRED',
        'Recent login required for this account. Sign out and sign in again, then retry reveal.',
      );
    }
  };

  return {
    async issueStepUpGrant(input: {
      request: FastifyRequest;
      reply: FastifyReply;
      userId: string;
      workspaceId: string;
      body: unknown;
    }) {
      const parsed = parseStepUpRequestBody(input.body);

      const user = await dependencies.userRepositoryApi.findByIdForLogin(input.userId);
      if (!user) {
        throw unauthorized('Authenticated user was not found');
      }

      const accessToken = getAccessTokenFromRequest(input.request);

      if (user.vaultPasswordHash) {
        if (!parsed.password) {
          throw badRequest('Vault password is required for this step-up purpose');
        }

        const isValidVaultPassword = await dependencies.comparePasswordFn(parsed.password, user.vaultPasswordHash);
        if (!isValidVaultPassword) {
          throw unauthorized('Credenziali non valide');
        }
      } else {
        if (!user.passwordHash) {
          throw new HttpError(
            403,
            'STEP_UP_VAULT_PASSWORD_NOT_SET',
            'Vault password is not configured. Set it first to unlock reveal.',
          );
        }

        if (!parsed.password) {
          throw badRequest('Password is required for this step-up purpose');
        }

        const isValidPassword = await dependencies.comparePasswordFn(parsed.password, user.passwordHash);
        if (!isValidPassword) {
          throw unauthorized('Credenziali non valide');
        }
      }

      const scope = stepUpPurposeToScope[parsed.purpose];
      const { token } = issueStepUpToken({
        userId: input.userId,
        workspaceId: input.workspaceId,
        scope,
        sessionHash: hashAccessTokenForStepUp(accessToken),
      });

      appendSetCookieHeader(input.reply, createStepUpCookie(token));
    },

    async setVaultPassword(input: {
      request: FastifyRequest;
      userId: string;
      workspaceId: string;
      body: unknown;
    }) {
      const parsed = parseSetVaultPasswordRequestBody(input.body);
      const user = await dependencies.userRepositoryApi.findByIdForLogin(input.userId);
      if (!user) {
        throw unauthorized('Authenticated user was not found');
      }

      const accessToken = getAccessTokenFromRequest(input.request);
      const nowSeconds = Math.floor(dependencies.nowMsFn() / 1000);
      const config = getStepUpRuntimeConfig();

      if (user.vaultPasswordHash) {
        if (!parsed.currentPassword) {
          throw badRequest('Current vault password is required');
        }

        const isValidCurrentVaultPassword =
          await dependencies.comparePasswordFn(parsed.currentPassword, user.vaultPasswordHash);
        if (!isValidCurrentVaultPassword) {
          throw unauthorized('Credenziali non valide');
        }
      } else if (user.passwordHash) {
        if (!parsed.currentPassword) {
          throw badRequest('Current account password is required');
        }

        const isValidCurrentAccountPassword =
          await dependencies.comparePasswordFn(parsed.currentPassword, user.passwordHash);
        if (!isValidCurrentAccountPassword) {
          throw unauthorized('Credenziali non valide');
        }
      } else {
        await assertRecentLoginForOAuthAccount(
          accessToken,
          nowSeconds,
          config.oauthRecentLoginMaxAgeSeconds,
        );
      }

      const vaultPasswordHash = await dependencies.hashPasswordFn(parsed.password, PASSWORD_SALT_ROUNDS);
      await dependencies.userRepositoryApi.updateVaultPasswordHash(user.id, vaultPasswordHash);
    },
  };
};

export const stepUpService = buildStepUpService();
