import assert from 'node:assert/strict';
import test from 'node:test';
import { markTrashed } from '../../core/soft-delete.js';
import {
  buildSuperadminAssignmentsWhere,
  buildTrashMembershipWhere,
} from './team.repository.js';

/**
 * La protezione dell'ultimo Superadmin, provata senza database (CRMA-157).
 *
 * E' il punto piu' grave dei sette: `countActiveSuperadminMembers` e
 * `isSuperadmin` decidono chi comanda il modulo Team e quanti Superadmin
 * restano. Un cestinato che continuasse a contare farebbe da riempitivo alla
 * protezione (`team.service.ts:305`, `:362-363`, `:430-431`), che lascerebbe
 * quindi passare la rimozione dell'ultimo Superadmin reale.
 */

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';

const membershipFilter = (where: ReturnType<typeof buildSuperadminAssignmentsWhere>) =>
  (where.user as { memberships: { some: Record<string, unknown> } }).memberships.some;

test('un membro cestinato non conta in countActiveSuperadminMembers', () => {
  const some = membershipFilter(buildSuperadminAssignmentsWhere(WORKSPACE_ID));

  assert.equal(some.workspaceId, WORKSPACE_ID);
  assert.equal(some.status, 'ACTIVE');
  assert.equal(
    some.deletedAt,
    null,
    'senza questo filtro un Superadmin cestinato tiene in piedi da solo la protezione dell ultimo Superadmin',
  );
});

test('isSuperadmin guarda lo stesso filtro, piu il singolo utente', () => {
  const where = buildSuperadminAssignmentsWhere(WORKSPACE_ID, USER_ID);

  assert.equal(where.userId, USER_ID);
  assert.equal(membershipFilter(where).deletedAt, null);
});

test('il conteggio non filtra per utente: i due usi condividono il costruttore ma non il perimetro', () => {
  const where = buildSuperadminAssignmentsWhere(WORKSPACE_ID);

  assert.equal('userId' in where, false, 'il conteggio deve vedere tutti i Superadmin del workspace');
  assert.deepEqual(where.role, { isSuperadmin: true });
});

/**
 * Il gesto che cestina un membro del Team (CRMA-165).
 *
 * «Rimuovi dal Team» non cancella piu' la riga: la sposta nel cestino. Le tre
 * guardie (solo Superadmin, non te stesso, non l'ultimo Superadmin attivo)
 * stanno in `assertMembershipDestroyable` e non si provano qui perche'
 * leggono dal database; qui si prova la clausola, che e' la parte muta.
 */
test('cestinare un membro resta dentro il workspace e chiede anche di quale persona sia', () => {
  const where = buildTrashMembershipWhere(WORKSPACE_ID, 'member-1', USER_ID);

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.id, 'member-1');
  // `userId` non e' un di piu': la membership e la persona devono combaciare,
  // altrimenti un id di membership sbagliato cestinerebbe la riga di un altro.
  assert.equal(where.userId, USER_ID);
});

test('un membro gia cestinato non si ricestina', () => {
  assert.equal(buildTrashMembershipWhere(WORKSPACE_ID, 'member-1', USER_ID).deletedAt, null);
});

test('cestinare un membro NON tocca le sue assegnazioni di ruolo', () => {
  // Regola 1 del Cestino: cestinare non cancella niente, cosi' chi viene
  // ripristinato torna con i ruoli che aveva senza ricucire niente a mano.
  // La cancellazione fisica delle `UserRole` resta in `deleteMember`, che da
  // oggi e' il gesto dell'eliminazione definitiva (`trash.purge`).
  const dati = markTrashed(USER_ID);

  assert.deepEqual(Object.keys(dati).sort(), ['deletedAt', 'deletedByUserId']);
});
