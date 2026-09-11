import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { buildTeamMemberWriteWhere, teamRepository } from './team.repository.js';

/**
 * Le SCRITTURE del Team davanti al Cestino, provate senza database (CRMA-163).
 *
 * CRMA-130 ha messo il filtro sulle letture-lista; questo file copre l'altro
 * lato, che e' la stessa cecita' vista da dietro: `updateMembershipStatus`
 * rimetteva `status: 'ACTIVE'` **senza toccare `deletedAt`**. Il guasto e' del
 * tipo che non da' errore — il CRM risponde «riattivato», e la persona resta
 * fuori perche' la riga e' ancora cestinata e `grantsWorkspaceAccess` la
 * respinge su ogni rotta (`membership-access.ts`, CRMA-157).
 *
 * Stessa tecnica di `team.repository.membership.test.ts`: un client di
 * transazione finto che annota cosa gli e' stato chiesto. Il filtro e' proprio
 * la cosa che si vuole verificare senza montare un database.
 *
 * Runner: `node --test --import tsx` (nota #76, `server/` non gira con Vitest).
 */

const WORKSPACE_ID = 'workspace-1';
const MEMBER_ID = 'member-1';

/** Un client di transazione finto: non esegue niente, annota cosa gli e' stato chiesto. */
const recordingClient = () => {
  const calls: Array<{ where: unknown; data: unknown }> = [];

  return {
    calls,
    client: {
      membership: {
        updateMany: async (args: { where: unknown; data: unknown }) => {
          calls.push(args);
          return { count: 1 };
        },
      },
    } as unknown as Prisma.TransactionClient,
  };
};

test('la clausola di scrittura esclude chi e nel Cestino', () => {
  const where = buildTeamMemberWriteWhere(WORKSPACE_ID, MEMBER_ID);

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.id, MEMBER_ID);
  assert.equal(
    where.deletedAt,
    null,
    'senza questo filtro riattivare un cestinato scrive ACTIVE e lascia deletedAt: il CRM dice «riattivato» e ogni rotta risponde 403',
  );
});

test('updateMembershipStatus porta il filtro fino alla query, non solo nella clausola', async () => {
  const { calls, client } = recordingClient();

  await teamRepository.updateMembershipStatus(WORKSPACE_ID, MEMBER_ID, 'ACTIVE', client);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.where, {
    workspaceId: WORKSPACE_ID,
    id: MEMBER_ID,
    deletedAt: null,
  });
  assert.deepEqual(calls[0]?.data, { status: 'ACTIVE' });
});

test('vale anche per la disattivazione: il filtro non dipende dallo stato che si scrive', async () => {
  const { calls, client } = recordingClient();

  await teamRepository.updateMembershipStatus(WORKSPACE_ID, MEMBER_ID, 'INACTIVE', client);

  assert.equal((calls[0]?.where as { deletedAt?: unknown })?.deletedAt, null);
});

test('nessuna riga toccata significa falso, ed e cosi che il chiamante alza il 404', async () => {
  // `setMemberActiveState` traduce questo `false` in «Team member not found», che
  // per un cestinato e' la verita': dal Team non c'e', sta nel Cestino.
  const client = {
    membership: {
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as Prisma.TransactionClient;

  const updated = await teamRepository.updateMembershipStatus(
    WORKSPACE_ID,
    MEMBER_ID,
    'ACTIVE',
    client,
  );

  assert.equal(updated, false);
});

test('la clausola di scrittura e quella della scheda restano lo stesso perimetro', async () => {
  // Sono lo stesso filtro apposta: due letterali gemelli sono due letterali che
  // prima o poi divergono, e divergere qui vuol dire una porta che si riapre.
  const { buildFindMemberByIdWhere } = await import('./team.repository.js');

  assert.deepEqual(
    buildTeamMemberWriteWhere(WORKSPACE_ID, MEMBER_ID),
    buildFindMemberByIdWhere(WORKSPACE_ID, MEMBER_ID),
  );
});
