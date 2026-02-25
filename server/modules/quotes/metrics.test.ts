import assert from 'node:assert/strict';
import test from 'node:test';
import { quotesMetrics } from './metrics.js';

test('quotesMetrics records operation counters and average duration per workspace', () => {
  const workspaceId = `workspace-${Date.now()}`;

  quotesMetrics.recordOperation(workspaceId, 'create', 100, true);
  quotesMetrics.recordOperation(workspaceId, 'create', 50, false);
  quotesMetrics.recordOperation(workspaceId, 'exportPdf', 200, true);

  const snapshot = quotesMetrics.getWorkspaceSnapshot(workspaceId);

  assert.equal(snapshot.operations.create.total, 2);
  assert.equal(snapshot.operations.create.success, 1);
  assert.equal(snapshot.operations.create.error, 1);
  assert.equal(snapshot.operations.create.avgDurationMs, 75);
  assert.equal(snapshot.operations.exportPdf.total, 1);
  assert.equal(snapshot.operations.exportPdf.lastDurationMs, 200);
});
