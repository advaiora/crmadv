import { SignJWT, jwtVerify } from 'jose';
import { unauthorized } from '../core/errors.js';

const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'crm-advaiora-api';
const JWT_AUDIENCE = 'crm-advaiora-web';
const DEFAULT_EXPIRATION_SECONDS = 60 * 60 * 24 * 7;

const textEncoder = new TextEncoder();

export type AccessTokenClaims = {
  sub: string;
  email: string;
  role: string;
  workspaceId?: string;
  workspaceSlug?: string;
  type: 'access';
};

type JwtRuntimeConfig = {
  secret: string;
  expiresInSeconds: number;
};

const getJwtRuntimeConfig = (): JwtRuntimeConfig => {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('Missing AUTH_JWT_SECRET');
  }

  const rawExpiresIn = process.env.AUTH_JWT_EXPIRES_IN_SECONDS?.trim();
  if (!rawExpiresIn) {
    return { secret, expiresInSeconds: DEFAULT_EXPIRATION_SECONDS };
  }

  const expiresInSeconds = Number(rawExpiresIn);
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60) {
    throw new Error('Invalid AUTH_JWT_EXPIRES_IN_SECONDS');
  }

  return { secret, expiresInSeconds };
};

export const signAccessToken = async (
  claims: Omit<AccessTokenClaims, 'type'>,
) => {
  const config = getJwtRuntimeConfig();
  const secret = textEncoder.encode(config.secret);

  return new SignJWT({
    ...claims,
    type: 'access' as const,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${config.expiresInSeconds}s`)
    .sign(secret);
};

export const verifyAccessToken = async (token: string): Promise<AccessTokenClaims> => {
  try {
    const config = getJwtRuntimeConfig();
    const secret = textEncoder.encode(config.secret);

    const verified = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const payload = verified.payload;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      throw unauthorized('Sessione non valida');
    }

    if (payload.type !== 'access') {
      throw unauthorized('Sessione non valida');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      workspaceId: typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined,
      workspaceSlug: typeof payload.workspaceSlug === 'string' ? payload.workspaceSlug : undefined,
      type: 'access',
    };
  } catch {
    throw unauthorized('Sessione non valida');
  }
};

export const extractBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/u);
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
};
