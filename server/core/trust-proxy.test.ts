import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTrustProxy } from './trust-proxy.js';

test('senza variabile non ci si fida di nessuno', () => {
  // E' il caso che conta di piu': il valore predefinito deve essere quello
  // sicuro. Se un giorno questo test diventa rosso, X-Forwarded-For e' tornato
  // credibile per chiunque e tutti i limiti per IP sono falsificabili.
  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy(''), false);
  assert.equal(parseTrustProxy('   '), false);
});

test('le forme dello spegnimento esplicito', () => {
  for (const value of ['false', 'FALSE', '0', 'no', ' false ']) {
    assert.equal(parseTrustProxy(value), false, `«${value}» doveva spegnere la fiducia`);
  }
});

test('«true» si fida di chiunque, ed e una scelta esplicita', () => {
  assert.equal(parseTrustProxy('true'), true);
  assert.equal(parseTrustProxy('TRUE'), true);
  assert.equal(parseTrustProxy('yes'), true);
});

test('un numero e il conto degli hop fidati, non una stringa', () => {
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy('2'), 2);
});

test('un elenco di indirizzi arriva a Fastify intatto', () => {
  assert.equal(parseTrustProxy('10.0.0.1,192.168.1.0/24'), '10.0.0.1,192.168.1.0/24');
  assert.equal(parseTrustProxy('  10.0.0.1  '), '10.0.0.1');
});
