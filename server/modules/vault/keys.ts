import { randomBytes } from 'node:crypto';
import { prisma } from '../../prisma.js';

const generateWrappedKeyPlaceholder = () => {
  // TODO(vault-phase-3): replace placeholder with envelope wrapping using ENCRYPTION_KEY (AES-256-GCM).
  return `phase2-placeholder:${randomBytes(32).toString('base64')}`;
};

export const getOrCreateWorkspaceVaultKeyRecord = async (workspaceId: string) => {
  const existing = await prisma.workspaceVaultKey.findUnique({
    where: {
      workspaceId,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.workspaceVaultKey.create({
    data: {
      workspaceId,
      wrappedKey: generateWrappedKeyPlaceholder(),
      keyVersion: 1,
    },
  });
};

