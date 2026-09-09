import bcrypt from 'bcrypt';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../audit/audit.js';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_SALT_ROUNDS } from '../../auth/password-policy.js';
import { HttpError, badRequest } from '../../core/errors.js';
import { prisma } from '../../prisma.js';
import { membershipRepository } from '../../repositories/membership.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import { passwordResetNotifier } from './password-reset.notifier.js';
import { passwordResetRepository } from './password-reset.repository.js';
import { generateResetToken, hashResetToken } from './password-reset.tokens.js';

// Recupero della password per chi NON puo' fare l'accesso, perche' l'ha persa.
// Forma copiata da `server/modules/team/team-invite.service.ts`, che e' l'altro
// token al portatore del progetto: dipendenze iniettate, cosi' il test non ha
// bisogno ne' di database, ne' di bcrypt vero, ne' di un server di posta.
//
// ⚠️ Cinque scelte deliberate, scritte qui perche' non si riscoprano per tentativi:
//
// 1. LA RISPOSTA E' SEMPRE LA STESSA, indirizzo esistente o no. E' il punto
//    delicato dell'intera rotta: qualunque differenza — un codice di errore, un
//    campo in piu', persino una risposta molto piu' veloce — trasforma il
//    recupero password in un modo per sapere CHI ha un account nel CRM. Per lo
//    stesso motivo il limite di frequenza conta le richieste RICEVUTE e non
//    quelle andate a buon fine (vedi `rate-limit.ts`): contare solo le email
//    spedite renderebbe il 429 lo stesso oracolo.
// 2. IL TOKEN A DATABASE E' SOLO UN'IMPRONTA. Il valore in chiaro esiste per il
//    tempo di comporre il link e poi si perde. Chi si portasse via il database
//    non troverebbe nessun link utilizzabile.
// 3. LA CONFERMA STA IN UNA TRANSAZIONE. Bruciare il token e scrivere la
//    password nuova devono riuscire o fallire insieme: il finale storto grave e'
//    password nuova con token ancora vergine, cioe' un link al portatore
//    riutilizzabile.
// 4. NESSUN ACCESSO AUTOMATICO. L'invito Team, finito il suo giro, consegna un
//    token di sessione; qui no, e la differenza e' voluta. Chi accetta un invito
//    ha appena dimostrato di controllare la casella E ha scelto lui di entrare;
//    chi reimposta una password potrebbe essere qualcuno che ha trovato il link.
//    Farlo passare dalla schermata di accesso costa un passaggio e chiude il
//    caso in cui il link finisca nelle mani sbagliate.
// 5. ANCHE CHI ENTRA CON GOOGLE PUO' USARLO. `User.passwordHash` e' facoltativo:
//    per quegli account il recupero non REIMPOSTA una password, gliene IMPOSTA
//    una che prima non c'era. E' corretto e non e' una scorciatoia: la prova
//    richiesta e' il controllo della casella, cioe' esattamente la stessa prova
//    su cui si regge l'accesso con Google. Da quel momento l'account ha due modi
//    di entrare — si noti che il cambio password, invece, quegli account li
//    rifiuta con `PASSWORD_NOT_SET` (`password.service.ts`), perche' li' la
//    password vecchia va presentata e non esiste.

/** Quanto vale il link. Breve per scelta: e' un token al portatore che gira per email. */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Tetto di richieste per indirizzo IP tenuto A DATABASE, sulla finestra qui sotto.
 *
 * Si somma al limite in memoria di `rate-limit.ts` e non lo duplica: quello si
 * azzera a ogni riavvio dell'API, quindi da solo lascerebbe scoperto chi
 * aspettasse un riavvio. Questo conta righe vere e sopravvive.
 */
export const RESET_IP_DB_WINDOW_MS = 60 * 60 * 1000;
export const RESET_IP_DB_MAX_REQUESTS = 12;

const requestResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict();

const confirmResetSchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
}).strict();

/** Esiti registrati nel registro attivita'. */
export const PASSWORD_RESET_AUDIT_EVENTS = {
  requested: 'auth.password.reset_requested',
  completed: 'auth.password.reset_completed',
  failed: 'auth.password.reset_failed',
} as const;

