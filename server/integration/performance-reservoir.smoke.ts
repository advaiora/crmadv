import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../app.js';
import { bootstrapRuntime } from '../bootstrap/startup.js';
import { initializePrisma, prisma, resetPrismaForTests } from '../prisma.js';
import { performanceRepository } from '../modules/agency-os/reporting/performance.repository.js';
import { performanceReportingService } from '../modules/agency-os/reporting/performance.service.js';

// Smoke test del serbatoio "Reportistica multi-sorgente" (Agency, V6):
// 1) gli endpoint sono registrati e protetti (401 senza auth, mai 500);
// 2) round-trip reale contro Postgres via il repository (create/list/unique/
//    rename/delete + scoping), su workspace e progetto temporanei ripuliti a fine.

const TEST_HOST = '127.0.0.1';

const startTestServer = async () => {
  const app = createApp({ logger: false });
  await app.listen({ host: TEST_HOST, port: 0 });
  const address = app.server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to read test server address');
  }

  return { app, baseUrl: `http://${TEST_HOST}:${address.port}` };
};

const stopTestServer = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }
};

// createApp non inizializza il singleton Prisma (lo fa l'entry point reale):
// negli smoke che toccano il DB va fatto a mano, come in sources-rag/auth-login.
before(() => {
  const runtimeEnv = bootstrapRuntime();
  initializePrisma(runtimeEnv.databaseUrl);
});

after(async () => {
  await resetPrismaForTests();
});

