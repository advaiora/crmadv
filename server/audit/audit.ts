import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { auditRepository } from '../repositories/audit.repository.js';

type AuditEventInput = {
  event: string;
  actorUserId?: string;
  workspaceId: string;
  metadata?: Prisma.InputJsonValue;
  entityType?: string;
  entityId?: string;
  request?: FastifyRequest;
};

const readHeader = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const audit = {
  log(input: AuditEventInput) {
    const ipAddress = input.request?.ip;
    const userAgent = readHeader(input.request?.headers['user-agent']);

    return auditRepository.create({
      action: input.event,
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      metadata: input.metadata,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress,
      userAgent,
    });
  },
};
