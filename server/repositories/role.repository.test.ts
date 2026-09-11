import assert from 'node:assert/strict';
import test from 'node:test';
import { markTrashed } from '../core/soft-delete.js';
import { buildTrashRoleWhere } from './role.repository.js';

/**
 * Il gesto che cestina un ruolo (CRMA-165).
 *
 * «Elimina ruolo» non cancella piu' la riga: la sposta nel cestino, con lo
 * stesso permesso di prima (`roles.manage`). Le due guardie che contano —
 * un ruolo di sistema non si tocca, un ruolo ancora assegnato a qualcuno
 * nemmeno — restano nel servizio e leggono dal database, quindi qui si prova
 * la clausola, che e' la parte che puo' sbagliarsi in silenzio.
 *
 * Vedi la nota #76 per il runner: `server/` gira con `node --test`, non con
 * Vitest.
 */

const WORKSPACE_ID = 'workspace-1';
const ROLE_ID = 'role-1';

test('cestinare un ruolo resta dentro il suo workspace', () => {
  const where = buildTrashRoleWhere(WORKSPACE_ID, ROLE_ID);

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.id, ROLE_ID);
});

test('un ruolo gia nel cestino non si ricestina', () => {
  // Il secondo gesto riscriverebbe data e autore del primo, cioe' toglierebbe
  // dalla pagina Cestino il nome di chi quel ruolo l'aveva davvero buttato.
  assert.equal(buildTrashRoleWhere(WORKSPACE_ID, ROLE_ID).deletedAt, null);
});

test('cestinare un ruolo scrive chi e quando, e non tocca i permessi del ruolo', () => {
  const istante = new Date('2026-09-11T10:00:00.000Z');
  const dati = markTrashed('user-7', istante);

  assert.deepEqual(dati, {
    deletedAt: istante,
    deletedByUserId: 'user-7',
  });
  // Regola 1 del Cestino: nessuna cascata parte. I `RolePermission` restano
  // dove sono, ed e' il motivo per cui un ruolo ripristinato torna completo
  // senza che nessuno debba ricostruirgli i permessi a mano.
  assert.deepEqual(Object.keys(dati).sort(), ['deletedAt', 'deletedByUserId']);
});
