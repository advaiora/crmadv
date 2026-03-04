import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { HttpError } from '../../../core/errors.js';
import { buildWorkspaceVaultRoute } from './workspace-vault.route.js';
import { stepUpService } from '../../security/stepup/service.js';
import { resetVaultRateLimitStoreForTests } from '../rate-limit.js';
import { vaultPolicyService } from '../vault-policy.service.js';
import { vaultService } from '../service.js';
import { vaultUnlockService } from '../vault-unlock.service.js';
import type { VaultPermissionKey } from '../policies.js';

type EnsureVaultAccessFn = (
  request: FastifyRequest,
  permissionKey: VaultPermissionKey,
  options?: { skipVaultUnlock?: boolean; skipStepUp?: boolean },
) => Promise<{
  user: { id: string };
  workspace: { id: string };
}>;
type InjectResponse = Awaited<ReturnType<FastifyInstance['inject']>>;

const createTestApp = async (input: {
  ensureVaultAccessFn?: EnsureVaultAccessFn;
  vaultServiceApi?: typeof vaultService;
  stepUpServiceApi?: typeof stepUpService;
  vaultPolicyServiceApi?: typeof vaultPolicyService;
  vaultUnlockServiceApi?: typeof vaultUnlockService;
  logVaultAuditFn?: (event: Record<string, unknown>) => Promise<void>;
} = {}) => {
  const app = Fastify({ logger: false });
  const now = new Date();
  const baseVaultItemRecord = {
    id: 'item-1',
    clientId: null,
    client: null,
    workspaceId: 'workspace-1',
    name: 'Example',
    username: null,
    url: null,
    tags: [],
    ciphertext: 'ciphertext',
    iv: 'iv',
    authTag: 'authTag',
    version: 1,
    keyVersion: 1,
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
          parseClientLookupQuery: () => ({ limit: 100 }),
          listVaultClients: async () => ([]),
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
      stepUpServiceApi:
        input.stepUpServiceApi
        ?? ({
          issueStepUpGrant: async () => undefined,
          setVaultPassword: async () => undefined,
        } as unknown as typeof stepUpService),
      vaultPolicyServiceApi:
        input.vaultPolicyServiceApi
        ?? ({
          getStatus: async () => ({ exists: true }),
          setupMasterPassword: async () => ({
            id: 'policy-1',
            workspaceId: 'workspace-1',
            passwordVersion: 1,
            createdAt: now,
            updatedAt: now,
          }),
          verifyPassword: async () => true,
        } as unknown as typeof vaultPolicyService),
      vaultUnlockServiceApi:
        input.vaultUnlockServiceApi
        ?? ({
          issueUnlockToken: () => undefined,
          verifyUnlock: () => true,
          clearUnlock: () => undefined,
        } as unknown as typeof vaultUnlockService),
      logVaultAuditFn: input.logVaultAuditFn as never,
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
    resetVaultRateLimitStoreForTests();
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

test('vault clients lookup returns workspace clients list', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    app = await createTestApp({
      vaultServiceApi: {
        ...vaultService,
        parseClientLookupQuery: () => ({ search: 'acme', limit: 20 }),
        listVaultClients: async () => ([
          { id: 'client-1', name: 'Acme', email: 'owner@acme.test' },
        ]),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/vault/lookups/clients?search=acme&limit=20',
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { data: { items: Array<{ id: string; name: string; email: string | null }> } };
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].id, 'client-1');
    assert.equal(body.data.items[0].name, 'Acme');
    assert.equal(body.data.items[0].email, 'owner@acme.test');
  } finally {
    await closeApp(app);
  }
});

test('vault status exposes setup/unlock state without requiring unlock guard', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    const accessCalls: Array<{ permissionKey: VaultPermissionKey; skipVaultUnlock: boolean; skipStepUp: boolean }> = [];

    app = await createTestApp({
      ensureVaultAccessFn: async (_request, permissionKey, options) => {
        accessCalls.push({
          permissionKey,
          skipVaultUnlock: options?.skipVaultUnlock === true,
          skipStepUp: options?.skipStepUp === true,
        });

        return {
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        };
      },
      vaultPolicyServiceApi: {
        getStatus: async () => ({ exists: true }),
        setupMasterPassword: async () => {
          throw new Error('not used');
        },
        verifyPassword: async () => false,
      } as unknown as typeof vaultPolicyService,
      vaultUnlockServiceApi: {
        issueUnlockToken: () => undefined,
        verifyUnlock: () => true,
        clearUnlock: () => undefined,
      } as unknown as typeof vaultUnlockService,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/vault/status',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(accessCalls.length, 1);
    assert.equal(accessCalls[0].permissionKey, 'vault.view_list');
    assert.equal(accessCalls[0].skipVaultUnlock, true);
    assert.equal(accessCalls[0].skipStepUp, true);

    const body = response.json() as { data: { exists: boolean; unlocked: boolean } };
    assert.equal(body.data.exists, true);
    assert.equal(body.data.unlocked, true);
  } finally {
    await closeApp(app);
  }
});

test('vault setup endpoint requires manage settings permission and returns unlocked status', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    const accessCalls: Array<{ permissionKey: VaultPermissionKey; skipVaultUnlock: boolean }> = [];
    let setupCalls = 0;
    let issueUnlockCalls = 0;
    const auditCalls: Array<Record<string, unknown>> = [];

    app = await createTestApp({
      ensureVaultAccessFn: async (_request, permissionKey, options) => {
        accessCalls.push({
          permissionKey,
          skipVaultUnlock: options?.skipVaultUnlock === true,
        });

        return {
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        };
      },
      vaultPolicyServiceApi: {
        getStatus: async () => ({ exists: false }),
        setupMasterPassword: async () => {
          setupCalls += 1;
          return {
            id: 'policy-1',
            workspaceId: 'workspace-1',
            passwordVersion: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
        verifyPassword: async () => false,
      } as unknown as typeof vaultPolicyService,
      vaultUnlockServiceApi: {
        issueUnlockToken: () => {
          issueUnlockCalls += 1;
        },
        verifyUnlock: () => false,
        clearUnlock: () => undefined,
      } as unknown as typeof vaultUnlockService,
      logVaultAuditFn: async (event) => {
        auditCalls.push(event);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/vault/setup',
      payload: {
        password: 'VaultGatePass123',
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(setupCalls, 1);
    assert.equal(issueUnlockCalls, 1);
    assert.equal(accessCalls.length, 1);
    assert.equal(accessCalls[0].permissionKey, 'vault.manage_settings');
    assert.equal(accessCalls[0].skipVaultUnlock, true);
    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].action, 'vault.unlock_success');
  } finally {
    await closeApp(app);
  }
});

test('vault unlock endpoint rejects invalid password with bad request and audits failure', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    const auditCalls: Array<Record<string, unknown>> = [];

    app = await createTestApp({
      vaultPolicyServiceApi: {
        getStatus: async () => ({ exists: true }),
        setupMasterPassword: async () => {
          throw new Error('not used');
        },
        verifyPassword: async () => false,
      } as unknown as typeof vaultPolicyService,
      vaultUnlockServiceApi: {
        issueUnlockToken: () => undefined,
        verifyUnlock: () => false,
        clearUnlock: () => undefined,
      } as unknown as typeof vaultUnlockService,
      logVaultAuditFn: async (event) => {
        auditCalls.push(event);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/vault/unlock',
      payload: {
        password: 'wrong-pass',
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].action, 'vault.unlock_fail');
  } finally {
    await closeApp(app);
  }
});

test('vault reveal response is marked as no-store', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/vault/item-1/reveal',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    const body = response.json() as { data: { secret: { password: string } } };
    assert.equal(body.data.secret.password, 'secret');
  } finally {
    await closeApp(app);
  }
});

test('vault reveal returns VAULT_LOCKED when access guard blocks locked workspace', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    app = await createTestApp({
      ensureVaultAccessFn: async (_request, permissionKey) => {
        if (permissionKey === 'vault.reveal') {
          throw new HttpError(423, 'VAULT_LOCKED', 'Vault is locked for this workspace');
        }

        return {
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        };
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/vault/item-1/reveal',
    });

    assert.equal(response.statusCode, 423);
    const body = response.json() as { error?: { code?: string }; code?: string };
    assert.equal(body.error?.code ?? body.code, 'VAULT_LOCKED');
  } finally {
    await closeApp(app);
  }
});