test('serbatoio: gli endpoint richiedono autenticazione (401, mai 500)', async () => {
  let app: FastifyInstance | null = null;

  try {
    const server = await startTestServer();
    app = server.app;

    const responses = await Promise.all([
      fetch(`${server.baseUrl}/agency/projects/x/performance/snapshots`),
      fetch(`${server.baseUrl}/agency/projects/x/performance/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      fetch(`${server.baseUrl}/agency/projects/x/performance/snapshots/y`, { method: 'DELETE' }),
      fetch(`${server.baseUrl}/agency/performance/metric-sets`),
      fetch(`${server.baseUrl}/agency/performance/metric-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      fetch(`${server.baseUrl}/agency/performance/metric-sets/z`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      fetch(`${server.baseUrl}/agency/performance/metric-sets/z`, { method: 'DELETE' }),
    ]);

    for (const response of responses) {
      assert.notEqual(response.status, 500);
      assert.equal(response.status, 401);
    }
  } finally {
    await stopTestServer(app);
  }
});

test('serbatoio: round-trip CRUD reale su Postgres via repository', async () => {
  let app: FastifyInstance | null = null;
  let workspaceId: string | null = null;

  try {
    const server = await startTestServer();
    app = server.app;

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const workspace = await prisma.workspace.create({
      data: { name: 'smoke perf reservoir', slug: `smoke-perf-${suffix}` },
    });
    workspaceId = workspace.id;
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'smoke perf project' },
    });

    // --- Rilevazioni (storico) ---
    const snapshot = await performanceRepository.createSnapshot({
      workspaceId: workspace.id,
      projectId: project.id,
      source: 'GOOGLE_ADS',
      sourceLabel: 'Account demo',
      scopeLevel: 'ACCOUNT',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-01-31T00:00:00.000Z'),
      metrics: { conversions: 12, cost: 340.5, impressions: 10000, clicks: 220 },
      campaignRefs: ['brand-search'],
      contextEvent: 'Lancio prodotto',
      tags: ['smoke'],
      createdByUserId: null,
    });
    assert.ok(snapshot.id);

    const listed = await performanceRepository.listProjectSnapshots({
      workspaceId: workspace.id,
      projectId: project.id,
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, snapshot.id);

    // Scoping: il progetto non appartiene a un altro workspace.
    assert.equal(await performanceRepository.projectExistsInWorkspace(workspace.id, project.id), true);
    assert.equal(
      await performanceRepository.projectExistsInWorkspace('workspace-inesistente', project.id),
      false,
    );

    const deletedSnapshots = await performanceRepository.deleteSnapshot({
      workspaceId: workspace.id,
      snapshotId: snapshot.id,
    });
    assert.equal(deletedSnapshots, 1);
    assert.equal(
      (await performanceRepository.listProjectSnapshots({ workspaceId: workspace.id, projectId: project.id })).length,
      0,
    );

    // --- Set di metriche ("carne'") ---
    const metricSet = await performanceRepository.createMetricSet({
      workspaceId: workspace.id,
      name: 'Performance base',
      icon: null,
      metrics: ['conversions', 'cost', 'roas'],
      createdByUserId: null,
    });
    assert.ok(metricSet.id);

    // Il vincolo @@unique([workspaceId, name]) blocca il nome duplicato.
    await assert.rejects(
      performanceRepository.createMetricSet({
        workspaceId: workspace.id,
        name: 'Performance base',
        icon: null,
        metrics: [],
        createdByUserId: null,
      }),
    );

    const renamed = await performanceRepository.updateMetricSet({
      workspaceId: workspace.id,
      id: metricSet.id,
      data: { name: 'Performance estesa' },
    });
    assert.equal(renamed, 1);
    const reloaded = await performanceRepository.findMetricSet({
      workspaceId: workspace.id,
      id: metricSet.id,
    });
    assert.equal(reloaded?.name, 'Performance estesa');

    const deletedSets = await performanceRepository.deleteMetricSet({
      workspaceId: workspace.id,
      id: metricSet.id,
    });
    assert.equal(deletedSets, 1);
  } finally {
    if (workspaceId) {
      // Cascade: elimina progetto, rilevazioni e set residui del workspace di test.
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await stopTestServer(app);
  }
});

test('serbatoio: anti-doppione e sostituzione per periodo (commit transazionale)', async () => {
  let app: FastifyInstance | null = null;
  let workspaceId: string | null = null;

  try {
    const server = await startTestServer();
    app = server.app;

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const workspace = await prisma.workspace.create({
      data: { name: 'smoke perf dedup', slug: `smoke-perf-dedup-${suffix}` },
    });
    workspaceId = workspace.id;
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'smoke perf dedup project' },
    });

    const feb = new Date('2026-02-01T00:00:00.000Z');
    const mar = new Date('2026-03-01T00:00:00.000Z');

    // Primo import Excel di due mesi (feb, mar): scrittura transazionale, 2 righe.
    const first = await performanceReportingService.commitExcelSnapshots({
      workspaceId: workspace.id,
      projectId: project.id,
      userId: null,
      sourceLabel: 'Excel: dati.xlsx',
      contextEvent: null,
      tags: ['excel'],
      snapshots: [
        { periodStart: '2026-02-01', periodEnd: '2026-02-28', metrics: { leads: 10, conversionValue: 100 } },
        { periodStart: '2026-03-01', periodEnd: '2026-03-31', metrics: { leads: 20, conversionValue: 200 } },
      ],
      replace: false,
    });
    assert.equal(first.created.length, 2);
    assert.equal(first.replaced, 0);

    // Rilevamento: riconosce i due mesi presenti e ignora quello assente.
    const existing = await performanceRepository.findExistingPeriodStarts({
      workspaceId: workspace.id,
      projectId: project.id,
      source: 'EXCEL',
      periodStarts: [feb, mar, new Date('2026-04-01T00:00:00.000Z')],
    });
    assert.equal(existing.length, 2);

    // Ri-import senza replace -> 409 e NIENTE scritto (i totali non raddoppiano).
    await assert.rejects(
      performanceReportingService.commitExcelSnapshots({
        workspaceId: workspace.id,
        projectId: project.id,
        userId: null,
        sourceLabel: 'Excel: dati.xlsx',
        contextEvent: null,
        tags: ['excel'],
        snapshots: [{ periodStart: '2026-02-01', periodEnd: '2026-02-28', metrics: { leads: 10 } }],
        replace: false,
      }),
      (err: unknown) => {
        assert.equal((err as { statusCode?: number }).statusCode, 409);
        return true;
      },
    );
    assert.equal(
      (await performanceRepository.listProjectSnapshots({ workspaceId: workspace.id, projectId: project.id })).length,
      2,
    );

    // Re-import di FEB con replace -> sostituisce SOLO feb; mar resta intatto.
    const replaced = await performanceReportingService.commitExcelSnapshots({
      workspaceId: workspace.id,
      projectId: project.id,
      userId: null,
      sourceLabel: 'Excel: dati-v2.xlsx',
      contextEvent: null,
      tags: ['excel'],
      snapshots: [{ periodStart: '2026-02-01', periodEnd: '2026-02-28', metrics: { leads: 99, conversionValue: 999 } }],
      replace: true,
    });
    assert.equal(replaced.created.length, 1);
    assert.equal(replaced.replaced, 1);

    const afterReplace = await performanceRepository.listProjectSnapshots({
      workspaceId: workspace.id,
      projectId: project.id,
    });
    assert.equal(afterReplace.length, 2); // feb (nuovo) + mar (intatto): nessun doppione
    const febRow = afterReplace.find((row) => row.periodStart.getTime() === feb.getTime());
    assert.equal(Number((febRow?.metrics as Record<string, number> | null)?.leads), 99);
    assert.equal(febRow?.sourceLabel, 'Excel: dati-v2.xlsx');

    // findExistingProjectPeriods (usato dall'anteprima) ritorna gli ISO in input che esistono.
    const previewExisting = await performanceReportingService.findExistingProjectPeriods({
      workspaceId: workspace.id,
      projectId: project.id,
      source: 'EXCEL',
      periodStarts: ['2026-02-01', '2026-05-01'],
    });
    assert.deepEqual(previewExisting, ['2026-02-01']);
  } finally {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await stopTestServer(app);
  }
});
