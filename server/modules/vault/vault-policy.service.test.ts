import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../core/errors.js';
import { buildVaultPolicyService } from './vault-policy.service.js';

test('setupMasterPassword creates policy only once', async () => {
  const workspacePolicies = new Map<string, { hash: string }>();

  const service = buildVaultPolicyService({
    prismaClient: {
      workspaceVaultPolicy: {
        findUnique: async ({ where }: { where: { workspaceId: string } }) => {
          const record = workspacePolicies.get(where.workspaceId);
          return record ? { id: 'policy-1', masterPasswordHash: record.hash } : null;
        },
        create: async ({ data }: { data: { workspaceId: string; masterPasswordHash: string } }) => {
          workspacePolicies.set(data.workspaceId, { hash: data.masterPasswordHash });
          return {
            id: 'policy-1',
            workspaceId: data.workspaceId,
            passwordVersion: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      },
    } as never,
    hashPasswordFn: async (password: string) => `hash:${password}`,
    comparePasswordFn: async (password: string, hash: string) => hash === `hash:${password}`,
  });

  await service.setupMasterPassword('workspace-1', 'user-1', 'VaultPass123');

  await assert.rejects(
    () => service.setupMasterPassword('workspace-1', 'user-1', 'VaultPass123'),
    (error) => error instanceof HttpError && error.statusCode === 409,
  );
});

test('verifyPassword validates stored workspace password hash', async () => {
  const service = buildVaultPolicyService({
    prismaClient: {
      workspaceVaultPolicy: {
        findUnique: async ({ where }: { where: { workspaceId: string } }) => {
          if (where.workspaceId !== 'workspace-1') {
            return null;
          }

          return {
            masterPasswordHash: 'hash:VaultPass123',
          };
        },
      },
    } as never,
    hashPasswordFn: async () => 'unused',
    comparePasswordFn: async (password: string, hash: string) => hash === `hash:${password}`,
  });

  assert.equal(await service.verifyPassword('workspace-1', 'VaultPass123'), true);
  assert.equal(await service.verifyPassword('workspace-1', 'wrong-password'), false);
  assert.equal(await service.verifyPassword('workspace-2', 'VaultPass123'), false);
});
