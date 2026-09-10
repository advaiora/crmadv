import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENCY_AI_FALLBACK_RATES,
  computeAgencyAiCostUsd,
  resolveAgencyAiRates,
} from './ai-cost-rates.js';

// Il motivo per cui questo modulo esiste e' l'ultimo gruppo di test: il ripiego
// di prezzo era muto, e adesso e' riconoscibile da chi chiama.

test('i modelli noti tornano la loro tariffa, con matched vero', () => {
  const attesi: Array<[string, number, number]> = [
    ['gpt-4o-mini', 0.15, 0.6],
    ['gpt-4o', 5, 15],
    ['gpt-5', 1.25, 10],
    ['claude-haiku-4-5', 1, 5],
    ['claude-sonnet-4', 3, 15],
    ['claude-opus-4-1', 5, 25],
    ['claude-fable-5', 10, 50],
  ];
  for (const [model, input, output] of attesi) {
    const rates = resolveAgencyAiRates(model);
    assert.equal(rates.matched, true, `${model} dovrebbe essere riconosciuto`);
    assert.equal(rates.inputPerMillion, input, `input di ${model}`);
    assert.equal(rates.outputPerMillion, output, `output di ${model}`);
  }
});

// L'ordine della tabella e' significativo: 'gpt-4o-mini' contiene 'gpt-4o'.
test('gpt-4o-mini non viene prezzato come gpt-4o', () => {
  assert.notEqual(
    resolveAgencyAiRates('gpt-4o-mini').inputPerMillion,
    resolveAgencyAiRates('gpt-4o').inputPerMillion,
  );
});

test('il nome del modello si confronta senza distinzione di maiuscole', () => {
  assert.deepEqual(resolveAgencyAiRates('GPT-4O-MINI'), resolveAgencyAiRates('gpt-4o-mini'));
});

test('un Claude non elencato ricade sulla tariffa Claude generica, non sul ripiego', () => {
  const rates = resolveAgencyAiRates('claude-qualcosa-di-nuovo');
  assert.equal(rates.matched, true);
  assert.equal(rates.inputPerMillion, 5);
  assert.equal(rates.outputPerMillion, 25);
});

// ⚠️ Il difetto che CRMA-55 chiedeva di rompere: prima il ripiego era
// indistinguibile da una tariffa vera.
test('un modello sconosciuto ripiega e lo DICE (matched falso)', () => {
  for (const model of ['llama-3', 'mistral-large', '', 'modello-mai-visto']) {
    const rates = resolveAgencyAiRates(model);
    assert.equal(rates.matched, false, `${model} non dovrebbe risultare riconosciuto`);
    assert.equal(rates.inputPerMillion, AGENCY_AI_FALLBACK_RATES.inputPerMillion);
    assert.equal(rates.outputPerMillion, AGENCY_AI_FALLBACK_RATES.outputPerMillion);
  }
});

test('il costo si calcola sui token e sulla tariffa del modello', () => {
  // 1M token di input a 5$ + 1M di output a 15$.
  assert.equal(computeAgencyAiCostUsd('gpt-4o', 1_000_000, 1_000_000), 20);
  // Mezzo milione di input di gpt-4o-mini: 0,075$.
  assert.equal(computeAgencyAiCostUsd('gpt-4o-mini', 500_000, 0), 0.075);
});

test('zero token costano zero', () => {
  assert.equal(computeAgencyAiCostUsd('gpt-4o', 0, 0), 0);
});
