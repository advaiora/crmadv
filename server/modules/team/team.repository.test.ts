import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSuperadminAssignmentsWhere,
  buildTeamMemberWriteWhere,
  classifyMembershipAdmission,
} from './team.repository.js';
import { markRestored, markTrashed } from '../../core/soft-delete.js';

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
 * Le due porte d'ingresso al Team, provate senza database (CRMA-163).
 *
 * Il difetto che questi test bloccano non da' errore e non si vede: le due sole
 * vie per riportare dentro una persona cestinata — reinvitarla, riaggiungerla a
 * mano — rispondono «e' gia' membro» perche' leggono il `Boolean` della riga
 * invece dei tre casi. Il rifiuto e' corretto per chi c'e' davvero, ed e' un
 * vicolo cieco per chi sta nel Cestino.
 */

const MOMENTO_DELLA_CESTINAZIONE = new Date('2026-09-11T10:00:00.000Z');

test('nessuna membership: la porta e aperta, e nessuno dei due gesti trova niente da rispettare', () => {
  assert.equal(classifyMembershipAdmission(null), 'none');
  assert.equal(classifyMembershipAdmission(undefined), 'none');
});

test('una membership viva blocca: e il rifiuto corretto, quello che questo compito NON tocca', () => {
  assert.equal(classifyMembershipAdmission({ status: 'ACTIVE', deletedAt: null }), 'present');
});

test('un membro disattivato resta present: si riaccende dal Team, non serve reinvitarlo', () => {
  // INACTIVE e' il caso che assomiglia di piu' al cestinato e non lo e': quella
  // persona nella lista del Team c'e', quindi rispondere «e gia membro» descrive
  // qualcosa che chi guarda lo schermo vede davvero.
  assert.equal(classifyMembershipAdmission({ status: 'INACTIVE', deletedAt: null }), 'present');
});

test('un membro cestinato NON blocca: e il terzo caso, quello che prima non esisteva', () => {
  const cestinato = {
    status: 'ACTIVE',
    ...markTrashed('user-admin', MOMENTO_DELLA_CESTINAZIONE),
  };

  assert.equal(
    classifyMembershipAdmission(cestinato),
    'trashed',
    'se questo torna present, reinvitare e riaggiungere rispondono entrambi che la persona e gia dentro mentre a schermo non c e',
  );
});

test('cestinare non cambia lo stato: e per questo che il solo status non basta a classificare', () => {
  const cestinato = { status: 'ACTIVE', ...markTrashed('user-admin', MOMENTO_DELLA_CESTINAZIONE) };

  assert.equal(cestinato.status, 'ACTIVE');
  assert.notEqual(classifyMembershipAdmission(cestinato), 'present');
});

test('dopo il ripristino la stessa riga torna a bloccare, senza altri gesti', () => {
  const ripristinato = { status: 'ACTIVE', ...markRestored() };

  assert.equal(classifyMembershipAdmission(ripristinato), 'present');
});

test('la scrittura sullo stato di un membro non raggiunge chi e nel Cestino', () => {
  const where = buildTeamMemberWriteWhere(WORKSPACE_ID, 'membership-1');

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.id, 'membership-1');
  assert.equal(
    where.deletedAt,
    null,
    'senza questo filtro riattivare un cestinato scrive ACTIVE e lascia deletedAt: la persona risulta riattivata e ogni rotta le risponde 403',
  );
});
