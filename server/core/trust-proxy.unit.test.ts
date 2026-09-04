import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTrustProxy, parseTrustProxy } from './trust-proxy.js';

const TRUST_PROXY_KEY = 'TRUST_PROXY';

const restoreEnvValue = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

test('normalizeTrustProxy defaults to false when the variable is missing or empty', () => {
  assert.equal(normalizeTrustProxy(undefined), false);
  assert.equal(normalizeTrustProxy(''), false);
  assert.equal(normalizeTrustProxy('   '), false);
});

test('normalizeTrustProxy reads the on/off form, ignoring case and spaces', () => {
  assert.equal(normalizeTrustProxy('true'), true);
  assert.equal(normalizeTrustProxy(' TRUE '), true);
  assert.equal(normalizeTrustProxy('false'), false);
  assert.equal(normalizeTrustProxy('False'), false);
});

test('normalizeTrustProxy reads the number of trusted proxies as a number', () => {
  assert.equal(normalizeTrustProxy('1'), 1);
  assert.equal(normalizeTrustProxy(' 2 '), 2);
});

test('normalizeTrustProxy passes an address list through untouched', () => {
  assert.equal(normalizeTrustProxy('127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeTrustProxy(' 10.0.0.0/8, 172.16.0.0/12 '), '10.0.0.0/8, 172.16.0.0/12');
});

test('parseTrustProxy reads the value from the environment', () => {
  const previousValue = process.env[TRUST_PROXY_KEY];

  try {
    process.env[TRUST_PROXY_KEY] = '1';
    assert.equal(parseTrustProxy(), 1);

    delete process.env[TRUST_PROXY_KEY];
    assert.equal(parseTrustProxy(), false);
  } finally {
    restoreEnvValue(TRUST_PROXY_KEY, previousValue);
  }
});
