import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { HttpError } from '../../../core/errors.js';
import { resetPasswordRateLimitStoreForTests } from '../rate-limit.js';
import { buildPasswordRoute } from './password.route.js';

// Il servizio ha gia' le sue prove: qui si controlla solo il cablaggio, cioe' le
// tre cose che il servizio non puo' sapere — che la rotta esista al percorso
// giusto, che l'ordine sia autenticazione → workspace → limite → servizio, e che
// l'errore del servizio esca col suo codice invece di diventare un 500.

type ChangeCall = {
  userId: string;
  workspaceId: string;
  body: unknown;
};

const createTestApp = async (input: {
  changeOwnPasswordImpl?: (call: ChangeCall) => Promise<void>;
  requireAuthImpl?: () => Promise<{ id: string }>;
} = {}) => {
  const changeCalls: ChangeCall[] = [];
  const app = Fastify({ logger: false });

  await app.register(
    buildPasswordRoute({
      requireAuthFn: (input.requireAuthImpl ?? (async () => ({ id: 'user-1' }))) as never,
      requireWorkspaceFn: (async () => ({ id: 'workspace-1' })) as never,
      passwordServiceApi: {
        changeOwnPassword: async (call: ChangeCall) => {
          changeCalls.push({
            userId: call.userId,
            workspaceId: call.workspaceId,
            body: call.body,
          });
          await input.changeOwnPasswordImpl?.(call);
        },
      } as never,
      enforceRateLimitFn: () => undefined,
    }),
  );

  await app.ready();
  return { app, changeCalls };
};

const closeApp = async (app: FastifyInstance) => {
  await app.close();
};

const validPayload = {
  currentPassword: 'vecchia-password',
  newPassword: 'nuova-password-sicura',
};

test('la rotta risponde a POST /auth/password/change e passa utente e workspace al servizio', async () => {
  resetPasswordRateLimitStoreForTests();
  const { app, changeCalls } = await createTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/change',
      payload: validPayload,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(changeCalls, [
      { userId: 'user-1', workspaceId: 'workspace-1', body: validPayload },
    ]);
  } finally {
    await closeApp(app);
  }
});

// Il campo esiste per non far credere risolto cio' che non lo e': finche' il JWT
// resta senza revoca, cambiare la password non chiude le altre sessioni.
test('la risposta dichiara che le altre sessioni NON sono state chiuse', async () => {
  resetPasswordRateLimitStoreForTests();
  const { app } = await createTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/change',
      payload: validPayload,
    });

    assert.deepEqual(response.json(), {
      data: { changed: true, otherSessionsRevoked: false },
    });
  } finally {
    await closeApp(app);
  }
});

test('il rifiuto del servizio esce come 400, non come 500 e non come 401', async () => {
  resetPasswordRateLimitStoreForTests();
  const { app } = await createTestApp({
    changeOwnPasswordImpl: async () => {
      throw new HttpError(400, 'INVALID_CURRENT_PASSWORD', 'La password attuale non è corretta.');
    },
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/change',
      payload: validPayload,
    });

    // 401 qui sloggherebbe dal CRM chi ha solo sbagliato a digitare
    // (`src/lib/apiFetch.ts` cancella la sessione su qualunque 401).
    assert.equal(response.statusCode, 400);
  } finally {
    await closeApp(app);
  }
});

test('senza sessione valida il servizio non viene nemmeno chiamato', async () => {
  resetPasswordRateLimitStoreForTests();
  const { app, changeCalls } = await createTestApp({
    requireAuthImpl: async () => {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication token is missing');
    },
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password/change',
      payload: validPayload,
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(changeCalls, []);
  } finally {
    await closeApp(app);
  }
});
