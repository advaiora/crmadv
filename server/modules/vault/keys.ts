import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { decryptAESGCM, encryptAESGCM } from './crypto/aesGcm.js';
import { getMasterKey } from './crypto/masterKey.js';

const WORKSPACE_DEK_LENGTH_BYTES = 32;
const INITIAL_WORKSPACE_KEY_VERSION = 1;
const LEGACY_PLACEHOLDER_PREFIX = 'phase2-placeholder:';

type WrappedWorkspaceDEK = {
  wrappedKey: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

type WorkspaceDekRecord = {
  id: string;
  workspaceId: string;
  wrappedKey: string;
  iv: string | null;
  authTag: string | null;
  keyVersion: number;
  isActive: boolean;
};

export type WorkspaceDEKResult = {
  key: Buffer;
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

const canUnwrapWorkspaceDEK = (record: WorkspaceDekRecord) =>
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

const unwrapWorkspaceDekRecord = (record: WorkspaceDekRecord): WorkspaceDEKResult => {
  if (!canUnwrapWorkspaceDEK(record)) {
    throw new Error('Workspace encryption key material is not usable.');
  }

  return {
    key: unwrapWorkspaceDEK({
      workspaceId: record.workspaceId,
      wrappedKey: record.wrappedKey,
      iv: record.iv as string,
      authTag: record.authTag as string,
      keyVersion: record.keyVersion,
    }),
    keyVersion: record.keyVersion,
  };
};

const getLatestWorkspaceKeyRecord = (workspaceId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) =>
  tx.workspaceVaultKey.findFirst({
    where: { workspaceId },
    orderBy: { keyVersion: 'desc' },
  });

const getActiveWorkspaceKeyRecord = (workspaceId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) =>
  tx.workspaceVaultKey.findFirst({
    where: {
      workspaceId,
      isActive: true,
    },
    orderBy: { keyVersion: 'desc' },
  });

const createWorkspaceKeyVersion = async (input: {
  workspaceId: string;
  keyVersion: number;
  tx?: Prisma.TransactionClient;
}) => {
  const tx = input.tx ?? prisma;
  const dek = randomBytes(WORKSPACE_DEK_LENGTH_BYTES);
  const wrapped = wrapWorkspaceDEK(input.workspaceId, dek, input.keyVersion);

  await tx.workspaceVaultKey.create({
    data: {
      workspaceId: input.workspaceId,
      ...wrapped,
      isActive: true,
    },
  });

  return {
    key: dek,
    keyVersion: input.keyVersion,
  } satisfies WorkspaceDEKResult;
};

const resolveActiveWorkspaceDek = async (workspaceId: string): Promise<WorkspaceDEKResult> => {
  const activeRecord = await getActiveWorkspaceKeyRecord(workspaceId);
  if (activeRecord) {
    if (canUnwrapWorkspaceDEK(activeRecord)) {
      return unwrapWorkspaceDekRecord(activeRecord);
    }

    // Legacy/incomplete material: keep old version for decrypt compatibility and issue a fresh active key.
    return rotateWorkspaceKey(workspaceId);
  }

  const latestRecord = await getLatestWorkspaceKeyRecord(workspaceId);
  const initialVersion = latestRecord ? latestRecord.keyVersion + 1 : INITIAL_WORKSPACE_KEY_VERSION;

  try {
    return await createWorkspaceKeyVersion({
      workspaceId,
      keyVersion: initialVersion,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const racedActiveRecord = await getActiveWorkspaceKeyRecord(workspaceId);
      if (racedActiveRecord && canUnwrapWorkspaceDEK(racedActiveRecord)) {
        return unwrapWorkspaceDekRecord(racedActiveRecord);
      }
    }

    throw error;
  }
};

const resolveWorkspaceDekByVersion = async (
  workspaceId: string,
  keyVersion: number,
): Promise<WorkspaceDEKResult> => {
  const record = await prisma.workspaceVaultKey.findFirst({
    where: {
      workspaceId,
      keyVersion,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new Error('Workspace encryption key version not found.');
  }

  return unwrapWorkspaceDekRecord(record);
};

export const getOrCreateWorkspaceDEK = async (
  workspaceId: string,
  keyVersion?: number,
): Promise<WorkspaceDEKResult> => {
  if (typeof keyVersion === 'number') {
    return resolveWorkspaceDekByVersion(workspaceId, keyVersion);
  }

  return resolveActiveWorkspaceDek(workspaceId);
};

export const rotateWorkspaceKey = async (workspaceId: string): Promise<WorkspaceDEKResult> => {
  return prisma.$transaction(async (tx) => {
    const latest = await getLatestWorkspaceKeyRecord(workspaceId, tx);
    const nextKeyVersion = latest ? latest.keyVersion + 1 : INITIAL_WORKSPACE_KEY_VERSION;

    await tx.workspaceVaultKey.updateMany({
      where: {
        workspaceId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return createWorkspaceKeyVersion({
      workspaceId,
      keyVersion: nextKeyVersion,
      tx,
    });
  });
};

