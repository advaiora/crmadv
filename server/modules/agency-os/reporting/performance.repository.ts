import { Prisma } from '@prisma/client';
import type { PerformanceScopeLevel, PerformanceSource } from '@prisma/client';
import { prisma } from '../../../prisma.js';

// Accesso dati del serbatoio "Reportistica multi-sorgente" (Agency, V6):
// rilevazioni di performance (storico) e set di metriche salvabili ("carne'").
// A differenza di agency.repository.ts (SQL raw + guardie schema-ready, retaggio
// dell'epoca db-push), queste tabelle nascono da migrazione tracciata, quindi si
// usa direttamente il client Prisma tipizzato.

const SNAPSHOT_LIST_DEFAULT_LIMIT = 200;

export const performanceRepository = {
  // Le rilevazioni sono legate a un progetto: si verifica che il progetto
  // appartenga al workspace prima di leggere/scrivere il suo storico.
  async projectExistsInWorkspace(workspaceId: string, projectId: string): Promise<boolean> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });

    return project !== null;
  },

  async listProjectSnapshots(input: {
    workspaceId: string;
    projectId: string;
    source?: PerformanceSource;
    limit?: number;
  }) {
    return prisma.performanceSnapshot.findMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        ...(input.source ? { source: input.source } : {}),
      },
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      take: input.limit ?? SNAPSHOT_LIST_DEFAULT_LIMIT,
    });
  },

  async findSnapshot(input: { workspaceId: string; projectId: string; snapshotId: string }) {
    return prisma.performanceSnapshot.findFirst({
      where: {
        id: input.snapshotId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      },
    });
  },

  async createSnapshot(input: {
    workspaceId: string;
    projectId: string;
    source: PerformanceSource;
    sourceLabel: string | null;
    scopeLevel: PerformanceScopeLevel;
    periodStart: Date;
    periodEnd: Date;
    metrics: Prisma.InputJsonValue;
    campaignRefs: string[];
    contextEvent: string | null;
    tags: string[];
    createdByUserId: string | null;
  }) {
    return prisma.performanceSnapshot.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        source: input.source,
        sourceLabel: input.sourceLabel,
        scopeLevel: input.scopeLevel,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        metrics: input.metrics,
        campaignRefs: input.campaignRefs,
        contextEvent: input.contextEvent,
        tags: input.tags,
        createdByUserId: input.createdByUserId,
      },
    });
  },

  // deleteMany con lo scoping a workspace: non elimina mai rilevazioni di un
  // altro workspace anche se l'id fosse indovinato.
  async deleteSnapshot(input: { workspaceId: string; snapshotId: string }): Promise<number> {
    const result = await prisma.performanceSnapshot.deleteMany({
      where: { id: input.snapshotId, workspaceId: input.workspaceId },
    });

    return result.count;
  },

  async listMetricSets(workspaceId: string) {
    return prisma.performanceMetricSet.findMany({
      where: { workspaceId },
      orderBy: [{ name: 'asc' }],
    });
  },

  async findMetricSet(input: { workspaceId: string; id: string }) {
    return prisma.performanceMetricSet.findFirst({
      where: { id: input.id, workspaceId: input.workspaceId },
    });
  },

  async createMetricSet(input: {
    workspaceId: string;
    name: string;
    icon: string | null;
    metrics: string[];
    createdByUserId: string | null;
  }) {
    return prisma.performanceMetricSet.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        icon: input.icon,
        metrics: input.metrics,
        createdByUserId: input.createdByUserId,
      },
    });
  },

  // updateMany/deleteMany con lo scoping a workspace nel where (come sopra).
  async updateMetricSet(input: {
    workspaceId: string;
    id: string;
    data: { name?: string; icon?: string | null; metrics?: string[] };
  }): Promise<number> {
    const result = await prisma.performanceMetricSet.updateMany({
      where: { id: input.id, workspaceId: input.workspaceId },
      data: input.data,
    });

    return result.count;
  },

  async deleteMetricSet(input: { workspaceId: string; id: string }): Promise<number> {
    const result = await prisma.performanceMetricSet.deleteMany({
      where: { id: input.id, workspaceId: input.workspaceId },
    });

    return result.count;
  },
};
