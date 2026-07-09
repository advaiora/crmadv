import { getOrCreateWorkspaceDEK } from '../vault/keys.js';
import { decryptAESGCM, encryptAESGCM } from '../vault/crypto/aesGcm.js';

// Cifratura a riposo dei segreti delle integrazioni (es. chiave API Brevo).
// Riusa la DEK di workspace del vault + AES-256-GCM, con un AAD dedicato che
// lega il testo cifrato a workspace + provider (difesa contro lo scambio di
// record tra workspace o provider diversi).

const encodeBase64 = (value: Buffer): string => value.toString('base64');
const decodeBase64 = (value: string): Buffer => Buffer.from(value, 'base64');

const buildIntegrationSecretAAD = (workspaceId: string, provider: string): Buffer =>
  Buffer.from(`integration-secret|workspace:${workspaceId}|provider:${provider}`, 'utf8');

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

// Esposto come oggetto così i punti chiamata possono essere mockati nei test
// senza toccare la DEK/DB reale.
export const integrationsCrypto = {
  async encrypt(input: {
    workspaceId: string;
    provider: string;
    value: string;
  }): Promise<EncryptedSecret> {
    const dek = await getOrCreateWorkspaceDEK(input.workspaceId);
    const encrypted = encryptAESGCM({
      key: dek.key,
      aad: buildIntegrationSecretAAD(input.workspaceId, input.provider),
      plaintext: Buffer.from(input.value, 'utf8'),
    });

    return {
      ciphertext: encodeBase64(encrypted.ciphertext),
      iv: encodeBase64(encrypted.iv),
      authTag: encodeBase64(encrypted.authTag),
      keyVersion: dek.keyVersion,
    };
  },

  async decrypt(input: {
    workspaceId: string;
    provider: string;
    ciphertext: string | null;
    iv: string | null;
    authTag: string | null;
    keyVersion: number | null;
  }): Promise<string | null> {
    if (!input.ciphertext || !input.iv || !input.authTag || !input.keyVersion) {
      return null;
    }

    const dek = await getOrCreateWorkspaceDEK(input.workspaceId, input.keyVersion);
    const plaintext = decryptAESGCM({
      key: dek.key,
      aad: buildIntegrationSecretAAD(input.workspaceId, input.provider),
      ciphertext: decodeBase64(input.ciphertext),
      iv: decodeBase64(input.iv),
      authTag: decodeBase64(input.authTag),
    });

    return plaintext.toString('utf8').trim() || null;
  },
};