test('vault stepup endpoint is rate limited', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    app = await createTestApp();

    for (let index = 0; index < 5; index += 1) {
      const allowedResponse: InjectResponse = await (app as FastifyInstance).inject({
        method: 'POST',
        url: '/vault/stepup',
        payload: {
          purpose: 'vault.reveal',
          password: 'example',
        },
      });

      assert.equal(allowedResponse.statusCode, 204);
    }

    const limitedResponse: InjectResponse = await (app as FastifyInstance).inject({
      method: 'POST',
      url: '/vault/stepup',
      payload: {
        purpose: 'vault.reveal',
        password: 'example',
      },
    });

    assert.equal(limitedResponse.statusCode, 429);
    const body = limitedResponse.json() as { error?: { code?: string }; code?: string };
    assert.equal(body.error?.code ?? body.code, 'RATE_LIMITED');
  } finally {
    await closeApp(app);
  }
});

test('vault reveal endpoint is rate limited', async () => {
  let app: FastifyInstance | null = null;

  try {
    resetVaultRateLimitStoreForTests();
    app = await createTestApp();

    for (let index = 0; index < 30; index += 1) {
      const allowedResponse: InjectResponse = await (app as FastifyInstance).inject({
        method: 'POST',
        url: '/vault/item-1/reveal',
      });

      assert.equal(allowedResponse.statusCode, 200);
    }

    const limitedResponse: InjectResponse = await (app as FastifyInstance).inject({
      method: 'POST',
      url: '/vault/item-1/reveal',
    });

    assert.equal(limitedResponse.statusCode, 429);
    const body = limitedResponse.json() as { error?: { code?: string }; code?: string };
    assert.equal(body.error?.code ?? body.code, 'RATE_LIMITED');
  } finally {
    await closeApp(app);
  }
});
