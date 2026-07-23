import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SsrfBlockedError,
  assertPublicHttpUrl,
  isBlockedHostname,
  isBlockedIpAddress,
} from './net-guard.js';

test('isBlockedHostname: blocca nomi locali e IP privati/link-local', () => {
  for (const host of [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '10.0.0.5',
    '192.168.1.1',
    '172.16.0.1',
    '169.254.169.254', // metadata cloud
    'db.internal',
    'foo.local',
  ]) {
    assert.equal(isBlockedHostname(host), true, `atteso bloccato: ${host}`);
  }
});

test('isBlockedHostname: consente host pubblici', () => {
  for (const host of ['example.com', 'www.google.com', '8.8.8.8', '203.0.113.10']) {
    assert.equal(isBlockedHostname(host), false, `atteso consentito: ${host}`);
  }
});

test('isBlockedIpAddress: riconosce loopback/ULA IPv6', () => {
  assert.equal(isBlockedIpAddress('::1'), true);
  assert.equal(isBlockedIpAddress('fd00::1'), true);
  assert.equal(isBlockedIpAddress('2606:4700:4700::1111'), false);
});

test('assertPublicHttpUrl: accetta https pubblico e restituisce la URL', () => {
  const url = assertPublicHttpUrl('https://example.com/page');
  assert.equal(url.hostname, 'example.com');
});

test('assertPublicHttpUrl: rifiuta schemi non http(s)', () => {
  assert.throws(() => assertPublicHttpUrl('ftp://example.com'), SsrfBlockedError);
  assert.throws(() => assertPublicHttpUrl('file:///etc/passwd'), SsrfBlockedError);
});

test('assertPublicHttpUrl: rifiuta host privati/locali', () => {
  assert.throws(() => assertPublicHttpUrl('http://127.0.0.1/admin'), SsrfBlockedError);
  assert.throws(() => assertPublicHttpUrl('https://169.254.169.254/latest/meta-data'), SsrfBlockedError);
});

test('assertPublicHttpUrl: http consentito solo quando allowHttp e vero', () => {
  assert.throws(() => assertPublicHttpUrl('http://example.com', { allowHttp: false }), SsrfBlockedError);
  const url = assertPublicHttpUrl('http://example.com', { allowHttp: true });
  assert.equal(url.protocol, 'http:');
});
