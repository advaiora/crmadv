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
 * ⚠️ **Copia della scala dei ruoli che sta sul server** (`SYSTEM_ROLE_PRIORITY`
 * in `server/auth/workspace-bootstrap.ts`). Attraverso il confine fra backend e
 * frontend una copia e' inevitabile, ma va saputo che sono due: se un giorno si
 * aggiunge un sesto ruolo di sistema, va aggiunto **in tutte e due**. Chi decide
 * davvero e' il server; qui si evita solo di mostrare scelte che verrebbero
 * rifiutate.
 */
export const TEAM_ROLE_PRIORITY = {
  Superadmin: 50,
  Admin: 40,
  Manager: 30,
  Operativo: 20,
  Viewer: 10,
};

/** Il livello di una persona = il piu' alto fra i ruoli di sistema che ha. */
export const highestRolePriority = (roles) =>
  (Array.isArray(roles) ? roles : []).reduce(
    (highest, role) => Math.max(highest, TEAM_ROLE_PRIORITY[role] ?? 0),
    0,
  );

/**
 * I ruoli che chi sta invitando puo' davvero concedere: il proprio e tutti
 * quelli sotto.
 *
 * Regola di Jacopo (17/8/2026): **un ruolo piu' basso non puo' mai creare un
 * invito per un ruolo piu' alto di lui.** Non e' solo cosmesi: prima non
 * esisteva nessun controllo, e chi poteva invitare poteva crearsi un invito da
 * Superadmin, aprirlo, ed entrare con pieni poteri. Il server la applica
 * comunque; qui si evita di mostrare scelte che verrebbero rifiutate.
 *
 * @param {string[]|undefined} actorRoles i ruoli dell'utente collegato
 */
export const invitableRolePresets = (actorRoles) => {
  const actorPriority = highestRolePriority(actorRoles);

  // Un ruolo che non sta nella scala NON si offre: sbagliare in apertura
  // mostrerebbe a un Viewer una voce che il server poi rifiuta.
  return TEAM_ROLE_PRESETS.filter((role) => {
    const priority = TEAM_ROLE_PRIORITY[role];
    return typeof priority === 'number' && priority <= actorPriority;
  });
};

/**
 * `true` se chi guarda puo' agire su un invito destinato a `invitePreset`.
 * Serve a **spegnere** il pulsante "Link invito" su un invito di livello piu'
 * alto del proprio, invece di offrirlo e farlo rifiutare dal server.
 */
export const canActOnInvitePreset = (actorRoles, invitePreset) => {
  const invitePriority = TEAM_ROLE_PRIORITY[invitePreset];
  if (typeof invitePriority !== 'number') {
    return false;
  }

  return invitePriority <= highestRolePriority(actorRoles);
};

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
