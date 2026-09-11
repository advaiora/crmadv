// Rotte di autenticazione: diagnostica, accesso, registrazione, uscita.
// Le rotte di Google e del profilo vivono in server/routes/auth/ e sono
// registrate qui sotto come plugin: il default export di questo file resta
// l'unico punto che server/app.ts conosce.

import bcrypt from 'bcrypt';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { HttpError, badRequest, conflict, forbidden, isHttpError, internalServerError, unauthorized } from '../core/errors.js';
import { ok } from '../core/response.js';
import { audit } from '../audit/audit.js';
import { extractBearerToken, verifyAccessToken } from '../auth/jwt.js';
import { initializeWorkspaceAuthDefaults } from '../auth/workspace-bootstrap.js';
import { requestContext } from '../core/request-context.js';
import { prisma } from '../prisma.js';
import { userRepository } from '../repositories/user.repository.js';
import { PASSWORD_SALT_ROUNDS } from '../auth/password-policy.js';
import googleAuthRoute from './auth/auth.google.route.js';
import meRoute from './auth/auth.me.route.js';
import { GOOGLE_AUTH_METRICS } from './auth/auth.google.js';
import { loginSchema, registerSchema } from './auth/auth.schemas.js';
import {
  createSessionPayload,
  listMemberships,
  pickActiveMembership,
  resolveWorkspaceForRegistration,
} from './auth/auth.session.js';
import {
  AUTH_RATE_LIMIT_CONFIG,
  getUniqueTargetFields,
  hasConfiguredGoogleClientId,
  isUniqueConstraintError,
  maskEmailForLog,
  readSingleHeaderValue,
  REGISTRATION_GENERIC_ERROR_MESSAGE,
  userWithCreatedAtSelect,
} from './auth/auth.shared.js';
import { ensureWorkspaceAccessDefaults } from './auth/auth.workspace-defaults.js';

type FailedLoginReason =
  | 'unknown_email'
  | 'wrong_password'
  | 'no_active_membership'
  | 'workspace_suspended';

/**
 * Registra un tentativo di accesso fallito.
 *
 * In un registro attività gli accessi falliti valgono quanto quelli riusciti: è
 * l'unico modo per accorgersi che qualcuno sta provando le password di un
 * account vero.
 *
 * ⚠️ Due limiti dichiarati, entrambi voluti:
 *
 * 1. Se l'indirizzo non corrisponde a nessun utente non c'è nessun workspace a
 *    cui appendere la riga (workspaceId è obbligatorio e vincolato), quindi
 *    resta solo un avviso nel log dell'applicazione. Inventare un workspace
 *    sarebbe peggio del buco.
 * 2. La risposta al client non cambia mai in base a quello che troviamo qui: chi
 *    prova le password continua a leggere lo stesso «Credenziali non valide» sia
 *    che l'indirizzo esista sia che non esista.
 */
const recordFailedLogin = async ({
  request,
  user,
  reason,
  workspaceId,
}: {
  request: FastifyRequest;
  user: { id: string; email: string } | null;
  reason: FailedLoginReason;
  workspaceId?: string;
}) => {
  request.log.warn(
    {
      reqId: request.id,
      email: maskEmailForLog(user?.email),
      reason,
    },
    'Login attempt failed',
  );

  if (!user) {
    return;
  }

  const targetWorkspaceId =
    workspaceId ?? pickActiveMembership(await listMemberships(prisma, user.id))?.workspace.id;

  if (!targetWorkspaceId) {
    return;
  }

  try {
    await audit.log({
      event: 'auth.login.failed',
      actorUserId: user.id,
      workspaceId: targetWorkspaceId,
      entityType: 'user',
      entityId: user.id,
      metadata: {
        route: '/auth/login',
        method: 'password',
        reason,
      },
      request,
    });
  } catch (error) {
    // Un accesso va rifiutato anche se il registro non si riesce a scrivere.
    request.log.warn({ reqId: request.id, err: error }, 'Failed login was not recorded');
  }
};

