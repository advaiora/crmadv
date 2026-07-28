import { Prisma } from '@prisma/client';
import type { PerformanceMetricSet, PerformanceSnapshot } from '@prisma/client';
import { z } from 'zod';
import { badRequest, notFound } from '../../../core/errors.js';
import { performanceRepository } from './performance.repository.js';

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
