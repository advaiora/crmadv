export type ModuleCatalogEntry = {
  key: string;
  name: string;
  isCore: boolean;
  description: string;
};

export type PermissionCatalogEntry = {
  key: string;
  moduleKey: string;
  description: string;
};

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

export const TEAM_MODULE_KEY = 'team';
export const DASHBOARD_MODULE_KEY = 'dashboard';
export const MESSAGES_MODULE_KEY = 'messages';

// Permessi della Chat AI (15/7/2026). Prima la chat girava tutta su 'projects.view':
// inviare un messaggio — che SPENDE SOLDI — chiedeva lo stesso permesso della sola
// lettura, e nessun ruolo poteva moderare un gruppo altrui. Modellati sul precedente
// di 'messages' (view/send), che e' lo stesso problema: consultare != scrivere.
// Stanno sotto il modulo 'projects' perche' e' quello che le rotte della chat
// richiedono gia' (l'area Agency non ha un modulo suo).
export const CHAT_PERMISSIONS = {
  view: 'chat.view',
  use: 'chat.use',
  moderate: 'chat.moderate',
} as const;

export type ChatPermissionKey = (typeof CHAT_PERMISSIONS)[keyof typeof CHAT_PERMISSIONS];

export const TEAM_PERMISSIONS = {
  view: 'team.view',
  invite: 'team.invite',
  edit: 'team.edit',
  deactivate: 'team.deactivate',
  rolesAssign: 'team.roles_assign',
} as const;

export const DASHBOARD_PERMISSIONS = {
  view: 'dashboard.view',
} as const;

export type TeamPermissionKey =
  (typeof TEAM_PERMISSIONS)[keyof typeof TEAM_PERMISSIONS];
export type DashboardPermissionKey =
  (typeof DASHBOARD_PERMISSIONS)[keyof typeof DASHBOARD_PERMISSIONS];

export type PermissionSelection =
  | 'all'
  | readonly string[]
  | { mode: 'all_except'; exclude: readonly string[] };

export type SystemRoleDefinition = {
  name: WorkspaceSystemRoleName;
  description: string;
  isSuperadmin: boolean;
  userRole: string;
  permissions: PermissionSelection;
};

export const SYSTEM_MODULE_CATALOG: readonly ModuleCatalogEntry[] = [
  { key: 'modules', name: 'Module Registry', isCore: true, description: 'Module registry' },
  { key: 'branding', name: 'Branding', isCore: true, description: 'Branding module' },
  { key: 'audit', name: 'Audit', isCore: true, description: 'Audit module' },
  { key: DASHBOARD_MODULE_KEY, name: 'Dashboard', isCore: true, description: 'Operational dashboard module' },
  { key: TEAM_MODULE_KEY, name: 'Team', isCore: false, description: 'Team module' },
  { key: 'departments', name: 'Departments', isCore: false, description: 'Departments module' },
  { key: 'clients', name: 'Clients', isCore: false, description: 'Clients module' },
  { key: 'projects', name: 'Projects', isCore: false, description: 'Projects module' },
  { key: 'checklists', name: 'Checklists', isCore: false, description: 'Checklists module' },
  { key: 'calendar', name: 'Calendar', isCore: false, description: 'Calendar module' },
  { key: 'quotes', name: 'Quotes', isCore: false, description: 'Quotes module' },
  { key: 'web', name: 'Web', isCore: false, description: 'Web module' },
  { key: 'vault', name: 'Vault', isCore: false, description: 'Vault module' },
  { key: 'seo', name: 'SEO', isCore: false, description: 'SEO module' },
  { key: MESSAGES_MODULE_KEY, name: 'Messages', isCore: false, description: 'Internal messaging module' },
] as const;

