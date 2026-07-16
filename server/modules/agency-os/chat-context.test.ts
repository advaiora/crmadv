import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveContextWindow,
  planContextCompression,
  buildSummaryRequest,
  buildCompressedContext,
  type ContextMessage,
} from './chat-context.js';

// Compressione del contesto (Fase 5). Il riassunto vero passa dal motore AI (chiavi),
// ma la decisione di soglia e il taglio finestra/coda sono deterministici: qui.

const msg = (i: number, role: 'user' | 'assistant' = 'user'): ContextMessage => ({
  role,
  content: `messaggio numero ${i} con un po' di testo di contorno`,
});

test('resolveContextWindow riconosce le famiglie note e ha un default', () => {
  assert.equal(resolveContextWindow('claude-opus-4-8'), 200_000);
  assert.equal(resolveContextWindow('claude-sonnet-5'), 200_000);
  assert.equal(resolveContextWindow('gpt-4o-mini'), 128_000);
  assert.equal(resolveContextWindow('gpt-5'), 272_000);
  assert.equal(resolveContextWindow('modello-ignoto'), 128_000);
});

test('planContextCompression: sotto soglia non comprime, tiene tutto verbatim', () => {
  const messages = [msg(1), msg(2), msg(3)];
  const plan = planContextCompression({ systemText: 'system', messages, model: 'claude-opus-4-8', threshold: 1 });
  assert.equal(plan.needsCompression, false);
  assert.equal(plan.keepVerbatim.length, 3);
  assert.equal(plan.toSummarize.length, 0);
});

test('planContextCompression: sopra soglia riassume i vecchi e tiene la coda', () => {
  const messages = [msg(1), msg(2), msg(3), msg(4), msg(5)];
  // Soglia minuscola: il budget di storico e' ~0, resta solo la coda minima.
  const plan = planContextCompression({
    systemText: 'system',
    messages,
    model: 'claude-opus-4-8',
    threshold: 0.0000001,
    minTail: 2,
  });
  assert.equal(plan.needsCompression, true);
  assert.equal(plan.keepVerbatim.length, 2);
  assert.deepEqual(plan.keepVerbatim.map((m) => m.content), [msg(4).content, msg(5).content]);
  assert.equal(plan.toSummarize.length, 3);
});

test('planContextCompression: la coda minima e garantita anche a budget zero', () => {
  const messages = [msg(1), msg(2), msg(3), msg(4)];
  const plan = planContextCompression({
    systemText: 'x'.repeat(10_000),
    messages,
    model: 'gpt-4o',
    threshold: 0.00001,
    minTail: 3,
  });
  assert.equal(plan.keepVerbatim.length, 3);
});

test('planContextCompression: se i messaggi stanno tutti nella coda, niente da riassumere', () => {
  const messages = [msg(1), msg(2)];
  const plan = planContextCompression({
    systemText: 'system',
    messages,
    model: 'claude-opus-4-8',
    threshold: 0.0000001,
    minTail: 5,
  });
  assert.equal(plan.needsCompression, false);
  assert.equal(plan.keepVerbatim.length, 2);
});

test('buildSummaryRequest mette la trascrizione e chiede solo il riassunto', () => {
  const req = buildSummaryRequest([msg(1, 'user'), msg(2, 'assistant')]);
  assert.ok(req.system.toLowerCase().includes('riassum'));
  assert.equal(req.messages.length, 1);
  assert.ok(req.messages[0].content.includes('Utente:'));
  assert.ok(req.messages[0].content.includes('AI:'));
});

test('buildCompressedContext antepone il riassunto come turno utente', () => {
  const out = buildCompressedContext('riassunto x', [msg(9, 'assistant')]);
  assert.equal(out.length, 2);
  assert.equal(out[0].role, 'user');
  assert.ok(out[0].content.includes('Riassunto della conversazione precedente'));
  assert.ok(out[0].content.includes('riassunto x'));
  assert.equal(out[1].content, msg(9).content);
});
