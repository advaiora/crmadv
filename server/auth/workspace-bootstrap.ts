import type { Prisma } from '@prisma/client';
import { badRequest, forbidden, notFound } from '../core/errors.js';

export const SYSTEM_ROLE_NAME = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  manager: 'Manager',
  operativo: 'Operativo',
  viewer: 'Viewer',
} as const;

export const REGISTRABLE_WORKSPACE_ROLE_NAMES = [
  SYSTEM_ROLE_NAME.admin,
  SYSTEM_ROLE_NAME.manager,
  SYSTEM_ROLE_NAME.operativo,
  SYSTEM_ROLE_NAME.viewer,
] as const;

export type WorkspaceSystemRoleName =
  (typeof SYSTEM_ROLE_NAME)[keyof typeof SYSTEM_ROLE_NAME];

type SystemRoleDefinition = {
  name: WorkspaceSystemRoleName;
  description: string;
  isSuperadmin: boolean;
  userRole: string;
  permissions: readonly string[] | 'all';
};

type RoleCatalogEntry = {
  id: string;
  roleName: WorkspaceSystemRoleName;
  userRole: string;
  permissionKeys: string[];
};

const SYSTEM_ROLE_PRIORITY: Record<WorkspaceSystemRoleName, number> = {
  [SYSTEM_ROLE_NAME.superadmin]: 50,
  [SYSTEM_ROLE_NAME.admin]: 40,
  [SYSTEM_ROLE_NAME.manager]: 30,
  [SYSTEM_ROLE_NAME.operativo]: 20,
  [SYSTEM_ROLE_NAME.viewer]: 10,
};

const ADMIN_ASSIGNABLE_ROLE_NAMES = new Set<WorkspaceSystemRoleName>([
  SYSTEM_ROLE_NAME.manager,
  SYSTEM_ROLE_NAME.operativo,
  SYSTEM_ROLE_NAME.viewer,
]);

const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    name: SYSTEM_ROLE_NAME.superadmin,
    description: 'Full control over workspace and permissions',
    isSuperadmin: true,
    userRole: 'superadmin',
    permissions: 'all',
  },
  {
    name: SYSTEM_ROLE_NAME.admin,
    description: 'Manage clients and assign operational roles',
    isSuperadmin: false,
    userRole: 'admin',
    permissions: [
      'roles.view',
      'roles.assign',
      'team.view',
      'clients.view',
      'clients.create',
      'clients.edit',
      'clients.delete',
    ],
  },
  {
    name: SYSTEM_ROLE_NAME.manager,
    description: 'Manage operational workflows (projects/checklists/quotes)',
    isSuperadmin: false,
    userRole: 'manager',
    permissions: [
      'team.view',
      'clients.view',
      'clients.create',
      'clients.edit',
      'projects.view',
      'projects.create',
      'projects.edit',
      'projects.move_stage',
      'checklists.view',
      'checklists.create',
      'checklists.edit',
      'checklists.complete_item',
      'quotes.view',
      'quotes.create',
      'quotes.edit',
      'quotes.send',
    ],
  },
  {
    name: SYSTEM_ROLE_NAME.operativo,
    description: 'Operational contributor with limited edit permissions',
    isSuperadmin: false,
    userRole: 'operativo',
    permissions: [
      'team.view',
      'clients.view',
      'clients.edit',
      'projects.view',
      'checklists.view',
      'checklists.complete_item',
      'quotes.view',
    ],
  },
  {
    name: SYSTEM_ROLE_NAME.viewer,
    description: 'Read-only access',
    isSuperadmin: false,
    userRole: 'viewer',
    permissions: [
      'team.view',
      'clients.view',
      'projects.view',
      'checklists.view',
      'quotes.view',
      'audit.view',
      'roles.view',
    ],
  },
] as const;

const WORKSPACE_SYSTEM_ROLE_NAME_SET = new Set<WorkspaceSystemRoleName>(
  SYSTEM_ROLE_DEFINITIONS.map((role) => role.name),
);

const isWorkspaceSystemRoleName = (value: string): value is WorkspaceSystemRoleName =>
  WORKSPACE_SYSTEM_ROLE_NAME_SET.has(value as WorkspaceSystemRoleName);

export const normalizeWorkspaceSystemRoleName = (
  value: unknown,
): WorkspaceSystemRoleName | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    if (role.name.toLowerCase() === normalizedValue) {
      return role.name;
    }
  }

  return null;
};

