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
};
