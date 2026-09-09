import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { HttpError } from '../../../core/errors.js';
import { resolveRequestClientIp } from '../../vault/rate-limit.js';
import { buildPasswordResetRoute } from './password-reset.route.js';

// Il servizio ha gia' le sue prove: qui si controlla il cablaggio, cioe' cio'
// che il servizio non puo' sapere — che le tre rotte esistano al percorso
// giusto, che il limite di frequenza scatti PRIMA del servizio, che l'IP
// arrivi fin dentro la riga salvata, e che nessuna delle tre chieda una
// sessione.

type ChiamataRichiesta = { body: unknown; requestIp: string | null };

const creaApp = async (input: {
  requestResetImpl?: () => Promise<void>;
  confirmResetImpl?: () => Promise<void>;
  limiteRichiestaImpl?: () => void;
  clientIp?: string;
} = {}) => {
  const richieste: ChiamataRichiesta[] = [];
  const conferme: unknown[] = [];
  const limitiApplicati: string[] = [];
  const app = Fastify({ logger: false });

  await app.register(
    buildPasswordResetRoute({
      passwordResetServiceApi: {
        requestReset: async (call: ChiamataRichiesta) => {
          richieste.push({ body: call.body, requestIp: call.requestIp });
          await input.requestResetImpl?.();
          return { requested: true as const, previewUrl: null };
        },
        checkToken: async () => ({ valid: true as const }),
        confirmReset: async (call: { body: unknown }) => {
          conferme.push(call.body);
          await input.confirmResetImpl?.();
          return { reset: true as const };
        },
      } as never,
      enforceRequestRateLimitFn: ((call: { requestIp: string; email: string }) => {
        limitiApplicati.push(`richiesta:${call.requestIp}:${call.email}`);
        input.limiteRichiestaImpl?.();
      }) as never,
      enforceConfirmRateLimitFn: ((call: { requestIp: string }) => {
        limitiApplicati.push(`conferma:${call.requestIp}`);
      }) as never,
      resolveClientIpFn: () => input.clientIp ?? '203.0.113.7',
    }),
  );

  await app.ready();
  return { app, richieste, conferme, limitiApplicati };
};

const chiudi = async (app: FastifyInstance) => {
  await app.close();
};

test('le tre rotte rispondono senza nessuna sessione', async () => {
  const { app } = await creaApp();

  try {
    const richiesta = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: { email: 'utente@esempio.it' },
    });
    const controllo = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/check',
      payload: { token: 'un-token' },
    });
    const conferma = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/confirm',
      payload: { token: 'un-token', newPassword: 'password-nuova-lunga' },
    });

    // Nessuna intestazione `authorization` in nessuna delle tre: se una di
    // queste tornasse 401, chi ha perso la password non potrebbe usarla.
    assert.equal(richiesta.statusCode, 200);
    assert.equal(controllo.statusCode, 200);
    assert.equal(conferma.statusCode, 200);
  } finally {
    await chiudi(app);
  }
});

test('la richiesta risponde 200 e non dice se l indirizzo esista', async () => {
  const { app } = await creaApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: { email: 'utente@esempio.it' },
    });

    // Nessun campo oltre a `requested`: niente che possa far distinguere un
    // indirizzo registrato da uno che non lo e'.
    assert.deepEqual(response.json(), { data: { requested: true } });
  } finally {
    await chiudi(app);
  }
});

test('l indirizzo IP arriva al servizio, per finire in requestIp', async () => {
  const { app, richieste } = await creaApp({ clientIp: '198.51.100.42' });

  try {
    await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: { email: 'utente@esempio.it' },
    });

    assert.deepEqual(richieste, [
      { body: { email: 'utente@esempio.it' }, requestIp: '198.51.100.42' },
    ]);
  } finally {
    await chiudi(app);
  }
});

test('un IP illeggibile diventa null, non la stringa unknown', async () => {
  const { app, richieste } = await creaApp({ clientIp: 'unknown' });

  try {
    await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: { email: 'utente@esempio.it' },
    });

    // Con `'unknown'` salvato a database, tutte le richieste senza IP leggibile
    // finirebbero nello stesso secchio e si bloccherebbero a vicenda.
    assert.equal(richieste[0].requestIp, null);
  } finally {
    await chiudi(app);
  }
});

test('il limite di frequenza scatta PRIMA del servizio, e il servizio non viene chiamato', async () => {
  const { app, richieste } = await creaApp({
    limiteRichiestaImpl: () => {
      throw new HttpError(429, 'RATE_LIMITED', 'Troppe richieste di recupero password.');
    },
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: { email: 'utente@esempio.it' },
    });

    assert.equal(response.statusCode, 429);
    assert.deepEqual(richieste, []);
  } finally {
    await chiudi(app);
  }
});

test('il limite della richiesta conta per IP e per email insieme', async () => {
  const { app, limitiApplicati } = await creaApp({ clientIp: '198.51.100.42' });

  try {
    await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: { email: 'Utente@Esempio.IT' },
    });

    // L'email va normalizzata prima di diventare una chiave, altrimenti
    // cambiare le maiuscole basterebbe per avere un contatore nuovo.
    assert.deepEqual(limitiApplicati, ['richiesta:198.51.100.42:utente@esempio.it']);
  } finally {
    await chiudi(app);
  }
});

