import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { checklistsRepository } from './checklists.repository.js';

/**
 * La tendina dell'assegnatario delle checklist davanti al Cestino (CRMA-130).
 *
 * Le due funzioni accettano una transazione, quindi si provano passando un
 * client finto che registra il `where`: si verifica che il filtro arrivi
 * davvero alla query, non solo che esista da qualche parte. Nessun database
 * (nota #76 per il runner: `node --test`, non Vitest).
 */

const WORKSPACE_ID = 'workspace-1';

const recordingClient = () => {
  const calls: Array<{ where: Record<string, unknown> }> = [];
  const record = async (args: { where: Record<string, unknown> }) => {
    calls.push(args);
    return null;
  };

  return {
    calls,
    client: {
      membership: {
        findFirst: record,
        findMany: async (args: { where: Record<string, unknown> }) => {
          calls.push(args);
          return [];
        },
      },
    } as unknown as Prisma.TransactionClient,
  };
};

test('la tendina "assegna a" non propone un membro cestinato', async () => {
  const { calls, client } = recordingClient();

  await checklistsRepository.listActiveWorkspaceMembers(WORKSPACE_ID, client);

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.where.deletedAt,
    null,
    'senza filtro chi e\' stato rimosso dal Team resta scegliibile come assegnatario',
  );
  assert.equal(
    calls[0]?.where.status,
    'ACTIVE',
    'lo stato resta necessario: cestinare non lo cambia, quindi da solo non basta',
  );
});

test('assegnare una checklist a un membro cestinato non passa la validazione', async () => {
  const { calls, client } = recordingClient();

  await checklistsRepository.findActiveWorkspaceMemberByUserId(WORKSPACE_ID, 'user-1', client);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.where, {
    workspaceId: WORKSPACE_ID,
    userId: 'user-1',
    status: 'ACTIVE',
    deletedAt: null,
  });
});
