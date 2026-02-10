import { badRequest, conflict, forbidden, notFound } from '../core/errors.js';
import { membershipRepository } from '../repositories/membership.repository.js';
import { roleRepository } from '../repositories/role.repository.js';

const MAX_ROLE_NAME_LENGTH = 50;

type RolePayload = {
  name: string;
  permissions: string[];
};

type AssignRolesPayload = {
  roles: string[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getDuplicates = (items: string[]) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item)) {
      duplicates.add(item);
      continue;
    }

    seen.add(item);
  }

  return Array.from(duplicates).sort();
};

const arraysAreEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const normalizeStringArray = (
  values: unknown,
  fieldName: string,
  allowEmpty = true,
): string[] => {
  if (!Array.isArray(values)) {
    throw badRequest(`${fieldName} must be an array`);
  }

  if (!allowEmpty && values.length === 0) {
    throw badRequest(`${fieldName} cannot be empty`);
  }

  const normalizedValues = values.map((value, index) => {
    if (typeof value !== 'string' || !value.trim()) {
      throw badRequest(`${fieldName}[${index}] must be a non-empty string`);
    }

    return value.trim();
  });

  const duplicates = getDuplicates(normalizedValues);
  if (duplicates.length > 0) {
    throw badRequest(`Duplicate values are not allowed in ${fieldName}`, {
      duplicates,
    });
  }

  return normalizedValues;
};

export const workspaceRolesService = {
  async listRoles(workspaceId: string) {
    const roles = await roleRepository.listRolesWithPermissions(workspaceId);
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions,
    }));
  },

  parseRolePayload(body: unknown): RolePayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw badRequest('Role name is required');
    }

    const normalizedName = body.name.trim();
    if (normalizedName.length > MAX_ROLE_NAME_LENGTH) {
      throw badRequest('Role name is too long', {
        maxLength: MAX_ROLE_NAME_LENGTH,
      });
    }

    const permissions = normalizeStringArray(body.permissions, 'permissions');

    return {
      name: normalizedName,
      permissions,
    };
  },

  async validatePermissionKeys(permissionKeys: string[]): Promise<string[]> {
    const permissions = await roleRepository.listPermissionsByKeys(permissionKeys);
    const permissionIdsByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
    const missingKeys = permissionKeys.filter((permissionKey) => !permissionIdsByKey.has(permissionKey));

    if (missingKeys.length > 0) {
      throw badRequest('Unknown permission keys', {
        missingKeys: Array.from(new Set(missingKeys)).sort(),
      });
    }

    return permissionKeys.map((permissionKey) => permissionIdsByKey.get(permissionKey) as string);
  },

  async createRole(workspaceId: string, body: unknown) {
    const payload = this.parseRolePayload(body);

    const existingRole = await roleRepository.findRoleByName(workspaceId, payload.name);
    if (existingRole) {
      throw badRequest('Role name already exists in workspace', {
        name: payload.name,
      });
    }

    const permissionIds = await this.validatePermissionKeys(payload.permissions);
    const role = await roleRepository.createRoleWithPermissions(
      workspaceId,
      payload.name,
      permissionIds,
    );

    return {
      role: {
        id: role.id,
        name: role.name,
        permissions: role.permissions,
      },
      changes: {
        name: role.name,
        permissions: role.permissions,
      },
    };
  },

  async updateRole(workspaceId: string, roleId: string, body: unknown) {
    const existingRole = await roleRepository.findRoleById(workspaceId, roleId);
    if (!existingRole) {
      throw notFound('Role not found');
    }

    const payload = this.parseRolePayload(body);

    const roleWithSameName = await roleRepository.findRoleByName(workspaceId, payload.name);
    if (roleWithSameName && roleWithSameName.id !== roleId) {
      throw badRequest('Role name already exists in workspace', {
        name: payload.name,
      });
    }

    const permissionIds = await this.validatePermissionKeys(payload.permissions);
    const updatedRole = await roleRepository.updateRoleWithPermissions(
      workspaceId,
      roleId,
      payload.name,
      permissionIds,
    );

    const previousPermissions = [...existingRole.permissions].sort();
    const nextPermissions = [...updatedRole.permissions].sort();

    return {
      role: {
        id: updatedRole.id,
        name: updatedRole.name,
        permissions: updatedRole.permissions,
      },
      changes: {
        ...(existingRole.name !== updatedRole.name
          ? { name: { from: existingRole.name, to: updatedRole.name } }
          : {}),
        ...(!arraysAreEqual(previousPermissions, nextPermissions)
          ? {
              permissions: {
                from: previousPermissions,
                to: nextPermissions,
              },
            }
          : {}),
      },
    };
  },

  async deleteRole(workspaceId: string, roleId: string) {
    const role = await roleRepository.findRoleById(workspaceId, roleId);
    if (!role) {
      throw notFound('Role not found');
    }

    if (role.isSystem || role.isSuperadmin) {
      throw forbidden('System roles cannot be deleted', {
        roleId: role.id,
        roleName: role.name,
      });
    }

    const assignmentCount = await roleRepository.countUserAssignments(workspaceId, roleId);
    if (assignmentCount > 0) {
      throw conflict('Role is assigned to one or more users', {
        roleId: role.id,
        assignmentCount,
      });
    }

    await roleRepository.deleteRole(workspaceId, roleId);

    return {
      role: {
        id: role.id,
        name: role.name,
      },
    };
  },

  parseAssignRolesPayload(body: unknown): AssignRolesPayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    return {
      roles: normalizeStringArray(body.roles, 'roles'),
    };
  },

  async assignUserRoles(workspaceId: string, targetUserId: string, body: unknown) {
    const payload = this.parseAssignRolesPayload(body);

    const isMember = await membershipRepository.isMember(targetUserId, workspaceId);
    if (!isMember) {
      throw notFound('User is not a member of the workspace', {
        userId: targetUserId,
        workspaceId,
      });
    }

    const uniqueRoleIds = Array.from(new Set(payload.roles));
    const rolesCount = await roleRepository.countRolesByIds(workspaceId, uniqueRoleIds);
    if (rolesCount !== uniqueRoleIds.length) {
      throw badRequest('One or more role ids are invalid for this workspace');
    }

    const currentRoleIds = await roleRepository.listUserRoleIds(workspaceId, targetUserId);
    const nextRoleIds = [...uniqueRoleIds].sort();

    await roleRepository.replaceUserRoles(workspaceId, targetUserId, nextRoleIds);

    return {
      userId: targetUserId,
      roles: nextRoleIds,
      changes: {
        from: currentRoleIds,
        to: nextRoleIds,
      },
    };
  },
};
