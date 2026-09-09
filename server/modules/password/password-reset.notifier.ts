import {
  getDevPreviewUrl,
  resolveMailTransportDettagliato,
  type EsitoCanaleDiPosta,
} from '../../core/mail.js';

// Gemello di `server/modules/team/team-invite.notifier.ts`: stessi tre esiti,
// stessa iniezione del canale, stessa casella finta in sviluppo.
//
// ⚠️ La posta NON parte finche' la password della casella non e' nel `.env`
// (o nella pagina «Server di posta»), e quel file sta fuori dal repository: lo
// mette Jacopo o Claudio sulla macchina. Il codice qui sotto e' completo e si
// prova con un finto spedizioniere, ma la prova vera — email che arriva davvero
// in una casella — non puo' essere chiusa da chi scrive il codice.

type PasswordResetNotificationInput = {
  toEmail: string;
  workspaceId?: string;
  resetLink: string;
  expiresAt: Date;
};

export type PasswordResetNotificationResult = {
  delivered: boolean;
  reason?: 'MAIL_NOT_CONFIGURED' | 'SEND_FAILED' | 'MAIL_CONFIG_UNREADABLE';
  providerMessageId?: string | null;
  previewUrl?: string | null;
};

type PasswordResetNotifierDependencies = {
  resolveTransportFn: (workspaceId?: string) => Promise<EsitoCanaleDiPosta>;
};

const defaultDependencies: PasswordResetNotifierDependencies = {
  resolveTransportFn: (workspaceId?: string) =>
    resolveMailTransportDettagliato({ workspaceId, allowDevFallback: true }),
};

/** Quanto manca alla scadenza, in minuti, per dirlo in italiano nel messaggio. */
const minutesUntil = (expiresAt: Date, nowMs: number) =>
  Math.max(1, Math.round((expiresAt.getTime() - nowMs) / 60_000));

export const buildPasswordResetNotifier = (
  dependencies: PasswordResetNotifierDependencies = defaultDependencies,
) => {
  const { resolveTransportFn } = dependencies;

  return {
    async sendResetLink(
      input: PasswordResetNotificationInput,
    ): Promise<PasswordResetNotificationResult> {
      const resolved = await resolveTransportFn(input.workspaceId);

      if (resolved.esito !== 'ok') {
        return {
          delivered: false,
          reason:
            resolved.esito === 'illeggibile' ? 'MAIL_CONFIG_UNREADABLE' : 'MAIL_NOT_CONFIGURED',
        };
      }

      const minuti = minutesUntil(input.expiresAt, Date.now());

      try {
        const info = await resolved.transport.sendMail({
          from: resolved.from,
          to: input.toEmail,
          subject: 'Reimposta la password del CRM',
          text: [
            'Ciao,',
            '',
            'abbiamo ricevuto una richiesta di reimpostare la password del tuo account CRM.',
            `Apri questo link per sceglierne una nuova: ${input.resetLink}`,
            '',
            `Il link vale ${minuti} minuti e si può usare una volta sola.`,
            'Se non sei stato tu a chiederlo, ignora questo messaggio: la tua password resta quella di prima.',
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

export const passwordResetNotifier = buildPasswordResetNotifier();
