import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SsrfBlockedError,
  assertPublicHttpUrl,
  isBlockedHostname,
  isBlockedIpAddress,
  isPrivateIpv4Address,
  isPrivateIpv6Address,
  isPrivateNetworkHost,
  mentionsPrivateIpAddress,
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

test('isPrivateNetworkHost: riconosce nomi locali e IP privati senza toccare il DNS', async () => {
  for (const host of ['localhost', '127.0.0.1', '10.0.0.5', '192.168.1.1', 'db.internal', 'foo.local']) {
    assert.equal(await isPrivateNetworkHost(host), true, `atteso privato: ${host}`);
  }
});

test('isPrivateNetworkHost: un IP pubblico scritto in chiaro non e\' rete privata', async () => {
  // IP letterale: nessuna risoluzione DNS da fare, quindi il test non dipende
  // dalla rete della macchina che lo esegue.
  assert.equal(await isPrivateNetworkHost('8.8.8.8'), false);
  assert.equal(await isPrivateNetworkHost('203.0.113.10'), false);
});

test('isPrivateNetworkHost: un nome che non risolve NON e\' rete privata', async () => {
  // Fail-open voluto, all'opposto di `safeFetch`: verso un nome che non risolve
  // non si apre nessuna connessione comunque, quindi non c'e' nessuna sonda da
  // chiudere — e chiamarlo "rete privata" manderebbe chi ha sbagliato a digitare
  // a cercare un guasto che non esiste. `.invalid` non risolve per definizione
  // (RFC 2606), quindi il caso non dipende da quali nomi veri esistano.
  assert.equal(await isPrivateNetworkHost('questo-nome-non-esiste.invalid'), false);
});

test('isPrivateNetworkHost: un nome pubblico che RISOLVE a un indirizzo privato e\' rete privata', async () => {
  // E' il caso per cui il secondo strato esiste: la sonda con un passaggio in
  // piu'. `interno.esempio.it` non ha niente di sospetto da guardare, e senza
  // risoluzione DNS passerebbe.
  const risolvi = async () => [{ address: '10.0.0.5' }];

  assert.equal(await isPrivateNetworkHost('interno.esempio.it', risolvi), true);
});

test('isPrivateNetworkHost: basta UNO degli indirizzi risolti a essere privato', async () => {
  const risolvi = async () => [{ address: '93.184.216.34' }, { address: '192.168.1.10' }];

  assert.equal(await isPrivateNetworkHost('doppio.esempio.it', risolvi), true);
});

test('isPrivateNetworkHost: un nome che risolve solo a indirizzi pubblici passa', async () => {
  const risolvi = async () => [{ address: '93.184.216.34' }, { address: '2606:4700::1111' }];

  assert.equal(await isPrivateNetworkHost('vero.esempio.it', risolvi), false);
});

test('isPrivateIpv6Address: le forme lunghe dello stesso indirizzo non scavalcano il controllo', () => {
  // Il buco trovato in revisione l'1/9/2026: `::ffff:10.0.0.5` e' `10.0.0.5`
  // scritto in un altro modo, e passava.
  for (const host of ['::1', '0:0:0:0:0:0:0:1', '::', '::ffff:10.0.0.5', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fd00::1', 'febf::1', 'fe80::1%eth0']) {
    assert.equal(isPrivateIpv6Address(host), true, `atteso privato: ${host}`);
  }
});

test('isPrivateIpv6Address: gli IPv6 pubblici restano pubblici', () => {
  for (const host of ['2606:4700:4700::1111', '2001:db8::1', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateIpv6Address(host), false, `atteso pubblico: ${host}`);
  }
});

test('isPrivateIpv4Address: la fascia CGNAT non e\' internet', () => {
  assert.equal(isPrivateIpv4Address('100.64.0.1'), true);
  assert.equal(isPrivateIpv4Address('100.127.255.254'), true);
  // I bordi: 100.63 e 100.128 sono fuori dalla /10 e sono pubblici davvero.
  assert.equal(isPrivateIpv4Address('100.63.255.255'), false);
  assert.equal(isPrivateIpv4Address('100.128.0.1'), false);
});

test('mentionsPrivateIpAddress: riconosce un indirizzo interno dentro un messaggio d\'errore', () => {
  for (const messaggio of [
    'connect ECONNREFUSED 10.0.0.5:587',
    'connect ETIMEDOUT 192.168.1.10:25',
    'getaddrinfo dice 169.254.169.254',
    'connect ECONNREFUSED ::1:587',
  ]) {
    assert.equal(mentionsPrivateIpAddress(messaggio), true, `atteso riconosciuto: ${messaggio}`);
  }
});

test('mentionsPrivateIpAddress: non si allarma per numeri e indirizzi pubblici', () => {
  for (const messaggio of [
    'connect ECONNREFUSED 93.184.216.34:587',
    'Invalid login: 535 5.7.8 Username and Password not accepted',
    'Greeting never received after 10000 ms',
    'versione 1.2.3.4 del protocollo',
  ]) {
    assert.equal(mentionsPrivateIpAddress(messaggio), false, `atteso ignorato: ${messaggio}`);
  }
});
