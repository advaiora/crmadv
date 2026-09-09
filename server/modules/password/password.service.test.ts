import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import type { FastifyRequest } from 'fastify';
import { PASSWORD_SALT_ROUNDS } from '../../auth/password-policy.js';
import { isHttpError } from '../../core/errors.js';
import { buildPasswordService } from './password.service.js';

const fakeRequest = {} as FastifyRequest;

type AuditEntry = {
  event?: string;
  metadata?: unknown;
  actorUserId?: string;
  workspaceId: string;
};

// Il finto bcrypt: un hash e' la stringa `hash:<password>`. Cosi' il test non
// paga i 12 giri di bcrypt veri e resta leggibile.
const fakeHash = (password: string) => `hash:${password}`;

const createService = (input: {
  passwordHash: string | null;
  userExists?: boolean;
} = { passwordHash: fakeHash('vecchia-password') }) => {
  const auditLog: AuditEntry[] = [];
  const updatedHashes: Array<{ userId: string; passwordHash: string }> = [];

  const service = buildPasswordService({
    userRepositoryApi: {
      findByIdForLogin: async () =>
        (input.userExists === false
          ? null
          : {
              id: 'user-1',
              email: 'persona@example.com',
              name: 'Persona',
              role: 'member',
              isPlatformAdmin: false,
              passwordHash: input.passwordHash,
              vaultPasswordHash: null,
            }) as never,
      updatePasswordHash: async (userId: string, passwordHash: string) => {
        updatedHashes.push({ userId, passwordHash });
        return {} as never;
      },
    } as never,
    comparePasswordFn: async (password: string, hash: string) => fakeHash(password) === hash,
    hashPasswordFn: async (password: string) => fakeHash(password),
    auditLogFn: (async (entry: AuditEntry) => {
      auditLog.push(entry);
      return {} as never;
    }) as never,
  });

  return { service, auditLog, updatedHashes };
};

const changeOwnPassword = (
  service: ReturnType<typeof buildPasswordService>,
  body: unknown,
) =>
  service.changeOwnPassword({
    request: fakeRequest,
    userId: 'user-1',
    workspaceId: 'workspace-1',
    body,
  });

const captureError = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    return error;
  }

  throw new Error('Era attesa una eccezione, ma la chiamata e andata a buon fine');
};

test('con la password attuale giusta scrive il nuovo hash e registra l esito', async () => {
  const { service, auditLog, updatedHashes } = createService({ passwordHash: fakeHash('vecchia-password') });

  await changeOwnPassword(service, {
    currentPassword: 'vecchia-password',
    newPassword: 'nuova-password',
  });

  assert.deepEqual(updatedHashes, [
    { userId: 'user-1', passwordHash: fakeHash('nuova-password') },
  ]);
  assert.equal(auditLog.length, 1);
  assert.equal(auditLog[0]?.event, 'auth.password.changed');
  assert.equal(auditLog[0]?.actorUserId, 'user-1');
  assert.equal(auditLog[0]?.workspaceId, 'workspace-1');
  assert.deepEqual(auditLog[0]?.metadata, {
    route: '/auth/password/change',
    outcome: 'success',
  });
});

test('con la password attuale sbagliata rifiuta con 400, non con 401', async () => {
  const { service, auditLog, updatedHashes } = createService({ passwordHash: fakeHash('vecchia-password') });

  const error = await captureError(() =>
    changeOwnPassword(service, {
      currentPassword: 'sbagliata',
      newPassword: 'nuova-password',
    }));

  assert.ok(isHttpError(error));
  // Il 400 non e' un dettaglio di gusto: `src/lib/apiFetch.ts` cancella la
  // sessione su qualunque 401, quindi un 401 qui sloggherebbe dal CRM chi ha
  // solo sbagliato a digitare.
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, 'INVALID_CURRENT_PASSWORD');
  assert.deepEqual(updatedHashes, []);
  assert.equal(auditLog.length, 1);
  assert.equal(auditLog[0]?.event, 'auth.password.change_failed');
  assert.deepEqual(auditLog[0]?.metadata, {
    route: '/auth/password/change',
    outcome: 'failed',
    reason: 'invalid_current_password',
  });
});

test('il rifiuto non racconta quale delle due password non torna', async () => {
  const { service } = createService({ passwordHash: fakeHash('vecchia-password') });

  const error = await captureError(() =>
    changeOwnPassword(service, {
      currentPassword: 'sbagliata',
      newPassword: 'nuova-password',
    }));

  assert.ok(isHttpError(error));
  assert.equal(error.message, 'La password attuale non è corretta.');
  assert.equal(error.details, undefined);
  // Nessuna traccia della password provata nel messaggio o nei dettagli.
  assert.ok(!JSON.stringify(error.details ?? null).includes('sbagliata'));
});

