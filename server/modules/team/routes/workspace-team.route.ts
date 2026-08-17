import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../../audit/audit.js';
import { badRequest, isHttpError } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { requireAuthIdentity } from '../../../guards/requireAuth.js';
import { createAuditEvent, TEAM_AUDIT_ACTION } from '../team.audit.js';
import {
  TEAM_PERMISSIONS,
  ensureTeamAccess,
} from '../team.policies.js';
import { enforceTeamInviteCreateRateLimit, resolveTeamRequestClientIp } from '../rate-limit.js';
import { teamInviteService } from '../team-invite.service.js';
import { teamService } from '../team.service.js';
import { isWorkspaceEntityId } from '../team.utils.js';

const memberParamsSchema = z.object({
  memberId: z.string().trim().min(1).refine(isWorkspaceEntityId, {
    message: 'Invalid memberId format',
  }),
}).strict();

const parseMemberParams = (value: unknown) => {
  const parsed = memberParamsSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid team member params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const inviteParamsSchema = z.object({
  inviteId: z.string().trim().min(1).refine(isWorkspaceEntityId, {
    message: 'Invalid inviteId format',
  }),
}).strict();

const parseInviteParams = (value: unknown) => {
  const parsed = inviteParamsSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid team invite params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

type TeamRouteDependencies = {
  ensureTeamAccessFn: typeof ensureTeamAccess;
  requireAuthIdentityFn: typeof requireAuthIdentity;
  teamServiceApi: typeof teamService;
  teamInviteServiceApi: typeof teamInviteService;
  auditLogFn: typeof audit.log;
};

const defaultDependencies: TeamRouteDependencies = {
  ensureTeamAccessFn: ensureTeamAccess,
  requireAuthIdentityFn: requireAuthIdentity,
  teamServiceApi: teamService,
  teamInviteServiceApi: teamInviteService,
  auditLogFn: audit.log,
};

export const buildWorkspaceTeamRoute = (
  dependencies: Partial<TeamRouteDependencies> = {},
): FastifyPluginAsync => async (app) => {
  const {
    ensureTeamAccessFn,
    requireAuthIdentityFn,
    teamServiceApi,
    teamInviteServiceApi,
    auditLogFn,
  } = {
    ...defaultDependencies,
    ...dependencies,
  };

  app.get('/api/team', async (request, reply) => {
    const { workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.view);
    const members = await teamServiceApi.listMembers(workspace.id);

    return ok(reply, { members });
  });

  app.get('/api/team/invites', async (request, reply) => {
    const { workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.view);
    const invites = await teamInviteServiceApi.listInvites(workspace.id);

    return ok(reply, { invites });
  });

  app.post<{ Body: unknown }>('/api/team/invites', async (request, reply) => {
    const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.invite);
    enforceTeamInviteCreateRateLimit({
      workspaceId: workspace.id,
      actorUserId: user.id,
      clientIp: resolveTeamRequestClientIp(request),
    });

    const invite = await teamInviteServiceApi.createInvite({
      workspaceId: workspace.id,
      invitedByUserId: user.id,
      invitedByDisplayName: user.name ?? user.email,
      payload: request.body,
    });

    await createAuditEvent({
      action: TEAM_AUDIT_ACTION.inviteSent,
      actorUserId: user.id,
      workspaceId: workspace.id,
      targetType: 'team_invite',
      targetId: invite.inviteId,
      metadata: {
        email: invite.email,
        inviteId: invite.inviteId,
        rolePreset: invite.rolePreset,
        expiresAt: invite.expiresAt,
      },
      request,
      auditLogFn,
    });

    return ok(reply, invite, 201);
  });

  app.post<{ Params: unknown }>('/api/team/invites/:inviteId/revoke', async (request, reply) => {
    const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.invite);
    const params = parseInviteParams(request.params);
    const invite = await teamInviteServiceApi.revokeInvite({
      workspaceId: workspace.id,
      inviteId: params.inviteId,
    });

    await createAuditEvent({
      action: TEAM_AUDIT_ACTION.inviteRevoked,
      actorUserId: user.id,
      workspaceId: workspace.id,
      targetType: 'team_invite',
      targetId: invite.inviteId,
      metadata: {
        inviteId: invite.inviteId,
        status: invite.status,
      },
      request,
      auditLogFn,
    });

    return ok(reply, { invite });
  });

  app.post<{ Params: unknown }>('/api/team/invites/:inviteId/link', async (request, reply) => {
    const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.invite);
    const params = parseInviteParams(request.params);
    const result = await teamInviteServiceApi.regenerateInviteLink({
      workspaceId: workspace.id,
      inviteId: params.inviteId,
      actorUserId: user.id,
    });

    await createAuditEvent({
      action: TEAM_AUDIT_ACTION.inviteLinkRegenerated,
      actorUserId: user.id,
      workspaceId: workspace.id,
      targetType: 'team_invite',
      targetId: result.invite.inviteId,
      metadata: {
        inviteId: result.invite.inviteId,
        email: result.invite.email,
        // Il link contiene il token: nel registro non ci finisce mai.
      },
      request,
      auditLogFn,
    });

    return ok(reply, result);
  });

  const deleteInviteHandler = async (
    request: FastifyRequest<{ Params: unknown }>,
    reply: FastifyReply,
  ) => {
    const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.invite);
    const params = parseInviteParams(request.params);
    const invite = await teamInviteServiceApi.deleteInvite({
      workspaceId: workspace.id,
      inviteId: params.inviteId,
    });

    await createAuditEvent({
      action: TEAM_AUDIT_ACTION.inviteDeleted,
      actorUserId: user.id,
      workspaceId: workspace.id,
      targetType: 'team_invite',
      targetId: invite.inviteId,
      metadata: {
        inviteId: invite.inviteId,
        email: invite.email,
        status: invite.status,
      },
      request,
      auditLogFn,
    });

    return ok(reply, { invite });
  };

  app.delete<{ Params: unknown }>('/api/team/invites/:inviteId', deleteInviteHandler);
  app.post<{ Params: unknown }>('/api/team/invites/:inviteId/delete', deleteInviteHandler);

  app.post<{ Body: unknown }>(
    '/api/team/invites/accept',
    {
      config: {
        rateLimit: {
          max: 12,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      let authenticatedUserId: string | null = null;

      try {
        const identity = await requireAuthIdentityFn(request);
        authenticatedUserId = identity.user.id;
      } catch (error) {
        if (!isHttpError(error) || error.statusCode !== 401) {
          throw error;
        }
      }

      const result = await teamInviteServiceApi.acceptInvite({
        payload: request.body,
        authenticatedUserId,
        clientIp: resolveTeamRequestClientIp(request),
      });

      await createAuditEvent({
        action: TEAM_AUDIT_ACTION.inviteAccepted,
        actorUserId: result.user.id,
        workspaceId: result.workspaceId,
        targetType: 'team_invite',
        targetId: result.inviteId,
        metadata: {
          inviteId: result.inviteId,
          userId: result.user.id,
          membershipId: result.membershipId,
        },
        request,
        auditLogFn,
      });

      return ok(reply, {
        workspaceId: result.workspaceId,
        workspaceSlug: result.workspaceSlug,
        membershipId: result.membershipId,
        accessToken: result.accessToken,
        user: result.user,
      });
    },
  );

  app.get<{ Params: unknown }>('/api/team/:memberId', async (request, reply) => {
    const { workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.view);
    const params = parseMemberParams(request.params);
    const member = await teamServiceApi.getMember(workspace.id, params.memberId);

    return ok(reply, { member });
  });

  app.post<{ Body: unknown }>('/api/team', async (request, reply) => {
    const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.invite);
    const member = await teamServiceApi.createMember({
      workspaceId: workspace.id,
      actorUserId: user.id,
      payload: request.body,
    });

    await createAuditEvent({
      action: TEAM_AUDIT_ACTION.memberAdded,
      actorUserId: user.id,
      workspaceId: workspace.id,
      targetType: 'membership',
      targetId: member.memberId,
      metadata: {
        membershipId: member.memberId,
        userId: member.userId,
        roleNames: member.roles,
      },
      request,
      auditLogFn,
    });

    return ok(reply, { member }, 201);
  });

  app.patch<{ Params: unknown; Body: unknown }>('/api/team/:memberId', async (request, reply) => {
    const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.edit);
    const params = parseMemberParams(request.params);
    const result = await teamServiceApi.updateMember({
      workspaceId: workspace.id,
      memberId: params.memberId,
      payload: request.body,
    });

    await createAuditEvent({
      action: TEAM_AUDIT_ACTION.memberUpdated,
      actorUserId: user.id,
      workspaceId: workspace.id,
      targetType: 'membership',
      targetId: result.member.memberId,
      metadata: {
        membershipId: result.member.memberId,
        fields: result.changes,
      },
      request,
      auditLogFn,
    });

    return ok(reply, result);
  });

  app.post<{ Params: unknown; Body: unknown }>(
    '/api/team/:memberId/deactivate',
    async (request, reply) => {
      const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.deactivate);
      const params = parseMemberParams(request.params);
      const member = await teamServiceApi.setMemberActiveState({
        workspaceId: workspace.id,
        actorUserId: user.id,
        memberId: params.memberId,
        payload: request.body,
      });

      await createAuditEvent({
        action: member.status === 'ACTIVE'
          ? TEAM_AUDIT_ACTION.memberReactivated
          : TEAM_AUDIT_ACTION.memberDeactivated,
        actorUserId: user.id,
        workspaceId: workspace.id,
        targetType: 'membership',
        targetId: member.memberId,
        metadata: {
          membershipId: member.memberId,
          status: member.status,
        },
        request,
        auditLogFn,
      });

      return ok(reply, { member });
    },
  );

  app.post<{ Params: unknown; Body: unknown }>(
    '/api/team/:memberId/roles',
    async (request, reply) => {
      const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.rolesAssign);
      const params = parseMemberParams(request.params);
      const result = await teamServiceApi.assignMemberRoles({
        workspaceId: workspace.id,
        actorUserId: user.id,
        memberId: params.memberId,
        payload: request.body,
      });

      await createAuditEvent({
        action: TEAM_AUDIT_ACTION.rolesChanged,
        actorUserId: user.id,
        workspaceId: workspace.id,
        targetType: 'membership',
        targetId: result.member.memberId,
        metadata: {
          membershipId: result.member.memberId,
          beforeRoleIds: result.beforeRoleIds,
          beforeRoleNames: result.beforeRoleNames,
          afterRoleIds: result.afterRoleIds,
          afterRoleNames: result.afterRoleNames,
        },
        request,
        auditLogFn,
      });

      return ok(reply, { member: result.member });
    },
  );

  const removeMemberHandler = async (
    request: FastifyRequest<{ Params: unknown }>,
    reply: FastifyReply,
  ) => {
    const { user, workspace } = await ensureTeamAccessFn(request, TEAM_PERMISSIONS.deactivate);
    const params = parseMemberParams(request.params);
    const result = await teamServiceApi.removeMember({
      workspaceId: workspace.id,
      actorUserId: user.id,
      memberId: params.memberId,
    });

    await createAuditEvent({
      action: TEAM_AUDIT_ACTION.memberDeleted,
      actorUserId: user.id,
      workspaceId: workspace.id,
      targetType: 'membership',
      targetId: result.member.memberId,
      metadata: {
        membershipId: result.member.memberId,
        userId: result.member.userId,
      },
      request,
      auditLogFn,
    });

    return ok(reply, result);
  };

  app.delete<{ Params: unknown }>('/api/team/:memberId', removeMemberHandler);
  app.post<{ Params: unknown }>('/api/team/:memberId/remove', removeMemberHandler);
};

const workspaceTeamRoute = buildWorkspaceTeamRoute();

export default workspaceTeamRoute;
