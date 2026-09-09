import type { FastifyRequest } from 'fastify';
import { unauthorized } from '../core/errors.js';
import { requestContext } from '../core/request-context.js';
import { extractBearerToken, type AccessTokenClaims, verifyAccessToken } from '../auth/jwt.js';
import { userRepository } from '../repositories/user.repository.js';

export type AuthIdentity = {
  user: NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;
  tokenClaims: AccessTokenClaims;
};

/**
 * Il token e' stato emesso PRIMA dell'ultimo cambio password?
 *
 * E' l'unica revoca che questo CRM ha: il JWT e' senza stato e dura 7 giorni
 * (`server/auth/jwt.ts`), non c'e' tabella sessioni ne' denylist. Confrontare
 * l'`iat` del token con `User.passwordChangedAt` ottiene lo stesso risultato
 * senza aggiungere stato: chi cambia la password fa cadere tutti i token piu'
 * vecchi della password, ovunque fossero.
 *
 * ⚠️ Il confronto e' AL SECONDO, non al millisecondo, e non e' un'imprecisione:
 * l'`iat` del JWT e' in secondi interi (arrotondati per difetto), mentre
 * `passwordChangedAt` ha i millisecondi. Confrontandoli tali e quali, il token
 * nuovo di zecca consegnato a chi ha appena cambiato la password risulterebbe
 * piu' vecchio della password per una manciata di millisecondi, e chi cambia
 * password verrebbe sloggiato dalla propria stessa richiesta. Il prezzo e' una
 * finestra di un secondo: un'altra sessione che avesse emesso il proprio token
 * nello stesso secondo del cambio sopravvive. E' un secondo, e non c'e' modo di
 * fare meglio con `iat` in secondi.
 *
 * ⚠️ Un token SENZA `iat` con una password gia' cambiata viene rifiutato:
 * `signAccessToken` mette sempre `setIssuedAt()`, quindi in pratica non capita,
 * ma davanti a un token che non dice quando e' nato l'unica risposta prudente e'
 * non fidarsene.
 */
// Esportata per poterla provare da sola (`requireAuth.test.ts`): il resto della
// guardia pretende database e JWT veri, questo confronto no — ed e' la parte in
// cui si sbaglia, non il resto.
export const isTokenOlderThanPassword = (
  issuedAtSeconds: number | undefined,
  passwordChangedAt: Date | null,
) => {
  if (!passwordChangedAt) {
    return false;
  }

  if (typeof issuedAtSeconds !== 'number') {
    return true;
  }

  return issuedAtSeconds < Math.floor(passwordChangedAt.getTime() / 1000);
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
  const identity = await userRepository.findAuthIdentityById(tokenClaims.sub);

  if (!identity) {
    throw unauthorized('Authenticated user was not found');
  }

  // `passwordChangedAt` serve qui e si ferma qui: `user` torna con la stessa
  // forma di prima (`userSelect`), cosi' nessuna risposta che restituisce
  // l'utente autenticato si ritrova il campo in piu' senza averlo chiesto.
  const { passwordChangedAt, ...user } = identity;

  if (isTokenOlderThanPassword(tokenClaims.issuedAt, passwordChangedAt)) {
    throw unauthorized('La password di questo account è stata cambiata: accedi di nuovo.', {
      reason: 'PASSWORD_CHANGED',
    });
  }

  // Registra l'utente autenticato nel contesto di richiesta: così i livelli
  // profondi (es. log costi AI) sanno chi ha avviato l'azione senza propagazioni.
  requestContext.setUserId(user.id);

  return {
    user,
    tokenClaims,
  };
};

export const requireAuth = async (request: FastifyRequest) =>
  (await requireAuthIdentity(request)).user;
