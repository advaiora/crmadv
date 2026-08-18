import { getOrCreateWorkspaceDEK } from '../vault/keys.js';
import { decryptAESGCM, encryptAESGCM } from '../vault/crypto/aesGcm.js';

// Cifratura a riposo della password del server di posta.
// Stesso impianto delle integrazioni (integrations.crypto.ts): DEK di workspace
// del vault + AES-256-GCM, con un AAD dedicato che lega il testo cifrato al
// workspace e al campo. L'AAD e' diverso da quello delle integrazioni apposta:
// cosi' un ciphertext non puo' essere spostato da un record all'altro, nemmeno
// da chi avesse accesso al database.

const encodeBase64 = (value: Buffer): string => value.toString('base64');
const decodeBase64 = (value: string): Buffer => Buffer.from(value, 'base64');

const buildMailSecretAAD = (workspaceId: string): Buffer =>
  Buffer.from(`mail-secret|workspace:${workspaceId}|field:password`, 'utf8');

export type EncryptedMailSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

// Esposto come oggetto cosi' i punti chiamata si possono sostituire nei test
// senza toccare la DEK o il database reale.
export const mailCrypto = {
  async encrypt(input: { workspaceId: string; value: string }): Promise<EncryptedMailSecret> {
    const dek = await getOrCreateWorkspaceDEK(input.workspaceId);
    const encrypted = encryptAESGCM({
      key: dek.key,
      aad: buildMailSecretAAD(input.workspaceId),
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
      aad: buildMailSecretAAD(input.workspaceId),
      ciphertext: decodeBase64(input.ciphertext),
      iv: decodeBase64(input.iv),
      authTag: decodeBase64(input.authTag),
    });

    // ⚠️ Nessun `trim` qui, di proposito: quello che si e' salvato e quello che
    // si usa devono essere la stessa cosa. Ripulire in lettura e non in
    // scrittura creerebbe proprio il guasto che sembra evitare — una password
    // che finisce con uno spazio verrebbe salvata intera e usata mozzata, senza
    // modo di accorgersene, perche' la password non si rilegge mai. La
    // ripulitura si fa una volta sola, al salvataggio (mail.service.ts).
    return plaintext.toString('utf8') || null;
  },
};
