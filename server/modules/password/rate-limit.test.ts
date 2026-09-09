import assert from 'node:assert/strict';
import test from 'node:test';
import { isHttpError } from '../../core/errors.js';
import {
  CHANGE_PASSWORD_MAX_REQUESTS,
  CHANGE_PASSWORD_WINDOW_MS,
  RESET_CONFIRM_MAX_PER_IP,
  RESET_REQUEST_MAX_PER_EMAIL,
  RESET_REQUEST_MAX_PER_IP,
  RESET_REQUEST_WINDOW_MS,
  enforcePasswordChangeRateLimit,
  enforcePasswordResetConfirmRateLimit,
  enforcePasswordResetRequestRateLimit,
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

// --- Recupero password (rotte pubbliche) -----------------------------------
//
// Qui il limite non e' un di piu': le rotte del recupero non chiedono nessuna
// sessione, quindi e' l'unica difesa che hanno.

test('la richiesta di recupero si ferma al sesto tentativo dallo stesso indirizzo IP', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  // Cinque indirizzi email DIVERSI, cosi' a fermare il sesto e' per forza il
  // contatore per IP e non quello per email.
  for (let index = 0; index < RESET_REQUEST_MAX_PER_IP; index += 1) {
    enforcePasswordResetRequestRateLimit({
      requestIp: '203.0.113.7',
      email: `utente${index}@esempio.it`,
      nowMs,
    });
  }

  const error = captureError(() =>
    enforcePasswordResetRequestRateLimit({
      requestIp: '203.0.113.7',
      email: 'utente-di-troppo@esempio.it',
      nowMs,
    }),
  );

  assert.equal(isHttpError(error) && error.statusCode, 429);
});

test('la richiesta di recupero si ferma al quarto tentativo sullo stesso indirizzo email', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  // Indirizzi IP diversi: cambiare rete e' facile, e la casella da proteggere
  // dalle molestie e' sempre quella.
  for (let index = 0; index < RESET_REQUEST_MAX_PER_EMAIL; index += 1) {
    enforcePasswordResetRequestRateLimit({
      requestIp: `203.0.113.${index}`,
      email: 'vittima@esempio.it',
      nowMs,
    });
  }

  const error = captureError(() =>
    enforcePasswordResetRequestRateLimit({
      requestIp: '203.0.113.200',
      email: 'vittima@esempio.it',
      nowMs,
    }),
  );

  assert.equal(isHttpError(error) && error.statusCode, 429);
});

test('il contatore per email non distingue le maiuscole', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  for (let index = 0; index < RESET_REQUEST_MAX_PER_EMAIL; index += 1) {
    enforcePasswordResetRequestRateLimit({
      requestIp: `203.0.113.${index}`,
      email: 'vittima@esempio.it',
      nowMs,
    });
  }

  const error = captureError(() =>
    enforcePasswordResetRequestRateLimit({
      requestIp: '203.0.113.200',
      email: 'VITTIMA@Esempio.IT',
      nowMs,
    }),
  );

  assert.equal(isHttpError(error) && error.statusCode, 429);
});

test('passata la finestra il recupero riparte', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  for (let index = 0; index < RESET_REQUEST_MAX_PER_EMAIL; index += 1) {
    enforcePasswordResetRequestRateLimit({
      requestIp: '203.0.113.7',
      email: 'utente@esempio.it',
      nowMs,
    });
  }

  assert.equal(
    captureError(() =>
      enforcePasswordResetRequestRateLimit({
        requestIp: '203.0.113.7',
        email: 'utente@esempio.it',
        nowMs: nowMs + RESET_REQUEST_WINDOW_MS,
      }),
    ),
    null,
  );
});

test('la conferma ha un contatore suo, che il limite della richiesta non tocca', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  // Si esaurisce del tutto il limite della RICHIESTA per questo indirizzo...
  for (let index = 0; index < RESET_REQUEST_MAX_PER_IP; index += 1) {
    enforcePasswordResetRequestRateLimit({
      requestIp: '203.0.113.7',
      email: `utente${index}@esempio.it`,
      nowMs,
    });
  }

  // ...e la conferma deve poter passare lo stesso: chi ha appena ricevuto il
  // link non c'entra con chi ha tempestato di richieste.
  assert.equal(
    captureError(() =>
      enforcePasswordResetConfirmRateLimit({ requestIp: '203.0.113.7', nowMs }),
    ),
    null,
  );
});

test('la conferma si ferma all undicesimo tentativo dallo stesso indirizzo IP', () => {
  resetPasswordRateLimitStoreForTests();
  const nowMs = 1_000_000;

  for (let index = 0; index < RESET_CONFIRM_MAX_PER_IP; index += 1) {
    enforcePasswordResetConfirmRateLimit({ requestIp: '203.0.113.7', nowMs });
  }

  const error = captureError(() =>
    enforcePasswordResetConfirmRateLimit({ requestIp: '203.0.113.7', nowMs }),
  );

  // E' il muro contro chi prova a indovinare token a raffica.
  assert.equal(isHttpError(error) && error.statusCode, 429);
});
