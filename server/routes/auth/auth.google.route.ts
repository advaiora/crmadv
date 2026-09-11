// Rotta POST /auth/google. Registrata come plugin da auth.route.ts.

import type { FastifyPluginAsync } from 'fastify';
import { badRequest, isHttpError } from '../../core/errors.js';
import { ok } from '../../core/response.js';
import { prisma } from '../../prisma.js';
import {
  resolveOrCreateWorkspaceForGoogle,
  upsertGoogleUser,
  verifyGoogleAccessToken,
  verifyGoogleIdToken,
  type GoogleAuthMode,
} from '../../services/google-auth.service.js';
import {
  inferGoogleAuthModeFromRawBody,
  logGoogleAuthConfigDiagnostics,
  logGoogleAuthEvent,
  resolveGoogleAuthMode,
  resolveGoogleInternalErrorCode,
  updateGoogleAuthMetrics,
  withGoogleErrorCode,
  type GoogleAuthInternalCode,
} from './auth.google.js';
import { googleAuthSchema } from './auth.schemas.js';
import { createSessionPayload } from './auth.session.js';
import {
  AUTH_RATE_LIMIT_CONFIG,
  getConfiguredGoogleClientId,
  maskEmailForLog,
  readSingleHeaderValue,
} from './auth.shared.js';
import { ensureWorkspaceAccessDefaults } from './auth.workspace-defaults.js';

const googleAuthRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: unknown }>(
    '/auth/google',
    {
      config: {
        rateLimit: AUTH_RATE_LIMIT_CONFIG.google,
      },
    },
    async (request, reply) => {
      const startedAt = Date.now();
      let mode: GoogleAuthMode = inferGoogleAuthModeFromRawBody(request.body);
      let maskedEmailForAudit = '(unknown)';

      const parsed = googleAuthSchema.safeParse(request.body);

      if (!parsed.success) {
        const latencyMs = Date.now() - startedAt;
        const statusCode = 400;
        const errorCode: GoogleAuthInternalCode = 'BAD_REQUEST';
        updateGoogleAuthMetrics({
          statusCode,
          mode,
          errorCode,
          latencyMs,
        });
        logGoogleAuthEvent({
          request,
          mode,
          result: 'error',
          statusCode,
          maskedEmail: maskedEmailForAudit,
          latencyMs,
          errorCode,
        });

        throw badRequest('Invalid Google auth payload', {
          issues: parsed.error.flatten(),
        });
      }

      try {
        mode = resolveGoogleAuthMode(parsed.data);
        const googleClientId = getConfiguredGoogleClientId();
        const googleClientIdFromClient = readSingleHeaderValue(
          request.headers['x-google-client-id-debug'] as string | string[] | undefined,
        );
        if (googleClientIdFromClient && googleClientIdFromClient !== googleClientId) {
          request.log.warn(
            {
              reqId: request.id,
              provider: 'google',
              configuredGoogleClientIdLength: googleClientId.length,
              clientGoogleClientIdLength: googleClientIdFromClient.length,
            },
            'GOOGLE_CLIENT_ID mismatch between frontend and backend',
          );
        }
        logGoogleAuthConfigDiagnostics({
          request,
          mode,
          googleClientId,
        });
        const identity = parsed.data.idToken
          ? await verifyGoogleIdToken({
              idToken: parsed.data.idToken,
              audience: googleClientId,
            })
          : await verifyGoogleAccessToken({
              accessToken: parsed.data.accessToken,
              audience: googleClientId,
            });
        maskedEmailForAudit = maskEmailForLog(identity.email);

        const result = await prisma.$transaction(async (tx) => {
          const upsertedUser = await upsertGoogleUser(tx, identity);
          const workspaceResolution = await resolveOrCreateWorkspaceForGoogle({
            tx,
            mode,
            userId: upsertedUser.user.id,
            workspaceInput: {
              workspaceName: parsed.data.workspaceName,
              workspaceSlug: parsed.data.workspaceSlug,
              roleName: parsed.data.role ?? undefined,
            },
          });
          const repairedRole = await ensureWorkspaceAccessDefaults({
            tx,
            workspaceId: workspaceResolution.workspace.id,
            userId: upsertedUser.user.id,
            fallbackUserRole: workspaceResolution.roleAssignment?.assignedUserRole ?? upsertedUser.user.role,
            sourceAction: 'auth.google.self_heal',
          });
          const resolvedUserRole =
            repairedRole?.assignedUserRole ??
            workspaceResolution.roleAssignment?.assignedUserRole ??
            upsertedUser.user.role;
          const resolvedUser = {
            ...upsertedUser.user,
            role: resolvedUserRole,
          };
          const onboardingRequired = upsertedUser.isNewUser || workspaceResolution.isNewWorkspace;

          await tx.auditLog.create({
            data: {
              workspaceId: workspaceResolution.workspace.id,
              actorUserId: upsertedUser.user.id,
              action: 'auth.google',
              entityType: 'user',
              entityId: upsertedUser.user.id,
              // Come per la registrazione: siamo dentro la transazione che crea
              // utente e workspace, quindi non si passa dall'aiutante audit.log e
              // IP e programma si scrivono a mano.
              ipAddress: request.ip,
              userAgent: readSingleHeaderValue(request.headers['user-agent']),
              metadata: {
                workspaceSlug: workspaceResolution.workspace.slug,
                mode,
                assignedRoleName: workspaceResolution.roleAssignment?.assignedRoleName ?? null,
                assignedUserRole: workspaceResolution.roleAssignment?.assignedUserRole ?? null,
                assignedPermissionKeys: workspaceResolution.roleAssignment?.assignedPermissionKeys ?? [],
                isFirstWorkspaceUser: workspaceResolution.roleAssignment?.isFirstWorkspaceUser ?? false,
                onboardingRequired,
                isNewUser: upsertedUser.isNewUser,
                isNewWorkspace: workspaceResolution.isNewWorkspace,
              },
            },
          });

          return {
            user: resolvedUser,
            workspace: workspaceResolution.workspace,
            statusCode: workspaceResolution.statusCode,
            mode,
            onboardingRequired,
            isNewUser: upsertedUser.isNewUser,
            isNewWorkspace: workspaceResolution.isNewWorkspace,
          };
        });

        const statusCode = result.statusCode;
        const latencyMs = Date.now() - startedAt;
        updateGoogleAuthMetrics({
          statusCode,
          mode: result.mode,
          latencyMs,
        });
        logGoogleAuthEvent({
          request,
          mode: result.mode,
          result: 'ok',
          statusCode,
          maskedEmail: maskedEmailForAudit,
          latencyMs,
        });

        const sessionPayload = await createSessionPayload({
          ...result,
          onboardingRequired: result.onboardingRequired,
          isNewUser: result.isNewUser,
          isNewWorkspace: result.isNewWorkspace,
        });
        return ok(reply, sessionPayload, result.statusCode);
      } catch (error) {
        const statusCode = isHttpError(error) ? error.statusCode : 500;
        const errorCode = resolveGoogleInternalErrorCode(error);
        const latencyMs = Date.now() - startedAt;
        updateGoogleAuthMetrics({
          statusCode,
          mode,
          errorCode,
          latencyMs,
        });
        logGoogleAuthEvent({
          request,
          mode,
          result: 'error',
          statusCode,
          maskedEmail: maskedEmailForAudit,
          latencyMs,
          errorCode,
        });

        if (errorCode === 'INVALID_TOKEN' || errorCode === 'BAD_REQUEST') {
          const requestOrigin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin;
          request.log.warn(
            {
              reqId: request.id,
              provider: 'google',
              mode,
              errorCode,
              requestOrigin: requestOrigin ?? '(missing-origin-header)',
              message: isHttpError(error) ? error.message : String(error),
              oauthHints: [
                'Check Google Cloud Authorized JavaScript origins',
                'Check GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID are identical',
                'Ensure ALLOWED_ORIGINS contains frontend origin',
              ],
            },
            'Google auth failed due to potential OAuth/CORS misconfiguration',
          );
        }

        throw withGoogleErrorCode(error, errorCode);
      }
    },
  );
};

export default googleAuthRoute;
