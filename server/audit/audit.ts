import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { auditRepository } from '../repositories/audit.repository.js';
import { requestContext } from '../core/request-context.js';

type AuditEventInput = {
  event?: string;
  action?: string;
  actorUserId?: string;
  workspaceId: string;
  metadata?: Prisma.InputJsonValue;
  entityType?: string;
  entityId?: string;
  targetType?: string;
  targetId?: string;
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
    const action = input.action ?? input.event;
    if (!action) {
      throw new Error('audit.log requires action/event');
    }

    const ipAddress = input.request?.ip;
    const userAgent = readHeader(input.request?.headers['user-agent']);
    const entityType = input.targetType ?? input.entityType;
    const entityId = input.targetId ?? input.entityId;

    // Questa annotazione è scritta a mano e porta un significato che
    // l'intercettore automatico non saprebbe ricavare dalla sola riga cambiata:
    // segnalando il bersaglio come «già coperto», l'automatica corrispondente
    // viene scartata a fine richiesta invece di raddoppiare la voce.
    // Vedi server/audit/audit-interceptor.ts.
    if (entityType) {
      requestContext.markManualAudit(entityType, entityId);
    }

    return auditRepository.create({
      action,
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      metadata: input.metadata,
      entityType,
      entityId,
      ipAddress,
      userAgent,
    });
  },
};