const isDevelopment = () => process.env.NODE_ENV !== 'production';

/**
 * La base dell'indirizzo su cui vive la pagina `/reset-password`.
 *
 * Stessa catena di variabili d'ambiente di `resolveInviteBaseUrl` in
 * `team-invite.service.ts`, con in testa una variabile propria per il caso in
 * cui il recupero password debba puntare altrove rispetto agli inviti.
 */
export const resolveResetBaseUrl = () => {
  const candidate =
    process.env.PASSWORD_RESET_BASE_URL?.trim()
    || process.env.APP_BASE_URL?.trim()
    || process.env.FRONTEND_BASE_URL?.trim()
    || process.env.WEB_BASE_URL?.trim();

  if (!candidate) {
    return isDevelopment() ? 'http://localhost:5173' : null;
  }

  try {
    return new URL(candidate).toString().replace(/\/+$/, '');
  } catch {
    return isDevelopment() ? 'http://localhost:5173' : null;
  }
};

type PasswordResetServiceDependencies = {
  userRepositoryApi: typeof userRepository;
  membershipRepositoryApi: typeof membershipRepository;
  resetRepositoryApi: typeof passwordResetRepository;
  notifierApi: typeof passwordResetNotifier;
  hashPasswordFn: (password: string, rounds: number) => Promise<string>;
  generateTokenFn: typeof generateResetToken;
  hashTokenFn: typeof hashResetToken;
  auditLogFn: typeof audit.log;
  // ⚠️ Iniettata e non chiamata direttamente perche' `resolveResetBaseUrl`
  // dipende da `NODE_ENV`: in questo contenitore vale `production` (nota
  // operativa #69), quindi un test che non la sostituisse si troverebbe `null`
  // e nessun link, senza che il codice abbia niente che non va.
  resolveBaseUrlFn: typeof resolveResetBaseUrl;
  runInTransactionFn: typeof prisma.$transaction;
  nowFn: () => Date;
};

const defaultDependencies: PasswordResetServiceDependencies = {
  userRepositoryApi: userRepository,
  membershipRepositoryApi: membershipRepository,
  resetRepositoryApi: passwordResetRepository,
  notifierApi: passwordResetNotifier,
  hashPasswordFn: bcrypt.hash,
  generateTokenFn: generateResetToken,
  hashTokenFn: hashResetToken,
  auditLogFn: (input) => audit.log(input),
  resolveBaseUrlFn: resolveResetBaseUrl,
  runInTransactionFn: ((callback: unknown) =>
    (prisma.$transaction as (cb: unknown) => Promise<unknown>)(
      callback,
    )) as typeof prisma.$transaction,
  nowFn: () => new Date(),
};

/**
 * L'unico errore che la conferma restituisce, per qualunque motivo il token non
 * vada bene: inesistente, gia' usato, scaduto.
 *
 * ⚠️ Non distinguere i tre casi e' voluto ed e' un compromesso consapevole. Un
 * messaggio piu' preciso («questo link e' scaduto») aiuterebbe chi ha
 * semplicemente aspettato troppo, ma direbbe anche a chi tira a indovinare quali
 * token sono ESISTITI. La maschera suggerisce l'unica mossa utile — chiederne
 * un altro — che e' la stessa in tutti e tre i casi.
 */
const invalidResetToken = () =>
  new HttpError(
    400,
    'INVALID_RESET_TOKEN',
    'Questo link per reimpostare la password non è più valido. Richiedine uno nuovo.',
  );

