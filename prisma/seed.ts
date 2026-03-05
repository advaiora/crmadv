import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  SYSTEM_MODULE_CATALOG,
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_NAME,
  type PermissionSelection,
} from '../server/auth/rbac-catalog.js';

const prisma = new PrismaClient();

const resolveWorkspaceDefaultModuleEnabled = (moduleKey: string, isCore: boolean) => {
  if (isCore) {
    return true;
  }

  if (moduleKey === 'seo') {
    return false;
  }

  return true;
};

const resolvePermissionKeys = (
  permissionSelection: PermissionSelection,
  allPermissionKeys: string[],
) => {
  if (permissionSelection === 'all') {
    return [...allPermissionKeys];
  }

  if (Array.isArray(permissionSelection)) {
    return [...permissionSelection];
  }

  const excludedKeys = new Set(permissionSelection.exclude);
  return allPermissionKeys.filter((permissionKey) => !excludedKeys.has(permissionKey));
};

const syncRolePermissions = async (roleId: string, desiredPermissionIds: string[]) => {
  const existingRolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });

  const existingIds = new Set(existingRolePermissions.map((item) => item.permissionId));
  const desiredIds = new Set(desiredPermissionIds);
  const permissionIdsToAdd = desiredPermissionIds.filter((permissionId) => !existingIds.has(permissionId));
  const permissionIdsToRemove = existingRolePermissions
    .map((item) => item.permissionId)
    .filter((permissionId) => !desiredIds.has(permissionId));

  if (permissionIdsToAdd.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIdsToAdd.map((permissionId) => ({
        roleId,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  if (permissionIdsToRemove.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: {
          in: permissionIdsToRemove,
        },
      },
    });
  }
};

