import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../../core/errors.js';
import { extractBearerToken } from '../../../auth/jwt.js';
import { getStepUpRuntimeConfig } from './config.js';
import { parseCookies } from './cookie.js';
import type { StepUpScope } from './scopes.js';
import { hashAccessTokenForStepUp, validateStepUpToken } from './token.js';

type RequireStepUpInput = {
  userId: string;
  workspaceId: string;
  scope: StepUpScope;
};

const getStepUpTokenFromRequest = (request: FastifyRequest) => {
  const { cookieName } = getStepUpRuntimeConfig();
  const cookies = parseCookies(request.headers.cookie);
  const cookieToken = cookies[cookieName];
  if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    return cookieToken;
  }

  return null;
};

export const requireStepUp = async (request: FastifyRequest, input: RequireStepUpInput) => {
  const token = getStepUpTokenFromRequest(request);
  if (!token) {
    throw new HttpError(403, 'STEP_UP_REQUIRED', 'Step-up authentication is required for this action');
  }

  const authorizationHeader = Array.isArray(request.headers.authorization)
    ? request.headers.authorization[0]
    : request.headers.authorization;
  const accessToken = extractBearerToken(authorizationHeader);
  if (!accessToken) {
    throw new HttpError(403, 'STEP_UP_INVALID', 'Step-up authentication is invalid or expired');
  }

  const sessionHash = hashAccessTokenForStepUp(accessToken);
  const validation = validateStepUpToken({
    token,
    userId: input.userId,
    workspaceId: input.workspaceId,
    scope: input.scope,
    sessionHash,
  });

  if (!validation.valid) {
    if (validation.reason === 'missing') {
      throw new HttpError(403, 'STEP_UP_REQUIRED', 'Step-up authentication is required for this action');
    }

    throw new HttpError(403, 'STEP_UP_INVALID', 'Step-up authentication is invalid or expired');
  }

  return validation.payload;
};
