import { z } from 'zod';
import { HttpError, badRequest, conflict, forbidden, notFound, unauthorized } from '../../core/errors.js';
import { signAccessToken } from '../../auth/jwt.js';
import {
  SYSTEM_ROLE_NAME,
  assignWorkspaceUserRole,
  normalizeWorkspaceSystemRoleName,
} from '../../auth/workspace-bootstrap.js';
import { TEAM_MODULE_KEY } from '../../auth/rbac-catalog.js';
import { moduleRepository } from '../../repositories/module.repository.js';
import { teamRepository } from './team.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import { prisma } from '../../prisma.js';
import { teamInviteNotifier } from './team-invite.notifier.js';
import { teamInviteRepository, type TeamInviteRecord } from './team-invite.repository.js';
import { generateInviteToken, hashInviteToken } from './team-invite.tokens.js';
import { enforceTeamInviteAcceptRateLimit } from './rate-limit.js';
import { normalizeEmail } from './team.utils.js';

const DEFAULT_INVITE_EXPIRES_IN_DAYS = 7;
const MAX_INVITE_EXPIRES_IN_DAYS = 30;

const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  rolePreset: z
    .union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)).min(1),
    ])
    .optional(),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(MAX_INVITE_EXPIRES_IN_DAYS)
    .optional(),
}).strict();

const acceptInviteSchema = z.object({
  token: z.string().trim().min(32),
}).strict();

type InviteRolePresetInput = z.infer<typeof createInviteSchema>['rolePreset'];

type TeamInviteDto = {
  inviteId: string;
  workspaceId: string;
  email: string;
  status: string;
  rolePreset: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedBy: {
    userId: string;
    name: string | null;
    email: string;
  };
  acceptedBy: {
    userId: string;
    name: string | null;
    email: string;
  } | null;
};

type CreateTeamInviteResult = {
  inviteId: string;
  email: string;
  expiresAt: string;
  status: string;
  rolePreset: string;
  inviteLink?: string;
  invitePreviewUrl?: string;
};

type AcceptTeamInviteResult = {
  inviteId: string;
  workspaceId: string;
  workspaceSlug: string;
  membershipId: string;
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string | null;
  };
};

type TeamInviteServiceDependencies = {
  inviteRepository: typeof teamInviteRepository;
  teamRepo: typeof teamRepository;
  userRepo: typeof userRepository;
  prismaClient: typeof prisma;
  moduleRepo: typeof moduleRepository;
  notifier: typeof teamInviteNotifier;
  assignWorkspaceUserRoleFn: typeof assignWorkspaceUserRole;
  signAccessTokenFn: typeof signAccessToken;
  generateTokenFn: typeof generateInviteToken;
  hashTokenFn: typeof hashInviteToken;
  nowFn: () => Date;
};

const defaultDependencies: TeamInviteServiceDependencies = {
  inviteRepository: teamInviteRepository,
  teamRepo: teamRepository,
  userRepo: userRepository,
  prismaClient: prisma,
  moduleRepo: moduleRepository,
  notifier: teamInviteNotifier,
  assignWorkspaceUserRoleFn: assignWorkspaceUserRole,
  signAccessTokenFn: signAccessToken,
  generateTokenFn: generateInviteToken,
  hashTokenFn: hashInviteToken,
  nowFn: () => new Date(),
};

const isDevelopment = () => process.env.NODE_ENV !== 'production';

const resolveInviteBaseUrl = () => {
  const candidate =
    process.env.TEAM_INVITE_BASE_URL?.trim()
    || process.env.APP_BASE_URL?.trim()
    || process.env.FRONTEND_BASE_URL?.trim()
    || process.env.WEB_BASE_URL?.trim();

  if (!candidate) {
    return isDevelopment() ? 'http://localhost:5173' : null;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return isDevelopment() ? 'http://localhost:5173' : null;
  }
};

