import { badRequest } from '../core/errors.js';
import { prisma } from '../prisma.js';

export type WorkspaceModuleState = {
  key: string;
  name: string;
  description: string | null;
  isCore: boolean;
  enabled: boolean;
};

type WorkspaceModuleUpdate = {
  key: string;
  enabled: boolean;
};

export const moduleRepository = {
  async isEnabled(workspaceId: string, moduleKey: string): Promise<boolean> {
    const workspaceModule = await prisma.workspaceModule.findFirst({
      where: {
        workspaceId,
        enabled: true,
        module: {
          key: moduleKey,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(workspaceModule);
  },

  async listEnabledModules(workspaceId: string): Promise<string[]> {
    const workspaceModules = await prisma.workspaceModule.findMany({
      where: {
        workspaceId,
        enabled: true,
      },
      select: {
        module: {
          select: {
            key: true,
          },
        },
      },
      orderBy: {
        module: {
          key: 'asc',
        },
      },
    });

    return workspaceModules.map((workspaceModule) => workspaceModule.module.key);
  },

  async listWorkspaceModules(workspaceId: string): Promise<WorkspaceModuleState[]> {
    const modules = await prisma.module.findMany({
      select: {
        key: true,
        name: true,
        description: true,
        isCore: true,
        workspaceModules: {
          where: {
            workspaceId,
          },
          select: {
            enabled: true,
          },
          take: 1,
        },
      },
      orderBy: {
        key: 'asc',
      },
    });

    return modules.map((moduleRecord) => ({
      key: moduleRecord.key,
      name: moduleRecord.name,
      description: moduleRecord.description ?? null,
      isCore: moduleRecord.isCore,
      enabled: moduleRecord.workspaceModules[0]?.enabled ?? false,
    }));
  },

  async setWorkspaceModuleEnabled(
    workspaceId: string,
    moduleKey: string,
    enabled: boolean,
  ): Promise<WorkspaceModuleState | null> {
    const normalizedModuleKey = moduleKey.trim();
    if (!normalizedModuleKey) {
      return null;
    }

    const moduleRecord = await prisma.module.findUnique({
      where: {
        key: normalizedModuleKey,
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isCore: true,
      },
    });

    if (!moduleRecord) {
      return null;
    }

    if (moduleRecord.isCore && !enabled) {
      throw badRequest('Core modules cannot be disabled', {
        moduleKey: moduleRecord.key,
      });
    }

    await prisma.workspaceModule.upsert({
      where: {
        workspaceId_moduleId: {
          workspaceId,
          moduleId: moduleRecord.id,
        },
      },
      update: {
        enabled,
      },
      create: {
        workspaceId,
        moduleId: moduleRecord.id,
        enabled,
      },
    });

    return {
      key: moduleRecord.key,
      name: moduleRecord.name,
      description: moduleRecord.description ?? null,
      isCore: moduleRecord.isCore,
      enabled,
    };
  },

  async updateWorkspaceModules(
    workspaceId: string,
    updates: WorkspaceModuleUpdate[],
  ): Promise<WorkspaceModuleState[]> {
    return prisma.$transaction(async (tx) => {
      const keys = updates.map((update) => update.key);

      const modules = await tx.module.findMany({
        where: {
          key: {
            in: keys,
          },
        },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          isCore: true,
        },
      });

      const moduleByKey = new Map(modules.map((moduleRecord) => [moduleRecord.key, moduleRecord]));
      const unknownKeys = keys.filter((key) => !moduleByKey.has(key));

      if (unknownKeys.length > 0) {
        throw badRequest('Unknown module keys', {
          unknownKeys,
        });
      }

      const blockedCoreUpdates = updates
        .filter((update) => {
          const moduleRecord = moduleByKey.get(update.key);
          return Boolean(moduleRecord?.isCore) && !update.enabled;
        })
        .map((update) => update.key);

      if (blockedCoreUpdates.length > 0) {
        throw badRequest('Core modules cannot be disabled', {
          moduleKeys: blockedCoreUpdates,
        });
      }

      await Promise.all(
        updates.map(async (update) =>
          tx.workspaceModule.upsert({
            where: {
              workspaceId_moduleId: {
                workspaceId,
                moduleId: moduleByKey.get(update.key)?.id as string,
              },
            },
            update: {
              enabled: update.enabled,
            },
            create: {
              workspaceId,
              moduleId: moduleByKey.get(update.key)?.id as string,
              enabled: update.enabled,
            },
          }),
        ),
      );

      const updatedModules = await tx.module.findMany({
        select: {
          key: true,
          name: true,
          description: true,
          isCore: true,
          workspaceModules: {
            where: {
              workspaceId,
            },
            select: {
              enabled: true,
            },
            take: 1,
          },
        },
        orderBy: {
          key: 'asc',
        },
      });

      return updatedModules.map((moduleRecord) => ({
        key: moduleRecord.key,
        name: moduleRecord.name,
        description: moduleRecord.description ?? null,
        isCore: moduleRecord.isCore,
        enabled: moduleRecord.workspaceModules[0]?.enabled ?? false,
      }));
    });
  },
};
