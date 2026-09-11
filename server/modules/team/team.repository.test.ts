import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSuperadminAssignmentsWhere } from './team.repository.js';

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
