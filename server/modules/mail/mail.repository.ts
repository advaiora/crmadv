import { prisma } from '../../prisma.js';

export type ImpostazioniMailRecord = {
  workspaceId: string;
  attivo: boolean;
  server: string;
  porta: number;
  connessioneSicura: boolean;
  retePrivataConsentita: boolean;
  utente: string | null;
  mittente: string;
  ciphertext: string | null;
  iv: string | null;
  authTag: string | null;
  keyVersion: number | null;
  updatedAt: Date;
};

export type SalvaImpostazioniMailInput = {
  workspaceId: string;
  attivo: boolean;
  server: string;
  porta: number;
  connessioneSicura: boolean;
  retePrivataConsentita: boolean;
  utente: string | null;
  mittente: string;
  /**
   * `undefined` = la password non si tocca (chi salva ha lasciato il campo
   * vuoto). `null` = la password va rimossa. Una stringa = la nuova busta
   * cifrata. Distinguere i tre casi e' l'unico modo per avere un campo segreto
   * che si puo' lasciare in bianco senza cancellarlo.
   */
  segreto?: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  } | null;
};

/**
 * Le colonne che escono da questo repository — una volta sola, perche' le due
 * query che le chiedono devono restituire la stessa cosa.
 *
 * ⚠️ Quando si aggiunge un campo a `ImpostazioniMailRecord` va aggiunto anche
 * qui, o si ottiene un campo che si salva e non si rilegge: un guasto che non
 * da' nessun errore e si vede solo ricaricando la maschera. Il test
 * «ogni campo del record e' chiesto al database» in `mail.repository.test.ts`
 * esiste apposta per non lasciarlo scoprire a chi usa il CRM.
 */
export const CAMPI_LETTI = {
  workspaceId: true,
  attivo: true,
  server: true,
  porta: true,
  connessioneSicura: true,
  retePrivataConsentita: true,
  utente: true,
  mittente: true,
  ciphertext: true,
  iv: true,
  authTag: true,
  keyVersion: true,
  updatedAt: true,
} as const;

export const mailRepository = {
  async findByWorkspaceId(workspaceId: string): Promise<ImpostazioniMailRecord | null> {
    return prisma.mailServerSettings.findUnique({
      where: { workspaceId },
      select: CAMPI_LETTI,
    });
  },

  async upsert(input: SalvaImpostazioniMailInput): Promise<ImpostazioniMailRecord> {
    const segretoData =
      input.segreto === undefined
        ? {}
        : input.segreto === null
          ? { ciphertext: null, iv: null, authTag: null, keyVersion: null }
          : input.segreto;

    const comuni = {
      attivo: input.attivo,
      server: input.server,
      porta: input.porta,
      connessioneSicura: input.connessioneSicura,
      retePrivataConsentita: input.retePrivataConsentita,
      utente: input.utente,
      mittente: input.mittente,
    };

    return prisma.mailServerSettings.upsert({
      where: { workspaceId: input.workspaceId },
      update: { ...comuni, ...segretoData },
      // Alla creazione non c'e' niente da conservare: se il segreto non e'
      // stato fornito la riga nasce senza password, che e' un caso legittimo
      // (server di posta aperto, senza autenticazione).
      create: {
        workspaceId: input.workspaceId,
        ...comuni,
        ...(input.segreto ?? {}),
      },
      select: CAMPI_LETTI,
    });
  },

  async deleteByWorkspaceId(workspaceId: string): Promise<void> {
    await prisma.mailServerSettings.deleteMany({ where: { workspaceId } });
  },
};
