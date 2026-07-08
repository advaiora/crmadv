import { prisma } from '../prisma.js';

export type AiUsageLogInput = {
  workspaceId: string;
  functionName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  status: string;
};

export const aiUsageRepository = {
  create(data: AiUsageLogInput) {
    return prisma.aiUsageLog.create({ data });
  },

  // Aggregato per workspace (opzionalmente da una data in poi).
  aggregateByWorkspace(since?: Date) {
    return prisma.aiUsageLog.groupBy({
      by: ['workspaceId'],
      where: since ? { createdAt: { gte: since } } : undefined,
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
  },

  // Totali complessivi (tutti i workspace) nel periodo.
  totals(since?: Date) {
    return prisma.aiUsageLog.aggregate({
      where: since ? { createdAt: { gte: since } } : undefined,
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    });
  },

  recentLogs(limit: number) {
    return prisma.aiUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
