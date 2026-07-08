import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, badRequest, conflict, forbidden, isHttpError, internalServerError, unauthorized } from '../core/errors.js';
import { ok } from '../core/response.js';
import { extractBearerToken, signAccessToken, verifyAccessToken } from '../auth/jwt.js';
import {
  assignWorkspaceUserRole,
  initializeWorkspaceAuthDefaults,
  normalizeWorkspaceSystemRoleName,
  REGISTRABLE_WORKSPACE_ROLE_NAMES,
  ensureWorkspaceSystemRoles,
  SYSTEM_ROLE_NAME,
  type WorkspaceSystemRoleName,
} from '../auth/workspace-bootstrap.js';
import { requireAuthIdentity } from '../guards/requireAuth.js';
import { audit } from '../audit/audit.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { moduleRepository } from '../repositories/module.repository.js';
import { prisma } from '../prisma.js';
import { rbacRepository } from '../repositories/rbac.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { workspaceBrandingService } from '../services/workspace-branding.service.js';
import {
  resolveOrCreateWorkspaceForGoogle,
  upsertGoogleUser,
  verifyGoogleAccessToken,
  verifyGoogleIdToken,
  type GoogleAuthMode,
} from '../services/google-auth.service.js';

const PASSWORD_SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const LOGIN_MIN_PASSWORD_LENGTH = 1;
const REGISTRATION_GENERIC_ERROR_MESSAGE = 'Errore durante la registrazione';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isLikelyJwtToken = (value: string) => value.split('.').length === 3;

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
} as const;

const userWithCreatedAtSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

const AUTH_RATE_LIMIT_CONFIG = {
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

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(LOGIN_MIN_PASSWORD_LENGTH),
});

const registerSchema = z.object({
  name: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== 'string') {
        return null;
      }

      const normalizedName = value.trim();
      return normalizedName.length > 0 ? normalizedName : null;
    }),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  workspaceName: z.string().trim().min(1),
  workspaceSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .regex(slugPattern, 'Workspace slug non valido'),
  role: z.enum(REGISTRABLE_WORKSPACE_ROLE_NAMES).optional(),
});

const updateMeSchema = z
  .object({
    name: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null) {
            return value;
          }

          if (typeof value !== 'string') {
            return value;
          }

          const normalized = value.trim();
          return normalized.length > 0 ? normalized : null;
        },
        z.union([z.string().max(120), z.null()]).optional(),
      )
      .optional(),
    email: z
      .preprocess(
        (value) => {
          if (value === undefined) {
            return undefined;
          }

          if (typeof value !== 'string') {
            return value;
          }

          const normalized = value.trim().toLowerCase();
          return normalized.length > 0 ? normalized : value;
        },
        z.string().email().optional(),
      )
      .optional(),
    themePreference: z
      .union([z.enum(['light', 'dark', 'system']), z.null()])
      .optional(),
    avatarUrl: z
      .preprocess(
        (value) => {
          if (value === undefined) {
            return undefined;
          }
          if (value === null) {
            return null;
          }
          if (typeof value !== 'string') {
            return value;
          }
          const normalized = value.trim();
          return normalized.length > 0 ? normalized : null;
        },
        z
          .union([
            z
              .string()
              .max(1_000_000, 'Immagine profilo troppo grande')
              .refine(
                (value) =>
                  value.startsWith('data:image/')
                  || value.startsWith('http://')
                  || value.startsWith('https://'),
                'avatarUrl deve essere un data:image o un URL http(s)',
              ),
            z.null(),
          ])
          .optional(),
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      value.name === undefined
      && value.email === undefined
      && value.themePreference === undefined
      && value.avatarUrl === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
        path: ['name'],
      });
    }
  });

const googleAuthSchema = z.object({
  idToken: z.string().trim().min(1).optional(),
  credential: z.string().trim().min(1).optional(),
  id_token: z.string().trim().min(1).optional(),
  token: z.string().trim().min(1).optional(),
  googleIdToken: z.string().trim().min(1).optional(),
  accessToken: z.string().trim().min(1).optional(),
  access_token: z.string().trim().min(1).optional(),
  googleAccessToken: z.string().trim().min(1).optional(),
  mode: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : undefined),
    z.enum(['login', 'signup']).optional(),
  ),
  action: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : undefined),
    z.enum(['login', 'signup']).optional(),
  ),
  workspaceName: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().min(1).optional(),
  ),
  workspaceSlug: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().regex(slugPattern, 'Workspace slug non valido').optional(),
  ),
  role: z.preprocess(
    (value) => normalizeWorkspaceSystemRoleName(value),
    z.enum(REGISTRABLE_WORKSPACE_ROLE_NAMES).nullable().optional(),
  ),
})
  .superRefine((value, context) => {
    if (
      !value.idToken
      && !value.credential
      && !value.id_token
      && !value.token
      && !value.googleIdToken
      && !value.accessToken
      && !value.access_token
      && !value.googleAccessToken
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'idToken/credential/accessToken is required',
        path: ['idToken'],
      });
    }
  })
  .transform((value) => {
    const genericToken = value.token ?? '';
    const idToken = value.idToken
      ?? value.credential
      ?? value.id_token
      ?? value.googleIdToken
      ?? (genericToken && isLikelyJwtToken(genericToken) ? genericToken : '');
    const accessToken = value.accessToken
      ?? value.access_token
      ?? value.googleAccessToken
      ?? (genericToken && !isLikelyJwtToken(genericToken) ? genericToken : '');

    return {
      ...value,
      mode: value.mode ?? value.action,
      idToken,
      accessToken,
    };
  });

