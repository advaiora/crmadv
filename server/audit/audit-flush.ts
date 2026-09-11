// Svuotamento della coda di registrazioni raccolte dall'intercettore (CRMA-28).
//
// Sta in un file suo, e non dentro audit-interceptor.ts, per non creare un
// import circolare: prisma.ts importa l'estensione dall'intercettore, quindi
// l'intercettore non può a sua volta importare prisma.ts. Qui invece si può,
// perché di questo file prisma.ts non sa niente.

import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '../prisma.js';
import { requestContext, type PendingAuditEntry, type RequestStore } from '../core/request-context.js';

type FlushInput = {
  store?: RequestStore;
  // Quando la richiesta è finita male non si scrive niente: una transazione
  // annullata lascia in coda registrazioni di scritture che non esistono più.
  succeeded: boolean;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  log?: Pick<FastifyBaseLogger, 'warn'>;
};

const toAuditRow = (entry: PendingAuditEntry, input: FlushInput) => ({
  action: entry.action,
  workspaceId: entry.workspaceId,
  actorUserId: entry.actorUserId ?? undefined,
  entityType: entry.entityType,
  entityId: entry.entityId ?? undefined,
  ipAddress: input.ipAddress,
  userAgent: input.userAgent,
  metadata: {
    // `origin: 'auto'` distingue a colpo d'occhio ciò che ha scritto
    // l'intercettore da ciò che qualcuno ha annotato a mano con un significato
    // suo. Serve a chi legge il registro e a chi un domani volesse smettere di
    // annotare a mano una certa cosa.
    origin: 'auto',
    operation: entry.operation,
    ...(entry.affectedCount > 1 ? { affectedCount: entry.affectedCount } : {}),
    ...(input.route ? { route: input.route } : {}),
  },
});

/**
 * Scrive in una volta sola le registrazioni accumulate durante la richiesta.
 *
 * Non solleva mai: se il registro non si riesce a scrivere lo si segnala nel log
 * dell'applicazione, ma la richiesta è già stata servita e non si rovina una
 * risposta riuscita per un problema di registrazione.
 */
export const flushRequestAuditTrail = async (input: FlushInput): Promise<number> => {
  const { entries, dropped } = requestContext.drainPendingAuditEntries(input.store);

  if (!input.succeeded || entries.length === 0) {
    return 0;
  }

  try {
    const result = await prisma.auditLog.createMany({
      data: entries.map((entry) => toAuditRow(entry, input)),
    });

    if (dropped > 0) {
      input.log?.warn(
        {
          route: input.route,
          written: result.count,
          dropped,
        },
        'Registro attività: superato il tetto di registrazioni automatiche per richiesta',
      );
    }

    return result.count;
  } catch (error) {
    input.log?.warn(
      {
        route: input.route,
        pending: entries.length,
        err: error,
      },
      'Registro attività: registrazioni automatiche non scritte',
    );
    return 0;
  }
};