export const SYSTEM_PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  { key: 'modules.manage', moduleKey: 'modules', description: 'Manage workspace modules' },
  { key: 'branding.manage', moduleKey: 'branding', description: 'Manage workspace branding' },
  { key: 'audit.view', moduleKey: 'audit', description: 'View audit logs' },
  { key: DASHBOARD_PERMISSIONS.view, moduleKey: DASHBOARD_MODULE_KEY, description: 'View operational dashboard' },

  // Legacy role-management permissions still used by existing routes.
  { key: 'roles.view', moduleKey: TEAM_MODULE_KEY, description: 'View workspace roles' },
  { key: 'roles.manage', moduleKey: TEAM_MODULE_KEY, description: 'Manage workspace roles' },
  { key: 'roles.assign', moduleKey: TEAM_MODULE_KEY, description: 'Assign roles to workspace users' },

  { key: TEAM_PERMISSIONS.view, moduleKey: TEAM_MODULE_KEY, description: 'View team members' },
  { key: TEAM_PERMISSIONS.invite, moduleKey: TEAM_MODULE_KEY, description: 'Invite team members' },
  { key: TEAM_PERMISSIONS.edit, moduleKey: TEAM_MODULE_KEY, description: 'Edit team members' },
  { key: TEAM_PERMISSIONS.deactivate, moduleKey: TEAM_MODULE_KEY, description: 'Deactivate team members' },
  { key: TEAM_PERMISSIONS.rolesAssign, moduleKey: TEAM_MODULE_KEY, description: 'Assign team roles' },

  { key: 'departments.view', moduleKey: 'departments', description: 'View departments' },
  { key: 'departments.manage', moduleKey: 'departments', description: 'Create, edit and delete departments' },
  { key: 'departments.assign', moduleKey: 'departments', description: 'Assign users to departments' },

  { key: 'clients.view', moduleKey: 'clients', description: 'View clients' },
  { key: 'clients.create', moduleKey: 'clients', description: 'Create clients' },
  { key: 'clients.edit', moduleKey: 'clients', description: 'Edit clients' },
  { key: 'clients.delete', moduleKey: 'clients', description: 'Delete clients' },
  { key: 'projects.view', moduleKey: 'projects', description: 'View projects' },
  { key: 'projects.view_all', moduleKey: 'projects', description: 'View all workspace projects (bypass department/assignment scoping)' },
  { key: 'projects.create', moduleKey: 'projects', description: 'Create projects' },
  { key: 'projects.edit', moduleKey: 'projects', description: 'Edit projects' },
  { key: 'projects.delete', moduleKey: 'projects', description: 'Delete projects' },
  { key: 'projects.move_stage', moduleKey: 'projects', description: 'Move projects between stages' },
  { key: 'checklists.view', moduleKey: 'checklists', description: 'View checklists' },
  { key: 'checklists.manage_templates', moduleKey: 'checklists', description: 'Manage checklist templates' },
  // Legacy granular permissions still accepted by existing APIs.
  { key: 'checklists.create', moduleKey: 'checklists', description: 'Create checklist templates' },
  { key: 'checklists.edit', moduleKey: 'checklists', description: 'Edit checklist templates and items' },
  { key: 'checklists.delete', moduleKey: 'checklists', description: 'Archive checklist templates and delete items' },
  { key: 'checklists.complete_item', moduleKey: 'checklists', description: 'Complete checklist instance items' },
  { key: 'checklists.assign', moduleKey: 'checklists', description: 'Assign checklist items to workspace users' },
  { key: 'checklists.override_gate', moduleKey: 'checklists', description: 'Override checklist gates' },
  { key: 'calendar.view', moduleKey: 'calendar', description: 'View calendar events' },
  { key: 'calendar.create', moduleKey: 'calendar', description: 'Create calendar events' },
  { key: 'calendar.edit', moduleKey: 'calendar', description: 'Edit calendar events' },
  { key: 'calendar.delete', moduleKey: 'calendar', description: 'Delete calendar events' },
  { key: 'quotes.view', moduleKey: 'quotes', description: 'View quotes' },
  { key: 'quotes.create', moduleKey: 'quotes', description: 'Create quotes' },
  { key: 'quotes.edit', moduleKey: 'quotes', description: 'Edit quotes' },
  { key: 'quotes.delete', moduleKey: 'quotes', description: 'Delete quotes' },
  { key: 'quotes.send', moduleKey: 'quotes', description: 'Send quotes' },
  { key: 'quotes.accept', moduleKey: 'quotes', description: 'Accept quotes' },
  { key: 'quotes.manage_templates', moduleKey: 'quotes', description: 'Manage quote templates' },
  { key: 'web.view', moduleKey: 'web', description: 'View web assets' },
  { key: 'web.create', moduleKey: 'web', description: 'Create web assets' },
  { key: 'web.edit', moduleKey: 'web', description: 'Edit web assets' },
  { key: 'web.delete', moduleKey: 'web', description: 'Delete web assets' },
  { key: 'web.publish', moduleKey: 'web', description: 'Publish or unpublish web assets' },
  { key: 'web.unpublish', moduleKey: 'web', description: 'Unpublish web assets' },
  { key: 'web.version.create', moduleKey: 'web', description: 'Create web asset versions' },
  { key: 'web.version.rollback', moduleKey: 'web', description: 'Rollback web asset versions' },
  { key: 'vault.view_list', moduleKey: 'vault', description: 'View vault item list' },
  { key: 'vault.create', moduleKey: 'vault', description: 'Create vault items' },
  { key: 'vault.edit', moduleKey: 'vault', description: 'Edit vault items' },
  { key: 'vault.reveal', moduleKey: 'vault', description: 'Reveal vault secrets' },
  { key: 'vault.delete', moduleKey: 'vault', description: 'Delete vault items' },
  { key: 'vault.manage_settings', moduleKey: 'vault', description: 'Manage vault workspace settings' },
  { key: 'seo.view', moduleKey: 'seo', description: 'View SEO data' },
  { key: 'seo.run_scan', moduleKey: 'seo', description: 'Run SEO scans' },
  { key: 'seo.export', moduleKey: 'seo', description: 'Export SEO reports' },
  { key: 'seo.manage_settings', moduleKey: 'seo', description: 'Manage SEO settings' },
  { key: 'messages.view', moduleKey: MESSAGES_MODULE_KEY, description: 'View internal messages' },
  { key: 'messages.send', moduleKey: MESSAGES_MODULE_KEY, description: 'Send internal messages' },

  { key: CHAT_PERMISSIONS.view, moduleKey: 'projects', description: 'View AI chat sessions and their history' },
  { key: CHAT_PERMISSIONS.use, moduleKey: 'projects', description: 'Write in the AI chat: send messages (spends AI budget), invite, attach, clear' },
  { key: CHAT_PERMISSIONS.moderate, moduleKey: 'projects', description: "Moderate AI chat groups: remove members, take over and disband, without reading the messages" },
] as const;

