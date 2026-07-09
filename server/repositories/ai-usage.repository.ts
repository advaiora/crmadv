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
// `since` limita al periodo, gli altri restringono per utente/modello/funzione.
export type AiUsageFilter = {
  since?: Date;
  userId?: string;
  model?: string;
  functionName?: string;
};

const buildWhere = (filter: AiUsageFilter): Prisma.AiUsageLogWhereInput => {
  const where: Prisma.AiUsageLogWhereInput = {};
  if (filter.since) {
    where.createdAt = { gte: filter.since };
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

  // Totali complessivi (tutti i workspace) nel periodo/filtri indicati.
  totals(filter: AiUsageFilter = {}) {
    return prisma.aiUsageLog.aggregate({
      where: buildWhere(filter),
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
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
