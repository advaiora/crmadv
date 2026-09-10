import type { FastifyRequest } from 'fastify';
import { unauthorized } from '../core/errors.js';
import { requestContext } from '../core/request-context.js';
import { extractBearerToken, type AccessTokenClaims, verifyAccessToken } from '../auth/jwt.js';
import { userRepository } from '../repositories/user.repository.js';

export type AuthIdentity = {
  user: NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;
  tokenClaims: AccessTokenClaims;
};

export const requireAuthIdentity = async (request: FastifyRequest): Promise<AuthIdentity> => {
  const accessToken = extractBearerToken(
    Array.isArray(request.headers.authorization) ? request.headers.authorization[0] : request.headers.authorization,
  );

  if (!accessToken) {
    throw unauthorized('Authentication token is missing', {
      expected: 'Authorization: Bearer <token>',
    });
  }

  const tokenClaims = await verifyAccessToken(accessToken);
  const user = await userRepository.findById(tokenClaims.sub);

  if (!user) {
    throw unauthorized('Authenticated user was not found');
  }

  // Registra l'utente autenticato nel contesto di richiesta: così i livelli
  // profondi (es. log costi AI) sanno chi ha avviato l'azione senza propagazioni.
  requestContext.setUserId(user.id);
  // Il workspace serve all'intercettore del Registro attività per attribuire una
  // scrittura quando la riga toccata non porta con sé la propria colonna
  // workspaceId (accade su update e delete, dove si conosce solo l'id).
  requestContext.setWorkspaceId(tokenClaims.workspaceId ?? null);

  return {
    user,
    tokenClaims,
  };
};

export const requireAuth = async (request: FastifyRequest) =>
  (await requireAuthIdentity(request)).user;
