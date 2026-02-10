import { badRequest } from '../core/errors.js';
import { prisma } from '../prisma.js';

export type WorkspaceModuleState = {
  key: string;
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
      enabled: moduleRecord.workspaceModules[0]?.enabled ?? false,
    }));
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
        },
      });

      const moduleByKey = new Map(modules.map((moduleRecord) => [moduleRecord.key, moduleRecord.id]));
      const unknownKeys = keys.filter((key) => !moduleByKey.has(key));

      if (unknownKeys.length > 0) {
        throw badRequest('Unknown module keys', {
          unknownKeys,
        });
      }

      await Promise.all(
        updates.map(async (update) =>
          tx.workspaceModule.upsert({
            where: {
              workspaceId_moduleId: {
                workspaceId,
                moduleId: moduleByKey.get(update.key) as string,
              },
            },
            update: {
              enabled: update.enabled,
            },
            create: {
              workspaceId,
              moduleId: moduleByKey.get(update.key) as string,
              enabled: update.enabled,
            },
          }),
        ),
      );

      const updatedModules = await tx.module.findMany({
        select: {
          key: true,
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
        enabled: moduleRecord.workspaceModules[0]?.enabled ?? false,
      }));
    });
  },
};
