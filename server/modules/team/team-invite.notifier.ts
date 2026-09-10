import { sendMail, type SendMailFn } from '../../core/send-mail.js';

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
  sendMailFn: SendMailFn;
};

const defaultDependencies: TeamInviteNotifierDependencies = {
  sendMailFn: sendMail,
};

/** Il testo dell'invito, in chiaro: e' anche cio' che il test verifica. */
export const buildTeamInviteMessage = (input: TeamInviteNotificationInput) => ({
  to: input.toEmail,
  subject: `Invito al workspace ${input.workspaceName}`,
  text: [
    `Ciao,`,
    '',
    `${input.invitedByName} ti ha invitato al workspace "${input.workspaceName}".`,
    `Accetta l'invito: ${input.inviteLink}`,
    `Scadenza invito: ${input.expiresAt.toISOString().slice(0, 10)}`,
  ].join('\n'),
});

export const buildTeamInviteNotifier = (
  dependencies: TeamInviteNotifierDependencies = defaultDependencies,
) => {
  const { sendMailFn } = dependencies;

  return {
    async sendInvite(input: TeamInviteNotificationInput): Promise<TeamInviteNotificationResult> {
      const esito = await sendMailFn({
        workspaceId: input.workspaceId,
        motivo: 'invito al Team',
        // In sviluppo, senza server configurato, si ripiega sul trasporto finto:
        // l'invito si puo' collaudare comunque e il messaggio resta leggibile.
        ripiegoDiSviluppo: true,
        messaggio: buildTeamInviteMessage(input),
      });

      if (esito.esito === 'illeggibile') {
        return { delivered: false, reason: 'MAIL_CONFIG_UNREADABLE' };
      }

      if (esito.esito === 'non-configurata') {
        return { delivered: false, reason: 'MAIL_NOT_CONFIGURED' };
      }

      if (esito.esito === 'rifiutata') {
        return { delivered: false, reason: 'SEND_FAILED' };
      }

      // ⚠️ Ethereal SI', il trasporto dei log NO — e non e' un capriccio.
      // Da Ethereal torna un link con cui chi ha invitato legge il messaggio,
      // quindi c'e' qualcosa da consegnare e "inviata" e' un'informazione utile.
      // Il trasporto dei log non da' niente all'interfaccia: annunciare
      // "email inviata" li' sarebbe la bugia che questo giro di lavoro toglie.
      // Con `delivered: false` chi ha invitato si riprende il link d'invito
      // nella risposta e fa entrare la persona lo stesso.
      if (esito.source === 'log') {
        return { delivered: false, reason: 'MAIL_NOT_CONFIGURED' };
      }

      return {
        delivered: true,
        providerMessageId: esito.providerMessageId,
        ...(esito.previewUrl ? { previewUrl: esito.previewUrl } : {}),
      };
    },
  };
};

export const teamInviteNotifier = buildTeamInviteNotifier();
