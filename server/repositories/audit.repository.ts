import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

type CreateAuditLogInput = {
  action: string;
  actorUserId?: string;
  workspaceId: string;
  metadata?: Prisma.InputJsonValue;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const auditListSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actorUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export const auditRepository = {
  create(input: CreateAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        metadata: input.metadata,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      select: {
        id: true,
      },
    });
  },

  listRecentByWorkspace(workspaceId: string, limit = 6) {
    return prisma.auditLog.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.max(1, Math.min(limit, 20)),
      select: auditListSelect,
    });
  },
};
