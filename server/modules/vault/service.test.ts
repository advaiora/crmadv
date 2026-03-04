import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { HttpError } from '../../core/errors.js';
import { decryptAESGCM, encryptAESGCM } from './crypto/aesGcm.js';
import { buildVaultService } from './service.js';
import type { CreateVaultItemInput } from './types.js';

test('createVaultItem persists encrypted payload only (no plaintext fields)', async () => {
  let capturedCreateInput: Record<string, unknown> | null = null;
  const now = new Date();
  const service = buildVaultService({
    vaultRepoApi: {
      listVaultItems: async () => ({ items: [], nextCursor: null }),
      getVaultItemById: async () => null,
      createVaultItem: async (_workspaceId: string, input: CreateVaultItemInput) => {
        capturedCreateInput = input as unknown as Record<string, unknown>;
        return {
          id: 'vault-item-1',
          clientId: null,
          client: null,
          workspaceId: 'workspace-1',
          name: 'CRM',
          username: 'admin',
          url: 'https://example.com',
          tags: ['prod'],
          ciphertext: String((input as { payload: { ciphertext: string } }).payload.ciphertext),
          iv: String((input as { payload: { iv: string } }).payload.iv),
          authTag: String((input as { payload: { authTag: string } }).payload.authTag),
          version: 1,
          keyVersion: 7,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
          createdAt: now,
          updatedAt: now,
        };
      },
      updateVaultItem: async () => null,
      deleteVaultItem: async () => false,
    } as never,
    getWorkspaceDekFn: async () => ({ key: randomBytes(32), keyVersion: 7 }),
    encryptFn: encryptAESGCM,
    decryptFn: decryptAESGCM,
    logAuditFn: async () => undefined as never,
    auditRevealFn: async () => undefined as never,
    createIdFn: () => 'vault-item-1',
  });

  await service.createVaultItem({
    workspaceId: 'workspace-1',
    actorUserId: 'user-1',
    body: {
      name: 'CRM',
      username: 'admin',
      password: 'super-secret-password',
      notes: 'sensitive note',
      tags: ['prod'],
    },
  });

  assert.ok(capturedCreateInput);
  assert.equal('password' in (capturedCreateInput as Record<string, unknown>), false);
  assert.equal('notes' in (capturedCreateInput as Record<string, unknown>), false);

  const payload = (capturedCreateInput as { payload: Record<string, unknown> }).payload;
  assert.ok(typeof payload.ciphertext === 'string' && payload.ciphertext.length > 0);
  assert.ok(typeof payload.iv === 'string' && payload.iv.length > 0);
  assert.ok(typeof payload.authTag === 'string' && payload.authTag.length > 0);
  assert.equal(payload.keyVersion, 7);
  assert.notEqual(payload.ciphertext, 'super-secret-password');
});

test('revealVaultItem returns generic error when decrypt fails', async () => {
  const keyForWrite = randomBytes(32);
  const keyForRead = randomBytes(32);
  const aad = Buffer.from('vault:v1|workspace:workspace-1|item:item-1', 'utf8');
  const encrypted = encryptAESGCM({
    key: keyForWrite,
    plaintext: Buffer.from(JSON.stringify({ password: 'secret', notes: null }), 'utf8'),
    aad,
  });

  const service = buildVaultService({
    vaultRepoApi: {
      listVaultItems: async () => ({ items: [], nextCursor: null }),
      getVaultItemById: async () => ({
        id: 'item-1',
        clientId: null,
        client: null,
        workspaceId: 'workspace-1',
        name: 'Demo',
        username: null,
        url: null,
        tags: [],
        ciphertext: encrypted.ciphertext.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64'),
        version: 1,
        keyVersion: 1,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      createVaultItem: async () => {
        throw new Error('not used');
      },
      updateVaultItem: async () => null,
      deleteVaultItem: async () => false,
    } as never,
    getWorkspaceDekFn: async () => ({ key: keyForRead, keyVersion: 1 }),
    encryptFn: encryptAESGCM,
    decryptFn: decryptAESGCM,
    logAuditFn: async () => undefined as never,
    auditRevealFn: async () => undefined as never,
    createIdFn: () => 'unused',
  });

  await assert.rejects(
    () =>
      service.revealVaultItem({
        workspaceId: 'workspace-1',
        actorUserId: 'user-1',
        vaultItemId: 'item-1',
      }),
    (error) =>
      error instanceof HttpError
      && error.statusCode === 400
      && error.message === 'Invalid vault payload',
  );
});
