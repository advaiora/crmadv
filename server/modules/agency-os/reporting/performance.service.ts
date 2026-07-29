import { Prisma } from '@prisma/client';
import type { PerformanceMetricSet, PerformanceSnapshot, PerformanceSource } from '@prisma/client';
import { z } from 'zod';
import { badRequest, conflict, notFound } from '../../../core/errors.js';
import { performanceRepository } from './performance.repository.js';
import { getConnector, listConnectorDescriptors } from './performance-connectors.js';

// Logica del serbatoio "Reportistica multi-sorgente" (Agency, V6): valida gli
// input (Zod), applica lo scoping a workspace/progetto e orchestra il repository.
// Decisione chiusa (report-multisorgente-decisioni.md): nel serbatoio si cattura
// TUTTO il grezzo -> `metrics` e' un oggetto JSON libero, la selezione delle
// metriche da mostrare vive nei set/carne', non qui.

const SOURCE_VALUES = ['GOOGLE_ADS', 'META_ADS', 'EXCEL'] as const;
const SCOPE_LEVEL_VALUES = ['ACCOUNT', 'CAMPAIGN_GROUP', 'CAMPAIGN', 'AD_SET'] as const;

const createSnapshotBodySchema = z
  .object({
    source: z.enum(SOURCE_VALUES),
    sourceLabel: z.string().trim().max(160).optional(),
    scopeLevel: z.enum(SCOPE_LEVEL_VALUES).optional().default('ACCOUNT'),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    // Set ampio di metriche grezze: oggetto libero (chiave -> valore).
    metrics: z.record(z.string(), z.unknown()),
    campaignRefs: z.array(z.string().trim().min(1).max(200)).optional().default([]),
    contextEvent: z.string().trim().max(200).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: 'La fine del periodo deve essere successiva o uguale all\'inizio.',
    path: ['periodEnd'],
  });

const listSnapshotsQuerySchema = z.object({
  source: z.enum(SOURCE_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

// "Aggiorna ora": si rileva una nuova fotografia da un connettore (solo le sorgenti
// a connettore, non l'Excel). Il periodo e' l'unica parte obbligatoria (massima
// elasticita', come deciso per lo storico).
const refreshSnapshotBodySchema = z
  .object({
    source: z.enum(['GOOGLE_ADS', 'META_ADS']),
    scopeLevel: z.enum(SCOPE_LEVEL_VALUES).optional().default('ACCOUNT'),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    contextEvent: z.string().trim().max(200).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: 'La fine del periodo deve essere successiva o uguale all\'inizio.',
    path: ['periodEnd'],
  });

const createMetricSetBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().min(1).max(60).optional(),
  metrics: z.array(z.string().trim().min(1).max(120)).optional().default([]),
});

const updateMetricSetBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    icon: z.string().trim().max(60).nullable().optional(),
    metrics: z.array(z.string().trim().min(1).max(120)).optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.icon !== undefined || data.metrics !== undefined,
    { message: 'Nessun campo da aggiornare.' },
  );

const mapSnapshot = (row: PerformanceSnapshot) => ({
  id: row.id,
  projectId: row.projectId,
  source: row.source,
  sourceLabel: row.sourceLabel,
  scopeLevel: row.scopeLevel,
  periodStart: row.periodStart.toISOString(),
  periodEnd: row.periodEnd.toISOString(),
  metrics: row.metrics,
  campaignRefs: row.campaignRefs,
  contextEvent: row.contextEvent,
  tags: row.tags,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
});

const mapMetricSet = (row: PerformanceMetricSet) => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  metrics: row.metrics,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const ensureProjectInWorkspace = async (workspaceId: string, projectId: string) => {
  const exists = await performanceRepository.projectExistsInWorkspace(workspaceId, projectId);
  if (!exists) {
    throw notFound('Progetto non trovato.');
  }
};

// Il vincolo @@unique([workspaceId, name]) sui carne' fa scattare P2002 su nome
// duplicato: lo traduciamo in un 400 leggibile invece di un 500 opaco.
const toReadableError = (error: unknown): unknown => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return badRequest('Esiste gia\' un set di metriche con questo nome.');
  }

  return error;
};

