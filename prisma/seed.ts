import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODULES = [
  { key: 'modules', name: 'Module Registry', isCore: true },
  { key: 'branding', name: 'Branding', isCore: true },
  { key: 'audit', name: 'Audit', isCore: true },
  { key: 'team', name: 'Team', isCore: false },
  { key: 'clients', name: 'Clients', isCore: false },
  { key: 'projects', name: 'Projects', isCore: false },
  { key: 'checklists', name: 'Checklists', isCore: false },
  { key: 'quotes', name: 'Quotes', isCore: false },
  { key: 'web', name: 'Web', isCore: false },
  { key: 'vault', name: 'Vault', isCore: false },
  { key: 'seo', name: 'SEO', isCore: false },
] as const;

const PERMISSIONS = [
  { key: 'modules.manage', moduleKey: 'modules', description: 'Manage workspace modules' },
  { key: 'branding.manage', moduleKey: 'branding', description: 'Manage workspace branding' },
  { key: 'audit.view', moduleKey: 'audit', description: 'View audit logs' },
  { key: 'team.view', moduleKey: 'team', description: 'View team members' },
  { key: 'team.manage', moduleKey: 'team', description: 'Manage team members' },
  { key: 'clients.view', moduleKey: 'clients', description: 'View clients' },
  { key: 'clients.create', moduleKey: 'clients', description: 'Create clients' },
  { key: 'clients.edit', moduleKey: 'clients', description: 'Edit clients' },
  { key: 'clients.delete', moduleKey: 'clients', description: 'Delete clients' },
  { key: 'projects.view', moduleKey: 'projects', description: 'View projects' },
  { key: 'projects.create', moduleKey: 'projects', description: 'Create projects' },
  { key: 'projects.edit', moduleKey: 'projects', description: 'Edit projects' },
  { key: 'projects.delete', moduleKey: 'projects', description: 'Delete projects' },
  { key: 'projects.move_stage', moduleKey: 'projects', description: 'Move projects between stages' },
  { key: 'checklists.view', moduleKey: 'checklists', description: 'View checklists' },
  { key: 'checklists.manage_templates', moduleKey: 'checklists', description: 'Manage checklist templates' },
  { key: 'checklists.complete_item', moduleKey: 'checklists', description: 'Complete checklist items' },
  { key: 'checklists.override_gate', moduleKey: 'checklists', description: 'Override checklist gates' },
  { key: 'quotes.view', moduleKey: 'quotes', description: 'View quotes' },
  { key: 'quotes.create', moduleKey: 'quotes', description: 'Create quotes' },
  { key: 'quotes.send', moduleKey: 'quotes', description: 'Send quotes' },
  { key: 'quotes.accept', moduleKey: 'quotes', description: 'Accept quotes' },
  { key: 'quotes.manage_templates', moduleKey: 'quotes', description: 'Manage quote templates' },
  { key: 'web.view', moduleKey: 'web', description: 'View web assets' },
  { key: 'web.create', moduleKey: 'web', description: 'Create web assets' },
  { key: 'web.edit', moduleKey: 'web', description: 'Edit web assets' },
  { key: 'web.delete', moduleKey: 'web', description: 'Delete web assets' },
  { key: 'vault.view_list', moduleKey: 'vault', description: 'View vault item list' },
  { key: 'vault.create', moduleKey: 'vault', description: 'Create vault items' },
  { key: 'vault.edit', moduleKey: 'vault', description: 'Edit vault items' },
  { key: 'vault.reveal', moduleKey: 'vault', description: 'Reveal vault secrets' },
  { key: 'vault.delete', moduleKey: 'vault', description: 'Delete vault items' },
  { key: 'seo.view', moduleKey: 'seo', description: 'View SEO data' },
  { key: 'seo.run_scan', moduleKey: 'seo', description: 'Run SEO scans' },
  { key: 'seo.export', moduleKey: 'seo', description: 'Export SEO reports' },
  { key: 'seo.manage_settings', moduleKey: 'seo', description: 'Manage SEO settings' },
] as const;

const ROLES = [
  { name: 'Superadmin', description: 'Full control over workspace', isSuperadmin: true },
  { name: 'Admin', description: 'Administrative role for day-to-day operations', isSuperadmin: false },
  { name: 'Manager', description: 'Can manage teams and projects', isSuperadmin: false },
  { name: 'Operativo', description: 'Operational contributor role', isSuperadmin: false },
  { name: 'Viewer', description: 'Read-only access where allowed', isSuperadmin: false },
] as const;

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: { name: 'Demo' },
    create: { name: 'Demo', slug: 'demo' },
  });

  const superadminUser = await prisma.user.upsert({
    where: { email: 'superadmin@demo.local' },
    update: { name: 'Demo Superadmin' },
    create: {
      email: 'superadmin@demo.local',
      name: 'Demo Superadmin',
      passwordHash: 'change-me',
    },
  });

  await prisma.membership.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: superadminUser.id },
    },
    update: { status: 'active' },
    create: {
      workspaceId: workspace.id,
      userId: superadminUser.id,
      status: 'active',
    },
  });

  const modulesByKey = new Map<string, { id: string; key: string }>();
  for (const moduleData of MODULES) {
    const moduleRecord = await prisma.module.upsert({
      where: { key: moduleData.key },
      update: {
        name: moduleData.name,
        description: `${moduleData.name} module`,
        isCore: moduleData.isCore,
      },
      create: {
        key: moduleData.key,
        name: moduleData.name,
        description: `${moduleData.name} module`,
        isCore: moduleData.isCore,
      },
      select: { id: true, key: true },
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
      update: { enabled: true },
      create: {
        workspaceId: workspace.id,
        moduleId: moduleRecord.id,
        enabled: true,
      },
    });
  }

  const allPermissions: { id: string; key: string }[] = [];
  for (const permissionData of PERMISSIONS) {
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

  const rolesByName = new Map<string, { id: string; name: string }>();
  for (const roleData of ROLES) {
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
  }

  const superadminRole = rolesByName.get('Superadmin');
  if (!superadminRole) {
    throw new Error('Superadmin role not found after seed');
  }

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superadminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superadminRole.id,
        permissionId: permission.id,
      },
    });
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
          modulesEnabled: MODULES.length,
          permissionsCreated: PERMISSIONS.length,
        },
      },
    });
  }

  console.log('Seed completed');
  console.log(`Workspace: ${workspace.slug}`);
  console.log(`User: ${superadminUser.email}`);
  console.log(`Modules: ${MODULES.length}`);
  console.log(`Permissions: ${PERMISSIONS.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
