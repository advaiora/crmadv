import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrantingUserRoleWhere } from '../../repositories/rbac.repository.js';
import { ensureWorkspaceAccessDefaults, resolveFallbackWorkspaceRoleName } from './auth.workspace-defaults.js';

/**
 * L'auto-riparazione dell'accesso, dal Cestino in poi (CRMA-132, rilievo del
 * Guardiano su CRMA-131).
 *
 * Qui il `where` giusto non basta provarlo dov'e' scritto: il difetto era
 * **questo chiamante** che ne usava un altro. Quindi si prova che la funzione
 * vera passi al conteggio la condizione vera, con una transazione finta.
 *
 * La transazione finta e' un Proxy che risponde solo a `userRole.count` e spara
 * su qualunque altra cosa: subito dopo il conteggio arriva
 * `ensureWorkspaceSystemRoles`, che vorrebbe un database intero. Il colpo viene
 * catturato, e a quel punto il conteggio e' gia' stato osservato — che e' tutto
 * cio' che questo test deve vedere. Runner: `node --test` (nota #76).
 */

const USER_ID = 'user-1';
const WORKSPACE_ID = 'workspace-1';
const OLTRE_IL_CONTEGGIO = Symbol('oltre il conteggio');

const txCheOsservaIlConteggio = (conteggio: number) => {
  const whereOsservati: unknown[] = [];

  const tx = new Proxy(
    {
      userRole: {
        count: ({ where }: { where: unknown }) => {
          whereOsservati.push(where);
          return Promise.resolve(conteggio);
        },
      },
    } as Record<string, unknown>,
    {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop as string];
        }

        throw OLTRE_IL_CONTEGGIO;
      },
    },
  );

  return { tx, whereOsservati };
};

const eseguiFinoAlConteggio = async (tx: unknown) => {
  try {
    await ensureWorkspaceAccessDefaults({
      tx: tx as Parameters<typeof ensureWorkspaceAccessDefaults>[0]['tx'],
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      fallbackUserRole: 'operativo',
      sourceAction: 'test',
    });
  } catch (error) {
    // Solo il colpo atteso: un errore vero deve restare visibile.
    if (error !== OLTRE_IL_CONTEGGIO) {
      throw error;
    }
  }
};

test('il conteggio dell auto-riparazione esclude i ruoli cestinati', async () => {
  const { tx, whereOsservati } = txCheOsservaIlConteggio(1);

  await eseguiFinoAlConteggio(tx);

  assert.equal(whereOsservati.length, 1);
  // La stessa condizione che il resto del codice considera valida, non una copia
  // scritta a mano che poi invecchia da sola.
  assert.deepEqual(whereOsservati[0], buildGrantingUserRoleWhere(USER_ID, WORKSPACE_ID));
});

test('il conteggio nudo non torna di nascosto', async () => {
  // Il difetto che c'era: `{ workspaceId, userId }` senza il ruolo. Se qualcuno
  // lo riscrive cosi', questo test cade invece di restare verde.
  const { tx, whereOsservati } = txCheOsservaIlConteggio(1);

  await eseguiFinoAlConteggio(tx);

  const where = whereOsservati[0] as { role?: { deletedAt?: unknown } };
  assert.equal(where.role?.deletedAt, null);
});

test('il ruolo di ripiego resta quello di prima', () => {
  // Il conteggio cambia CHI viene riparato, non con che ruolo: la tabella dei
  // ripieghi non e' toccata da questo lavoro.
  assert.equal(resolveFallbackWorkspaceRoleName('manager'), 'Manager');
  assert.equal(resolveFallbackWorkspaceRoleName(null), 'Viewer');
});
