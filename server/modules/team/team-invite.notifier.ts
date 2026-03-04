import nodemailer, { type Transporter } from 'nodemailer';

type TeamInviteNotificationInput = {
  toEmail: string;
  workspaceName: string;
  invitedByName: string;
  inviteLink: string;
  expiresAt: Date;
};

export type TeamInviteNotificationResult = {
  delivered: boolean;
  reason?: 'SMTP_NOT_CONFIGURED' | 'SMTP_SEND_FAILED';
  providerMessageId?: string | null;
  previewUrl?: string | null;
};

type TeamInviteNotifierDependencies = {
  createTransportFn: () => Transporter | null;
};

const DEFAULT_FROM = 'no-reply@local';
const isDevelopment = () => process.env.NODE_ENV !== 'production';

const readEnv = (name: string) => {
  const raw = process.env[name];
  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    return false;
  }

  return fallback;
};

const resolveTransport = () => {
  const host = readEnv('SMTP_HOST');
  if (!host) {
    return null;
  }

  const rawPort = readEnv('SMTP_PORT');
  const port = rawPort ? Number(rawPort) : 587;
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  const secure = parseBoolean(readEnv('SMTP_SECURE'), false);
  const user = readEnv('SMTP_USER');
  const pass = readEnv('SMTP_PASS');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user ? { auth: { user, pass: pass ?? '' } } : {}),
  });
};

const resolveEtherealTransport = async () => {
  try {
    const account = await nodemailer.createTestAccount();

    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
  } catch {
    return null;
  }
};

const defaultDependencies: TeamInviteNotifierDependencies = {
  createTransportFn: resolveTransport,
};

export const buildTeamInviteNotifier = (
  dependencies: TeamInviteNotifierDependencies = defaultDependencies,
) => {
  const { createTransportFn } = dependencies;

  return {
    async sendInvite(input: TeamInviteNotificationInput): Promise<TeamInviteNotificationResult> {
      let transport = createTransportFn();
      let usingEthereal = false;
      if (!transport && isDevelopment()) {
        transport = await resolveEtherealTransport();
        usingEthereal = Boolean(transport);
      }

      if (!transport) {
        return {
          delivered: false,
          reason: 'SMTP_NOT_CONFIGURED',
        };
      }

      const expiresDate = input.expiresAt.toISOString().slice(0, 10);

      try {
        const info = await transport.sendMail({
          from: readEnv('EMAIL_FROM') || DEFAULT_FROM,
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
          ...(usingEthereal
            ? { previewUrl: nodemailer.getTestMessageUrl(info) || null }
            : {}),
        };
      } catch {
        return {
          delivered: false,
          reason: 'SMTP_SEND_FAILED',
        };
      }
    },
  };
};

export const teamInviteNotifier = buildTeamInviteNotifier();
