import { badRequest, forbidden } from '../core/errors.js';
import { moduleRepository } from '../repositories/module.repository.js';

export const requireModuleEnabled = async (workspaceId: string, moduleKey: string) => {
  if (!moduleKey?.trim()) {
    throw badRequest('Module key is required');
  }

  const enabled = await moduleRepository.isEnabled(workspaceId, moduleKey.trim());
  if (!enabled) {
    throw forbidden('Module is disabled for this workspace', {
      workspaceId,
      moduleKey,
    });
  }
};