const authRoute: FastifyPluginAsync = async (app) => {
  await app.register(googleAuthRoute);
  await app.register(meRoute);

  app.get('/auth/google/health', async (_request, reply) =>
    reply.code(200).send({
      ok: true,
      googleClientIdConfigured: hasConfiguredGoogleClientId(),
      metrics: {
        total: GOOGLE_AUTH_METRICS.total,
        success: GOOGLE_AUTH_METRICS.success,
        error: GOOGLE_AUTH_METRICS.error,
        byStatusCode: GOOGLE_AUTH_METRICS.byStatusCode,
        byErrorCode: GOOGLE_AUTH_METRICS.byErrorCode,
        lastLatencyMs: GOOGLE_AUTH_METRICS.lastLatencyMs,
        lastStatusCode: GOOGLE_AUTH_METRICS.lastStatusCode,
        lastMode: GOOGLE_AUTH_METRICS.lastMode,
        updatedAt: GOOGLE_AUTH_METRICS.updatedAt,
      },
    }),
  );

  app.post<{ Body: unknown }>(
    '/auth/login',
    {
      config: {
        rateLimit: AUTH_RATE_LIMIT_CONFIG.login,
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);

      if (!parsed.success) {
        throw badRequest('Invalid login payload', {
          issues: parsed.error.flatten(),
        });
      }

      const credentials = parsed.data;
      const user = await userRepository.findByEmailForLogin(credentials.email);

      if (!user || !user.passwordHash) {
        // Nessun utente, quindi nessun workspace a cui appendere la
        // registrazione: resta solo il log dell'applicazione. Vedi la nota su
        // recordFailedLogin.
        await recordFailedLogin({ request, user: null, reason: 'unknown_email' });
        throw unauthorized('Credenziali non valide');
      }

      const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValidPassword) {
        await recordFailedLogin({ request, user, reason: 'wrong_password' });
        throw unauthorized('Credenziali non valide');
      }

      const memberships = await listMemberships(prisma, user.id);
      const activeMembership = pickActiveMembership(memberships);
      if (!activeMembership) {
        await recordFailedLogin({ request, user, reason: 'no_active_membership' });
        throw unauthorized('Credenziali non valide');
      }

      // Da qui in poi utente e workspace sono noti: metterli nel contesto fa sì
      // che le scritture di riparazione dei ruoli qui sotto risultino attribuite
      // a chi sta entrando, invece che a nessuno. L'accesso non passa dalla
      // guardia requireAuthIdentity — il token lo produce, non lo consuma —
      // quindi il contesto va valorizzato qui a mano.
      requestContext.setUserId(user.id);
      requestContext.setWorkspaceId(activeMembership.workspace.id);

      if (activeMembership.workspace.status === 'SUSPENDED' && !user.isPlatformAdmin) {
        await recordFailedLogin({
          request,
          user,
          reason: 'workspace_suspended',
          workspaceId: activeMembership.workspace.id,
        });
        throw forbidden('Questo workspace è stato sospeso. Contatta un amministratore di piattaforma.');
      }

      const repairedRole = await prisma.$transaction((tx) =>
        ensureWorkspaceAccessDefaults({
          tx,
          workspaceId: activeMembership.workspace.id,
          userId: user.id,
          fallbackUserRole: user.role,
          sourceAction: 'auth.login.self_heal',
        }),
      );

      const sessionPayload = await createSessionPayload({
        user: {
          ...user,
          role: repairedRole?.assignedUserRole ?? user.role,
        },
        workspace: activeMembership.workspace,
      });

      // Chi è entrato, quando, e da dove. Fino a CRMA-28 dell'accesso non
      // restava nessuna traccia: era il buco più grave del Registro attività.
      await audit.log({
        event: 'auth.login',
        actorUserId: user.id,
        workspaceId: activeMembership.workspace.id,
        entityType: 'user',
        entityId: user.id,
        metadata: {
          route: '/auth/login',
          method: 'password',
          workspaceSlug: activeMembership.workspace.slug,
          repairedRole: Boolean(repairedRole),
        },
        request,
      });

      return ok(reply, sessionPayload);
    },
  );

  app.post<{ Body: unknown }>(
    '/auth/register',
    {
      config: {
        rateLimit: AUTH_RATE_LIMIT_CONFIG.register,
      },
    },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);

      if (!parsed.success) {
        throw badRequest('Invalid register payload', {
          issues: parsed.error.flatten(),
        });
      }

      const payload = parsed.data;
      const existingUser = await userRepository.findByEmail(payload.email);
      if (existingUser) {
        request.log.warn(
          {
            reqId: request.id,
            email: maskEmailForLog(payload.email),
          },
          'Registration rejected due to existing email',
        );
        throw conflict(REGISTRATION_GENERIC_ERROR_MESSAGE);
      }

      const passwordHash = await bcrypt.hash(payload.password, PASSWORD_SALT_ROUNDS);

      try {
        const result = await prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email: payload.email,
              name: payload.name,
              passwordHash,
              role: 'member',
            },
            select: userWithCreatedAtSelect,
          });

          const workspaceResolution = await resolveWorkspaceForRegistration({
            tx,
            workspaceName: payload.workspaceName,
            workspaceSlug: payload.workspaceSlug,
          });
          const resolvedWorkspace = workspaceResolution.workspace;

          await tx.membership.create({
            data: {
              workspaceId: resolvedWorkspace.id,
              userId: createdUser.id,
              status: 'ACTIVE',
            },
          });

          const roleAssignment = await initializeWorkspaceAuthDefaults({
            tx,
            workspaceId: resolvedWorkspace.id,
            userId: createdUser.id,
            actorUserId: createdUser.id,
            sourceAction: 'auth.register',
            requestedRoleName: payload.role ?? null,
          });

          await tx.auditLog.create({
            data: {
              workspaceId: resolvedWorkspace.id,
              actorUserId: createdUser.id,
              action: 'auth.register',
              entityType: 'user',
              entityId: createdUser.id,
              // Questa registrazione sta dentro la transazione (utente e
              // workspace non esistono ancora fuori), quindi non passa
              // dall'aiutante audit.log e IP e programma vanno messi a mano:
              // senza, di una registrazione non resterebbe da dove è arrivata.
              ipAddress: request.ip,
              userAgent: readSingleHeaderValue(request.headers['user-agent']),
              metadata: {
                workspaceSlug: resolvedWorkspace.slug,
                isNewWorkspace: workspaceResolution.isNewWorkspace,
                assignedRoleName: roleAssignment.assignedRoleName,
                assignedUserRole: roleAssignment.assignedUserRole,
                assignedPermissionKeys: roleAssignment.assignedPermissionKeys,
                isFirstWorkspaceUser: roleAssignment.isFirstWorkspaceUser,
              },
            },
          });

          return {
            user: {
              ...createdUser,
              role: roleAssignment.assignedUserRole,
            },
            workspace: resolvedWorkspace,
          };
        });

        const sessionPayload = await createSessionPayload(result);
        return ok(reply, sessionPayload, 201);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          request.log.warn(
            {
              reqId: request.id,
              email: maskEmailForLog(payload.email),
              uniqueFields: getUniqueTargetFields(error),
            },
            'Registration failed due to unique constraint',
          );
          throw conflict(REGISTRATION_GENERIC_ERROR_MESSAGE);
        }

        if (isHttpError(error)) {
          request.log.warn(
            {
              reqId: request.id,
              email: maskEmailForLog(payload.email),
              code: error.code,
              statusCode: error.statusCode,
            },
            'Registration failed with handled error',
          );
          throw new HttpError(error.statusCode, error.code, REGISTRATION_GENERIC_ERROR_MESSAGE);
        }

        request.log.error(
          {
            reqId: request.id,
            email: maskEmailForLog(payload.email),
            err: error,
          },
          'Registration failed unexpectedly',
        );
        throw internalServerError(REGISTRATION_GENERIC_ERROR_MESSAGE);
      }
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const authorizationHeader = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0]
      : request.headers.authorization;
    const bearerToken = extractBearerToken(authorizationHeader);
    if (!bearerToken) {
      throw unauthorized('Authentication token is missing');
    }

    const tokenClaims = await verifyAccessToken(bearerToken);

    // L'uscita si registra solo se il token dice a quale workspace appartiene la
    // sessione. Un token senza workspace è di una versione precedente del
    // prodotto: l'uscita funziona lo stesso, semplicemente non lascia la riga.
    if (tokenClaims.workspaceId) {
      await audit.log({
        event: 'auth.logout',
        actorUserId: tokenClaims.sub,
        workspaceId: tokenClaims.workspaceId,
        entityType: 'user',
        entityId: tokenClaims.sub,
        metadata: {
          route: '/auth/logout',
        },
        request,
      });
    }

    return ok(reply, {
      loggedOut: true,
    });
  });
};

export default authRoute;
