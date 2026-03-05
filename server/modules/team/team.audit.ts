import type { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { audit } from '../../audit/audit.js';

export const TEAM_AUDIT_ACTION = {
  inviteSent: 'team.invite',
  inviteRevoked: 'team.invite_revoked',
  inviteDeleted: 'team.invite_deleted',
  inviteAccepted: 'team.invite_accepted',
  memberAdded: 'team.member_added',
  memberUpdated: 'team.member_updated',
  memberDeactivated: 'team.deactivate',
  memberReactivated: 'team.member_reactivated',
  memberDeleted: 'team.member_deleted',
  rolesChanged: 'team.roles_assign',
} as const;

type TeamAuditAction = (typeof TEAM_AUDIT_ACTION)[keyof typeof TEAM_AUDIT_ACTION];

type TeamAuditInput = {
  action: TeamAuditAction;
  workspaceId: string;
  actorUserId?: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
  request?: FastifyRequest;
  auditLogFn?: typeof audit.log;
};

export const createAuditEvent = (input: TeamAuditInput) => {
  const logFn = input.auditLogFn ?? audit.log;

  return logFn({
    event: input.action,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    entityType: input.targetType,
    entityId: input.targetId,
    metadata: input.metadata,
    request: input.request,
  });
};
