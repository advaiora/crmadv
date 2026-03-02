import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const AES_256_GCM_ALGORITHM = 'aes-256-gcm';
const AES_256_KEY_LENGTH_BYTES = 32;
const AES_GCM_IV_LENGTH_BYTES = 12;
const AES_GCM_AUTH_TAG_LENGTH_BYTES = 16;

type AESGCMInput = {
  key: Buffer;
  aad: Buffer;
};

type EncryptAESGCMInput = AESGCMInput & {
  plaintext: Buffer;
};

type DecryptAESGCMInput = AESGCMInput & {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export type AESGCMEncryptedPayload = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

const assertValidKey = (key: Buffer) => {
  if (key.length !== AES_256_KEY_LENGTH_BYTES) {
    throw new Error('Invalid AES-256-GCM key length');
  }
};

const assertValidAad = (aad: Buffer) => {
  if (aad.length === 0) {
    throw new Error('Invalid AES-256-GCM AAD');
  }
};

export const encryptAESGCM = (input: EncryptAESGCMInput): AESGCMEncryptedPayload => {
  assertValidKey(input.key);
  assertValidAad(input.aad);

  const iv = randomBytes(AES_GCM_IV_LENGTH_BYTES);
  const cipher = createCipheriv(AES_256_GCM_ALGORITHM, input.key, iv);
  cipher.setAAD(input.aad);

  const ciphertext = Buffer.concat([cipher.update(input.plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv,
    authTag,
  };
};

export const decryptAESGCM = (input: DecryptAESGCMInput): Buffer => {
  assertValidKey(input.key);
  assertValidAad(input.aad);

  if (input.iv.length !== AES_GCM_IV_LENGTH_BYTES) {
    throw new Error('Invalid AES-256-GCM IV length');
  }

  if (input.authTag.length !== AES_GCM_AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Invalid AES-256-GCM auth tag length');
  }

  const decipher = createDecipheriv(AES_256_GCM_ALGORITHM, input.key, input.iv);
  decipher.setAAD(input.aad);
  decipher.setAuthTag(input.authTag);

  return Buffer.concat([decipher.update(input.ciphertext), decipher.final()]);
};

