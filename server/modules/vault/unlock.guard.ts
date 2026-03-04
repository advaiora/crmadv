import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../core/errors.js';
import { vaultUnlockService } from './vault-unlock.service.js';

export const requireVaultUnlocked = async (
  request: FastifyRequest,
  input: {
    userId: string;
    workspaceId: string;
  },
) => {
  const unlocked = vaultUnlockService.verifyUnlock({
    request,
    userId: input.userId,
    workspaceId: input.workspaceId,
  });

  if (!unlocked) {
    throw new HttpError(423, 'VAULT_LOCKED', 'Vault is locked for this workspace');
  }
};