test('una richiesta senza email consuma comunque un gettone del limite', async () => {
  const { app, limitiApplicati } = await creaApp({ clientIp: '198.51.100.42' });

  try {
    await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: {},
    });

    // Altrimenti mandare corpi vuoti sarebbe un modo per non consumare mai il
    // limite pur tenendo occupata l'API.
    assert.deepEqual(limitiApplicati, ['richiesta:198.51.100.42:(assente)']);
  } finally {
    await chiudi(app);
  }
});

test('anche la conferma ha il suo limite, per IP', async () => {
  const { app, limitiApplicati } = await creaApp({ clientIp: '198.51.100.42' });

  try {
    await app.inject({
      method: 'POST',
      url: '/auth/password/reset/confirm',
      payload: { token: 'un-token', newPassword: 'password-nuova-lunga' },
    });

    assert.deepEqual(limitiApplicati, ['conferma:198.51.100.42']);
  } finally {
    await chiudi(app);
  }
});

test('il rifiuto del servizio esce come 400 col suo codice, non come 500', async () => {
  const { app } = await creaApp({
    confirmResetImpl: async () => {
      throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Questo link non è più valido.');
    },
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/confirm',
      payload: { token: 'un-token', newPassword: 'password-nuova-lunga' },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error?.code ?? response.json().code, 'INVALID_RESET_TOKEN');
  } finally {
    await chiudi(app);
  }
});

test('la conferma non restituisce nessun token di sessione', async () => {
  const { app } = await creaApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/confirm',
      payload: { token: 'un-token', newPassword: 'password-nuova-lunga' },
    });

    assert.deepEqual(response.json(), { data: { reset: true } });
  } finally {
    await chiudi(app);
  }
});

// ── Regressione: i rilievi 1 e 2 del Guardiano su CRMA-25 ────────────────────
// Le prove qui sopra iniettano un risolutore finto, che e' giusto per provare
// il cablaggio ma non direbbe niente sull'unico input non filtrato della rotta.
// Queste due usano il risolutore VERO, con la richiesta che arriva davvero
// dalla rete.

const creaAppConRisolutoreVero = async () => {
  const richieste: (string | null)[] = [];
  const chiaviDelLimite: string[] = [];
  const app = Fastify({ logger: false });

  await app.register(
    buildPasswordResetRoute({
      passwordResetServiceApi: {
        requestReset: async (call: ChiamataRichiesta) => {
          richieste.push(call.requestIp);
          return { requested: true as const, previewUrl: null };
        },
        checkToken: async () => ({ valid: true as const }),
        confirmReset: async () => ({ reset: true as const }),
      } as never,
      enforceRequestRateLimitFn: ((call: { requestIp: string }) => {
        chiaviDelLimite.push(call.requestIp);
      }) as never,
      enforceConfirmRateLimitFn: (() => {}) as never,
      resolveClientIpFn: resolveRequestClientIp,
    }),
  );

  await app.ready();
  return { app, richieste, chiaviDelLimite };
};

test('un X-Forwarded-For troppo lungo per la colonna non arriva al database', async () => {
  // Il difetto originale: questo valore finiva in `PasswordResetToken.requestIp`
  // (`VarChar(64)`), PostgreSQL rifiutava l'insert, e poiche' l'insert sta solo
  // nel ramo «utente trovato» la rotta rispondeva 500 per gli indirizzi
  // registrati e 200 per gli altri. Cioe' rivelava quali email hanno un account.
  const { app, richieste } = await creaAppConRisolutoreVero();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/reset/request',
      payload: { email: 'utente@esempio.it' },
      headers: { 'x-forwarded-for': 'A'.repeat(100) },
    });

    assert.equal(response.statusCode, 200);

    const [requestIp] = richieste;
    assert.equal(richieste.length, 1);
    assert.ok(
      requestIp === null || requestIp.length <= 64,
      `alla riga da salvare e arrivato un indirizzo di ${requestIp?.length} caratteri: l insert esplode e l oracolo di esistenza degli account e riaperto`,
    );
  } finally {
    await chiudi(app);
  }
});

test('cambiare X-Forwarded-For a ogni richiesta non regala un secchio nuovo', async () => {
  const { app, chiaviDelLimite } = await creaAppConRisolutoreVero();

  try {
    for (const forgiato of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      await app.inject({
        method: 'POST',
        url: '/auth/password/reset/request',
        payload: { email: 'utente@esempio.it' },
        headers: { 'x-forwarded-for': forgiato },
      });
    }

    assert.equal(chiaviDelLimite.length, 3);
    assert.equal(
      new Set(chiaviDelLimite).size,
      1,
      `tre richieste dallo stesso chiamante hanno prodotto ${new Set(chiaviDelLimite).size} chiavi diverse: il limite per IP si aggira con un intestazione`,
    );
  } finally {
    await chiudi(app);
  }
});