test('chi entra solo con Google riceve 409 PASSWORD_NOT_SET, non un errore interno', async () => {
  const { service, auditLog, updatedHashes } = createService({ passwordHash: null });

  const error = await captureError(() =>
    changeOwnPassword(service, {
      currentPassword: 'qualunque',
      newPassword: 'nuova-password',
    }));

  assert.ok(isHttpError(error));
  assert.equal(error.statusCode, 409);
  assert.equal(error.code, 'PASSWORD_NOT_SET');
  assert.match(error.message, /Google/);
  assert.deepEqual(updatedHashes, []);
  assert.equal(auditLog[0]?.event, 'auth.password.change_failed');
  assert.deepEqual((auditLog[0]?.metadata as { reason: string }).reason, 'password_not_set');
});

test('la nuova password uguale alla vecchia viene rifiutata', async () => {
  const { service, auditLog, updatedHashes } = createService({ passwordHash: fakeHash('vecchia-password') });

  const error = await captureError(() =>
    changeOwnPassword(service, {
      currentPassword: 'vecchia-password',
      newPassword: 'vecchia-password',
    }));

  assert.ok(isHttpError(error));
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, 'PASSWORD_UNCHANGED');
  assert.deepEqual(updatedHashes, []);
  assert.deepEqual((auditLog[0]?.metadata as { reason: string }).reason, 'password_unchanged');
});

test('la nuova password sotto gli 8 caratteri viene rifiutata prima di toccare il database', async () => {
  const { service, auditLog, updatedHashes } = createService({ passwordHash: fakeHash('vecchia-password') });

  const error = await captureError(() =>
    changeOwnPassword(service, {
      currentPassword: 'vecchia-password',
      newPassword: 'corta',
    }));

  assert.ok(isHttpError(error));
  assert.equal(error.statusCode, 400);
  assert.deepEqual(updatedHashes, []);
  // Payload malformato: nemmeno si sa ancora chi sia l'utente, quindi non c'e'
  // niente da scrivere nel registro attivita'.
  assert.deepEqual(auditLog, []);
});

test('un campo di troppo nel payload viene rifiutato', async () => {
  const { service } = createService({ passwordHash: fakeHash('vecchia-password') });

  const error = await captureError(() =>
    changeOwnPassword(service, {
      currentPassword: 'vecchia-password',
      newPassword: 'nuova-password',
      userId: 'user-2',
    }));

  assert.ok(isHttpError(error));
  assert.equal(error.statusCode, 400);
});

test('se il portatore del token non esiste piu, li il 401 e corretto', async () => {
  const { service, auditLog } = createService({ passwordHash: null, userExists: false });

  const error = await captureError(() =>
    changeOwnPassword(service, {
      currentPassword: 'vecchia-password',
      newPassword: 'nuova-password',
    }));

  assert.ok(isHttpError(error));
  assert.equal(error.statusCode, 401);
  assert.deepEqual(auditLog, []);
});

// Le prove qui sopra usano un finto bcrypt (`hash:<password>`) per restare
// veloci e leggibili. Questa invece usa quello vero, ed e' l'unica che risponde
// alla domanda che decide se il lavoro e' finito: «il successivo accesso funziona
// con la nuova password e fallisce con la vecchia?». Il confronto e' esattamente
// quello che fa l'accesso in `server/routes/auth.route.ts` (`bcrypt.compare`),
// quindi provarlo qui vale quanto provarlo di la', senza database.
test('con bcrypt vero, l hash scritto accetta la password nuova e rifiuta la vecchia', async () => {
  const vecchia = 'vecchia-password';
  const nuova = 'nuova-password-sicura';
  const hashVecchio = await bcrypt.hash(vecchia, PASSWORD_SALT_ROUNDS);
  const updatedHashes: string[] = [];

  const service = buildPasswordService({
    userRepositoryApi: {
      findByIdForLogin: async () => ({ id: 'user-1', passwordHash: hashVecchio }) as never,
      updatePasswordHash: async (_userId: string, passwordHash: string) => {
        updatedHashes.push(passwordHash);
        return {} as never;
      },
    } as never,
    comparePasswordFn: bcrypt.compare,
    hashPasswordFn: bcrypt.hash,
    auditLogFn: (async () => ({}) as never) as never,
  });

  await service.changeOwnPassword({
    request: fakeRequest,
    userId: 'user-1',
    workspaceId: 'workspace-1',
    body: { currentPassword: vecchia, newPassword: nuova },
  });

  const hashNuovo = updatedHashes[0];
  assert.ok(hashNuovo, 'nessun hash e stato scritto');
  assert.notEqual(hashNuovo, hashVecchio);
  assert.equal(await bcrypt.compare(nuova, hashNuovo), true);
  assert.equal(await bcrypt.compare(vecchia, hashNuovo), false);
});
