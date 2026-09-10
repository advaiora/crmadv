import { badRequest, conflict, notFound } from '../../core/errors.js';
import { signAccessToken } from '../../auth/jwt.js';
import {
  SYSTEM_ROLE_NAME,
  assignWorkspaceUserRole,
  getUserWorkspaceSystemRoleName,
} from '../../auth/workspace-bootstrap.js';
import { moduleRepository } from '../../repositories/module.repository.js';
import { teamRepository } from './team.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import { prisma } from '../../prisma.js';
import { teamInviteNotifier } from './team-invite.notifier.js';
import { teamInviteRepository } from './team-invite.repository.js';
import { generateInviteToken, hashInviteToken } from './team-invite.tokens.js';
import { normalizeEmail } from './team.utils.js';
import { acceptTeamInvite } from './team-invite.accept.js';
import {
  assertActorCanInviteRole,
  isDevelopment,
  mapInviteToDto,
  parseCreateInvitePayload,
  resolveInviteBaseUrl,
  resolveInviteExpiry,
  resolveRolePresetForAcceptance,
  resolveRolePresetNameOrThrow,
} from './team-invite.helpers.js';
import type {
  AcceptTeamInviteResult,
  CreateTeamInviteResult,
  RegenerateInviteLinkResult,
  TeamInviteDelivery,
  TeamInviteDto,
  TeamInviteServiceDependencies,
} from './team-invite.types.js';

// Ri-esportati perche' erano parte della superficie di questo file prima della
// spezzatura: chi li importava da qui continua a trovarli.
export type { TeamInviteDelivery, TeamInviteDeliveryFailure } from './team-invite.types.js';


