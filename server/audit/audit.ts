import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { auditRepository } from '../repositories/audit.repository.js';
import { requestContext } from '../core/request-context.js';

type AuditEventBase = {
  event?: string;
  action?: string;
  actorUserId?: string;
  workspaceId: string;
  metadata?: Prisma.InputJsonValue;
  request?: FastifyRequest;
};

// Il bersaglio è OBBLIGATORIO, e a imporlo è il tipo, non la buona volontà.
// Due motivi, ed entrambi si erano già visti rotti:
//
// 1. Senza `entityType` l'annotazione a mano non scarta la gemella automatica
//    (vedi markManualAudit): in tabella comparivano due righe per lo stesso
//    fatto, in certi casi con lo stesso identico nome.
// 2. Senza `entityType` la riga non è filtrabile per bersaglio nella pagina del
//    Registro attività, che filtra proprio su quel campo.
//
// I due nomi sono sinonimi storici — `targetType`/`targetId` è la forma più
// vecchia, rimasta in tre punti — e se ne indica uno solo.
type AuditEventTarget =
  | { entityType: string; entityId?: string; targetType?: never; targetId?: never }
  | { targetType: string; targetId?: string; entityType?: never; entityId?: never };

type AuditEventInput = AuditEventBase & AuditEventTarget;

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
    // Senza `entityId` il segno copre tutto il tipo, per questa sola richiesta:
    // serve alle annotazioni che riassumono più righe insieme («ha assegnato i
    // membri del reparto»). Vedi server/audit/audit-interceptor.ts.
    requestContext.markManualAudit(entityType, entityId);

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