export const performanceReportingService = {
  async listProjectSnapshots(input: { workspaceId: string; projectId: string; query: unknown }) {
    const parsed = listSnapshotsQuerySchema.safeParse(input.query ?? {});
    if (!parsed.success) {
      throw badRequest('Parametri di ricerca non validi.', { issues: parsed.error.flatten() });
    }

    await ensureProjectInWorkspace(input.workspaceId, input.projectId);

    const snapshots = await performanceRepository.listProjectSnapshots({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      source: parsed.data.source,
      limit: parsed.data.limit,
    });

    return snapshots.map(mapSnapshot);
  },

  async createProjectSnapshot(input: {
    workspaceId: string;
    projectId: string;
    userId: string | null;
    body: unknown;
  }) {
    const parsed = createSnapshotBodySchema.safeParse(input.body);
    if (!parsed.success) {
      throw badRequest('Dati della rilevazione non validi.', { issues: parsed.error.flatten() });
    }

    await ensureProjectInWorkspace(input.workspaceId, input.projectId);

    const created = await performanceRepository.createSnapshot({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      source: parsed.data.source,
      sourceLabel: parsed.data.sourceLabel ?? null,
      scopeLevel: parsed.data.scopeLevel,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      metrics: parsed.data.metrics as Prisma.InputJsonValue,
      campaignRefs: parsed.data.campaignRefs,
      contextEvent: parsed.data.contextEvent ?? null,
      tags: parsed.data.tags,
      createdByUserId: input.userId,
    });

    return mapSnapshot(created);
  },

  // Descrittori dei connettori per le card della dashboard (stato/simulato).
  listConnectors() {
    return listConnectorDescriptors();
  },

  // "Aggiorna ora": interroga il connettore (per ora stub) e SALVA una nuova
  // rilevazione datata. Coerente con la decisione "snapshot a comando": lo storico
  // si accumula a ogni aggiornamento manuale, non si sovrascrive.
  async refreshProjectSnapshot(input: {
    workspaceId: string;
    projectId: string;
    userId: string | null;
    body: unknown;
  }) {
    const parsed = refreshSnapshotBodySchema.safeParse(input.body);
    if (!parsed.success) {
      throw badRequest('Dati dell\'aggiornamento non validi.', { issues: parsed.error.flatten() });
    }

    await ensureProjectInWorkspace(input.workspaceId, input.projectId);

    const connector = getConnector(parsed.data.source);
    const fetched = connector.fetchMetrics({
      projectId: input.projectId,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
    });

    // Decisione approvata (report-multisorgente-decisioni.md): ogni "aggiorna ora"
    // lascia una rilevazione datata e NON sovrascrive lo storico. L'anti-doppione
    // dei totali (piu' fotografie dello stesso mese) e' risolto in visualizzazione
    // tenendo solo la fotografia piu' recente per mese/fonte (latestPerMonthSource),
    // non cancellando in scrittura.
    const created = await performanceRepository.createSnapshot({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      source: parsed.data.source,
      sourceLabel: fetched.sourceLabel,
      scopeLevel: parsed.data.scopeLevel,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      metrics: fetched.metrics as Prisma.InputJsonValue,
      campaignRefs: [],
      contextEvent: parsed.data.contextEvent ?? null,
      tags: parsed.data.tags,
      createdByUserId: input.userId,
    });

    return mapSnapshot(created);
  },

  // Usato dall'anteprima Excel: tra i mesi che verrebbero importati, quali sono
  // gia' presenti nel serbatoio per questa fonte/progetto. Ritorna gli stessi ISO
  // ricevuti in input (quelli esistenti), cosi' il frontend li confronta 1:1 con
  // i periodStart delle righe in anteprima.
  async findExistingProjectPeriods(input: {
    workspaceId: string;
    projectId: string;
    source: PerformanceSource;
    periodStarts: string[];
  }): Promise<string[]> {
    const existing = await performanceRepository.findExistingPeriodStarts({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      source: input.source,
      periodStarts: input.periodStarts.map((iso) => new Date(iso)),
    });
    const existingTimes = new Set(existing.map((date) => date.getTime()));
    return input.periodStarts.filter((iso) => existingTimes.has(new Date(iso).getTime()));
  },

  // Commit transazionale degli snapshot Excel (uno per mese): o tutti o nessuno.
  // Con replace=true cancella prima le rilevazioni EXCEL degli stessi mesi
  // (anti-doppione mirato); senza replace, se trova mesi gia' presenti, 409.
  async commitExcelSnapshots(input: {
    workspaceId: string;
    projectId: string;
    userId: string | null;
    sourceLabel: string | null;
    contextEvent: string | null;
    tags: string[];
    snapshots: Array<{ periodStart: string; periodEnd: string; metrics: Record<string, number> }>;
    replace: boolean;
  }) {
    await ensureProjectInWorkspace(input.workspaceId, input.projectId);

    const rows = input.snapshots.map((snapshot) => ({
      periodStart: new Date(snapshot.periodStart),
      periodEnd: new Date(snapshot.periodEnd),
      metrics: snapshot.metrics,
    }));
    const periodStarts = rows.map((row) => row.periodStart);

    const existing = await performanceRepository.findExistingPeriodStarts({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      source: 'EXCEL',
      periodStarts,
    });
    if (existing.length > 0 && !input.replace) {
      throw conflict('Alcuni mesi di questo file sono gia\' presenti nel serbatoio.', {
        reason: 'duplicate_period',
        source: 'EXCEL',
        existingCount: existing.length,
      });
    }

    const created = await performanceRepository.withTransaction(async (tx) => {
      if (input.replace && existing.length > 0) {
        await performanceRepository.deleteSnapshotsByPeriodStarts(
          {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            source: 'EXCEL',
            periodStarts,
          },
          tx,
        );
      }
      const out = [];
      for (const row of rows) {
        const createdRow = await performanceRepository.createSnapshot(
          {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            source: 'EXCEL',
            sourceLabel: input.sourceLabel,
            scopeLevel: 'ACCOUNT',
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            metrics: row.metrics as Prisma.InputJsonValue,
            campaignRefs: [],
            contextEvent: input.contextEvent,
            tags: input.tags,
            createdByUserId: input.userId,
          },
          tx,
        );
        out.push(createdRow);
      }
      return out;
    });

    return { created: created.map(mapSnapshot), replaced: input.replace ? existing.length : 0 };
  },

  async deleteProjectSnapshot(input: { workspaceId: string; projectId: string; snapshotId: string }) {
    const snapshot = await performanceRepository.findSnapshot({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      snapshotId: input.snapshotId,
    });
    if (!snapshot) {
      throw notFound('Rilevazione non trovata.');
    }

    await performanceRepository.deleteSnapshot({
      workspaceId: input.workspaceId,
      snapshotId: input.snapshotId,
    });

    return { id: snapshot.id };
  },

  async listMetricSets(input: { workspaceId: string }) {
    const sets = await performanceRepository.listMetricSets(input.workspaceId);
    return sets.map(mapMetricSet);
  },

  async createMetricSet(input: { workspaceId: string; userId: string | null; body: unknown }) {
    const parsed = createMetricSetBodySchema.safeParse(input.body);
    if (!parsed.success) {
      throw badRequest('Dati del set di metriche non validi.', { issues: parsed.error.flatten() });
    }

    try {
      const created = await performanceRepository.createMetricSet({
        workspaceId: input.workspaceId,
        name: parsed.data.name,
        icon: parsed.data.icon ?? null,
        metrics: parsed.data.metrics,
        createdByUserId: input.userId,
      });

      return mapMetricSet(created);
    } catch (error) {
      throw toReadableError(error);
    }
  },

  async updateMetricSet(input: { workspaceId: string; id: string; body: unknown }) {
    const parsed = updateMetricSetBodySchema.safeParse(input.body);
    if (!parsed.success) {
      throw badRequest('Dati del set di metriche non validi.', { issues: parsed.error.flatten() });
    }

    const existing = await performanceRepository.findMetricSet({
      workspaceId: input.workspaceId,
      id: input.id,
    });
    if (!existing) {
      throw notFound('Set di metriche non trovato.');
    }

    try {
      await performanceRepository.updateMetricSet({
        workspaceId: input.workspaceId,
        id: input.id,
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
          ...(parsed.data.metrics !== undefined ? { metrics: parsed.data.metrics } : {}),
        },
      });
    } catch (error) {
      throw toReadableError(error);
    }

    const updated = await performanceRepository.findMetricSet({
      workspaceId: input.workspaceId,
      id: input.id,
    });

    return mapMetricSet(updated ?? existing);
  },

  async deleteMetricSet(input: { workspaceId: string; id: string }) {
    const existing = await performanceRepository.findMetricSet({
      workspaceId: input.workspaceId,
      id: input.id,
    });
    if (!existing) {
      throw notFound('Set di metriche non trovato.');
    }

    await performanceRepository.deleteMetricSet({
      workspaceId: input.workspaceId,
      id: input.id,
    });

    return { id: existing.id };
  },
};
