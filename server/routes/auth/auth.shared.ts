// Costanti e piccoli aiutanti condivisi dai file dell'area autenticazione.
// Stanno qui, e non nel file di una singola rotta, perche' sono usati da piu' di
// uno dei file nati dalla spezzatura di auth.route.ts: tenerli in uno dei
// chiamanti creerebbe import circolari fra il residuo e i pezzi estratti.

import { Prisma } from '@prisma/client';
import { internalServerError } from '../../core/errors.js';

export const REGISTRATION_GENERIC_ERROR_MESSAGE = 'Errore durante la registrazione';

export const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
} as const;

export const userWithCreatedAtSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

export const AUTH_RATE_LIMIT_CONFIG = {
  login: {
    max: 8,
    timeWindow: '1 minute',
  },
  register: {
    max: 6,
    timeWindow: '1 minute',
  },
  google: {
    max: 30,
    timeWindow: '1 minute',
  },
} as const;

export const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export const getUniqueTargetFields = (error: Prisma.PrismaClientKnownRequestError): string[] => {
  const target = (error.meta as Record<string, unknown> | undefined)?.target;
  return Array.isArray(target) ? target.filter((value): value is string => typeof value === 'string') : [];
};

export const readSingleHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const hasConfiguredGoogleClientId = () => Boolean(process.env.GOOGLE_CLIENT_ID?.trim());

export const getConfiguredGoogleClientId = () => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!googleClientId) {
    throw internalServerError('Google sign-in is not configured');
  }

  return googleClientId;
};

// Oscura l'indirizzo prima di scriverlo nei log: serve sia alla registrazione sia
// all'accesso con Google, per questo non vive nel file di nessuna delle due.
export const maskEmailForLog = (email: string | null | undefined) => {
  if (!email) {
    return '(unknown)';
  }

  const [localPartRaw, domainPartRaw] = email.split('@');
  if (!localPartRaw || !domainPartRaw) {
    return '(invalid-email)';
  }

  const localPart = localPartRaw.trim();
  const domainPart = domainPartRaw.trim();
  if (!localPart || !domainPart) {
    return '(invalid-email)';
  }

  const [domainNameRaw, ...domainSuffixParts] = domainPart.split('.');
  if (!domainNameRaw) {
    return '(invalid-email)';
  }

  const domainName = domainNameRaw.trim();
  const suffix = domainSuffixParts.join('.');

  const maskedLocal = localPart.length <= 2 ? `${localPart[0]}*` : `${localPart.slice(0, 1)}***${localPart.slice(-1)}`;
  const maskedDomain = `${domainName.slice(0, 1)}***`;

  return `${maskedLocal}@${maskedDomain}${suffix ? `.${suffix}` : ''}`;
};