export const buildPasswordResetService = (
  dependencies: PasswordResetServiceDependencies = defaultDependencies,
) => {
  /**
   * Scrive nel registro attivita', ma solo se si sa DOVE.
   *
   * ⚠️ `audit.log` pretende un `workspaceId` (`server/audit/audit.ts`), e qui
   * puo' mancare per davvero: un utente senza nessuna iscrizione attiva esiste,
   * e il recupero password e' proprio la rotta che lo incontra. Meglio un
   * evento non registrato che un recupero password che fallisce per colpa del
   * registro.
   *
   * Funzione locale e non metodo del servizio: come metodo servirebbe `this`, e
   * `this` si perde appena qualcuno scrive `const { requestReset } = service`.
   */
  const logReset = async (
    outcome: 'requested' | 'completed' | 'failed',
    context: {
      userId: string;
      workspaceId: string | null;
      request?: FastifyRequest;
      reason?: string;
    },
  ) => {
    if (!context.workspaceId) {
      return;
    }

    await dependencies.auditLogFn({
      event: PASSWORD_RESET_AUDIT_EVENTS[outcome],
      actorUserId: context.userId,
      workspaceId: context.workspaceId,
      entityType: 'user',
      entityId: context.userId,
      metadata: {
        route: '/auth/password/reset',
        outcome,
        ...(context.reason ? { reason: context.reason } : {}),
      },
      ...(context.request ? { request: context.request } : {}),
    });
  };

  return {
  /**
   * Chiede il link. Risposta identica per chiunque: vedi la nota 1 qui sopra.
   *
   * Il `delivery` che torna NON dice se l'indirizzo esiste: dice se il canale di
   * posta e' configurato, cosa che il chiamante sa gia' per conto suo e che in
   * sviluppo serve a mostrare l'anteprima del messaggio.
   */
  async requestReset(input: {
    request?: FastifyRequest;
    body: unknown;
    requestIp: string | null;
  }) {
    const parsed = requestResetSchema.safeParse(input.body);
    if (!parsed.success) {
      throw badRequest('Richiesta di recupero password non valida', {
        issues: parsed.error.flatten(),
      });
    }

    const now = dependencies.nowFn();
    const user = await dependencies.userRepositoryApi.findByEmail(parsed.data.email);

    // Indirizzo che non corrisponde a nessun account: ci si ferma qui, in
    // silenzio, e si risponde come se fosse andato tutto bene.
    if (!user) {
      return { requested: true as const, previewUrl: null };
    }

    // Il tetto a database (nota in cima). Sta DOPO la ricerca dell'utente solo
    // perche' prima non servirebbe a niente, e comunque non cambia la risposta:
    // chi lo supera riceve lo stesso `requested: true`, altrimenti il muro
    // direbbe che quell'indirizzo esiste.
    if (input.requestIp) {
      const recentFromIp = await dependencies.resetRepositoryApi.countRecentByIp({
        requestIp: input.requestIp,
        since: new Date(now.getTime() - RESET_IP_DB_WINDOW_MS),
      });

      if (recentFromIp >= RESET_IP_DB_MAX_REQUESTS) {
        return { requested: true as const, previewUrl: null };
      }
    }

    // I link chiesti prima muoiono adesso. Senza questo, ogni richiesta
    // lascerebbe in giro un link ancora buono, e ne basta uno finito nelle mani
    // sbagliate.
    await dependencies.resetRepositoryApi.invalidateOutstanding({
      userId: user.id,
      usedAt: now,
    });

    const token = dependencies.generateTokenFn();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    await dependencies.resetRepositoryApi.create({
      userId: user.id,
      tokenHash: dependencies.hashTokenFn(token),
      expiresAt,
      requestIp: input.requestIp,
    });

    // Il workspace serve al server di posta, che e' configurato per workspace
    // (`server/core/mail.ts`): senza, l'email partirebbe sempre dalle variabili
    // d'ambiente ignorando la pagina «Server di posta».
    const workspaceId = await dependencies.membershipRepositoryApi.findPrimaryWorkspaceId(user.id);

    const baseUrl = dependencies.resolveBaseUrlFn();
    if (!baseUrl) {
      // Nessun indirizzo pubblico configurato: il link non si puo' comporre. Si
      // registra e si esce con la solita risposta — l'utente non ha modo di
      // rimediare, ma il registro attivita' dice perche' non e' arrivato niente.
      await logReset('failed', {
        userId: user.id,
        workspaceId,
        request: input.request,
        reason: 'base_url_not_configured',
      });
      return { requested: true as const, previewUrl: null };
    }

    const delivery = await dependencies.notifierApi.sendResetLink({
      toEmail: parsed.data.email,
      ...(workspaceId ? { workspaceId } : {}),
      resetLink: `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresAt,
    });

    await logReset('requested', {
      userId: user.id,
      workspaceId,
      request: input.request,
      ...(delivery.delivered ? {} : { reason: delivery.reason ?? 'send_failed' }),
    });

    return {
      requested: true as const,
      // In sviluppo il messaggio finisce su una casella finta e questo e'
      // l'indirizzo per leggerlo. In produzione e' sempre `null`.
      previewUrl: delivery.previewUrl ?? null,
    };
  },

  /**
   * Dice se un link e' ancora buono, senza consumarlo.
   *
   * Serve alla pagina `/reset-password`, che altrimenti farebbe scegliere e
   * digitare due volte una password nuova per poi annunciare che il link era
   * scaduto. ⚠️ Non e' una falla: chi chiama questa rotta il token ce l'ha gia'
   * in mano, quindi non impara niente che non sapesse.
   */
  async checkToken(input: { body: unknown }) {
    const parsed = z.object({ token: z.string().trim().min(1) }).strict().safeParse(input.body);
    if (!parsed.success) {
      return { valid: false as const };
    }

    const record = await dependencies.resetRepositoryApi.findByTokenHash(
      dependencies.hashTokenFn(parsed.data.token),
    );

    if (!record || record.usedAt || record.expiresAt.getTime() <= dependencies.nowFn().getTime()) {
      return { valid: false as const };
    }

    return { valid: true as const };
  },

  /** Reimposta davvero la password. Transazione: vedi la nota 3 in cima. */
  async confirmReset(input: {
    request?: FastifyRequest;
    body: unknown;
  }) {
    const parsed = confirmResetSchema.safeParse(input.body);
    if (!parsed.success) {
      throw badRequest('Reimpostazione della password non valida', {
        issues: parsed.error.flatten(),
      });
    }

    const now = dependencies.nowFn();
    const tokenHash = dependencies.hashTokenFn(parsed.data.token);
    const record = await dependencies.resetRepositoryApi.findByTokenHash(tokenHash);

    if (!record || record.usedAt || record.expiresAt.getTime() <= now.getTime()) {
      throw invalidResetToken();
    }

    const passwordHash = await dependencies.hashPasswordFn(
      parsed.data.newPassword,
      PASSWORD_SALT_ROUNDS,
    );

    const consumed = await dependencies.runInTransactionFn(async (tx) => {
      // ⚠️ Il secondo controllo, dentro la transazione e sulla riga: `markUsed`
      // scrive solo se `usedAt` e' ancora nullo e torna `false` se non ha
      // toccato niente. E' cio' che rende il token monouso davvero, quando due
      // richieste con lo stesso token arrivano nello stesso istante — il
      // controllo qui sopra le lascerebbe passare entrambe.
      const burned = await dependencies.resetRepositoryApi.markUsed(
        { tokenId: record.id, usedAt: now },
        tx,
      );

      if (!burned) {
        return false;
      }

      // La stessa data che fa cadere le sessioni aperte con la password vecchia
      // (`server/guards/requireAuth.ts`). Chi ha perso la password non ha una
      // sessione da salvare, quindi qui — a differenza del cambio password —
      // non si consegna nessun token nuovo.
      await dependencies.userRepositoryApi.updatePasswordHash(
        record.userId,
        passwordHash,
        now,
        tx,
      );

      // Gli altri link ancora aperti di questo utente muoiono con il giro.
      await dependencies.resetRepositoryApi.invalidateOutstanding(
        { userId: record.userId, usedAt: now },
        tx,
      );

      return true;
    });

    if (!consumed) {
      throw invalidResetToken();
    }

    const workspaceId = await dependencies.membershipRepositoryApi.findPrimaryWorkspaceId(
      record.userId,
    );

    await logReset('completed', {
      userId: record.userId,
      workspaceId,
      request: input.request,
    });

    return { reset: true as const };
  },
  };
};

export const passwordResetService = buildPasswordResetService();
