import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { decryptAESGCM, encryptAESGCM } from './crypto/aesGcm.js';
import { getMasterKey } from './crypto/masterKey.js';

const WORKSPACE_DEK_LENGTH_BYTES = 32;
const WORKSPACE_DEK_VERSION = 1;
const LEGACY_PLACEHOLDER_PREFIX = 'phase2-placeholder:';

type WrappedWorkspaceDEK = {
  wrappedKey: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

const encodeBase64 = (value: Buffer): string => value.toString('base64');

const decodeBase64 = (value: string): Buffer => Buffer.from(value, 'base64');

const buildWorkspaceDekAad = (workspaceId: string, keyVersion: number): Buffer =>
  Buffer.from(`vault:workspace-dek:v${keyVersion}|workspace:${workspaceId}`, 'utf8');

const wrapWorkspaceDEK = (workspaceId: string, dek: Buffer, keyVersion: number): WrappedWorkspaceDEK => {
  const masterKey = getMasterKey();
  const aad = buildWorkspaceDekAad(workspaceId, keyVersion);
  const encrypted = encryptAESGCM({
    key: masterKey,
    plaintext: dek,
    aad,
  });

  return {
    wrappedKey: encodeBase64(encrypted.ciphertext),
    iv: encodeBase64(encrypted.iv),
    authTag: encodeBase64(encrypted.authTag),
    keyVersion,
  };
};

const canUnwrapWorkspaceDEK = (record: {
  wrappedKey: string;
  iv: string | null;
  authTag: string | null;
  keyVersion: number;
}) =>
  Boolean(record.iv)
  && Boolean(record.authTag)
  && record.keyVersion >= 1
  && !record.wrappedKey.startsWith(LEGACY_PLACEHOLDER_PREFIX);

const unwrapWorkspaceDEK = (input: {
  workspaceId: string;
  wrappedKey: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}): Buffer => {
  const masterKey = getMasterKey();
  const aad = buildWorkspaceDekAad(input.workspaceId, input.keyVersion);

  let dek: Buffer;
  try {
    dek = decryptAESGCM({
      key: masterKey,
      ciphertext: decodeBase64(input.wrappedKey),
      iv: decodeBase64(input.iv),
      authTag: decodeBase64(input.authTag),
      aad,
    });
  } catch {
    throw new Error('Unable to unwrap workspace encryption key.');
  }

  if (dek.length !== WORKSPACE_DEK_LENGTH_BYTES) {
    throw new Error('Invalid workspace encryption key material.');
  }

  return dek;
};

const createOrRotateWorkspaceKey = async (workspaceId: string, existingId?: string): Promise<Buffer> => {
  const dek = randomBytes(WORKSPACE_DEK_LENGTH_BYTES);
  const wrapped = wrapWorkspaceDEK(workspaceId, dek, WORKSPACE_DEK_VERSION);

  if (existingId) {
    await prisma.workspaceVaultKey.update({
      where: { id: existingId },
      data: wrapped,
    });
    return dek;
  }

  try {
    await prisma.workspaceVaultKey.create({
      data: {
        workspaceId,
        ...wrapped,
      },
    });
    return dek;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const latest = await prisma.workspaceVaultKey.findUnique({
        where: { workspaceId },
      });

      if (latest && canUnwrapWorkspaceDEK(latest)) {
        return unwrapWorkspaceDEK({
          workspaceId,
          wrappedKey: latest.wrappedKey,
          iv: latest.iv as string,
          authTag: latest.authTag as string,
          keyVersion: latest.keyVersion,
        });
      }
    }

    throw error;
  }
};

export const getOrCreateWorkspaceDEK = async (workspaceId: string): Promise<Buffer> => {
  const existing = await prisma.workspaceVaultKey.findUnique({
    where: {
      workspaceId,
    },
  });

  if (!existing) {
    return createOrRotateWorkspaceKey(workspaceId);
  }

  if (canUnwrapWorkspaceDEK(existing)) {
    return unwrapWorkspaceDEK({
      workspaceId,
      wrappedKey: existing.wrappedKey,
      iv: existing.iv as string,
      authTag: existing.authTag as string,
      keyVersion: existing.keyVersion,
    });
  }

  return createOrRotateWorkspaceKey(workspaceId, existing.id);
};
