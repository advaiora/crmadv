import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONNECTOR_SOURCES,
  getConnector,
  isConnectorSource,
  listConnectorDescriptors,
} from './performance-connectors.js';

const baseInput = {
  projectId: 'proj_test',
  periodStart: new Date('2026-05-01'),
  periodEnd: new Date('2026-05-31'),
};

test('fetchMetrics e\' deterministico per lo stesso input', () => {
  const a = getConnector('GOOGLE_ADS').fetchMetrics(baseInput);
  const b = getConnector('GOOGLE_ADS').fetchMetrics(baseInput);
  assert.deepEqual(a.metrics, b.metrics);
  assert.equal(a.sourceLabel, b.sourceLabel);
});

test('periodi diversi producono metriche diverse (c\'e\' un andamento)', () => {
  const may = getConnector('GOOGLE_ADS').fetchMetrics(baseInput).metrics;
  const june = getConnector('GOOGLE_ADS').fetchMetrics({
    ...baseInput,
    periodStart: new Date('2026-06-01'),
    periodEnd: new Date('2026-06-30'),
  }).metrics;
  assert.notEqual(may.impressions, june.impressions);
});

test('i rapporti sono ricalcolati dai grezzi (non inventati)', () => {
  const { metrics: m } = getConnector('META_ADS').fetchMetrics(baseInput);
  assert.ok(m.impressions > 0 && m.clicks >= 0 && m.cost >= 0);
  assert.ok(Math.abs(m.ctr - m.clicks / m.impressions) < 1e-3, `ctr incoerente: ${m.ctr}`);
  if (m.cost > 0) {
    assert.ok(Math.abs(m.roas - m.conversionValue / m.cost) < 0.02, `roas incoerente: ${m.roas}`);
  }
  if (m.clicks > 0) {
    assert.ok(Math.abs(m.cpc - m.cost / m.clicks) < 0.02, `cpc incoerente: ${m.cpc}`);
  }
});

test('il ROAS simulato resta in una banda realistica su tutto l\'anno', () => {
  for (const source of CONNECTOR_SOURCES) {
    for (let month = 0; month < 12; month += 1) {
      const { metrics } = getConnector(source).fetchMetrics({
        projectId: 'proj_band',
        periodStart: new Date(2026, month, 1),
        periodEnd: new Date(2026, month + 1, 0),
      });
      assert.ok(
        metrics.roas >= 1.2 && metrics.roas <= 7,
        `roas fuori banda (${source}, mese ${month + 1}): ${metrics.roas}`,
      );
    }
  }
});

test('descrittori: 3 sorgenti, Excel e\' file manuale, i connettori sono simulati', () => {
  const list = listConnectorDescriptors();
  assert.equal(list.length, 3);
  const excel = list.find((entry) => entry.source === 'EXCEL');
  assert.equal(excel?.status, 'manual');
  assert.equal(excel?.kind, 'file');
  const google = list.find((entry) => entry.source === 'GOOGLE_ADS');
  assert.equal(google?.status, 'simulated');
  assert.equal(google?.kind, 'connector');
});

test('isConnectorSource distingue i connettori dall\'Excel', () => {
  assert.equal(isConnectorSource('GOOGLE_ADS'), true);
  assert.equal(isConnectorSource('META_ADS'), true);
  assert.equal(isConnectorSource('EXCEL'), false);
  assert.equal(isConnectorSource('boh'), false);
});
