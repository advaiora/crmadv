import {
  getDevPreviewUrl,
  resolveMailTransportDettagliato,
  type EsitoCanaleDiPosta,
} from '../../core/mail.js';

type TeamInviteNotificationInput = {
  toEmail: string;
  workspaceId: string;
  workspaceName: string;
  invitedByName: string;
  inviteLink: string;
  expiresAt: Date;
};

/**
 * `MAIL_NOT_CONFIGURED` = non esiste un server di posta configurato.
 * `SEND_FAILED` = il server c'e' ma ha rifiutato il messaggio.
 * `MAIL_CONFIG_UNREADABLE` = il server e' configurato nel CRM ma la sua password
 * non si riesce a decifrare (chiave di cifratura cambiata, o database venuto da
 * un altro ambiente). Tenuto separato da `MAIL_NOT_CONFIGURED` perche' manda a
 * un rimedio diverso: non "configura il server", ma "la chiave non e' piu'
 * quella con cui era stato salvato".
 * Le tre cose si dicono all'utente in modo diverso, quindi vanno distinte qui.
 */
export type TeamInviteNotificationResult = {
  delivered: boolean;
  reason?: 'MAIL_NOT_CONFIGURED' | 'SEND_FAILED' | 'MAIL_CONFIG_UNREADABLE';
  providerMessageId?: string | null;
  previewUrl?: string | null;
};

type TeamInviteNotifierDependencies = {
  resolveTransportFn: (workspaceId: string) => Promise<EsitoCanaleDiPosta>;
};

const defaultDependencies: TeamInviteNotifierDependencies = {
  // In sviluppo, senza server configurato, si ripiega sulla casella finta:
  // l'invito si puo' collaudare comunque e il link resta leggibile.
  // Il workspace serve a usare il server di posta configurato dalla pagina
  // "Server di posta", quando c'e': senza, l'invito partirebbe sempre dalle
  // variabili d'ambiente e la pagina non governerebbe niente.
  resolveTransportFn: (workspaceId: string) =>
    resolveMailTransportDettagliato({ workspaceId, allowDevFallback: true }),
};

export const buildTeamInviteNotifier = (
  dependencies: TeamInviteNotifierDependencies = defaultDependencies,
) => {
  const { resolveTransportFn } = dependencies;

  return {
    async sendInvite(input: TeamInviteNotificationInput): Promise<TeamInviteNotificationResult> {
      const resolved = await resolveTransportFn(input.workspaceId);

      if (resolved.esito !== 'ok') {
        return {
          delivered: false,
          reason:
            resolved.esito === 'illeggibile' ? 'MAIL_CONFIG_UNREADABLE' : 'MAIL_NOT_CONFIGURED',
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
