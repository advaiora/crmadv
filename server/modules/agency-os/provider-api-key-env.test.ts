import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlaceholderApiKey, readProviderApiKeyFromEnv } from './provider-api-key-env.js';

// Chiavi finte ma della lunghezza giusta: servono a verificare che il filtro
// NON scarti una chiave plausibile.
const CHIAVE_OPENAI_PLAUSIBILE = `sk-proj-${'a1B2c3D4e5'.repeat(5)}`;
const CHIAVE_ANTHROPIC_PLAUSIBILE = `sk-ant-api03-${'z9Y8x7W6v5'.repeat(5)}`;

test('isPlaceholderApiKey riconosce il segnaposto trovato in produzione', () => {
  // Il caso reale dell'8/9/2026: .env di messa online con REPLACE_ME.
  assert.equal(isPlaceholderApiKey('REPLACE_ME'), true);
});

test('isPlaceholderApiKey ignora maiuscole e spazi sui segnaposto comuni', () => {
  for (const valore of ['replace_me', ' CHANGE_ME ', 'TODO', 'placeholder', 'da_inserire']) {
    assert.equal(isPlaceholderApiKey(valore), true, `atteso segnaposto: ${valore}`);
  }
});

test('isPlaceholderApiKey riconosce i valori mascherati', () => {
  assert.equal(isPlaceholderApiKey('sk-xxxxxxxxxxxx'), true);
  assert.equal(isPlaceholderApiKey('****************'), true);
});

test('isPlaceholderApiKey scarta un valore troppo corto per essere una chiave', () => {
  assert.equal(isPlaceholderApiKey('sk-abc123'), true);
});

test('isPlaceholderApiKey non considera segnaposto una stringa vuota', () => {
  // Vuoto vuol dire assente, non finto: sono due stati diversi.
  assert.equal(isPlaceholderApiKey(''), false);
  assert.equal(isPlaceholderApiKey('   '), false);
  assert.equal(isPlaceholderApiKey(null), false);
  assert.equal(isPlaceholderApiKey(undefined), false);
});

test('isPlaceholderApiKey lascia passare le chiavi plausibili dei due provider', () => {
  assert.equal(isPlaceholderApiKey(CHIAVE_OPENAI_PLAUSIBILE), false);
  assert.equal(isPlaceholderApiKey(CHIAVE_ANTHROPIC_PLAUSIBILE), false);
});

test('readProviderApiKeyFromEnv rende null quando la variabile manca o e vuota', () => {
  assert.equal(readProviderApiKeyFromEnv(undefined), null);
  assert.equal(readProviderApiKeyFromEnv(''), null);
  assert.equal(readProviderApiKeyFromEnv('  '), null);
});

test('readProviderApiKeyFromEnv rende null sul segnaposto: cosi il bollino torna onesto', () => {
  assert.equal(readProviderApiKeyFromEnv('REPLACE_ME'), null);
});

test('readProviderApiKeyFromEnv rende la chiave ripulita dagli spazi quando e plausibile', () => {
  assert.equal(readProviderApiKeyFromEnv(` ${CHIAVE_OPENAI_PLAUSIBILE} `), CHIAVE_OPENAI_PLAUSIBILE);
});
