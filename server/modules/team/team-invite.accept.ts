import { HttpError, badRequest, conflict, forbidden, unauthorized } from '../../core/errors.js';
import { markMembershipReactivated } from '../../core/membership-access.js';
import { TEAM_MODULE_KEY } from '../../auth/rbac-catalog.js';
import { enforceTeamInviteAcceptRateLimit } from './rate-limit.js';
import { normalizeEmail } from './team.utils.js';
import {
  assertAcceptableInviteStatus,
  parseAcceptInvitePayload,
  resolveRolePresetForAcceptance,
} from './team-invite.helpers.js';
import type {
  AcceptTeamInviteResult,
  TeamInviteServiceDependencies,
} from './team-invite.types.js';

// Accettazione di un invito: estratta da team-invite.service.ts perche' da sola
// valeva 195 righe su 496, ed e' il ramo che crea utenti e sessioni.
export const acceptTeamInvite = async (
  dependencies: TeamInviteServiceDependencies,
  input: {
    payload: unknown;
    authenticatedUserId: string | null;
    clientIp?: string | null;
  },
): Promise<AcceptTeamInviteResult> => {
  const {
    inviteRepository,
    prismaClient,
    moduleRepo,
    assignWorkspaceUserRoleFn,
    signAccessTokenFn,
    hashTokenFn,
    nowFn,
  } = dependencies;

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

      // ⚠️ `update` e non `create`: la coppia (workspaceId, userId) resta unica
      // anche da cestinata, quindi reinvitare una persona rimossa aggiorna la
      // riga vecchia. Rimettere il solo `status` la lascerebbe cestinata, e
      // ogni rotta risponderebbe 403 a un invito appena accettato (CRMA-157).
      const membership = await tx.membership.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: targetUser.id,
          },
        },
        update: markMembershipReactivated(),
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

    // Stesso ripristino del ramo qui sopra: l'invito accettato deve riportare
    // indietro la membership, non solo riaccenderne lo stato (CRMA-157).
    const membership = await tx.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: targetUser.id,
        },
      },
      update: markMembershipReactivated(),
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
};
