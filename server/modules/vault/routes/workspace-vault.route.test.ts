import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { buildWorkspaceVaultRoute } from './workspace-vault.route.js';
import { vaultService } from '../service.js';
import type { VaultPermissionKey } from '../policies.js';

type EnsureVaultAccessFn = (
  request: FastifyRequest,
  permissionKey: VaultPermissionKey,
) => Promise<{
  user: { id: string };
  workspace: { id: string };
}>;

const createTestApp = async (input: {
  ensureVaultAccessFn?: EnsureVaultAccessFn;
  vaultServiceApi?: typeof vaultService;
}) => {
  const app = Fastify({ logger: false });
  const now = new Date();
  const baseVaultItemRecord = {
    id: 'item-1',
    workspaceId: 'workspace-1',
    name: 'Example',
    username: null,
    url: null,
    tags: [],
    ciphertext: 'ciphertext',
    iv: 'iv',
    authTag: 'authTag',
    version: 1,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    createdAt: now,
    updatedAt: now,
  };

  await app.register(
    buildWorkspaceVaultRoute({
      ensureVaultAccessFn:
        input.ensureVaultAccessFn
        ?? (async () => ({
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        })),
      vaultServiceApi:
        input.vaultServiceApi
        ?? ({
          parseListQuery: () => ({ limit: 50 }),
          listVaultItems: async () => ({
            items: [],
            nextCursor: null,
          }),
          parseCreatePayload: () => ({ name: 'x', username: null, url: null, tags: [], password: 'p', notes: null, extra: null }),
          createVaultItem: async () => baseVaultItemRecord,
          parseUpdatePayload: () => ({ name: 'Example' }),
          updateVaultItem: async () => baseVaultItemRecord,
          revealVaultItem: async () => ({
            id: 'item-1',
            password: 'secret',
            notes: null,
            extra: null,
          }),
          deleteVaultItem: async () => undefined,
        } as unknown as typeof vaultService),
    }),
  );

  return app;
};

const closeApp = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }
};

test('vault list response does not expose encrypted columns', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      vaultServiceApi: {
        ...vaultService,
        parseListQuery: () => ({ limit: 50 }),
        listVaultItems: async () => ({
          items: [
            {
              id: 'item-1',
              name: 'Database',
              username: 'admin',
              url: 'https://example.com',
              tags: ['prod'],
              createdAt: new Date(),
              updatedAt: new Date(),
              ciphertext: 'SHOULD_NOT_LEAK',
              iv: 'SHOULD_NOT_LEAK',
              authTag: 'SHOULD_NOT_LEAK',
            } as never,
          ],
          nextCursor: null,
        }),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/vault',
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      data: {
        items: Array<Record<string, unknown>>;
      };
    };

    assert.equal(body.data.items.length, 1);
    assert.equal('ciphertext' in body.data.items[0], false);
    assert.equal('iv' in body.data.items[0], false);
    assert.equal('authTag' in body.data.items[0], false);
  } finally {
    await closeApp(app);
  }
});
