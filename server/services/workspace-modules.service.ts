import { badRequest } from '../core/errors.js';
import {
  moduleRepository,
  type WorkspaceModuleState,
} from '../repositories/module.repository.js';

export type WorkspaceModuleUpdateInput = {
  key: string;
  enabled: boolean;
};

type ModulesUpdateBody = {
  modules: WorkspaceModuleUpdateInput[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getDuplicateKeys = (keys: string[]) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const key of keys) {
    if (seen.has(key)) {
      duplicates.add(key);
      continue;
    }

    seen.add(key);
  }

  return Array.from(duplicates).sort();
};

export const workspaceModulesService = {
  parseUpdates(body: unknown): WorkspaceModuleUpdateInput[] {
    if (!isObject(body) || !Array.isArray(body.modules)) {
      throw badRequest('Body must include a modules array');
    }

    const normalizedUpdates = body.modules.map((moduleEntry, index) => {
      if (!isObject(moduleEntry)) {
        throw badRequest('Each module update must be an object', { index });
      }

      const keyValue = moduleEntry.key;
      const enabledValue = moduleEntry.enabled;

      if (typeof keyValue !== 'string' || !keyValue.trim()) {
        throw badRequest('Module key is required', { index });
      }

      if (typeof enabledValue !== 'boolean') {
        throw badRequest('Module enabled flag must be a boolean', { index });
      }

      return {
        key: keyValue.trim(),
        enabled: enabledValue,
      };
    });

    const duplicates = getDuplicateKeys(normalizedUpdates.map((update) => update.key));
    if (duplicates.length > 0) {
      throw badRequest('Duplicate module keys are not allowed', {
        duplicates,
      });
    }

    return normalizedUpdates;
  },

  async getWorkspaceModules(workspaceId: string): Promise<WorkspaceModuleState[]> {
    return moduleRepository.listWorkspaceModules(workspaceId);
  },

  async updateWorkspaceModules(workspaceId: string, body: unknown) {
    const updates = this.parseUpdates(body) as ModulesUpdateBody['modules'];
    const previousState = await moduleRepository.listWorkspaceModules(workspaceId);
    const previousStateMap = new Map(previousState.map((moduleEntry) => [moduleEntry.key, moduleEntry.enabled]));

    const modules = await moduleRepository.updateWorkspaceModules(workspaceId, updates);
    const changes = updates
      .filter((update) => (previousStateMap.get(update.key) ?? false) !== update.enabled)
      .map((update) => ({
        key: update.key,
        from: previousStateMap.get(update.key) ?? false,
        to: update.enabled,
      }));

    return {
      modules,
      changes,
    };
  },
};
