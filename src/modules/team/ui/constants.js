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

/**
 * I ruoli assegnabili tramite INVITO: gli stessi meno Superadmin.
 *
 * Superadmin si concede solo a un membro che esiste gia', dalla gestione ruoli,
 * e solo da parte di un altro Superadmin. Offrirlo nell'invito voleva dire
 * lasciare che chiunque potesse invitare (per esempio un Manager) si fabbricasse
 * una sessione da Superadmin aprendo l'invito che aveva appena creato.
 */
export const TEAM_INVITE_ROLE_PRESETS = TEAM_ROLE_PRESETS.filter((role) => role !== 'Superadmin');

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
