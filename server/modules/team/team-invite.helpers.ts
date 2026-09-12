import { HttpError, badRequest, forbidden } from '../../core/errors.js';
import {
  SYSTEM_ROLE_NAME,
  isSystemRoleAtOrBelow,
  normalizeWorkspaceSystemRoleName,
} from '../../auth/workspace-bootstrap.js';
import type { WorkspaceSystemRoleName } from '../../auth/rbac-catalog.js';
import type { TeamInviteRecord } from './team-invite.repository.js';
import {
  DEFAULT_INVITE_EXPIRES_IN_DAYS,
  acceptInviteSchema,
  createInviteSchema,
  type InviteRolePresetInput,
} from './team-invite.schema.js';
import type { TeamInviteDto } from './team-invite.types.js';

export const isDevelopment = () => process.env.NODE_ENV !== 'production';

export const resolveInviteBaseUrl = () => {
  const candidate =
    process.env.TEAM_INVITE_BASE_URL?.trim()
    || process.env.APP_BASE_URL?.trim()
    || process.env.FRONTEND_BASE_URL?.trim()
    || process.env.WEB_BASE_URL?.trim();

  if (!candidate) {
    return isDevelopment() ? 'http://localhost:5173' : null;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return isDevelopment() ? 'http://localhost:5173' : null;
  }
};

/**
 * Il ruolo Superadmin non si concede per invito, nemmeno da un altro Superadmin.
 *
 * ⚠️ Sembra ridondante con la gerarchia qui sotto - se solo un Superadmin puo'
 * invitare un Superadmin, e un Superadmin puo' gia' promuovere chiunque, che
 * differenza fa? Ne fa una grossa, ed e' il motivo per cui questa regola
 * esiste: **promuovere e invitare non sono lo stesso potere.**
 *  - promuovere passa da `assignWorkspaceUserRole`, che pretende un destinatario
 *    gia' membro attivo del workspace: una persona con un account e una password;
 *  - invitare produce **una stringa al portatore**. La rotta di accettazione e'
 *    pubblica, l'autenticazione e' facoltativa, e senza sessione l'invito
 *    **crea l'utente** sull'email indicata e restituisce un token d'accesso.
 *
 * Dal 17/8/2026 quel link viene mostrato a schermo e copiato negli appunti
 * quando l'email non parte: finisce in chat, in un messaggio, in un blocco note.
 * Un invito da Superadmin sarebbe un oggetto per cui *chi lo apre per primo
 * comanda* - compreso chi non era il destinatario. Il resto del progetto la
 * pensa gia' cosi': la registrazione declassa a Viewer chi chiede Superadmin.
 */
export const assertInvitablePreset = (roleName: WorkspaceSystemRoleName) => {
  if (roleName === SYSTEM_ROLE_NAME.superadmin) {
    throw badRequest(
      'Il ruolo Superadmin non puo essere assegnato tramite invito: va concesso a un membro gia esistente da Ruoli e permessi',
    );
  }
};

export const resolveRolePresetNameOrThrow = (rolePreset: InviteRolePresetInput) => {
  const rawValue = Array.isArray(rolePreset) ? rolePreset[0] : rolePreset;
  if (!rawValue) {
    return SYSTEM_ROLE_NAME.viewer;
  }

  const normalizedRoleName = normalizeWorkspaceSystemRoleName(rawValue);
  if (!normalizedRoleName) {
    throw badRequest('Invalid rolePreset. Allowed values: Admin, Manager, Operativo, Viewer');
  }

  assertInvitablePreset(normalizedRoleName);

  return normalizedRoleName;
};

/**
 * Nessuno puo' invitare a un ruolo piu' alto del proprio.
 *
 * Regola di Jacopo, 17/8/2026, valida universalmente: non avrebbe senso che un
 * Manager faccia entrare un Admin. Prima non c'era nessun controllo e la
 * conseguenza era grossa: chiunque avesse `team.invite` poteva crearsi un invito
 * con preset **Superadmin**, aprirlo, e ritrovarsi una sessione da Superadmin -
 * mentre in ogni altro punto del CRM i ruoli di sistema li assegna solo un
 * Superadmin. Restava teorica solo perche' senza posta configurata il link non
 * usciva mai; col pulsante "Link invito" non lo sarebbe piu' stata.
 *
 * Stesso livello e' concesso: un Admin puo' invitare un Admin.
 */
export const assertActorCanInviteRole = ({
  actorRoleName,
  rolePresetName,
}: {
  actorRoleName: WorkspaceSystemRoleName | null;
  rolePresetName: WorkspaceSystemRoleName;
}) => {
  if (!actorRoleName) {
    throw forbidden('Actor has no system role in this workspace');
  }

  if (!isSystemRoleAtOrBelow(rolePresetName, actorRoleName)) {
    throw forbidden(
      `Non puoi invitare qualcuno al ruolo ${rolePresetName}: e piu alto del tuo (${actorRoleName})`,
      { actorRole: actorRoleName, requestedRole: rolePresetName },
    );
  }
};

export const resolveRolePresetForAcceptance = (rolePresetName: string | null) =>
  normalizeWorkspaceSystemRoleName(rolePresetName) ?? SYSTEM_ROLE_NAME.viewer;

export const resolveInviteExpiry = (now: Date, expiresInDays: number | undefined) => {
  const days = expiresInDays ?? DEFAULT_INVITE_EXPIRES_IN_DAYS;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
};

export const mapInviteToDto = (invite: TeamInviteRecord): TeamInviteDto => ({
  inviteId: invite.id,
  workspaceId: invite.workspaceId,
  email: invite.email,
  status: invite.status,
  rolePreset: invite.rolePresetName ?? SYSTEM_ROLE_NAME.viewer,
  expiresAt: invite.expiresAt.toISOString(),
  createdAt: invite.createdAt.toISOString(),
  acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
  revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
  invitedBy: {
    userId: invite.invitedByUser.id,
    name: invite.invitedByUser.name,
    email: invite.invitedByUser.email,
  },
  acceptedBy: invite.acceptedByUser
    ? {
      userId: invite.acceptedByUser.id,
      name: invite.acceptedByUser.name,
      email: invite.acceptedByUser.email,
    }
    : null,
});

export const parseCreateInvitePayload = (payload: unknown) => {
  const parsed = createInviteSchema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest('Invalid team invite payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

export const parseAcceptInvitePayload = (payload: unknown) => {
  const parsed = acceptInviteSchema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest('Invalid invite accept payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

export const assertAcceptableInviteStatus = (invite: TeamInviteRecord) => {
  if (invite.status === 'REVOKED') {
    throw new HttpError(410, 'INVITE_REVOKED', 'Invite has been revoked');
  }

  if (invite.status === 'EXPIRED') {
    throw new HttpError(410, 'INVITE_EXPIRED', 'Invite has expired');
  }
};