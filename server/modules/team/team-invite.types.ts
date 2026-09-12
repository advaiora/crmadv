import type { signAccessToken } from '../../auth/jwt.js';
import type { assignWorkspaceUserRole } from '../../auth/workspace-bootstrap.js';
import type { WorkspaceSystemRoleName } from '../../auth/rbac-catalog.js';
import type { moduleRepository } from '../../repositories/module.repository.js';
import type { teamRepository } from './team.repository.js';
import type { userRepository } from '../../repositories/user.repository.js';
import type { prisma } from '../../prisma.js';
import type { teamInviteNotifier } from './team-invite.notifier.js';
import type { teamInviteRepository } from './team-invite.repository.js';
import type { generateInviteToken, hashInviteToken } from './team-invite.tokens.js';

export type TeamInviteDto = {
  inviteId: string;
  workspaceId: string;
  email: string;
  status: string;
  rolePreset: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedBy: {
    userId: string;
    name: string | null;
    email: string;
  };
  acceptedBy: {
    userId: string;
    name: string | null;
    email: string;
  } | null;
};

/**
 * Perche' l'email non e' partita. Tre cause distinte, che si raccontano
 * all'utente in tre modi diversi: prima del 17/8/2026 erano tutte appiattite
 * su "SMTP non configurato", che nel caso della base URL mancante era falso.
 */
export type TeamInviteDeliveryFailure =
  /** Non esiste un server di posta configurato. */
  | 'MAIL_NOT_CONFIGURED'
  /** Il server c'e' ma ha rifiutato il messaggio. */
  | 'SEND_FAILED'
  /** Il server e' configurato nel CRM ma la sua password non si decifra piu'. */
  | 'MAIL_CONFIG_UNREADABLE'
  /** Non si sa a quale indirizzo pubblico risponde il CRM: il link non e' componibile. */
  | 'INVITE_LINK_UNAVAILABLE';

export type TeamInviteDelivery = {
  emailSent: boolean;
  reason?: TeamInviteDeliveryFailure;
};

export type CreateTeamInviteResult = {
  inviteId: string;
  email: string;
  expiresAt: string;
  status: string;
  rolePreset: string;
  /** L'esito reale della consegna. L'invito puo' esistere e l'email non essere partita. */
  delivery: TeamInviteDelivery;
  inviteLink?: string;
  invitePreviewUrl?: string;
};

export type RegenerateInviteLinkResult = {
  invite: TeamInviteDto;
  inviteLink: string;
};

export type AcceptTeamInviteResult = {
  inviteId: string;
  workspaceId: string;
  workspaceSlug: string;
  membershipId: string;
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string | null;
  };
};

export type TeamInviteServiceDependencies = {
  inviteRepository: typeof teamInviteRepository;
  teamRepo: typeof teamRepository;
  userRepo: typeof userRepository;
  prismaClient: typeof prisma;
  moduleRepo: typeof moduleRepository;
  notifier: typeof teamInviteNotifier;
  getActorSystemRoleFn: (input: {
    workspaceId: string;
    userId: string;
  }) => Promise<WorkspaceSystemRoleName | null>;
  assignWorkspaceUserRoleFn: typeof assignWorkspaceUserRole;
  signAccessTokenFn: typeof signAccessToken;
  generateTokenFn: typeof generateInviteToken;
  hashTokenFn: typeof hashInviteToken;
  nowFn: () => Date;
};
