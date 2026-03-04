import bcrypt from 'bcrypt';
import { z } from 'zod';
import { badRequest, conflict } from '../../core/errors.js';
import { prisma } from '../../prisma.js';

const PASSWORD_SALT_ROUNDS = 12;

const vaultMasterPasswordSchema = z.string().min(8).max(1024);

const parseVaultMasterPassword = (password: unknown) => {
  const parsed = vaultMasterPasswordSchema.safeParse(password);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
};

export type VaultPolicyStatus = {
  exists: boolean;
};

type VaultPolicyServiceDependencies = {
  prismaClient: typeof prisma;
  hashPasswordFn: (password: string, rounds: number) => Promise<string>;
  comparePasswordFn: (password: string, hash: string) => Promise<boolean>;
};

const defaultDependencies: VaultPolicyServiceDependencies = {
  prismaClient: prisma,
  hashPasswordFn: bcrypt.hash,
  comparePasswordFn: bcrypt.compare,
};

export const buildVaultPolicyService = (
  dependencies: VaultPolicyServiceDependencies = defaultDependencies,
) => {
  return {
    async getStatus(workspaceId: string): Promise<VaultPolicyStatus> {
      const policy = await dependencies.prismaClient.workspaceVaultPolicy.findUnique({
        where: {
          workspaceId,
        },
        select: {
          id: true,
        },
      });

      return {
        exists: Boolean(policy),
      };
    },

    async setupMasterPassword(
      workspaceId: string,
      _actorUserId: string,
      password: string,
    ) {
      const normalizedPassword = parseVaultMasterPassword(password);
      if (!normalizedPassword) {
        throw badRequest('Invalid vault master password');
      }

      const existing = await dependencies.prismaClient.workspaceVaultPolicy.findUnique({
        where: {
          workspaceId,
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        throw conflict('Vault workspace password is already configured');
      }

      const masterPasswordHash = await dependencies.hashPasswordFn(normalizedPassword, PASSWORD_SALT_ROUNDS);

      const created = await dependencies.prismaClient.workspaceVaultPolicy.create({
        data: {
          workspaceId,
          masterPasswordHash,
        },
        select: {
          id: true,
          workspaceId: true,
          passwordVersion: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return created;
    },

    async verifyPassword(workspaceId: string, password: string): Promise<boolean> {
      const normalizedPassword = parseVaultMasterPassword(password);
      if (!normalizedPassword) {
        return false;
      }

      const policy = await dependencies.prismaClient.workspaceVaultPolicy.findUnique({
        where: {
          workspaceId,
        },
        select: {
          masterPasswordHash: true,
        },
      });

      if (!policy?.masterPasswordHash) {
        return false;
      }

      return dependencies.comparePasswordFn(normalizedPassword, policy.masterPasswordHash);
    },
  };
};

export const vaultPolicyService = buildVaultPolicyService();
