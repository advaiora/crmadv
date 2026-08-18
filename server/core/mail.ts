import nodemailer, { type Transporter } from 'nodemailer';
import { mailCrypto } from '../modules/mail/mail.crypto.js';
import { mailRepository } from '../modules/mail/mail.repository.js';

/**
 * Fonte unica della configurazione di posta del CRM.
 *
 * Prima del 17/8/2026 gli stessi parametri venivano letti da tre punti diversi e
 * indipendenti (l'invito del Team, le notifiche dei preventivi, e un modulo mai
 * collegato a niente): configurarne uno lasciava gli altri rotti in silenzio.
 * Chi ha bisogno di spedire un'email passa da qui.
 *
 * Dal 18/8/2026 i parametri arrivano dalla pagina "Server di posta" (salvati per
 * workspace, password cifrata a riposo) e le variabili d'ambiente restano come
 * ripiego per chi non ha ancora configurato niente. L'ordine e' sempre questo:
 * prima il database del workspace, poi l'ambiente.
 *
 * ⚠️ Questo file importa il repository del modulo `mail`, quindi `core` dipende
 * da un modulo — cosa che altrove non fa. E' una scelta: l'alternativa era una
 * seconda porta d'ingresso alla posta accanto a questa, ed e' esattamente il
 * problema che il 17/8 e' costato un giro di lavoro a chiudere. Meglio una
 * dipendenza dichiarata che due strade che divergono.
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
export type MailSettingsSource = 'database' | 'env' | 'ethereal';

/**
 * L'esito della ricerca di una configurazione, con i tre casi tenuti distinti.
 *
 * `illeggibile` esiste perche' "non c'e' un server di posta" e "il server c'e'
 * ma non riusciamo a leggerne la password" sono due guasti diversi che
 * richiedono due rimedi diversi: il primo si risolve configurando, il secondo
 * dicendo che la chiave di cifratura del server e' cambiata. Confonderli
 * manderebbe chi amministra a riscrivere parametri che erano gia' giusti.
 */
export type EsitoConfigurazionePosta =
  | { esito: 'ok'; settings: MailSettings; source: Exclude<MailSettingsSource, 'ethereal'> }
  | { esito: 'assente' }
  | { esito: 'illeggibile' };

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
  /**
   * Il workspace di cui usare il server di posta configurato dalla pagina
   * "Server di posta". Senza, si leggono solo le variabili d'ambiente — che e'
   * il comportamento giusto per le spedizioni che non appartengono a nessun
   * workspace, non un ripiego da correggere.
   */
  workspaceId?: string | null;
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
 * Legge i parametri salvati nel CRM per un workspace.
 *
 * `assente` = non c'e' nessuna riga, oppure la configurazione e' stata messa in
 * pausa dall'interruttore della pagina: in entrambi i casi si passa al ripiego
 * sulle variabili d'ambiente, ed e' voluto.
 *
 * ⚠️ `illeggibile` = la riga c'e' ma la password non si decifra, cioe' la
 * chiave di cifratura del server e' cambiata (o il database viene da un altro
 * ambiente). Qui NON si ripiega sull'ambiente: spedire dal mittente sbagliato
 * senza dirlo a nessuno sarebbe peggio del guasto. Ma non si lancia nemmeno
 * un'eccezione — che risalirebbe fino a un "Errore interno del server" — perche'
 * chi chiama deve poterlo spiegare a schermo.
 */
export const readMailSettingsFromDatabase = async (
  workspaceId: string,
): Promise<EsitoConfigurazionePosta> => {
  const record = await mailRepository.findByWorkspaceId(workspaceId);
  if (!record || !record.attivo) {
    return { esito: 'assente' };
  }

  let pass: string | null;
  try {
    pass = await mailCrypto.decrypt({
      workspaceId,
      ciphertext: record.ciphertext,
      iv: record.iv,
      authTag: record.authTag,
      keyVersion: record.keyVersion,
    });
  } catch {
    return { esito: 'illeggibile' };
  }

  return {
    esito: 'ok',
    source: 'database',
    settings: {
      host: record.server,
      port: record.porta,
      secure: record.connessioneSicura,
      user: record.utente,
      pass,
      from: record.mittente,
    },
  };
};

/**
 * I parametri in vigore adesso, con l'indicazione di da dove arrivano.
 * L'ordine e' database del workspace, poi variabili d'ambiente — tranne quando
 * la configurazione a database e' illeggibile, che si ferma li'.
 */
export const resolveMailSettingsDettagliato = async (
  workspaceId?: string | null,
): Promise<EsitoConfigurazionePosta> => {
  if (workspaceId) {
    const daDatabase = await readMailSettingsFromDatabase(workspaceId);
    if (daDatabase.esito !== 'assente') {
      return daDatabase;
    }
  }

  const daAmbiente = readMailSettingsFromEnv();
  return daAmbiente
    ? { esito: 'ok', source: 'env', settings: daAmbiente }
    : { esito: 'assente' };
};

/**
 * Attese massime, in millisecondi, prima di rinunciare alla connessione.
 * Servono a chi apre una connessione verso un indirizzo scelto sul momento
 * (la prova della pagina "Server di posta"): senza, nodemailer resta appeso
 * fino al suo default di due minuti e chi ha premuto il pulsante non sa se
 * stia succedendo qualcosa. Per le spedizioni vere si lasciano i default.
 */
export type MailTransportTimeouts = {
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
};

export const createMailTransport = (
  settings: MailSettings,
  timeouts: MailTransportTimeouts = {},
): Transporter =>
  nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...timeouts,
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

export type EsitoCanaleDiPosta =
  | ({ esito: 'ok' } & ResolvedMailTransport)
  | { esito: 'assente' }
  | { esito: 'illeggibile' };

/**
 * Il canale pronto a spedire, con i tre esiti tenuti distinti.
 * Lo usano i due punti che spediscono davvero (inviti e notifiche dei
 * preventivi), perche' devono poter dire QUALE guasto e' successo invece di
 * ridurlo a "non configurato".
 *
 * ⚠️ Non rimettere accanto una versione "comoda" che appiattisca i tre esiti in
 * `null`: c'era, non la usava piu' nessuno, ed e' l'errore in cui questo
 * modulo e' gia' cascato due volte in un giorno — la pagina «Server di posta»
 * annunciava "nessun server configurato" davanti a una maschera piena e giusta,
 * mandando a riscrivere parametri che non c'entravano niente.
 */
export const resolveMailTransportDettagliato = async (
  options: ResolveMailTransportOptions = {},
): Promise<EsitoCanaleDiPosta> => {
  const resolved = await resolveMailSettingsDettagliato(options.workspaceId);

  if (resolved.esito === 'ok') {
    return {
      esito: 'ok',
      transport: createMailTransport(resolved.settings),
      from: resolved.settings.from,
      source: resolved.source,
    };
  }

  // Una configurazione illeggibile non si aggira con la casella finta: il
  // ripiego di sviluppo serve a chi non ha ancora configurato niente, non a
  // mascherare un guasto.
  if (resolved.esito === 'assente' && options.allowDevFallback && isDevelopment()) {
    const ethereal = await createEtherealTransport();
    if (ethereal) {
      return { esito: 'ok', ...ethereal };
    }
  }

  return { esito: resolved.esito };
};

/** Il link per leggere un messaggio finito nella casella finta di sviluppo. */
export const getDevPreviewUrl = (info: unknown) => nodemailer.getTestMessageUrl(info as never) || null;