const defaultDependencies: TeamInviteServiceDependencies = {
  inviteRepository: teamInviteRepository,
  teamRepo: teamRepository,
  userRepo: userRepository,
  prismaClient: prisma,
  moduleRepo: moduleRepository,
  notifier: teamInviteNotifier,
  getActorSystemRoleFn: ({ workspaceId, userId }) =>
    getUserWorkspaceSystemRoleName({ tx: prisma, workspaceId, userId }),
  assignWorkspaceUserRoleFn: assignWorkspaceUserRole,
  signAccessTokenFn: signAccessToken,
  generateTokenFn: generateInviteToken,
  hashTokenFn: hashInviteToken,
  nowFn: () => new Date(),
};
export const buildTeamInviteService = (
  dependencies: TeamInviteServiceDependencies = defaultDependencies,
) => {
  const {
    inviteRepository,
    teamRepo,
    userRepo,
    prismaClient,
    moduleRepo,
    notifier,
    getActorSystemRoleFn,
    assignWorkspaceUserRoleFn,
    signAccessTokenFn,
    generateTokenFn,
    hashTokenFn,
    nowFn,
  } = dependencies;

  return {
    async createInvite(input: {
      workspaceId: string;
      invitedByUserId: string;
      invitedByDisplayName: string;
      payload: unknown;
    }): Promise<CreateTeamInviteResult> {
      const now = nowFn();
      const parsedPayload = parseCreateInvitePayload(input.payload);
      const email = normalizeEmail(parsedPayload.email);
      const rolePresetName = resolveRolePresetNameOrThrow(parsedPayload.rolePreset);
      const expiresAt = resolveInviteExpiry(now, parsedPayload.expiresInDays);

      const actorRoleName = await getActorSystemRoleFn({
        workspaceId: input.workspaceId,
        userId: input.invitedByUserId,
      });

      assertActorCanInviteRole({ actorRoleName, rolePresetName });

      await inviteRepository.expirePendingInvites(input.workspaceId, now);

      const existingUser = await userRepo.findByEmail(email);
      if (existingUser) {
        const existingMembership = await teamRepo.findMembershipByUserId(input.workspaceId, existingUser.id);
        if (existingMembership) {
          throw conflict('Invite cannot be created for this recipient');
        }
      }

      const token = generateTokenFn();
      const tokenHash = hashTokenFn(token);
      const existingPendingInvite = await inviteRepository.findPendingInviteByEmail(input.workspaceId, email);

      // Se un invito per questa persona esiste gia', invitarla di nuovo lo
      // SOVRASCRIVE: cambia il ruolo e cambia il token, quindi il link gia'
      // consegnato smette di funzionare. E' un potere sull'invito di qualcun
      // altro, e va misurato sul ruolo di QUELL'invito, non solo su quello
      // nuovo - altrimenti un Manager puo' calpestare l'invito da Admin appena
      // spedito dal Superadmin, declassarlo, e prendersi il link.
      if (existingPendingInvite) {
        assertActorCanInviteRole({
          actorRoleName,
          rolePresetName: resolveRolePresetForAcceptance(existingPendingInvite.rolePresetName),
        });
      }

      const invite = existingPendingInvite
        ? await inviteRepository.refreshPendingInvite({
          inviteId: existingPendingInvite.id,
          tokenHash,
          expiresAt,
          rolePresetName,
        })
        : await inviteRepository.createInvite({
          workspaceId: input.workspaceId,
          email,
          tokenHash,
          expiresAt,
          rolePresetName,
          invitedByUserId: input.invitedByUserId,
        });

      const inviteBaseUrl = resolveInviteBaseUrl();
      const inviteLink = inviteBaseUrl
        ? `${inviteBaseUrl}/accept-invite?token=${encodeURIComponent(token)}`
        : null;

      let delivery: TeamInviteDelivery;
      let previewUrl: string | null = null;

      if (!inviteLink) {
        // Non e' un problema di posta: senza indirizzo pubblico il link non e'
        // nemmeno componibile, e dirlo "SMTP non configurato" sarebbe falso.
        delivery = { emailSent: false, reason: 'INVITE_LINK_UNAVAILABLE' };
      } else {
        const notificationResult = await notifier.sendInvite({
          toEmail: email,
          workspaceId: input.workspaceId,
          workspaceName: invite.workspace.name,
          invitedByName: input.invitedByDisplayName,
          inviteLink,
          expiresAt,
        });

        delivery = notificationResult.delivered
          ? { emailSent: true }
          : { emailSent: false, reason: notificationResult.reason ?? 'SEND_FAILED' };
        previewUrl = notificationResult.previewUrl ?? null;
      }

      return {
        inviteId: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt.toISOString(),
        status: invite.status,
        rolePreset: invite.rolePresetName ?? SYSTEM_ROLE_NAME.viewer,
        delivery,
        // Se l'email non e' partita il link va restituito SEMPRE, non solo in
        // sviluppo: e' l'unico modo che ha chi invita per far entrare la
        // persona lo stesso. Va a chi ha appena creato l'invito ed e' gia'
        // autenticato con il permesso di gestire il Team, quindi non allarga
        // la platea di chi puo' vederlo.
        ...(!delivery.emailSent && inviteLink ? { inviteLink } : {}),
        ...(delivery.emailSent && isDevelopment() && previewUrl
          ? { invitePreviewUrl: previewUrl }
          : {}),
      };
    },

    async listInvites(workspaceId: string): Promise<TeamInviteDto[]> {
      const now = nowFn();
      await inviteRepository.expirePendingInvites(workspaceId, now);
      const invites = await inviteRepository.listInvitesByWorkspace(workspaceId);
      return invites.map(mapInviteToDto);
    },

    /**
     * Restituisce un link di accettazione utilizzabile per un invito gia' in
     * attesa - quando l'email non e' partita, o la persona l'ha persa.
     *
     * Il link va necessariamente RIGENERATO: del token si conserva solo
     * l'impronta (`tokenHash`), mai il valore in chiaro, quindi non esiste da
     * nessuna parte un link da rileggere. Conseguenza da dire all'utente: il
     * link precedente smette di funzionare.
     *
     * La scadenza NON viene spostata: chiedere di nuovo il link non deve
     * allungare di nascosto la vita di un invito.
     */
    async regenerateInviteLink(input: {
      workspaceId: string;
      inviteId: string;
      actorUserId: string;
    }): Promise<RegenerateInviteLinkResult> {
      const now = nowFn();
      await inviteRepository.expirePendingInvites(input.workspaceId, now);

      const existingInvite = await inviteRepository.findInviteById(input.workspaceId, input.inviteId);
      if (!existingInvite) {
        throw notFound('Team invite not found');
      }

      if (existingInvite.status !== 'PENDING') {
        throw badRequest('Only pending invites can produce a new link');
      }

      // Consegnare il link e' come creare l'invito: se non potresti crearlo a
      // quel ruolo, non puoi nemmeno farne uscire il link. Vale anche per gli
      // inviti nati prima della regola.
      assertActorCanInviteRole({
        actorRoleName: await getActorSystemRoleFn({
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
        }),
        rolePresetName: resolveRolePresetForAcceptance(existingInvite.rolePresetName),
      });

      const inviteBaseUrl = resolveInviteBaseUrl();
      if (!inviteBaseUrl) {
        throw badRequest('Invite link cannot be built: public base URL is not configured');
      }

      const token = generateTokenFn();
      const updatedInvite = await inviteRepository.refreshPendingInvite({
        inviteId: existingInvite.id,
        tokenHash: hashTokenFn(token),
        expiresAt: existingInvite.expiresAt,
        rolePresetName: existingInvite.rolePresetName ?? SYSTEM_ROLE_NAME.viewer,
      });

      return {
        invite: mapInviteToDto(updatedInvite),
        inviteLink: `${inviteBaseUrl}/accept-invite?token=${encodeURIComponent(token)}`,
      };
    },

    async revokeInvite(input: {
      workspaceId: string;
      inviteId: string;
    }): Promise<TeamInviteDto> {
      const now = nowFn();
      await inviteRepository.expirePendingInvites(input.workspaceId, now);

      const existingInvite = await inviteRepository.findInviteById(input.workspaceId, input.inviteId);
      if (!existingInvite) {
        throw notFound('Team invite not found');
      }

      if (existingInvite.status !== 'PENDING') {
        throw badRequest('Only pending invites can be revoked');
      }

      await inviteRepository.revokePendingInvite(input.workspaceId, input.inviteId, now);
      const updatedInvite = await inviteRepository.findInviteById(input.workspaceId, input.inviteId);
      if (!updatedInvite) {
        throw notFound('Team invite not found');
      }

      return mapInviteToDto(updatedInvite);
    },

    async deleteInvite(input: {
      workspaceId: string;
      inviteId: string;
    }): Promise<TeamInviteDto> {
      const now = nowFn();
      await inviteRepository.expirePendingInvites(input.workspaceId, now);

      const existingInvite = await inviteRepository.findInviteById(input.workspaceId, input.inviteId);
      if (!existingInvite) {
        throw notFound('Team invite not found');
      }

      const deleted = await inviteRepository.deleteInviteById(input.workspaceId, input.inviteId);
      if (deleted.count === 0) {
        throw notFound('Team invite not found');
      }

      return mapInviteToDto(existingInvite);
    },

    async acceptInvite(input: {
      payload: unknown;
      authenticatedUserId: string | null;
      clientIp?: string | null;
    }): Promise<AcceptTeamInviteResult> {
      return acceptTeamInvite(dependencies, input);
    },
  };
};

export const teamInviteService = buildTeamInviteService();
