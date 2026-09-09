// Aiutanti dell'accesso con Google: classificazione degli errori, contatori di
// diagnostica e registrazioni nel log tecnico.
//
// ⚠️ GOOGLE_AUTH_METRICS e' stato mutabile di modulo: deve restare UNA sola
// istanza, esportata da qui. Ricrearlo altrove (o reimportarlo per copia)
// azzererebbe i contatori letti da GET /auth/google/health.

import type { FastifyRequest } from 'fastify';
import { HttpError, isHttpError } from '../../core/errors.js';
import type { GoogleAuthMode } from '../../services/google-auth.service.js';
import type { ParsedGoogleAuthPayload } from './auth.schemas.js';

export type GoogleAuthInternalCode =
  | 'INVALID_TOKEN'
  | 'SLUG_TAKEN'
  | 'NO_WORKSPACE'
  | 'EMAIL_CONFLICT'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

export const resolveGoogleAuthMode = (payload: ParsedGoogleAuthPayload): GoogleAuthMode => {
  if (payload.mode === 'login' || payload.mode === 'signup') {
    return payload.mode;
  }

  const hasWorkspaceName = Boolean(payload.workspaceName);
  const hasWorkspaceSlug = Boolean(payload.workspaceSlug);

  if (hasWorkspaceName && hasWorkspaceSlug) {
    return 'signup';
  }

  if (!hasWorkspaceName && !hasWorkspaceSlug) {
    return 'login';
  }

  return 'login';
};

export const inferGoogleAuthModeFromRawBody = (body: unknown): GoogleAuthMode => {
  if (typeof body !== 'object' || body === null) {
    return 'login';
  }

  const candidate = (body as { workspaceSlug?: unknown }).workspaceSlug;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? 'signup' : 'login';
};

export const GOOGLE_AUTH_METRICS = {
  total: 0,
  success: 0,
  error: 0,
  byStatusCode: {} as Record<string, number>,
  byErrorCode: {
    INVALID_TOKEN: 0,
    SLUG_TAKEN: 0,
    NO_WORKSPACE: 0,
    EMAIL_CONFLICT: 0,
    BAD_REQUEST: 0,
    UNKNOWN: 0,
  } as Record<GoogleAuthInternalCode, number>,
  lastLatencyMs: 0,
  lastStatusCode: 0,
  lastMode: 'login' as GoogleAuthMode,
  updatedAt: null as string | null,
};

export const updateGoogleAuthMetrics = ({
  statusCode,
  mode,
  errorCode,
  latencyMs,
}: {
  statusCode: number;
  mode: GoogleAuthMode;
  errorCode?: GoogleAuthInternalCode;
  latencyMs: number;
}) => {
  GOOGLE_AUTH_METRICS.total += 1;
  if (statusCode >= 400) {
    GOOGLE_AUTH_METRICS.error += 1;
  } else {
    GOOGLE_AUTH_METRICS.success += 1;
  }

  const statusKey = String(statusCode);
  GOOGLE_AUTH_METRICS.byStatusCode[statusKey] = (GOOGLE_AUTH_METRICS.byStatusCode[statusKey] ?? 0) + 1;

  if (errorCode) {
    GOOGLE_AUTH_METRICS.byErrorCode[errorCode] = (GOOGLE_AUTH_METRICS.byErrorCode[errorCode] ?? 0) + 1;
  }

  GOOGLE_AUTH_METRICS.lastLatencyMs = latencyMs;
  GOOGLE_AUTH_METRICS.lastStatusCode = statusCode;
  GOOGLE_AUTH_METRICS.lastMode = mode;
  GOOGLE_AUTH_METRICS.updatedAt = new Date().toISOString();
};

export const resolveGoogleInternalErrorCode = (error: unknown): GoogleAuthInternalCode => {
  if (!isHttpError(error)) {
    return 'UNKNOWN';
  }

  if (typeof error.details === 'object' && error.details !== null) {
    const explicitCode = (error.details as Record<string, unknown>).googleErrorCode;
    if (
      explicitCode === 'INVALID_TOKEN' ||
      explicitCode === 'SLUG_TAKEN' ||
      explicitCode === 'NO_WORKSPACE' ||
      explicitCode === 'EMAIL_CONFLICT' ||
      explicitCode === 'BAD_REQUEST'
    ) {
      return explicitCode;
    }
  }

  if (error.statusCode === 401) {
    return 'INVALID_TOKEN';
  }

  if (error.statusCode === 400) {
    return 'BAD_REQUEST';
  }

  if (error.statusCode !== 409) {
    return 'UNKNOWN';
  }

  const message = String(error.message ?? '').toLowerCase();
  if (message.includes('slug')) {
    return 'SLUG_TAKEN';
  }
  if (message.includes('workspace') || message.includes('completa') || message.includes('signup')) {
    return 'NO_WORKSPACE';
  }
  if (message.includes('email') || message.includes('account google')) {
    return 'EMAIL_CONFLICT';
  }

  return 'UNKNOWN';
};

export const withGoogleErrorCode = (error: unknown, errorCode: GoogleAuthInternalCode) => {
  if (!isHttpError(error) || errorCode === 'UNKNOWN') {
    return error;
  }

  return new HttpError(error.statusCode, errorCode, error.message, error.details);
};

export const logGoogleAuthEvent = ({
  request,
  mode,
  result,
  statusCode,
  maskedEmail,
  latencyMs,
  errorCode,
}: {
  request: Pick<FastifyRequest, 'id' | 'log'>;
  mode: GoogleAuthMode;
  result: 'ok' | 'error';
  statusCode: number;
  maskedEmail: string;
  latencyMs: number;
  errorCode?: GoogleAuthInternalCode;
}) => {
  const payload = {
    reqId: request.id,
    provider: 'google',
    mode,
    result,
    statusCode,
    email: maskedEmail,
    latencyMs,
    ...(errorCode ? { errorCode } : {}),
  };

  if (result === 'ok') {
    request.log.info(payload, 'Google auth request');
  } else {
    request.log.warn(payload, 'Google auth request');
  }
};

export const logGoogleAuthConfigDiagnostics = ({
  request,
  mode,
  googleClientId,
}: {
  request: Pick<FastifyRequest, 'id' | 'headers' | 'log'>;
  mode: GoogleAuthMode;
  googleClientId: string;
}) => {
  const requestOrigin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin;

  request.log.info(
    {
      reqId: request.id,
      provider: 'google',
      mode,
      requestOrigin: requestOrigin ?? '(missing-origin-header)',
      googleClientIdLength: googleClientId.length,
      oauthHints: [
        'Verify Authorized JavaScript origins include requestOrigin',
        'Verify backend GOOGLE_CLIENT_ID matches frontend VITE_GOOGLE_CLIENT_ID',
      ],
    },
    'Google auth configuration diagnostics',
  );
};
