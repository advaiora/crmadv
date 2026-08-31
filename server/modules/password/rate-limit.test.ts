import assert from 'node:assert/strict';
import test from 'node:test';
import { isHttpError } from '../../core/errors.js';
import {
  CHANGE_PASSWORD_MAX_REQUESTS,
  CHANGE_PASSWORD_WINDOW_MS,
  enforcePasswordChangeRateLimit,
  resetPasswordRateLimitStoreForTests,
} from './rate-limit.js';

// `nowMs` e' un parametro apposta per questo: la finestra e' di quindici minuti
// e nessun test puo' permettersi di aspettarli.
const spendAttempts = (userId: string, count: number, nowMs: number) => {
  for (let index = 0; index < count; index += 1) {
    enforcePasswordChangeRateLimit({ userId, nowMs });
  }
};

const captureError = (run: () => void) => {
  try {
    run();
  } catch (error) {
    return error;
  }

  return null;
};

test('i primi dieci tentativi passano, l undicesimo no', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  spendAttempts('user-1', CHANGE_PASSWORD_MAX_REQUESTS, nowMs);
  const error = captureError(() => enforcePasswordChangeRateLimit({ userId: 'user-1', nowMs }));

  assert.ok(isHttpError(error));
  assert.equal(error.statusCode, 429);
  assert.equal(error.code, 'RATE_LIMITED');
});

test('passata la finestra il contatore riparte', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  spendAttempts('user-1', CHANGE_PASSWORD_MAX_REQUESTS, nowMs);
  assert.ok(captureError(() => enforcePasswordChangeRateLimit({ userId: 'user-1', nowMs })));

  const dopoLaFinestra = nowMs + CHANGE_PASSWORD_WINDOW_MS;
  assert.equal(
    captureError(() => enforcePasswordChangeRateLimit({ userId: 'user-1', nowMs: dopoLaFinestra })),
    null,
  );
});

// Il conto e' per utente e non per indirizzo: chi ha esaurito i tentativi non se
// ne compra altri cambiando rete, e chi sta al banco accanto non paga per lui.
test('il limite di una persona non tocca quello di un altra', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  spendAttempts('user-1', CHANGE_PASSWORD_MAX_REQUESTS, nowMs);
  assert.ok(captureError(() => enforcePasswordChangeRateLimit({ userId: 'user-1', nowMs })));

  assert.equal(
    captureError(() => enforcePasswordChangeRateLimit({ userId: 'user-2', nowMs })),
    null,
  );
});
