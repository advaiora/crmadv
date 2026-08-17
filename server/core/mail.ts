import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Fonte unica della configurazione di posta del CRM.
 *
 * Prima del 17/8/2026 gli stessi parametri venivano letti da tre punti diversi e
 * indipendenti (l'invito del Team, le notifiche dei preventivi, e un modulo mai
 * collegato a niente): configurarne uno lasciava gli altri rotti in silenzio.
 * Chi ha bisogno di spedire un'email passa da qui.
 *
 * Oggi i parametri arrivano dalle variabili d'ambiente. Quando esistera' la
 * pagina "Server di posta" dentro il CRM, sara' questo modulo a leggerli dal
 * database e a tenere le variabili come ripiego: i chiamanti non cambiano.
 */

export type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
};

/** Da dove arrivano i parametri usati per spedire. */
export type MailSettingsSource = 'env' | 'ethereal';

export type ResolvedMailTransport = {
  transport: Transporter;
  from: string;
  source: MailSettingsSource;
};

export type ResolveMailTransportOptions = {
  /**
   * Se in sviluppo non c'e' nessun server configurato, ripiega su Ethereal:
   * una casella finta che non recapita niente a nessuno ma restituisce un link
   * per vedere il messaggio. Serve a collaudare i flussi di posta senza un
   * server vero. In produzione non si attiva mai.
   */
  allowDevFallback?: boolean;
};

export const DEFAULT_MAIL_FROM = 'no-reply@local';
export const DEFAULT_SMTP_PORT = 587;

export const isDevelopment = () => process.env.NODE_ENV !== 'production';

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

/**
 * Legge i parametri dalle variabili d'ambiente.
 * Torna `null` se manca l'indirizzo del server o se la porta non e' un numero
 * valido: senza quei due non si spedisce, e mentire dicendo "configurato" e'
 * proprio l'errore che questo giro di lavoro sta correggendo.
 */
export const readMailSettingsFromEnv = (): MailSettings | null => {
  const host = readEnv('SMTP_HOST');
  if (!host) {
    return null;
  }

  const rawPort = readEnv('SMTP_PORT');
  const port = rawPort ? Number(rawPort) : DEFAULT_SMTP_PORT;
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  return {
    host,
    port,
    secure: parseBoolean(readEnv('SMTP_SECURE'), false),
    user: readEnv('SMTP_USER') ?? null,
    pass: readEnv('SMTP_PASS') ?? null,
    from: readEnv('EMAIL_FROM') ?? DEFAULT_MAIL_FROM,
  };
};

/**
 * I parametri in vigore adesso. Async di proposito: quando la pagina "Server di
 * posta" li salvera' a database la lettura diventera' una query, e i chiamanti
 * non dovranno essere riscritti una seconda volta.
 */
export const resolveMailSettings = async (): Promise<MailSettings | null> =>
  readMailSettingsFromEnv();

export const createMailTransport = (settings: MailSettings): Transporter =>
  nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...(settings.user ? { auth: { user: settings.user, pass: settings.pass ?? '' } } : {}),
  });

const createEtherealTransport = async (): Promise<ResolvedMailTransport | null> => {
  try {
    const account = await nodemailer.createTestAccount();

    return {
      transport: nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
      from: readEnv('EMAIL_FROM') ?? DEFAULT_MAIL_FROM,
      source: 'ethereal',
    };
  } catch {
    return null;
  }
};

/**
 * Il canale pronto a spedire, o `null` se non c'e'.
 * Chi riceve `null` deve dirlo a schermo, non far finta di aver spedito.
 */
export const resolveMailTransport = async (
  options: ResolveMailTransportOptions = {},
): Promise<ResolvedMailTransport | null> => {
  const settings = await resolveMailSettings();
  if (settings) {
    return {
      transport: createMailTransport(settings),
      from: settings.from,
      source: 'env',
    };
  }

  if (options.allowDevFallback && isDevelopment()) {
    return createEtherealTransport();
  }

  return null;
};

/** `true` se esiste un server di posta configurato davvero (Ethereal non conta). */
export const isMailConfigured = async () => (await resolveMailSettings()) !== null;

/** Il link per leggere un messaggio finito nella casella finta di sviluppo. */
export const getDevPreviewUrl = (info: unknown) => nodemailer.getTestMessageUrl(info as never) || null;
