import { Prisma } from '@prisma/client';
import type { PerformanceScopeLevel, PerformanceSource } from '@prisma/client';
import { prisma } from '../../../prisma.js';

// Accesso dati del serbatoio "Reportistica multi-sorgente" (Agency, V6):
// rilevazioni di performance (storico) e set di metriche salvabili ("carne'").
// A differenza di agency.repository.ts (SQL raw + guardie schema-ready, retaggio
// dell'epoca db-push), queste tabelle nascono da migrazione tracciata, quindi si
// usa direttamente il client Prisma tipizzato.

const SNAPSHOT_LIST_DEFAULT_LIMIT = 200;

// Permette a un metodo di scrivere sia sul client globale sia dentro una
// transazione (`prisma.$transaction`), passando `tx`. Stesso schema gia' usato
// altrove nel progetto (team/checklists repository).
const withClient = (tx?: Prisma.TransactionClient) => tx ?? prisma;

export const performanceRepository = {
  // Esegue piu' scritture in un'unica transazione (tutto o niente). Usato dal
  // commit Excel (piu' mesi insieme) e dalla sostituzione anti-doppione.
  async withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  },

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

  async createSnapshot(
    input: {
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
    },
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).performanceSnapshot.create({
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

  // Anti-doppione: tra i periodi (primo del mese) passati, quali esistono gia'
  // per questa fonte/progetto. Il criterio e' (workspace, progetto, fonte,
  // periodStart): sia i connettori ("aggiorna ora" = mese corrente) sia l'Excel
  // (aggregazione per mese) producono sempre il primo del mese come periodStart,
  // quindi identifica il "mese gia' caricato" a prescindere dal periodEnd.
  async findExistingPeriodStarts(input: {
    workspaceId: string;
    projectId: string;
    source: PerformanceSource;
    periodStarts: Date[];
  }): Promise<Date[]> {
    if (input.periodStarts.length === 0) {
      return [];
    }
    const rows = await prisma.performanceSnapshot.findMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        source: input.source,
        periodStart: { in: input.periodStarts },
      },
      select: { periodStart: true },
      distinct: ['periodStart'],
    });

    return rows.map((row) => row.periodStart);
  },

  // Cancella (in blocco, opzionalmente dentro una transazione) le rilevazioni di
  // una fonte/progetto per i periodi indicati. Usato dalla "Sostituzione": si
  // cancellano i mesi che si sta per riscrivere, non tutto lo storico.
  async deleteSnapshotsByPeriodStarts(
    input: {
      workspaceId: string;
      projectId: string;
      source: PerformanceSource;
      periodStarts: Date[];
    },
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (input.periodStarts.length === 0) {
      return 0;
    }
    const result = await withClient(tx).performanceSnapshot.deleteMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        source: input.source,
        periodStart: { in: input.periodStarts },
      },
    });

    return result.count;
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
