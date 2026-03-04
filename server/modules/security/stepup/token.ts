import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { StepUpScope } from './scopes.js';
import { getStepUpRuntimeConfig } from './config.js';

export type StepUpTokenPayload = {
  userId: string;
  workspaceId: string;
  scope: StepUpScope;
  iat: number;
  exp: number;
  sessionHash?: string;
};

export type StepUpTokenValidationReason =
  | 'missing'
  | 'malformed'
  | 'invalid_signature'
  | 'expired'
  | 'subject_mismatch'
  | 'workspace_mismatch'
  | 'scope_mismatch'
  | 'session_mismatch';

export type StepUpTokenValidationResult =
  | {
      valid: true;
      payload: StepUpTokenPayload;
    }
  | {
      valid: false;
      reason: StepUpTokenValidationReason;
    };

type IssueStepUpTokenInput = {
  userId: string;
  workspaceId: string;
  scope: StepUpScope;
  sessionHash?: string;
  nowMs?: number;
};

type ValidateStepUpTokenInput = {
  token: string | null | undefined;
  userId: string;
  workspaceId: string;
  scope: StepUpScope;
  sessionHash?: string;
  nowMs?: number;
};

const isValidEpochSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const asPayload = (value: unknown): StepUpTokenPayload | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const parsed = value as Record<string, unknown>;
  if (
    typeof parsed.userId !== 'string'
    || typeof parsed.workspaceId !== 'string'
    || typeof parsed.scope !== 'string'
    || !isValidEpochSeconds(parsed.iat)
    || !isValidEpochSeconds(parsed.exp)
  ) {
    return null;
  }

  if (parsed.iat >= parsed.exp) {
    return null;
  }

  if (parsed.sessionHash !== undefined && typeof parsed.sessionHash !== 'string') {
    return null;
  }

  return {
    userId: parsed.userId,
    workspaceId: parsed.workspaceId,
    scope: parsed.scope as StepUpScope,
    iat: parsed.iat,
    exp: parsed.exp,
    sessionHash: parsed.sessionHash,
  };
};

const signPayload = (payloadBase64Url: string) => {
  const { tokenSecret } = getStepUpRuntimeConfig();
  return createHmac('sha256', tokenSecret)
    .update(payloadBase64Url, 'utf8')
    .digest('base64url');
};

const secureEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const hashAccessTokenForStepUp = (accessToken: string) =>
  createHash('sha256').update(accessToken, 'utf8').digest('base64url');

export const issueStepUpToken = (input: IssueStepUpTokenInput) => {
  const { ttlSeconds } = getStepUpRuntimeConfig();
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const payload: StepUpTokenPayload = {
    userId: input.userId,
    workspaceId: input.workspaceId,
    scope: input.scope,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    ...(input.sessionHash ? { sessionHash: input.sessionHash } : {}),
  };

  const payloadBase64Url = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayload(payloadBase64Url);

  return {
    token: `${payloadBase64Url}.${signature}`,
    payload,
  };
};

export const validateStepUpToken = (input: ValidateStepUpTokenInput): StepUpTokenValidationResult => {
  if (!input.token || input.token.trim().length === 0) {
    return {
      valid: false,
      reason: 'missing',
    };
  }

  const [payloadBase64Url, signature, ...rest] = input.token.split('.');
  if (!payloadBase64Url || !signature || rest.length > 0) {
    return {
      valid: false,
      reason: 'malformed',
    };
  }

  const expectedSignature = signPayload(payloadBase64Url);
  if (!secureEqual(signature, expectedSignature)) {
    return {
      valid: false,
      reason: 'invalid_signature',
    };
  }

  let parsedRawPayload: unknown;
  try {
    parsedRawPayload = JSON.parse(Buffer.from(payloadBase64Url, 'base64url').toString('utf8'));
  } catch {
    return {
      valid: false,
      reason: 'malformed',
    };
  }

  const payload = asPayload(parsedRawPayload);
  if (!payload) {
    return {
      valid: false,
      reason: 'malformed',
    };
  }

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (payload.exp <= nowSeconds) {
    return {
      valid: false,
      reason: 'expired',
    };
  }

  if (payload.userId !== input.userId) {
    return {
      valid: false,
      reason: 'subject_mismatch',
    };
  }

  if (payload.workspaceId !== input.workspaceId) {
    return {
      valid: false,
      reason: 'workspace_mismatch',
    };
  }

  if (payload.scope !== input.scope) {
    return {
      valid: false,
      reason: 'scope_mismatch',
    };
  }

  if (input.sessionHash && payload.sessionHash !== input.sessionHash) {
    return {
      valid: false,
      reason: 'session_mismatch',
    };
  }

  return {
    valid: true,
    payload,
  };
};
