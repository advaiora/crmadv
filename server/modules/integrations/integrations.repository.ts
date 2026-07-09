import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

// Accesso ai dati delle integrazioni per workspace (V3 — layer integrazioni).

export type IntegrationRecord = Awaited<ReturnType<typeof prisma.integration.findFirst>>;

type UpsertIntegrationInput = {
  workspaceId: string;
  provider: string;
  enabled?: boolean;
  configJson?: Prisma.InputJsonValue | null;
  // Segreto cifrato: presente solo quando si aggiorna la chiave API.
  secret?: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  };
};

type SyncOutcomeInput = {
  workspaceId: string;
  provider: string;
  status: string;
  message: string | null;
  stats: Prisma.InputJsonValue | null;
  syncedAt: Date;
};

export const integrationsRepository = {
  list(workspaceId: string) {
    return prisma.integration.findMany({
      where: { workspaceId },
      orderBy: [{ provider: 'asc' }],
    });
  },

  findByProvider(workspaceId: string, provider: string) {
    return prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider } },
    });
  },

  async upsert(input: UpsertIntegrationInput) {
    const secretData = input.secret
      ? {
          ciphertext: input.secret.ciphertext,
          iv: input.secret.iv,
          authTag: input.secret.authTag,
          keyVersion: input.secret.keyVersion,
        }
      : {};

    return prisma.integration.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: input.workspaceId,
          provider: input.provider,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        enabled: input.enabled ?? false,
        configJson: input.configJson ?? Prisma.JsonNull,
        ...secretData,
      },
      update: {
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.configJson === undefined
          ? {}
          : { configJson: input.configJson ?? Prisma.JsonNull }),
        ...secretData,
      },
    });
  },

  recordSyncOutcome(input: SyncOutcomeInput) {
    return prisma.integration.update({
      where: {
        workspaceId_provider: {
          workspaceId: input.workspaceId,
          provider: input.provider,
        },
      },
      data: {
        lastSyncAt: input.syncedAt,
        lastSyncStatus: input.status,
        lastSyncMessage: input.message,
        lastSyncStats: input.stats ?? Prisma.JsonNull,
      },
    });
  },

  delete(workspaceId: string, provider: string) {
    return prisma.integration.deleteMany({
      where: { workspaceId, provider },
    });
  },
};