export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    name: SYSTEM_ROLE_NAME.superadmin,
    description: 'Full control over workspace and permissions',
    isSuperadmin: true,
    userRole: 'superadmin',
    permissions: 'all',
  },
  {
    name: SYSTEM_ROLE_NAME.admin,
    description: 'High-privilege workspace administrator',
    isSuperadmin: false,
    userRole: 'admin',
    // Superadmin is the only role that can manage modules and role/permission assignments.
    permissions: {
      mode: 'all_except',
      exclude: [
        'modules.manage',
        'roles.view',
        'roles.manage',
        'roles.assign',
        TEAM_PERMISSIONS.rolesAssign,
        // Prevent legacy broad grant if this permission exists in older databases.
        'team.manage',
      ],
    },
  },
  {
    name: SYSTEM_ROLE_NAME.manager,
    description: 'Manage operational workflows (projects/checklists/quotes/web)',
    isSuperadmin: false,
    userRole: 'manager',
    permissions: [
      TEAM_PERMISSIONS.view,
      TEAM_PERMISSIONS.invite,
      TEAM_PERMISSIONS.edit,
      DASHBOARD_PERMISSIONS.view,
      'departments.view',
      'clients.view',
      'clients.create',
      'clients.edit',
      'projects.view',
      'projects.view_all',
      'projects.create',
      'projects.edit',
      'projects.move_stage',
      'checklists.view',
      'checklists.manage_templates',
      'checklists.complete_item',
      'checklists.assign',
      'checklists.override_gate',
      'calendar.view',
      'calendar.create',
      'calendar.edit',
      'calendar.delete',
      'quotes.view',
      'quotes.create',
      'quotes.edit',
      'quotes.send',
      'web.view',
      'web.create',
      'web.edit',
      'web.delete',
      'web.publish',
      'web.unpublish',
      'web.version.create',
      'web.version.rollback',
      'messages.view',
      'messages.send',
      // Il manager usa la chat, ma non modera i gruppi altrui: quella resta
      // ad Admin/Superadmin (che la prendono da 'all'/'all_except').
      CHAT_PERMISSIONS.view,
      CHAT_PERMISSIONS.use,
    ],
  },
  {
    name: SYSTEM_ROLE_NAME.operativo,
    description: 'Operational contributor with limited edit permissions',
    isSuperadmin: false,
    userRole: 'operativo',
    permissions: [
      TEAM_PERMISSIONS.view,
      DASHBOARD_PERMISSIONS.view,
      'departments.view',
      'clients.view',
      'clients.edit',
      'projects.view',
      'checklists.view',
      'checklists.complete_item',
      'checklists.assign',
      'calendar.view',
      'calendar.create',
      'calendar.edit',
      'quotes.view',
      'web.view',
      'messages.view',
      'messages.send',
      CHAT_PERMISSIONS.view,
      CHAT_PERMISSIONS.use,
    ],
  },
  {
    name: SYSTEM_ROLE_NAME.viewer,
    description: 'Read-only access',
    isSuperadmin: false,
    userRole: 'viewer',
    permissions: [
      TEAM_PERMISSIONS.view,
      DASHBOARD_PERMISSIONS.view,
      'departments.view',
      'clients.view',
      'projects.view',
      'checklists.view',
      'calendar.view',
      'quotes.view',
      'web.view',
      'audit.view',
      'messages.view',
      // Il Viewer e' in sola lettura: consulta le chat di cui fa parte ma non
      // scrive e non spende (niente chat.use). E' il punto della separazione.
      CHAT_PERMISSIONS.view,
    ],
  },
] as const;