const resolveRolePresetNameOrThrow = (rolePreset: InviteRolePresetInput) => {
  const rawValue = Array.isArray(rolePreset) ? rolePreset[0] : rolePreset;
  if (!rawValue) {
    return SYSTEM_ROLE_NAME.viewer;
  }

  const normalizedRoleName = normalizeWorkspaceSystemRoleName(rawValue);
  if (!normalizedRoleName) {
    throw badRequest('Invalid rolePreset. Allowed values: Superadmin, Admin, Manager, Operativo, Viewer');
  }

  return normalizedRoleName;
};

const resolveRolePresetForAcceptance = (rolePresetName: string | null) =>
  normalizeWorkspaceSystemRoleName(rolePresetName) ?? SYSTEM_ROLE_NAME.viewer;

const resolveInviteExpiry = (now: Date, expiresInDays: number | undefined) => {
  const days = expiresInDays ?? DEFAULT_INVITE_EXPIRES_IN_DAYS;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
};

const mapInviteToDto = (invite: TeamInviteRecord): TeamInviteDto => ({
  inviteId: invite.id,
  workspaceId: invite.workspaceId,
  email: invite.email,
  status: invite.status,
  rolePreset: invite.rolePresetName ?? SYSTEM_ROLE_NAME.viewer,
  expiresAt: invite.expiresAt.toISOString(),
  createdAt: invite.createdAt.toISOString(),
  acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
  revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
  invitedBy: {
    userId: invite.invitedByUser.id,
    name: invite.invitedByUser.name,
    email: invite.invitedByUser.email,
  },
  acceptedBy: invite.acceptedByUser
    ? {
      userId: invite.acceptedByUser.id,
      name: invite.acceptedByUser.name,
      email: invite.acceptedByUser.email,
    }
    : null,
});

