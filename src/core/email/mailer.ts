import nodemailer from 'nodemailer';
import { internalServerError } from '../../../server/core/errors.js';

type MailAttachment = NonNullable<nodemailer.SendMailOptions['attachments']>[number];

type SendMailInput = {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  from?: string;
  transport?: nodemailer.Transporter;
};

export type SendMailResult = {
  provider: 'smtp';
  providerMessageId: string | null;
};

const DEFAULT_FROM = 'no-reply@local';

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return fallback;
};

const readEnv = (name: string) => {
  const rawValue = process.env[name];
  if (typeof rawValue !== 'string') {
    return undefined;
  }

  const normalized = rawValue.trim();
  return normalized || undefined;
};

const resolveSmtpConfig = () => {
  const host = readEnv('SMTP_HOST');
  if (!host) {
    throw internalServerError('Email provider not configured');
  }

  const portRaw = readEnv('SMTP_PORT');
  const port = portRaw ? Number(portRaw) : 587;
  if (!Number.isInteger(port) || port <= 0) {
    throw internalServerError('Email provider not configured');
  }

  const secure = parseBoolean(readEnv('SMTP_SECURE'), false);
  const user = readEnv('SMTP_USER');
  const pass = readEnv('SMTP_PASS');

  return {
    host,
    port,
    secure,
    ...(user ? { auth: { user, pass: pass ?? '' } } : {}),
  };
};

export const createTransport = () => {
  const config = resolveSmtpConfig();
  return nodemailer.createTransport(config);
};

export const sendMail = async (input: SendMailInput) => {
  const transport = input.transport ?? createTransport();
  const from = input.from?.trim() || readEnv('EMAIL_FROM') || DEFAULT_FROM;

  const info = await transport.sendMail({
    from,
    to: input.to,
    ...(input.cc && input.cc.length > 0 ? { cc: input.cc } : {}),
    ...(input.bcc && input.bcc.length > 0 ? { bcc: input.bcc } : {}),
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    ...(input.attachments && input.attachments.length > 0
      ? { attachments: input.attachments }
      : {}),
  });

  return {
    provider: 'smtp',
    providerMessageId:
      typeof info.messageId === 'string' && info.messageId.trim() ? info.messageId.trim() : null,
  } satisfies SendMailResult;
};