type ParsedGoogleAuthPayload = z.infer<typeof googleAuthSchema>;
type GoogleAuthInternalCode =
  | 'INVALID_TOKEN'
  | 'SLUG_TAKEN'
  | 'NO_WORKSPACE'
  | 'EMAIL_CONFLICT'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const getUniqueTargetFields = (error: Prisma.PrismaClientKnownRequestError): string[] => {
  const target = (error.meta as Record<string, unknown> | undefined)?.target;
  return Array.isArray(target) ? target.filter((value): value is string => typeof value === 'string') : [];
};

const hasConfiguredGoogleClientId = () => Boolean(process.env.GOOGLE_CLIENT_ID?.trim());

const getConfiguredGoogleClientId = () => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!googleClientId) {
    throw internalServerError('Google sign-in is not configured');
  }

  return googleClientId;
};

const maskEmailForLog = (email: string | null | undefined) => {
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

const resolveGoogleAuthMode = (payload: ParsedGoogleAuthPayload): GoogleAuthMode => {
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

const inferGoogleAuthModeFromRawBody = (body: unknown): GoogleAuthMode => {
  if (typeof body !== 'object' || body === null) {
    return 'login';
  }

  const candidate = (body as { workspaceSlug?: unknown }).workspaceSlug;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? 'signup' : 'login';
};

const GOOGLE_AUTH_METRICS = {
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

const updateGoogleAuthMetrics = ({
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

const resolveGoogleInternalErrorCode = (error: unknown): GoogleAuthInternalCode => {
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

const withGoogleErrorCode = (error: unknown, errorCode: GoogleAuthInternalCode) => {
  if (!isHttpError(error) || errorCode === 'UNKNOWN') {
    return error;
  }

  return new HttpError(error.statusCode, errorCode, error.message, error.details);
};

const logGoogleAuthEvent = ({
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

const logGoogleAuthConfigDiagnostics = ({
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

const readSingleHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const LEGACY_USER_ROLE_TO_WORKSPACE_ROLE: Record<string, WorkspaceSystemRoleName> = {
  superadmin: SYSTEM_ROLE_NAME.superadmin,
  admin: SYSTEM_ROLE_NAME.admin,
  manager: SYSTEM_ROLE_NAME.manager,
  operativo: SYSTEM_ROLE_NAME.operativo,
  viewer: SYSTEM_ROLE_NAME.viewer,
};

const resolveFallbackWorkspaceRoleName = (legacyUserRole: string | null | undefined): WorkspaceSystemRoleName => {
  if (!legacyUserRole) {
    return SYSTEM_ROLE_NAME.viewer;
  }

  const normalizedRole = legacyUserRole.trim().toLowerCase();
  return LEGACY_USER_ROLE_TO_WORKSPACE_ROLE[normalizedRole] ?? SYSTEM_ROLE_NAME.viewer;
};

const ensureWorkspaceAccessDefaults = async ({
  tx,
  workspaceId,
  userId,
  fallbackUserRole,
  sourceAction,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
  fallbackUserRole: string | null | undefined;
  sourceAction: string;
}) => {
  const [assignedRoleCount] = await Promise.all([
    tx.userRole.count({
      where: {
        workspaceId,
        userId,
      },
    }),
  ]);

  const shouldAssignRole = assignedRoleCount === 0;
  // Always sync RBAC catalogs and system role permissions to prevent permission drift
  // when new modules/permissions are introduced after workspace creation.
  await ensureWorkspaceSystemRoles({
    tx,
    workspaceId,
    actorUserId: userId,
    sourceAction,
  });

  if (!shouldAssignRole) {
    return null;
  }

  const activeWorkspaceUserCount = await tx.membership.count({
    where: {
      workspaceId,
      status: 'ACTIVE',
    },
  });

  const nextRoleName =
    activeWorkspaceUserCount <= 1
      ? SYSTEM_ROLE_NAME.superadmin
      : resolveFallbackWorkspaceRoleName(fallbackUserRole);

  return assignWorkspaceUserRole({
    tx,
    workspaceId,
    targetUserId: userId,
    actorUserId: userId,
    nextRoleName,
    sourceAction,
    enforceHierarchy: false,
    auditAction: 'rbac.user.role.assigned',
  });
};

type MembershipRecord = {
  workspaceId: string;
  status: string;
  createdAt: Date;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};

const listMemberships = (client: Prisma.TransactionClient | typeof prisma, userId: string) =>
  client.membership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      workspaceId: true,
      status: true,
      createdAt: true,
      workspace: {
        select: workspaceSelect,
      },
    },
  }) as Promise<MembershipRecord[]>;

const pickActiveMembership = (
  memberships: MembershipRecord[],
  preferredWorkspaceId?: string,
) => {
  if (preferredWorkspaceId) {
    const preferredMembership = memberships.find(
      (membership) => membership.workspaceId === preferredWorkspaceId,
    );
    if (preferredMembership) {
      return preferredMembership;
    }
  }

  return memberships[0] ?? null;
};

const createSessionPayload = async ({
  user,
  workspace,
  onboardingRequired,
  isNewUser,
  isNewWorkspace,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isPlatformAdmin?: boolean;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  onboardingRequired?: boolean;
  isNewUser?: boolean;
  isNewWorkspace?: boolean;
}) => {
  const [accessToken, branding] = await Promise.all([
    signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
    }),
    workspaceBrandingService.getWorkspaceBranding(workspace),
  ]);

  return {
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isPlatformAdmin: Boolean(user.isPlatformAdmin),
    },
    workspace,
    branding,
    ...(typeof onboardingRequired === 'boolean' ? { onboardingRequired } : {}),
    ...(typeof isNewUser === 'boolean' ? { isNewUser } : {}),
    ...(typeof isNewWorkspace === 'boolean' ? { isNewWorkspace } : {}),
  };
};

const resolveWorkspaceForRegistration = async ({
  tx,
  workspaceName,
  workspaceSlug,
}: {
  tx: Prisma.TransactionClient;
  workspaceName: string;
  workspaceSlug: string;
}): Promise<{
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  isNewWorkspace: boolean;
}> => {
  const existingWorkspace = await tx.workspace.findUnique({
    where: {
      slug: workspaceSlug,
    },
    select: workspaceSelect,
  });

  if (existingWorkspace) {
    return {
      workspace: existingWorkspace,
      isNewWorkspace: false,
    };
  }

  try {
    const createdWorkspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug: workspaceSlug,
      },
      select: workspaceSelect,
    });

    return {
      workspace: createdWorkspace,
      isNewWorkspace: true,
    };
  } catch (error) {
    if (isUniqueConstraintError(error) && getUniqueTargetFields(error).includes('slug')) {
      const racedWorkspace = await tx.workspace.findUnique({
        where: {
          slug: workspaceSlug,
        },
        select: workspaceSelect,
      });

      if (racedWorkspace) {
        return {
          workspace: racedWorkspace,
          isNewWorkspace: false,
        };
      }
    }

    throw error;
  }
};

const authRoute: FastifyPluginAsync = async (app) => {
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
        throw unauthorized('Credenziali non valide');
      }

      const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValidPassword) {
        throw unauthorized('Credenziali non valide');
      }

      const memberships = await listMemberships(prisma, user.id);
      const activeMembership = pickActiveMembership(memberships);
      if (!activeMembership) {
        throw unauthorized('Credenziali non valide');
      }

      if (activeMembership.workspace.status === 'SUSPENDED' && !user.isPlatformAdmin) {
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

  app.patch<{ Body: unknown }>('/auth/me', async (request, reply) => {
    const { user, tokenClaims } = await requireAuthIdentity(request);

    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid profile update payload', {
        issues: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const patch: Prisma.UserUpdateInput = {};
    const changedFields: string[] = [];

    if (payload.name !== undefined && payload.name !== user.name) {
      patch.name = payload.name;
      changedFields.push('name');
    }

    if (payload.email !== undefined && payload.email !== user.email) {
      patch.email = payload.email;
      changedFields.push('email');
    }

    if (payload.themePreference !== undefined && payload.themePreference !== user.themePreference) {
      patch.themePreference = payload.themePreference;
      changedFields.push('themePreference');
    }

    if (payload.avatarUrl !== undefined && payload.avatarUrl !== user.avatarUrl) {
      patch.avatarUrl = payload.avatarUrl;
      changedFields.push('avatarUrl');
    }

    if (changedFields.length === 0) {
      return ok(reply, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          themePreference: user.themePreference ?? null,
          avatarUrl: user.avatarUrl ?? null,
        },
        changedFields: [],
      });
    }

    const memberships = await listMemberships(prisma, user.id);
    const activeMembership = pickActiveMembership(memberships, tokenClaims.workspaceId);
    if (!activeMembership) {
      throw unauthorized('Sessione non valida');
    }

    try {
      const updatedUser = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: patch,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          themePreference: true,
          avatarUrl: true,
        },
      });

      const shouldRefreshToken = updatedUser.email !== user.email;
      const refreshedToken = shouldRefreshToken
        ? await signAccessToken({
            sub: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            workspaceId: activeMembership.workspace.id,
            workspaceSlug: activeMembership.workspace.slug,
          })
        : null;

      await audit.log({
        event: 'me.update',
        actorUserId: updatedUser.id,
        workspaceId: activeMembership.workspace.id,
        entityType: 'user',
        entityId: updatedUser.id,
        metadata: {
          route: '/auth/me',
          changedFields,
        },
        request,
      });

      return ok(reply, {
        ...(refreshedToken ? { token: refreshedToken } : {}),
        user: updatedUser,
        changedFields,
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && getUniqueTargetFields(error).includes('email')) {
        throw conflict('Email gia in uso');
      }

      throw error;
    }
  });

  app.get('/auth/me', async (request, reply) => {
    const { user, tokenClaims } = await requireAuthIdentity(request);

    const memberships = await listMemberships(prisma, user.id);
    const activeMembership = pickActiveMembership(memberships, tokenClaims.workspaceId);
    if (!activeMembership) {
      throw unauthorized('Sessione non valida');
    }

    if (activeMembership.workspace.status === 'SUSPENDED' && !user.isPlatformAdmin) {
      throw forbidden('Questo workspace è stato sospeso. Contatta un amministratore di piattaforma.');
    }

    const repairedRole = await prisma.$transaction((tx) =>
      ensureWorkspaceAccessDefaults({
        tx,
        workspaceId: activeMembership.workspace.id,
        userId: user.id,
        fallbackUserRole: user.role,
        sourceAction: 'auth.me.self_heal',
      }),
    );
    const effectiveUserRole = repairedRole?.assignedUserRole ?? user.role;

    const [enabledModules, permissions, roles, recentActivity, branding] = await Promise.all([
      moduleRepository.listEnabledModules(activeMembership.workspace.id),
      rbacRepository.listUserPermissions(user.id, activeMembership.workspace.id),
      rbacRepository.listUserRoles(user.id, activeMembership.workspace.id),
      auditRepository.listRecentBusinessByWorkspace(activeMembership.workspace.id, 8),
      workspaceBrandingService.getWorkspaceBranding(activeMembership.workspace),
    ]);

    await audit.log({
      event: 'me.view',
      actorUserId: user.id,
      workspaceId: activeMembership.workspace.id,
      metadata: {
        route: '/auth/me',
      },
      request,
    });

    const shouldRefreshToken =
      tokenClaims.workspaceId !== activeMembership.workspace.id ||
      tokenClaims.workspaceSlug !== activeMembership.workspace.slug ||
      tokenClaims.role !== effectiveUserRole;

    const refreshedToken = shouldRefreshToken
      ? await signAccessToken({
          sub: user.id,
          email: user.email,
          role: effectiveUserRole,
          workspaceId: activeMembership.workspace.id,
          workspaceSlug: activeMembership.workspace.slug,
        })
      : null;

    return ok(reply, {
      ...(refreshedToken ? { token: refreshedToken } : {}),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: effectiveUserRole,
        isPlatformAdmin: Boolean(user.isPlatformAdmin),
        themePreference: user.themePreference ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
      workspace: activeMembership.workspace,
      branding,
      memberships: memberships.map((membership) => ({
        workspaceId: membership.workspaceId,
        status: membership.status,
        createdAt: membership.createdAt.toISOString(),
        workspace: membership.workspace,
      })),
      enabledModules,
      permissions,
      roles,
      recentActivity: recentActivity.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
        actor: item.actorUser
          ? {
              id: item.actorUser.id,
              email: item.actorUser.email,
              ...(item.actorUser.name ? { name: item.actorUser.name } : {}),
            }
          : null,
      })),
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const authorizationHeader = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0]
      : request.headers.authorization;
    const bearerToken = extractBearerToken(authorizationHeader);
    if (!bearerToken) {
      throw unauthorized('Authentication token is missing');
    }

    await verifyAccessToken(bearerToken);

    return ok(reply, {
      loggedOut: true,
    });
  });
};

export default authRoute;
