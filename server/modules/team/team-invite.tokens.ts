import { createHmac, randomBytes } from 'node:crypto';
import { internalServerError } from '../../core/errors.js';

const TOKEN_BYTES = 32;

const resolveInviteTokenSecret = () => {
  const explicitSecret = process.env.TEAM_INVITE_TOKEN_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const fallbackSecret = process.env.AUTH_JWT_SECRET?.trim();
  if (fallbackSecret) {
    return fallbackSecret;
  }

  throw internalServerError('Invite token secret is not configured');
};

export const generateInviteToken = () => randomBytes(TOKEN_BYTES).toString('hex');

export const hashInviteToken = (token: string) =>
  createHmac('sha256', resolveInviteTokenSecret()).update(token).digest('hex');
