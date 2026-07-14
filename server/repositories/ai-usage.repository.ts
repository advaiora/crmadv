import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

export type AiUsageLogInput = {
  workspaceId: string;
  userId?: string | null;
  functionName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  status: string;
};

// Filtri applicabili alle aggregazioni dei consumi AI. Tutti opzionali:
// `since` limita al periodo, gli altri restringono per workspace/utente/modello/funzione.
// `workspaceId` serve alla vista consumi per-workspace di Agency (la Console
// piattaforma lo lascia assente per aggregare su tutti i workspace).
export type AiUsageFilter = {
  since?: Date;
  workspaceId?: string;
  userId?: string;
  model?: string;
  functionName?: string;
};

const buildWhere = (filter: AiUsageFilter): Prisma.AiUsageLogWhereInput => {
  const where: Prisma.AiUsageLogWhereInput = {};
  if (filter.since) {
    where.createdAt = { gte: filter.since };
  }
  if (filter.workspaceId) {
    where.workspaceId = filter.workspaceId;
  }
  if (filter.userId) {
    where.userId = filter.userId;
  }
  if (filter.model) {
    where.model = filter.model;
  }
  if (filter.functionName) {
    where.functionName = filter.functionName;
  }
  return where;
};

export const aiUsageRepository = {
  create(data: AiUsageLogInput) {
    return prisma.aiUsageLog.create({ data });
  },

  // Aggregato per workspace nel periodo/filtri indicati.
  aggregateByWorkspace(filter: AiUsageFilter = {}) {
    return prisma.aiUsageLog.groupBy({
      by: ['workspaceId'],
      where: buildWhere(filter),
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
  },

  // Aggregato per utente nel periodo/filtri indicati (userId può essere null).
  aggregateByUser(filter: AiUsageFilter = {}) {
    return prisma.aiUsageLog.groupBy({
      by: ['userId'],
      where: buildWhere(filter),
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
  },

  // Aggregato per funzione AI nel periodo/filtri indicati. Alimenta la vista
  // consumi per-workspace (rendiconto per funzione) e, in prospettiva, le stime
  // di costo mostrate sui pulsanti AI.
  aggregateByFunction(filter: AiUsageFilter = {}) {
    return prisma.aiUsageLog.groupBy({
      by: ['functionName'],
      where: buildWhere(filter),
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
  },

  // Totali complessivi (tutti i workspace) nel periodo/filtri indicati.
  totals(filter: AiUsageFilter = {}) {
    return prisma.aiUsageLog.aggregate({
      where: buildWhere(filter),
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    });
  },

  // Somma del costo AI (USD) per un utente in un workspace a partire da `since`.
  // Usata dal controllo budget giornaliero (spesa già accumulata oggi).
  async sumCostForUser(workspaceId: string, userId: string, since: Date): Promise<number> {
    const result = await prisma.aiUsageLog.aggregate({
      where: { workspaceId, userId, createdAt: { gte: since } },
      _sum: { costUsd: true },
    });
    return result._sum.costUsd ?? 0;
  },

  // Costo AI (USD) per utente in un workspace da `since`, in un'unica query.
  // Usato dalla config budget per mostrare la spesa odierna di ogni dipendente.
  async sumCostByUserSince(workspaceId: string, since: Date): Promise<Record<string, number>> {
    const rows = await prisma.aiUsageLog.groupBy({
      by: ['userId'],
      where: { workspaceId, createdAt: { gte: since }, userId: { not: null } },
      _sum: { costUsd: true },
    });
    const result: Record<string, number> = {};
    for (const row of rows) {
      if (row.userId) {
        result[row.userId] = row._sum.costUsd ?? 0;
      }
    }
    return result;
  },

  // Campioni di token delle ultime chiamate riuscite di una funzione in un
  // workspace. Alimenta la stima di costo dei pulsanti AI: dai token storici
  // (stabili a parità di funzione) si ricava il costo col modello corrente.
  recentSuccessSamples(workspaceId: string, functionName: string, limit: number) {
    return prisma.aiUsageLog.findMany({
      where: { workspaceId, functionName, status: 'success' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { inputTokens: true, outputTokens: true },
    });
  },

  recentLogs(filter: AiUsageFilter, limit: number) {
    return prisma.aiUsageLog.findMany({
      where: buildWhere(filter),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  // Valori distinti per popolare i menu dei filtri (nel periodo).
  distinctModels(filter: AiUsageFilter = {}) {
    return prisma.aiUsageLog.findMany({
      where: buildWhere(filter),
      distinct: ['model'],
      select: { model: true },
      orderBy: { model: 'asc' },
    });
  },

  distinctFunctions(filter: AiUsageFilter = {}) {
    return prisma.aiUsageLog.findMany({
      where: buildWhere(filter),
      distinct: ['functionName'],
      select: { functionName: true },
      orderBy: { functionName: 'asc' },
    });
  },

  usersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
  },
};
