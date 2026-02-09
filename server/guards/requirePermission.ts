import { badRequest, forbidden } from '../core/errors.js';
import { rbacRepository } from '../repositories/rbac.repository.js';

export const requirePermission = async (
  userId: string,
  workspaceId: string,
  permissionKey: string,
) => {
  if (!permissionKey?.trim()) {
    throw badRequest('Permission key is required');
  }

  const granted = await rbacRepository.hasPermission(userId, workspaceId, permissionKey.trim());
  if (!granted) {
    throw forbidden('Permission denied', {
      workspaceId,
      permissionKey,
    });
  }
};
