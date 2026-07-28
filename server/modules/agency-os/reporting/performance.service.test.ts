import assert from 'node:assert/strict';
import test from 'node:test';
import { performanceReportingService } from './performance.service.js';

// Copertura dei rami di VALIDAZIONE del service del serbatoio Reportistica.
// Sono volutamente casi che falliscono in Zod PRIMA di qualsiasi accesso al DB
// (input non valido -> HttpError 400), quindi non serve un database in test.

const WORKSPACE_ID = 'ws_test';
const PROJECT_ID = 'proj_test';

const expectBadRequest = (err: unknown): true => {
  assert.equal((err as { statusCode?: number }).statusCode, 400);
  return true;
};

test('createProjectSnapshot rifiuta un periodo con fine precedente all\'inizio', async () => {
  await assert.rejects(
    performanceReportingService.createProjectSnapshot({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      userId: null,
      body: {
        source: 'GOOGLE_ADS',
        periodStart: '2026-02-01T00:00:00.000Z',
        periodEnd: '2026-01-01T00:00:00.000Z',
        metrics: { clicks: 10 },
      },
    }),
    expectBadRequest,
  );
});

test('createProjectSnapshot rifiuta una sorgente non prevista', async () => {
  await assert.rejects(
    performanceReportingService.createProjectSnapshot({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      userId: null,
      body: {
        source: 'TIKTOK_ADS',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        metrics: { clicks: 10 },
      },
    }),
    expectBadRequest,
  );
});

test('createProjectSnapshot rifiuta le metriche mancanti', async () => {
  await assert.rejects(
    performanceReportingService.createProjectSnapshot({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      userId: null,
      body: {
        source: 'META_ADS',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
      },
    }),
    expectBadRequest,
  );
});

test('createMetricSet rifiuta un nome vuoto', async () => {
  await assert.rejects(
    performanceReportingService.createMetricSet({
      workspaceId: WORKSPACE_ID,
      userId: null,
      body: { name: '   ', metrics: ['clicks'] },
    }),
    expectBadRequest,
  );
});

test('updateMetricSet rifiuta un aggiornamento senza campi', async () => {
  await assert.rejects(
    performanceReportingService.updateMetricSet({
      workspaceId: WORKSPACE_ID,
      id: 'set_test',
      body: {},
    }),
    expectBadRequest,
  );
});
