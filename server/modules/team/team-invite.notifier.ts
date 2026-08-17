import {
  getDevPreviewUrl,
  resolveMailTransport,
  type ResolvedMailTransport,
} from '../../core/mail.js';

type TeamInviteNotificationInput = {
  toEmail: string;
  workspaceName: string;
  invitedByName: string;
  inviteLink: string;
  expiresAt: Date;
};

/**
 * `MAIL_NOT_CONFIGURED` = non esiste un server di posta configurato.
 * `SEND_FAILED` = il server c'e' ma ha rifiutato il messaggio.
 * Le due cose si dicono all'utente in modo diverso, quindi vanno distinte qui.
 */
export type TeamInviteNotificationResult = {
  delivered: boolean;
  reason?: 'MAIL_NOT_CONFIGURED' | 'SEND_FAILED';
  providerMessageId?: string | null;
  previewUrl?: string | null;
};

type TeamInviteNotifierDependencies = {
  resolveTransportFn: () => Promise<ResolvedMailTransport | null>;
};

const defaultDependencies: TeamInviteNotifierDependencies = {
  // In sviluppo, senza server configurato, si ripiega sulla casella finta:
  // l'invito si puo' collaudare comunque e il link resta leggibile.
  resolveTransportFn: () => resolveMailTransport({ allowDevFallback: true }),
};

export const buildTeamInviteNotifier = (
  dependencies: TeamInviteNotifierDependencies = defaultDependencies,
) => {
  const { resolveTransportFn } = dependencies;

  return {
    async sendInvite(input: TeamInviteNotificationInput): Promise<TeamInviteNotificationResult> {
      const resolved = await resolveTransportFn();

      if (!resolved) {
        return {
          delivered: false,
          reason: 'MAIL_NOT_CONFIGURED',
        };
      }

      const expiresDate = input.expiresAt.toISOString().slice(0, 10);

      try {
        const info = await resolved.transport.sendMail({
          from: resolved.from,
          to: input.toEmail,
          subject: `Invito al workspace ${input.workspaceName}`,
          text: [
            `Ciao,`,
            '',
            `${input.invitedByName} ti ha invitato al workspace "${input.workspaceName}".`,
            `Accetta l'invito: ${input.inviteLink}`,
            `Scadenza invito: ${expiresDate}`,
          ].join('\n'),
        });

        return {
          delivered: true,
          providerMessageId:
            typeof info.messageId === 'string' && info.messageId.trim().length > 0
              ? info.messageId
              : null,
          ...(resolved.source === 'ethereal' ? { previewUrl: getDevPreviewUrl(info) } : {}),
        };
      } catch {
        return {
          delivered: false,
          reason: 'SEND_FAILED',
        };
      }
    },
  };
};

export const teamInviteNotifier = buildTeamInviteNotifier();