const parseCreateInvitePayload = (payload: unknown) => {
  const parsed = createInviteSchema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest('Invalid team invite payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseAcceptInvitePayload = (payload: unknown) => {
  const parsed = acceptInviteSchema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest('Invalid invite accept payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const assertAcceptableInviteStatus = (invite: TeamInviteRecord) => {
  if (invite.status === 'REVOKED') {
    throw new HttpError(410, 'INVITE_REVOKED', 'Invite has been revoked');
  }

  if (invite.status === 'EXPIRED') {
    throw new HttpError(410, 'INVITE_EXPIRED', 'Invite has expired');
  }
};

export const buildTeamInviteService = (
  dependencies: TeamInviteServiceDependencies = defaultDependencies,
) => {
  const {
    inviteRepository,
    teamRepo,
    userRepo,
    prismaClient,
    moduleRepo,
    notifier,
    assignWorkspaceUserRoleFn,
    signAccessTokenFn,
    generateTokenFn,
    hashTokenFn,
    nowFn,
  } = dependencies;

  return {
    async createInvite(input: {
      workspaceId: string;
      invitedByUserId: string;
      invitedByDisplayName: string;
      payload: unknown;
    }): Promise<CreateTeamInviteResult> {
      const now = nowFn();
      const parsedPayload = parseCreateInvitePayload(input.payload);
      const email = normalizeEmail(parsedPayload.email);
      const rolePresetName = resolveRolePresetNameOrThrow(parsedPayload.rolePreset);
      const expiresAt = resolveInviteExpiry(now, parsedPayload.expiresInDays);

      await inviteRepository.expirePendingInvites(input.workspaceId, now);

      const existingUser = await userRepo.findByEmail(email);
      if (existingUser) {
        const existingMembership = await teamRepo.findMembershipByUserId(input.workspaceId, existingUser.id);
        if (existingMembership) {
          throw conflict('Invite cannot be created for this recipient');
        }
      }

      const token = generateTokenFn();
      const tokenHash = hashTokenFn(token);
      const existingPendingInvite = await inviteRepository.findPendingInviteByEmail(input.workspaceId, email);

      const invite = existingPendingInvite
        ? await inviteRepository.refreshPendingInvite({
          inviteId: existingPendingInvite.id,
          tokenHash,
          expiresAt,
          rolePresetName,
        })
        : await inviteRepository.createInvite({
          workspaceId: input.workspaceId,
          email,
          tokenHash,
          expiresAt,
          rolePresetName,
          invitedByUserId: input.invitedByUserId,
        });

      const inviteBaseUrl = resolveInviteBaseUrl();
      const inviteLink = inviteBaseUrl
        ? `${inviteBaseUrl}/accept-invite?token=${encodeURIComponent(token)}`
        : null;

      const notificationResult = inviteLink
        ? await notifier.sendInvite({
          toEmail: email,
          workspaceName: invite.workspace.name,
          invitedByName: input.invitedByDisplayName,
          inviteLink,
          expiresAt,
        })
        : { delivered: false, reason: 'SMTP_NOT_CONFIGURED' as const };

      return {
        inviteId: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt.toISOString(),
        status: invite.status,
        rolePreset: invite.rolePresetName ?? SYSTEM_ROLE_NAME.viewer,
        ...(!notificationResult.delivered && isDevelopment() && inviteLink
          ? { inviteLink }
          : {}),
        ...(notificationResult.delivered && isDevelopment() && notificationResult.previewUrl
          ? { invitePreviewUrl: notificationResult.previewUrl }
          : {}),
      };
    },

    async listInvites(workspaceId: string): Promise<TeamInviteDto[]> {
      const now = nowFn();
      await inviteRepository.expirePendingInvites(workspaceId, now);
      const invites = await inviteRepository.listInvitesByWorkspace(workspaceId);
      return invites.map(mapInviteToDto);
    },

    async revokeInvite(input: {
      workspaceId: string;
      inviteId: string;
    }): Promise<TeamInviteDto> {
      const now = nowFn();
      await inviteRepository.expirePendingInvites(input.workspaceId, now);

      const existingInvite = await inviteRepository.findInviteById(input.workspaceId, input.inviteId);
      if (!existingInvite) {
        throw notFound('Team invite not found');
      }

      if (existingInvite.status !== 'PENDING') {
        throw badRequest('Only pending invites can be revoked');
      }

      await inviteRepository.revokePendingInvite(input.workspaceId, input.inviteId, now);
      const updatedInvite = await inviteRepository.findInviteById(input.workspaceId, input.inviteId);
      if (!updatedInvite) {
        throw notFound('Team invite not found');
      }

      return mapInviteToDto(updatedInvite);
    },

    async deleteInvite(input: {
      workspaceId: string;
      inviteId: string;
    }): Promise<TeamInviteDto> {
      const now = nowFn();
      await inviteRepository.expirePendingInvites(input.workspaceId, now);

      const existingInvite = await inviteRepository.findInviteById(input.workspaceId, input.inviteId);
      if (!existingInvite) {
        throw notFound('Team invite not found');
      }

      const deleted = await inviteRepository.deleteInviteById(input.workspaceId, input.inviteId);
      if (deleted.count === 0) {
        throw notFound('Team invite not found');
      }

      return mapInviteToDto(existingInvite);
    },

    async acceptInvite(input: {
      payload: unknown;
      authenticatedUserId: string | null;
      clientIp?: string | null;
    }): Promise<AcceptTeamInviteResult> {
      const now = nowFn();
      const parsedPayload = parseAcceptInvitePayload(input.payload);
      const tokenHash = hashTokenFn(parsedPayload.token);
      enforceTeamInviteAcceptRateLimit({
        clientIp: input.clientIp?.trim() || 'unknown',
        tokenHash,
      });

      const inviteSnapshot = await inviteRepository.findInviteByTokenHash(tokenHash);
      if (!inviteSnapshot) {
        throw badRequest('Invalid or expired invite token');
      }

      const teamModuleEnabled = await moduleRepo.isEnabled(inviteSnapshot.workspaceId, TEAM_MODULE_KEY);
      if (!teamModuleEnabled) {
        throw forbidden('Module is disabled for this workspace', {
          workspaceId: inviteSnapshot.workspaceId,
          moduleKey: TEAM_MODULE_KEY,
        });
      }

      const transactionResult = await prismaClient.$transaction(async (tx) => {
        const invite = await inviteRepository.findInviteByTokenHash(tokenHash, tx);
        if (!invite) {
          throw badRequest('Invalid or expired invite token');
        }

        assertAcceptableInviteStatus(invite);
        if (invite.status === 'PENDING' && invite.expiresAt < now) {
          await inviteRepository.expirePendingInviteById(invite.id, now, tx);
          throw new HttpError(410, 'INVITE_EXPIRED', 'Invite has expired');
        }

        let targetUser = null as null | {
          id: string;
          email: string;
          name: string | null;
          role: string;
        };

        if (input.authenticatedUserId) {
          targetUser = await tx.user.findUnique({
            where: {
              id: input.authenticatedUserId,
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          });

          if (!targetUser) {
            throw unauthorized('Authenticated user was not found');
          }

          if (normalizeEmail(targetUser.email) !== normalizeEmail(invite.email)) {
            throw forbidden('Invite email does not match authenticated user');
          }
        } else {
          targetUser = await tx.user.upsert({
            where: {
              email: invite.email,
            },
            update: {},
            create: {
              email: invite.email,
              name: null,
              role: 'member',
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          });
        }

        if (invite.status === 'ACCEPTED') {
          if (invite.acceptedByUserId && invite.acceptedByUserId !== targetUser.id) {
            throw forbidden('Invite has already been accepted');
          }

          const membership = await tx.membership.upsert({
            where: {
              workspaceId_userId: {
                workspaceId: invite.workspaceId,
                userId: targetUser.id,
              },
            },
            update: {
              status: 'ACTIVE',
            },
            create: {
              workspaceId: invite.workspaceId,
              userId: targetUser.id,
              status: 'ACTIVE',
            },
            select: {
              id: true,
            },
          });

          return {
            inviteId: invite.id,
            workspaceId: invite.workspace.id,
            workspaceSlug: invite.workspace.slug,
            membershipId: membership.id,
            sessionRole: targetUser.role,
            targetUser,
          };
        }

        const claimedInvite = await inviteRepository.markInviteAccepted(
          invite.id,
          targetUser.id,
          now,
          tx,
        );

        if (claimedInvite.count === 0) {
          throw conflict('Invite could not be claimed');
        }

        const membership = await tx.membership.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: invite.workspaceId,
              userId: targetUser.id,
            },
          },
          update: {
            status: 'ACTIVE',
          },
          create: {
            workspaceId: invite.workspaceId,
            userId: targetUser.id,
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        });

        const rolePresetName = resolveRolePresetForAcceptance(invite.rolePresetName);
        const roleAssignment = await assignWorkspaceUserRoleFn({
          tx,
          workspaceId: invite.workspaceId,
          targetUserId: targetUser.id,
          actorUserId: targetUser.id,
          nextRoleName: rolePresetName,
          sourceAction: 'team.invite.accept',
          enforceHierarchy: false,
          auditAction: 'rbac.user.role.assigned',
        });

        return {
          inviteId: invite.id,
          workspaceId: invite.workspace.id,
          workspaceSlug: invite.workspace.slug,
          membershipId: membership.id,
          sessionRole: roleAssignment.assignedUserRole,
          targetUser,
        };
      });

      const accessToken = await signAccessTokenFn({
        sub: transactionResult.targetUser.id,
        email: transactionResult.targetUser.email,
        role: transactionResult.sessionRole,
        workspaceId: transactionResult.workspaceId,
        workspaceSlug: transactionResult.workspaceSlug,
      });

      return {
        inviteId: transactionResult.inviteId,
        workspaceId: transactionResult.workspaceId,
        workspaceSlug: transactionResult.workspaceSlug,
        membershipId: transactionResult.membershipId,
        accessToken,
        user: {
          id: transactionResult.targetUser.id,
          email: transactionResult.targetUser.email,
          role: transactionResult.sessionRole,
          name: transactionResult.targetUser.name,
        },
      };
    },
  };
};

export const teamInviteService = buildTeamInviteService();
