const MASTER_KEY_ENV_NAME = 'ENCRYPTION_KEY';
const AES_256_KEY_LENGTH_BYTES = 32;

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

let cachedMasterKey: Buffer | null = null;

const parseBase64Key = (value: string): Buffer | null => {
  const normalized = value.trim();
  if (!BASE64_PATTERN.test(normalized)) {
    return null;
  }

  const decoded = Buffer.from(normalized, 'base64');
  return decoded.length === AES_256_KEY_LENGTH_BYTES ? decoded : null;
};

export const parseMasterKeyFromEnv = (rawValue: string | undefined): Buffer => {
  if (!rawValue || rawValue.trim().length === 0) {
    throw new Error('Missing ENCRYPTION_KEY. Configure a 32-byte encryption key.');
  }

  const normalized = rawValue.trim();
  const utf8Length = Buffer.byteLength(normalized, 'utf8');
  if (utf8Length === AES_256_KEY_LENGTH_BYTES) {
    return Buffer.from(normalized, 'utf8');
  }

  const decodedBase64 = parseBase64Key(normalized);
  if (decodedBase64) {
    return decodedBase64;
  }

  throw new Error('Invalid ENCRYPTION_KEY format. Expected 32-byte raw text or base64-encoded 32-byte key.');
};

export const getMasterKey = (): Buffer => {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  cachedMasterKey = parseMasterKeyFromEnv(process.env[MASTER_KEY_ENV_NAME]);
  return cachedMasterKey;
};

export const resetMasterKeyCacheForTests = () => {
  cachedMasterKey = null;
};

