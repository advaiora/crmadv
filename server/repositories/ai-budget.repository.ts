import { prisma } from '../prisma.js';

// Budget di spesa AI giornaliero (V4 — cost control). La tabella AiBudget contiene
// una riga per dipendente (override) più una riga "default" del workspace, marcata
// da questo userId sentinella (non è un vero utente). Vedi commento nello schema.
export const AI_BUDGET_DEFAULT_USER = '__workspace_default__';

export type ResolvedBudget = {
  // Limite giornaliero in USD applicabile all'utente (0 = nessun limite).
  dailyLimitUsd: number;
  // Da dove viene il limite: override personale o default del workspace.
  source: 'user' | 'default' | 'none';
};

export const aiBudgetRepository = {
  // Tutte le righe budget del workspace (default + override).
  listByWorkspace(workspaceId: string) {
    return prisma.aiBudget.findMany({ where: { workspaceId } });
  },

  // Limite applicabile a un utente: override personale se presente, altrimenti il
  // default del workspace, altrimenti nessun limite.
  async resolveLimitForUser(workspaceId: string, userId: string): Promise<ResolvedBudget> {
    const rows = await prisma.aiBudget.findMany({
      where: { workspaceId, userId: { in: [userId, AI_BUDGET_DEFAULT_USER] } },
    });
    const override = rows.find((row) => row.userId === userId);
    if (override) {
      return { dailyLimitUsd: override.dailyLimitUsd, source: 'user' };
    }
    const fallback = rows.find((row) => row.userId === AI_BUDGET_DEFAULT_USER);
    if (fallback) {
      return { dailyLimitUsd: fallback.dailyLimitUsd, source: 'default' };
    }
    return { dailyLimitUsd: 0, source: 'none' };
  },

  // Imposta (crea o aggiorna) un limite. userId può essere AI_BUDGET_DEFAULT_USER.
  upsert(workspaceId: string, userId: string, dailyLimitUsd: number) {
    return prisma.aiBudget.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, dailyLimitUsd },
      update: { dailyLimitUsd },
    });
  },

  // Rimuove un limite (per l'utente torna valido il default del workspace).
  async remove(workspaceId: string, userId: string) {
    await prisma.aiBudget.deleteMany({ where: { workspaceId, userId } });
  },
};
