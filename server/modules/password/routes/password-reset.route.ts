import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ok } from '../../../core/response.js';
import { resolveRequestClientIp } from '../../vault/rate-limit.js';
import { passwordResetService } from '../password-reset.service.js';
import {
  enforcePasswordResetConfirmRateLimit,
  enforcePasswordResetRequestRateLimit,
} from '../rate-limit.js';

// Le tre rotte del recupero password. Stanno accanto a `password.route.ts`
// (stesso modulo, stesso prefisso `/auth/password/...`) ma in un file separato,
// perche' hanno una proprieta' che quella non ha e che non va confusa: sono
// PUBBLICHE.
//
// ⚠️ Nessuna delle tre chiama `requireAuth`, ed e' l'unico modo perche'
// funzionino: chi ha perso la password non ha una sessione, per definizione. Il
// prezzo e' che l'unica difesa rimasta e' il limite di frequenza, e per questo
// qui e' doppio — quello del plugin Fastify per indirizzo IP (`config.rateLimit`)
// e quello del modulo, che conta anche per EMAIL richiesta. Chi aggiunge una
// rotta a questo file la lasci pubblica solo se e' costretto, e non le tolga mai
// i limiti.
//
// ⚠️ Nessuna delle tre deve far trapelare SE un indirizzo email esista: e' la
// nota 1 di `password-reset.service.ts`, e riguarda anche le risposte HTTP che
// si scrivono qui sotto. La richiesta del link risponde `200` sempre.
//
// ⚠️ Nessun permesso in `server/auth/rbac-catalog.ts`, e la regola ① di
// CLAUDE.md e' rispettata, non aggirata: un permesso e' una cosa che si concede
// a un ruolo, e qui chi chiama non ha nessun ruolo perche' non ha fatto
// l'accesso. Non c'e' niente da governare. E' lo stesso motivo per cui non ce
// l'ha `POST /api/team/invites/accept`.

type PasswordResetRouteDependencies = {
  passwordResetServiceApi: typeof passwordResetService;
  enforceRequestRateLimitFn: typeof enforcePasswordResetRequestRateLimit;
  enforceConfirmRateLimitFn: typeof enforcePasswordResetConfirmRateLimit;
  resolveClientIpFn: (request: FastifyRequest) => string;
};

const defaultDependencies: PasswordResetRouteDependencies = {
  passwordResetServiceApi: passwordResetService,
  enforceRequestRateLimitFn: enforcePasswordResetRequestRateLimit,
  enforceConfirmRateLimitFn: enforcePasswordResetConfirmRateLimit,
  resolveClientIpFn: resolveRequestClientIp,
};

/**
 * L'indirizzo da salvare in `PasswordResetToken.requestIp`.
 *
 * `resolveRequestClientIp` torna la stringa `'unknown'` quando non riesce a
 * ricavare niente; a database ci va `null`, perche' altrimenti tutte le
 * richieste senza IP leggibile finirebbero a contare nello stesso secchio e si
 * bloccherebbero a vicenda.
 */
const toStoredIp = (clientIp: string) => (clientIp === 'unknown' ? null : clientIp);

/**
 * L'email su cui appoggiare il limite di frequenza, letta dal corpo grezzo.
 *
 * ⚠️ Il limite va applicato PRIMA che il servizio validi il corpo e cerchi
 * l'utente: e' proprio quel giro che si vuole evitare a chi tempesta. Qui non si
 * puo' quindi contare sullo schema Zod, e si legge il campo a mano. Se manca o
 * non e' una stringa si usa una chiave fissa: la richiesta verra' comunque
 * rifiutata come non valida dal servizio, ma intanto ha consumato una gettone
 * del limite, che e' esattamente cio' che deve succedere.
 */
const readEmailForRateLimit = (body: unknown) => {
  if (body && typeof body === 'object' && 'email' in body) {
    const value = (body as { email?: unknown }).email;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().toLowerCase();
    }
  }

  return '(assente)';
};

export const buildPasswordResetRoute = (
  dependencies: PasswordResetRouteDependencies = defaultDependencies,
): FastifyPluginAsync => async (app) => {
  app.post<{ Body: unknown }>(
    '/auth/password/reset/request',
    {
      config: {
        // Il plugin ha `global: false`: senza questo blocco la rotta non
        // avrebbe nessun limite per indirizzo IP.
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const clientIp = dependencies.resolveClientIpFn(request);

      dependencies.enforceRequestRateLimitFn({
        requestIp: clientIp,
        email: readEmailForRateLimit(request.body),
      });

      const result = await dependencies.passwordResetServiceApi.requestReset({
        request,
        body: request.body,
        requestIp: toStoredIp(clientIp),
      });

      // ⚠️ `requested: true` non significa «l'email e' partita»: significa «la
      // richiesta e' stata presa in carico». La differenza e' il punto di tutta
      // la rotta — vedi la nota 1 nel servizio. La maschera deve dire all'utente
      // «se l'indirizzo e' registrato, riceverai un messaggio», mai «ti abbiamo
      // mandato un'email».
      return ok(reply, {
        requested: result.requested,
        // Solo in sviluppo, e solo con la casella finta: l'indirizzo dove
        // leggere il messaggio senza un server di posta vero. In produzione e'
        // sempre `null`.
        ...(result.previewUrl ? { previewUrl: result.previewUrl } : {}),
      });
    },
  );

  app.post<{ Body: unknown }>(
    '/auth/password/reset/check',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      // ⚠️ POST e non GET, pur non cambiando niente: con un GET il token
      // finirebbe nella riga di richiesta e quindi nei log del server e in ogni
      // proxy di mezzo. Nel corpo no.
      const result = await dependencies.passwordResetServiceApi.checkToken({
        body: request.body,
      });

      return ok(reply, { valid: result.valid });
    },
  );

  app.post<{ Body: unknown }>(
    '/auth/password/reset/confirm',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      dependencies.enforceConfirmRateLimitFn({
        requestIp: dependencies.resolveClientIpFn(request),
      });

      const result = await dependencies.passwordResetServiceApi.confirmReset({
        request,
        body: request.body,
      });

      // Nessun token di sessione nella risposta: chi ha reimpostato la password
      // passa dalla schermata di accesso. E' la nota 4 del servizio.
      return ok(reply, { reset: result.reset });
    },
  );
};

const passwordResetRoute: FastifyPluginAsync = buildPasswordResetRoute();

export default passwordResetRoute;
