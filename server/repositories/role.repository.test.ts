import assert from 'node:assert/strict';
import test from 'node:test';
import { markTrashed } from '../core/soft-delete.js';
import {
  buildLiveRoleWhere,
  buildLiveRolesByIdsWhere,
  buildLiveRolesWhere,
  buildRoleAssignmentsWhere,
  buildRoleNameWhere,
  buildTrashRoleWhere,
  buildUserCustomRolesWhere,
} from './role.repository.js';

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
const USER_ID = 'user-1';

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

/**
 * Le letture dei ruoli dopo il Cestino (CRMA-132).
 *
 * Qui sotto si prova una cosa sola, ripetuta per ogni lettura: che il ruolo nel
 * cestino non esca. Sembra ripetitivo ed e' il punto — la regola del Cestino e'
 * che il filtro manchi in ZERO letture, e un elenco di casi e' il modo in cui la
 * prossima lettura aggiunta a questo file si accorge di doverlo avere.
 */

test('il catalogo Ruoli e permessi non propone un ruolo cestinato', () => {
  const where = buildLiveRolesWhere(WORKSPACE_ID);

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.deletedAt, null);
});

test('un ruolo cestinato non si apre ne si modifica: per chi legge per id non esiste', () => {
  const where = buildLiveRoleWhere(WORKSPACE_ID, ROLE_ID);

  assert.equal(where.id, ROLE_ID);
  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.deletedAt, null);
});

test('un ruolo cestinato non e assegnabile: la lettura per id non lo restituisce', () => {
  const where = buildLiveRolesByIdsWhere(WORKSPACE_ID, [ROLE_ID, 'role-2']);

  assert.deepEqual(where.id, { in: [ROLE_ID, 'role-2'] });
  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.deletedAt, null);
});

test('i ruoli personalizzati di una persona escludono i cestinati e quelli di sistema', () => {
  const where = buildUserCustomRolesWhere(WORKSPACE_ID, USER_ID);

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.userId, USER_ID);
  assert.deepEqual(where.role, { isSystem: false, deletedAt: null });
});

test("il controllo sul nome NON filtra il cestino, ed e' l'unica lettura che non lo fa", () => {
  // Il vincolo `@@unique([workspaceId, name])` vale anche sulle righe cestinate:
  // se questa lettura filtrasse, `createRole` non vedrebbe il ruolo nel cestino,
  // tenterebbe l'inserimento e prenderebbe un errore del database (500) al posto
  // di un rifiuto spiegato (400). Il test sta qui perche' la prossima persona che
  // "uniforma i filtri" trovi scritto perche' questo e' diverso.
  const where = buildRoleNameWhere(WORKSPACE_ID, 'Commerciale');

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.name, 'Commerciale');
  assert.ok(!('deletedAt' in where));
});

test('un ruolo assegnato solo a persone cestinate risulta libero', () => {
  // La decisione che la scheda di CRMA-132 lasciava aperta: si sblocca. Quelle
  // assegnazioni non danno piu' niente a nessuno, quindi «ruolo ancora in uso»
  // sarebbe falso — e terrebbe il ruolo fermo per sempre, perche' una persona
  // nel cestino puo' restarci a tempo indeterminato.
  const where = buildRoleAssignmentsWhere(WORKSPACE_ID, ROLE_ID);

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.roleId, ROLE_ID);
  assert.deepEqual(where.user, {
    memberships: {
      some: {
        workspaceId: WORKSPACE_ID,
        status: 'ACTIVE',
        deletedAt: null,
      },
    },
  });
});
