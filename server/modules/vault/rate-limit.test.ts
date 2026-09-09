import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { UNKNOWN_CLIENT_IP, resolveRequestClientIp } from './rate-limit.js';

// La lunghezza della colonna `PasswordResetToken.requestIp` in
// `prisma/schema.prisma`. PostgreSQL su un valore piu' lungo NON tronca: da'
// errore. E' il numero da cui dipende la prova piu' importante di questo file.
const REQUEST_IP_COLUMN_LENGTH = 64;

/**
 * Una richiesta finta. `ip` e' cio' che Fastify ha gia' deciso applicando la
 * politica `trustProxy`; le intestazioni sono quelle grezze, che qui servono
 * solo a dimostrare che NON vengono guardate.
 */
const fakeRequest = (input: {
  ip?: unknown;
  headers?: Record<string, string | string[]>;
}) =>
  ({
    ip: input.ip,
    headers: input.headers ?? {},
  }) as unknown as FastifyRequest;

test('un IPv4 valido passa cosi com e', () => {
  assert.equal(resolveRequestClientIp(fakeRequest({ ip: '203.0.113.9' })), '203.0.113.9');
});

test('un IPv6 valido passa cosi com e', () => {
  assert.equal(resolveRequestClientIp(fakeRequest({ ip: '2001:db8::1' })), '2001:db8::1');
});

test('gli spazi intorno all indirizzo non contano', () => {
  assert.equal(resolveRequestClientIp(fakeRequest({ ip: '  203.0.113.9  ' })), '203.0.113.9');
});

// ── Rilievo 1 del Guardiano su CRMA-25 ────────────────────────────────────────
// Un X-Forwarded-For lungo 100 caratteri finiva tale e quale in una colonna
// VarChar(64). L'insert esplodeva, ma SOLO nel ramo «utente trovato», dove
// l'insert c'e': 500 per gli indirizzi registrati, 200 per gli altri. Cioe' un
// oracolo che dice quali email hanno un account.

test('un X-Forwarded-For lunghissimo non arriva mai al valore restituito', () => {
  const forged = 'A'.repeat(100);
  const resolved = resolveRequestClientIp(
    fakeRequest({ ip: '203.0.113.9', headers: { 'x-forwarded-for': forged } }),
  );

  assert.equal(resolved, '203.0.113.9');
  assert.ok(
    resolved.length <= REQUEST_IP_COLUMN_LENGTH,
    'l indirizzo restituito non entra in PasswordResetToken.requestIp: l oracolo di esistenza degli account e riaperto',
  );
});

test('nemmeno un proxy fidato che manda spazzatura arriva al database', () => {
  // Con `trustProxy` configurato, `request.ip` viene dall'intestazione: se il
  // proxy sbaglia o viene compromesso, il valore va comunque validato.
  const resolved = resolveRequestClientIp(fakeRequest({ ip: 'A'.repeat(100) }));

  assert.equal(resolved, UNKNOWN_CLIENT_IP);
  assert.ok(resolved.length <= REQUEST_IP_COLUMN_LENGTH);
});

test('qualunque cosa non sia un indirizzo valido diventa «unknown»', () => {
  const hostileValues = [
    'A'.repeat(100),
    'non-un-ip',
    '203.0.113.9, 198.51.100.7', // una catena di hop, non un indirizzo
    '999.999.999.999',
    '203.0.113.9; DROP TABLE users',
    '<script>alert(1)</script>',
    '',
    '   ',
    undefined,
    null,
    42,
    { toString: () => '203.0.113.9' },
  ];

  for (const value of hostileValues) {
    const resolved = resolveRequestClientIp(fakeRequest({ ip: value }));
    assert.equal(
      resolved,
      UNKNOWN_CLIENT_IP,
      `il valore ${JSON.stringify(value)} avrebbe dovuto essere scartato, invece e passato come "${resolved}"`,
    );
  }
});

// ── Rilievo 2 del Guardiano su CRMA-25 ────────────────────────────────────────
// Le intestazioni le scrive il client: cambiandole a ogni richiesta ci si
// creava un secchio nuovo ogni volta, e i limiti per IP non limitavano piu'
// niente. Ora la fonte e' solo `request.ip`.

test('un X-Forwarded-For falsificato NON sposta la chiave del limite di frequenza', () => {
  const realIp = '203.0.113.9';

  const primaRichiesta = resolveRequestClientIp(
    fakeRequest({ ip: realIp, headers: { 'x-forwarded-for': '198.51.100.1' } }),
  );
  const secondaRichiesta = resolveRequestClientIp(
    fakeRequest({ ip: realIp, headers: { 'x-forwarded-for': '198.51.100.2' } }),
  );

  assert.equal(primaRichiesta, realIp);
  assert.equal(
    secondaRichiesta,
    primaRichiesta,
    'due richieste dallo stesso indirizzo hanno ottenuto due chiavi diverse cambiando un intestazione: i limiti per IP sono aggirabili',
  );
});

test('nemmeno X-Real-IP sposta la chiave', () => {
  const resolved = resolveRequestClientIp(
    fakeRequest({ ip: '203.0.113.9', headers: { 'x-real-ip': '198.51.100.1' } }),
  );

  assert.equal(resolved, '203.0.113.9');
});

test('un intestazione falsificata non riesce nemmeno a farsi passare per «nessun IP»', () => {
  // Se ci si potesse far dare `unknown` a comando, a database andrebbe `null`
  // e il tetto per IP di `countRecentByIp` verrebbe saltato del tutto
  // (`password-reset.service.ts`, il controllo `if (input.requestIp)`).
  const resolved = resolveRequestClientIp(
    fakeRequest({ ip: '203.0.113.9', headers: { 'x-forwarded-for': 'unknown' } }),
  );

  assert.equal(resolved, '203.0.113.9');
});
