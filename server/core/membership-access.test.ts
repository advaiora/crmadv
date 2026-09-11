import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_MEMBER,
  MEMBERSHIP_ACCESS_SELECT,
  activeMember,
  grantsWorkspaceAccess,
  markMembershipReactivated,
} from './membership-access.js';
import { markRestored, markTrashed } from './soft-delete.js';

/**
 * La catena di accesso al workspace, provata senza database (CRMA-157).
 *
 * Si provano le funzioni invece delle query per la stessa ragione di
 * `messaging/repository.test.ts` (CRMA-133): `server/prisma.ts` esporta un Proxy
 * che spara se il client non e' inizializzato, montare un database per
 * verificare un filtro sarebbe sproporzionato, e il filtro e' esattamente la
 * cosa che puo' sfuggire. Runner: `node --test`, non Vitest (nota #76).
 */

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';
const ACTOR_ID = 'user-admin';

test('lo stato ACTIVE da solo non basta: cestinare non cambia lo stato della membership', () => {
  // E' il fraintendimento che genera tutti e sette i punti di questo compito.
  assert.equal(ACTIVE_MEMBER.status, 'ACTIVE');
  assert.equal(ACTIVE_MEMBER.deletedAt, null);
});

test('activeMember non mangia il resto del where', () => {
  const where = activeMember({ workspaceId: WORKSPACE_ID, userId: USER_ID });

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.userId, USER_ID);
  assert.equal(where.status, 'ACTIVE');
  assert.equal(where.deletedAt, null);
});

test('il select di isMember chiede deletedAt: senza, la riga non saprebbe di essere cestinata', () => {
  // Un `select` che non nomina `deletedAt` fa tornare `undefined`, e
  // `undefined` non e' cestinato: il guard lascerebbe passare tutti.
  assert.equal(MEMBERSHIP_ACCESS_SELECT.deletedAt, true);
  assert.equal(MEMBERSHIP_ACCESS_SELECT.status, true);
});

test('un membro con deletedAt valorizzata non passa isMember', () => {
  const cestinato = {
    status: 'ACTIVE',
    ...markTrashed(ACTOR_ID, new Date('2026-09-11T10:00:00.000Z')),
  };

  assert.equal(
    grantsWorkspaceAccess(cestinato),
    false,
    'una membership cestinata resta ACTIVE: se questo passa, ogni rotta del CRM resta aperta a chi e stato tolto',
  );
});

test('lo stesso membro, dopo markRestored(), ripassa senza altri gesti', () => {
  const ripristinato = { status: 'ACTIVE', ...markRestored() };

  assert.equal(
    grantsWorkspaceAccess(ripristinato),
    true,
    'il ripristino deve riaprire l accesso da solo, senza nessuna migrazione dati',
  );
});

test('gli altri modi di non essere membro continuano a valere', () => {
  assert.equal(grantsWorkspaceAccess({ status: 'INACTIVE', deletedAt: null }), false);
  assert.equal(grantsWorkspaceAccess(null), false, 'nessuna membership: non sei membro');
  assert.equal(grantsWorkspaceAccess(undefined), false);
});

test("l'accettazione di un invito riporta indietro una membership cestinata", () => {
  // Il difetto speculare: senza questo, l'invito riesce, viene emesso un token
  // di sessione valido, e poi ogni rotta risponde 403 senza spiegare perche'.
  const update = markMembershipReactivated();

  assert.equal(update.status, 'ACTIVE');
  assert.equal(update.deletedAt, null, 'rimettere il solo status lascia la riga nel cestino');
  assert.equal(update.deletedByUserId, null, 'anche l etichetta di chi ha cestinato va via');
});
