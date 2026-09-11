import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  buildFindMemberByIdWhere,
  buildListMembersWhere,
  teamRepository,
} from './team.repository.js';

/**
 * Le letture del Team davanti al Cestino (CRMA-130).
 *
 * Due tecniche, perche' le funzioni non sono tutte raggiungibili allo stesso
 * modo: le clausole estratte si provano da sole, mentre le funzioni che
 * accettano una transazione si provano passando un client finto che registra
 * il `where` ricevuto. In nessuno dei due casi serve un database — e il filtro
 * e' proprio la cosa che si vuole verificare senza montarne uno.
 *
 * Runner: `node --test --import tsx` (nota #76, `server/` non gira con Vitest).
 */

const WORKSPACE_ID = 'workspace-1';

/** Un client di transazione finto: non esegue niente, annota cosa gli e' stato chiesto. */
const recordingClient = () => {
  const calls: Array<{ where: unknown; select: unknown }> = [];
  const record = async (args: { where: unknown; select: unknown }) => {
    calls.push(args);
    return null;
  };

  return {
    calls,
    client: {
      membership: {
        findFirst: record,
        findMany: async (args: { where: unknown; select: unknown }) => {
          calls.push(args);
          return [];
        },
      },
    } as unknown as Prisma.TransactionClient,
  };
};

test('la lista Team non mostra un membro cestinato', () => {
  const where = buildListMembersWhere(WORKSPACE_ID);

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(
    where.deletedAt,
    null,
    'e\' la lettura della pagina Team: senza filtro il membro rimosso resta a schermo',
  );
});

test('la scheda di un membro cestinato non si apre piu\' dal Team', () => {
  const where = buildFindMemberByIdWhere(WORKSPACE_ID, 'member-1');

  assert.equal(where.id, 'member-1');
  assert.equal(where.deletedAt, null);
});

test('findMemberById porta il filtro fino alla query, non solo nella clausola', async () => {
  const { calls, client } = recordingClient();

  await teamRepository.findMemberById(WORKSPACE_ID, 'member-1', client);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.where, {
    workspaceId: WORKSPACE_ID,
    id: 'member-1',
    deletedAt: null,
  });
});

test('findMembershipByUserId vede ANCHE i cestinati, di proposito', async () => {
  // Non e' una lista: e' la prova di unicita' che gira prima di creare una
  // membership. La coppia (workspaceId, userId) resta unica anche da cestinata,
  // quindi nascondere qui la riga farebbe provare un inserimento che sbatte sul
  // vincolo — un 500 al posto di un messaggio. Se qualcuno "uniformasse" questa
  // funzione alle altre aggiungendoci notDeleted, questo test diventa rosso.
  const { calls, client } = recordingClient();

  await teamRepository.findMembershipByUserId(WORKSPACE_ID, 'user-1', client);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.where, {
    workspaceId: WORKSPACE_ID,
    userId: 'user-1',
  });
  assert.equal(
    (calls[0]?.select as { deletedAt?: boolean })?.deletedAt,
    true,
    'senza deletedAt il chiamante non puo\' distinguere «gia\' membro» da «nel Cestino»',
  );
});