const getPermissionIdsByKeys = (
  permissionKeys: readonly string[],
  permissionsByKey: Map<string, string>,
) =>
  permissionKeys
    .map((permissionKey) => permissionsByKey.get(permissionKey))
    .filter((permissionId): permissionId is string => typeof permissionId === 'string');

const syncRolePermissions = async ({
  tx,
  workspaceId,
  roleId,
  roleName,
  desiredPermissionIds,
  permissionKeysById,
  actorUserId,
  sourceAction,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  roleId: string;
  roleName: WorkspaceSystemRoleName;
  desiredPermissionIds: string[];
  permissionKeysById: Map<string, string>;
  actorUserId: string;
  sourceAction: string;
}) => {
  const existingRolePermissions = await tx.rolePermission.findMany({
    where: {
      roleId,
    },
    select: {
      permissionId: true,
    },
  });

  const existingPermissionIdSet = new Set(existingRolePermissions.map((entry) => entry.permissionId));
  const desiredPermissionIdSet = new Set(desiredPermissionIds);

  const permissionIdsToAdd = desiredPermissionIds.filter((permissionId) => !existingPermissionIdSet.has(permissionId));
  const permissionIdsToRemove = existingRolePermissions
    .map((entry) => entry.permissionId)
    .filter((permissionId) => !desiredPermissionIdSet.has(permissionId));

  if (permissionIdsToAdd.length > 0) {
    await tx.rolePermission.createMany({
      data: permissionIdsToAdd.map((permissionId) => ({
        roleId,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  if (permissionIdsToRemove.length > 0) {
    await tx.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: {
          in: permissionIdsToRemove,
        },
      },
    });
  }

  if (permissionIdsToAdd.length === 0 && permissionIdsToRemove.length === 0) {
    return;
  }

  await tx.auditLog.create({
    data: {
      workspaceId,
      actorUserId,
      action: 'rbac.role.permissions.synced',
      entityType: 'role',
      entityId: roleId,
      metadata: {
        sourceAction,
        targetId: roleId,
        roleName,
        addedPermissions: permissionIdsToAdd.map((permissionId) => permissionKeysById.get(permissionId) ?? permissionId),
        removedPermissions: permissionIdsToRemove.map((permissionId) => permissionKeysById.get(permissionId) ?? permissionId),
      },
    },
  });
};

const listWorkspaceMembershipCount = (
  tx: Prisma.TransactionClient,
  workspaceId: string,
) =>
  tx.membership.count({
    where: {
      workspaceId,
      status: 'active',
    },
  });

const getHighestSystemRoleName = (
  roleNames: WorkspaceSystemRoleName[],
): WorkspaceSystemRoleName | null => {
  if (roleNames.length === 0) {
    return null;
  }

  let highestRoleName: WorkspaceSystemRoleName | null = null;
  for (const roleName of roleNames) {
    if (!highestRoleName) {
      highestRoleName = roleName;
      continue;
    }

    if (SYSTEM_ROLE_PRIORITY[roleName] > SYSTEM_ROLE_PRIORITY[highestRoleName]) {
      highestRoleName = roleName;
    }
  }

  return highestRoleName;
};

const listUserSystemRoleNames = async ({
  tx,
  workspaceId,
  userId,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
}) => {
  const userRoles = await tx.userRole.findMany({
    where: {
      workspaceId,
      userId,
      role: {
        isSystem: true,
      },
    },
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  return userRoles
    .map((userRole) => userRole.role.name)
    .filter((roleName): roleName is WorkspaceSystemRoleName => isWorkspaceSystemRoleName(roleName));
};

const ensureTargetIsWorkspaceMember = async ({
  tx,
  workspaceId,
  targetUserId,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  targetUserId: string;
}) => {
  const membership = await tx.membership.findFirst({
    where: {
      workspaceId,
      userId: targetUserId,
      status: 'active',
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    throw notFound('Target user is not an active member of the workspace', {
      workspaceId,
      targetUserId,
    });
  }
};

const assertActorCanAssignRole = ({
  actorRoleName,
  targetCurrentRoleName,
  nextRoleName,
}: {
  actorRoleName: WorkspaceSystemRoleName | null;
  targetCurrentRoleName: WorkspaceSystemRoleName | null;
  nextRoleName: WorkspaceSystemRoleName;
}) => {
  if (!actorRoleName) {
    throw forbidden('Actor has no system role in this workspace');
  }

  if (actorRoleName === SYSTEM_ROLE_NAME.superadmin) {
    return;
  }

  if (actorRoleName !== SYSTEM_ROLE_NAME.admin) {
    throw forbidden('Only Superadmin and Admin can modify user roles');
  }

  if (!ADMIN_ASSIGNABLE_ROLE_NAMES.has(nextRoleName)) {
    throw forbidden('Admin can assign only Manager, Operativo or Viewer roles', {
      actorRole: actorRoleName,
      targetRole: nextRoleName,
    });
  }

  if (targetCurrentRoleName && !ADMIN_ASSIGNABLE_ROLE_NAMES.has(targetCurrentRoleName)) {
    throw forbidden('Admin cannot modify Superadmin or Admin roles', {
      actorRole: actorRoleName,
      currentTargetRole: targetCurrentRoleName,
    });
  }
};

const resolveRegistrationRoleName = ({
  isFirstWorkspaceUser,
  requestedRoleName,
}: {
  isFirstWorkspaceUser: boolean;
  requestedRoleName?: WorkspaceSystemRoleName | null;
}) => {
  if (isFirstWorkspaceUser) {
    return SYSTEM_ROLE_NAME.superadmin;
  }

  if (!requestedRoleName || requestedRoleName === SYSTEM_ROLE_NAME.superadmin) {
    return SYSTEM_ROLE_NAME.admin;
  }

  return requestedRoleName;
};

export const ensureWorkspaceSystemRoles = async ({
  tx,
  workspaceId,
  actorUserId,
  sourceAction,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  actorUserId: string;
  sourceAction: string;
}) => {
  const [permissions, modules] = await Promise.all([
    tx.permission.findMany({
      select: {
        id: true,
        key: true,
      },
      orderBy: {
        key: 'asc',
      },
    }),
    tx.module.findMany({
      select: {
        id: true,
      },
    }),
  ]);

  // Keep all modules enabled by default for the workspace. Actual access is still permission-gated.
  if (modules.length > 0) {
    await tx.workspaceModule.createMany({
      data: modules.map((moduleRecord) => ({
        workspaceId,
        moduleId: moduleRecord.id,
        enabled: true,
      })),
      skipDuplicates: true,
    });
  }

  const permissionsByKey = new Map(
    permissions.map((permission) => [permission.key, permission.id]),
  );
  const permissionKeysById = new Map(
    permissions.map((permission) => [permission.id, permission.key]),
  );
  const allPermissionIds = permissions.map((permission) => permission.id);
  const allPermissionKeys = permissions.map((permission) => permission.key);

  const roleCatalog = new Map<WorkspaceSystemRoleName, RoleCatalogEntry>();

  for (const roleDefinition of SYSTEM_ROLE_DEFINITIONS) {
    const roleRecord = await tx.role.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: roleDefinition.name,
        },
      },
      update: {
        isSystem: true,
        isSuperadmin: roleDefinition.isSuperadmin,
        description: roleDefinition.description,
      },
      create: {
        workspaceId,
        name: roleDefinition.name,
        isSystem: true,
        isSuperadmin: roleDefinition.isSuperadmin,
        description: roleDefinition.description,
      },
      select: {
        id: true,
      },
    });

    const desiredPermissionIds =
      roleDefinition.permissions === 'all'
        ? allPermissionIds
        : getPermissionIdsByKeys(roleDefinition.permissions, permissionsByKey);

    await syncRolePermissions({
      tx,
      workspaceId,
      roleId: roleRecord.id,
      roleName: roleDefinition.name,
      desiredPermissionIds,
      permissionKeysById,
      actorUserId,
      sourceAction,
    });

    roleCatalog.set(roleDefinition.name, {
      id: roleRecord.id,
      roleName: roleDefinition.name,
      userRole: roleDefinition.userRole,
      permissionKeys:
        roleDefinition.permissions === 'all'
          ? allPermissionKeys
          : [...roleDefinition.permissions],
    });
  }

  return roleCatalog;
};

export const getUserWorkspaceSystemRoleName = async ({
  tx,
  workspaceId,
  userId,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
}) => {
  const userSystemRoleNames = await listUserSystemRoleNames({
    tx,
    workspaceId,
    userId,
  });

  return getHighestSystemRoleName(userSystemRoleNames);
};

export type WorkspaceRoleAssignmentResult = {
  previousRoleName: WorkspaceSystemRoleName | null;
  assignedRoleName: WorkspaceSystemRoleName;
  assignedUserRole: string;
  assignedPermissionKeys: string[];
  actorRoleName: WorkspaceSystemRoleName | null;
};

export const assignWorkspaceUserRole = async ({
  tx,
  workspaceId,
  targetUserId,
  actorUserId,
  nextRoleName,
  sourceAction,
  enforceHierarchy = true,
  auditAction,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  targetUserId: string;
  actorUserId: string;
  nextRoleName: WorkspaceSystemRoleName;
  sourceAction: string;
  enforceHierarchy?: boolean;
  auditAction?: 'rbac.user.role.assigned' | 'rbac.user.role.modified';
}): Promise<WorkspaceRoleAssignmentResult> => {
  await ensureTargetIsWorkspaceMember({
    tx,
    workspaceId,
    targetUserId,
  });

  const roleCatalog = await ensureWorkspaceSystemRoles({
    tx,
    workspaceId,
    actorUserId,
    sourceAction,
  });

  const roleEntry = roleCatalog.get(nextRoleName);
  if (!roleEntry) {
    throw badRequest('Invalid workspace role', {
      roleName: nextRoleName,
    });
  }

  const [actorRoleName, previousRoleName] = await Promise.all([
    getUserWorkspaceSystemRoleName({
      tx,
      workspaceId,
      userId: actorUserId,
    }),
    getUserWorkspaceSystemRoleName({
      tx,
      workspaceId,
      userId: targetUserId,
    }),
  ]);

  if (enforceHierarchy) {
    assertActorCanAssignRole({
      actorRoleName,
      targetCurrentRoleName: previousRoleName,
      nextRoleName,
    });
  }

  // Keep exactly one assigned role per workspace user to avoid permission drift.
  await tx.userRole.deleteMany({
    where: {
      workspaceId,
      userId: targetUserId,
    },
  });

  await tx.userRole.create({
    data: {
      workspaceId,
      userId: targetUserId,
      roleId: roleEntry.id,
    },
  });

  await tx.user.update({
    where: {
      id: targetUserId,
    },
    data: {
      role: roleEntry.userRole,
    },
  });

  const action =
    auditAction ??
    (previousRoleName ? 'rbac.user.role.modified' : 'rbac.user.role.assigned');

  await tx.auditLog.create({
    data: {
      workspaceId,
      actorUserId,
      action,
      entityType: 'user',
      entityId: targetUserId,
      metadata: {
        sourceAction,
        targetId: targetUserId,
        actorRoleName,
        previousRoleName,
        assignedRoleName: roleEntry.roleName,
        assignedUserRole: roleEntry.userRole,
        assignedPermissionKeys: roleEntry.permissionKeys,
      },
    },
  });

  return {
    previousRoleName,
    assignedRoleName: roleEntry.roleName,
    assignedUserRole: roleEntry.userRole,
    assignedPermissionKeys: roleEntry.permissionKeys,
    actorRoleName,
  };
};

export type WorkspaceRegistrationRoleAssignment = {
  isFirstWorkspaceUser: boolean;
  assignedRoleName: WorkspaceSystemRoleName;
  assignedUserRole: string;
  assignedPermissionKeys: string[];
};

export const initializeWorkspaceAuthDefaults = async ({
  tx,
  workspaceId,
  userId,
  actorUserId,
  sourceAction = 'auth.register',
  requestedRoleName,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
  actorUserId?: string;
  sourceAction?: string;
  requestedRoleName?: WorkspaceSystemRoleName | null;
}): Promise<WorkspaceRegistrationRoleAssignment> => {
  const effectiveActorUserId = actorUserId ?? userId;
  const activeWorkspaceUsers = await listWorkspaceMembershipCount(tx, workspaceId);
  const isFirstWorkspaceUser = activeWorkspaceUsers <= 1;
  const nextRoleName = resolveRegistrationRoleName({
    isFirstWorkspaceUser,
    requestedRoleName,
  });

  const assignment = await assignWorkspaceUserRole({
    tx,
    workspaceId,
    targetUserId: userId,
    actorUserId: effectiveActorUserId,
    nextRoleName,
    sourceAction,
    enforceHierarchy: false,
    auditAction: 'rbac.user.role.assigned',
  });

  return {
    isFirstWorkspaceUser,
    assignedRoleName: assignment.assignedRoleName,
    assignedUserRole: assignment.assignedUserRole,
    assignedPermissionKeys: assignment.assignedPermissionKeys,
  };
};