async function main() {
  const superadminPasswordHash = await bcrypt.hash('admin123', 10);

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: { name: 'Demo' },
    create: { name: 'Demo', slug: 'demo' },
  });

  const superadminUser = await prisma.user.upsert({
    where: { email: 'superadmin@demo.local' },
    update: {
      name: 'Demo Superadmin',
      passwordHash: superadminPasswordHash,
      role: 'superadmin',
    },
    create: {
      email: 'superadmin@demo.local',
      name: 'Demo Superadmin',
      passwordHash: superadminPasswordHash,
      role: 'superadmin',
    },
  });

  const adminLoginUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {
      name: 'Admin Test',
      passwordHash: superadminPasswordHash,
      role: 'superadmin',
    },
    create: {
      email: 'admin@test.com',
      name: 'Admin Test',
      passwordHash: superadminPasswordHash,
      role: 'superadmin',
    },
  });

  await prisma.membership.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: superadminUser.id },
    },
    update: { status: 'ACTIVE' },
    create: {
      workspaceId: workspace.id,
      userId: superadminUser.id,
      status: 'ACTIVE',
    },
  });

  await prisma.membership.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: adminLoginUser.id },
    },
    update: { status: 'ACTIVE' },
    create: {
      workspaceId: workspace.id,
      userId: adminLoginUser.id,
      status: 'ACTIVE',
    },
  });

  const modulesByKey = new Map<string, { id: string; key: string; isCore: boolean }>();
  for (const moduleData of SYSTEM_MODULE_CATALOG) {
    const moduleRecord = await prisma.module.upsert({
      where: { key: moduleData.key },
      update: {
        name: moduleData.name,
        description: moduleData.description,
        isCore: moduleData.isCore,
      },
      create: {
        key: moduleData.key,
        name: moduleData.name,
        description: moduleData.description,
        isCore: moduleData.isCore,
      },
      select: { id: true, key: true, isCore: true },
    });

    modulesByKey.set(moduleData.key, moduleRecord);
  }

  for (const moduleRecord of modulesByKey.values()) {
    await prisma.workspaceModule.upsert({
      where: {
        workspaceId_moduleId: {
          workspaceId: workspace.id,
          moduleId: moduleRecord.id,
        },
      },
      update: { enabled: resolveWorkspaceDefaultModuleEnabled(moduleRecord.key, moduleRecord.isCore) },
      create: {
        workspaceId: workspace.id,
        moduleId: moduleRecord.id,
        enabled: resolveWorkspaceDefaultModuleEnabled(moduleRecord.key, moduleRecord.isCore),
      },
    });
  }

  const allPermissions: { id: string; key: string }[] = [];
  for (const permissionData of SYSTEM_PERMISSION_CATALOG) {
    const moduleRecord = modulesByKey.get(permissionData.moduleKey);
    if (!moduleRecord) {
      throw new Error(`Missing module for permission ${permissionData.key}`);
    }

    const permission = await prisma.permission.upsert({
      where: { key: permissionData.key },
      update: {
        description: permissionData.description,
        moduleId: moduleRecord.id,
      },
      create: {
        key: permissionData.key,
        description: permissionData.description,
        moduleId: moduleRecord.id,
      },
      select: { id: true, key: true },
    });

    allPermissions.push(permission);
  }

  const allPermissionKeys = allPermissions.map((permission) => permission.key);
  const permissionIdByKey = new Map(
    allPermissions.map((permission) => [permission.key, permission.id]),
  );

  const rolesByName = new Map<string, { id: string; name: string }>();
  for (const roleData of SYSTEM_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: {
        workspaceId_name: {
          workspaceId: workspace.id,
          name: roleData.name,
        },
      },
      update: {
        description: roleData.description,
        isSystem: true,
        isSuperadmin: roleData.isSuperadmin,
      },
      create: {
        workspaceId: workspace.id,
        name: roleData.name,
        description: roleData.description,
        isSystem: true,
        isSuperadmin: roleData.isSuperadmin,
      },
      select: { id: true, name: true },
    });

    rolesByName.set(roleData.name, role);

    const desiredPermissionKeys = resolvePermissionKeys(roleData.permissions, allPermissionKeys);
    const desiredPermissionIds = Array.from(
      new Set(
        desiredPermissionKeys
          .map((permissionKey) => permissionIdByKey.get(permissionKey))
          .filter((permissionId): permissionId is string => typeof permissionId === 'string'),
      ),
    );

    await syncRolePermissions(role.id, desiredPermissionIds);
  }

  const superadminRole = rolesByName.get(SYSTEM_ROLE_NAME.superadmin);
  if (!superadminRole) {
    throw new Error('Superadmin role not found after seed');
  }

  await prisma.userRole.upsert({
    where: {
      workspaceId_userId_roleId: {
        workspaceId: workspace.id,
        userId: superadminUser.id,
        roleId: superadminRole.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: superadminUser.id,
      roleId: superadminRole.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      workspaceId_userId_roleId: {
        workspaceId: workspace.id,
        userId: adminLoginUser.id,
        roleId: superadminRole.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: adminLoginUser.id,
      roleId: superadminRole.id,
    },
  });

  await prisma.workspaceBranding.upsert({
    where: { workspaceId: workspace.id },
    update: {
      workspaceName: 'Demo',
      primaryColor: '#0d6efd',
      secondaryColor: '#6c757d',
    },
    create: {
      workspaceId: workspace.id,
      workspaceName: 'Demo',
      primaryColor: '#0d6efd',
      secondaryColor: '#6c757d',
    },
  });

  const defaultProjectCategory = await prisma.projectCategory.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'Pipeline',
      },
    },
    update: {
      sortOrder: 0,
    },
    create: {
      workspaceId: workspace.id,
      name: 'Pipeline',
      sortOrder: 0,
    },
    select: { id: true },
  });

  const prePublishingTemplate = await prisma.checklistTemplate.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'Pre Pubblicazione',
      },
    },
    update: {
      description: 'Checklist demo per verifiche finali prima della pubblicazione',
      isArchived: false,
    },
    create: {
      workspaceId: workspace.id,
      name: 'Pre Pubblicazione',
      description: 'Checklist demo per verifiche finali prima della pubblicazione',
      isArchived: false,
    },
    select: {
      id: true,
    },
  });

  const checklistItems = [
    {
      title: 'Controllo SEO',
      isRequired: true,
      requiresEvidenceSnapshot: false,
      isCriticalSnapshot: false,
    },
    {
      title: 'Screenshot finale',
      isRequired: true,
      requiresEvidenceSnapshot: true,
      isCriticalSnapshot: false,
    },
    {
      title: 'Conferma cliente',
      isRequired: false,
      requiresEvidenceSnapshot: false,
      isCriticalSnapshot: false,
    },
  ] as const;

  for (let index = 0; index < checklistItems.length; index += 1) {
    const item = checklistItems[index];

    await prisma.checklistTemplateItem.upsert({
      where: {
        workspaceId_templateId_sortOrder: {
          workspaceId: workspace.id,
          templateId: prePublishingTemplate.id,
          sortOrder: index,
        },
      },
      update: {
        title: item.title,
        isRequired: item.isRequired,
        requiresEvidenceSnapshot: item.requiresEvidenceSnapshot,
        isCriticalSnapshot: item.isCriticalSnapshot,
      },
      create: {
        workspaceId: workspace.id,
        templateId: prePublishingTemplate.id,
        title: item.title,
        sortOrder: index,
        isRequired: item.isRequired,
        requiresEvidenceSnapshot: item.requiresEvidenceSnapshot,
        isCriticalSnapshot: item.isCriticalSnapshot,
      },
    });
  }

  const gatedStageName = 'Stage Gate Demo';
  const demoProjectName = 'Project Gate Demo';

  const existingGatedStage = await prisma.pipelineStage.findFirst({
    where: {
      workspaceId: workspace.id,
      name: gatedStageName,
    },
    select: { id: true },
  });

  const gatedStage = existingGatedStage
    ? await prisma.pipelineStage.update({
        where: { id: existingGatedStage.id },
        data: {
          categoryId: defaultProjectCategory.id,
          sortOrder: 0,
          isGated: true,
          gateChecklistTemplateId: prePublishingTemplate.id,
          autoCreateInstance: true,
        },
        select: { id: true },
      })
    : await prisma.pipelineStage.create({
        data: {
          workspaceId: workspace.id,
          categoryId: defaultProjectCategory.id,
          name: gatedStageName,
          sortOrder: 0,
          isGated: true,
          gateChecklistTemplateId: prePublishingTemplate.id,
          autoCreateInstance: true,
        },
        select: { id: true },
      });

  const existingDemoProject = await prisma.project.findFirst({
    where: {
      workspaceId: workspace.id,
      name: demoProjectName,
    },
    select: { id: true },
  });

  if (existingDemoProject) {
    await prisma.project.update({
      where: { id: existingDemoProject.id },
      data: {
        pipelineStageId: gatedStage.id,
      },
    });
  } else {
    await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: demoProjectName,
        pipelineStageId: gatedStage.id,
      },
    });
  }

  const bootstrapAlreadyLogged = await prisma.auditLog.findFirst({
    where: {
      workspaceId: workspace.id,
      action: 'seed.bootstrap',
      entityType: 'workspace',
      entityId: workspace.id,
    },
    select: { id: true },
  });

  if (!bootstrapAlreadyLogged) {
    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: superadminUser.id,
        action: 'seed.bootstrap',
        entityType: 'workspace',
        entityId: workspace.id,
        metadata: {
          seededBy: 'prisma/seed.ts',
          modulesEnabled: SYSTEM_MODULE_CATALOG.length,
          permissionsCreated: SYSTEM_PERMISSION_CATALOG.length,
        },
      },
    });
  }

  console.log('Seed completed');
  console.log(`Workspace: ${workspace.slug}`);
  console.log(`User: ${superadminUser.email}`);
  console.log(`User: ${adminLoginUser.email}`);
  console.log(`Modules: ${SYSTEM_MODULE_CATALOG.length}`);
  console.log(`Permissions: ${SYSTEM_PERMISSION_CATALOG.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
