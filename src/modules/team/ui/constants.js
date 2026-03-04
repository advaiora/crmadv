export const TEAM_MODULE_KEY = 'team';

export const TEAM_PERMISSIONS = {
  view: 'team.view',
  invite: 'team.invite',
  edit: 'team.edit',
  deactivate: 'team.deactivate',
  rolesAssign: 'team.roles_assign',
};

export const TEAM_ROLE_PRESETS = [
  'Superadmin',
  'Admin',
  'Manager',
  'Operativo',
  'Viewer',
];

export const TEAM_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tutti' },
  { value: 'ACTIVE', label: 'Attivi' },
  { value: 'INACTIVE', label: 'Inattivi' },
  { value: 'PENDING', label: 'Pending' },
];

export const TEAM_INVITE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tutti' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accettati' },
  { value: 'REVOKED', label: 'Revocati' },
  { value: 'EXPIRED', label: 'Scaduti' },
];
