import type { FastifyPluginAsync } from 'fastify';
import { signAccessToken } from '../../../auth/jwt.js';
import { ok } from '../../../core/response.js';
import { requireAuth } from '../../../guards/requireAuth.js';
import { requireWorkspace } from '../../../guards/requireWorkspace.js';
import { passwordService } from '../password.service.js';
import { enforcePasswordChangeRateLimit } from '../rate-limit.js';

// Le rotte della password stanno in un modulo proprio e NON in
// `server/routes/auth.route.ts`: quel file e' a 1.396 righe, cioe' oltre la
// soglia-mostro di 800, ed e' regola del progetto non aggiungere funzioni a un
// file gia' sopra soglia.
//
// Percorso e chiave in inglese, e senza prefisso `/api`: e' la convenzione
// dell'elenco in cui entra — `auth.route.ts` e' registrato alla radice, quindi
// le rotte di autenticazione vivono sotto `/auth/...`. L'etichetta italiana
// («Cambia password») sta a schermo, non qui.
//
// ⚠️ Il permesso: NON ne nasce nessuno, e la scelta e' argomentata. La regola ①
// di CLAUDE.md chiede una voce di catalogo per «un'azione che non tutti devono
// poter fare» — ma questa e' un'azione su se stessi, e non esiste ruolo a cui
// abbia senso negare di mettere in sicurezza il proprio account. Il precedente
// che chiude la questione e' `PATCH /auth/me` (nome, email, tema, foto), che non
// chiede nessun permesso. Non e' il ripiego contro cui la regola mette in
// guardia: li' ci si appoggia al permesso di un ALTRO modulo per pigrizia, qui
// non ci si appoggia a niente.

type PasswordRouteDependencies = {
  requireAuthFn: typeof requireAuth;
  requireWorkspaceFn: typeof requireWorkspace;
  passwordServiceApi: typeof passwordService;
  enforceRateLimitFn: typeof enforcePasswordChangeRateLimit;
  signAccessTokenFn: typeof signAccessToken;
};

const defaultDependencies: PasswordRouteDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  passwordServiceApi: passwordService,
  enforceRateLimitFn: enforcePasswordChangeRateLimit,
  signAccessTokenFn: signAccessToken,
};

export const buildPasswordRoute = (
  dependencies: PasswordRouteDependencies = defaultDependencies,
): FastifyPluginAsync => async (app) => {
  app.post<{ Body: unknown }>(
    '/auth/password/change',
    {
      config: {
        // Limite per indirizzo, oltre a quello per utente applicato piu' sotto.
        // Serve entrambi: il plugin ha `global: false`, quindi senza questo
        // blocco la rotta non ha nessun limite di IP.
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const user = await dependencies.requireAuthFn(request);
      const workspace = await dependencies.requireWorkspaceFn(request, user.id);

      dependencies.enforceRateLimitFn({ userId: user.id });

      await dependencies.passwordServiceApi.changeOwnPassword({
        request,
        userId: user.id,
        workspaceId: workspace.id,
        body: request.body,
      });

      // Le altre sessioni sono cadute davvero (nota 2 in `password.service.ts`):
      // ogni token emesso prima di `passwordChangedAt` viene rifiutato dalla
      // guardia. Ma questa richiesta arriva DA una di quelle sessioni, e il suo
      // token e' vecchio quanto le altre: senza un token nuovo, chi cambia la
      // propria password si troverebbe buttato fuori dalla richiesta successiva.
      //
      // ⚠️ Il campo si chiama `token` come nella risposta dell'accesso
      // (`server/routes/auth.route.ts`): la maschera deve sostituire quello che
      // ha in memoria, esattamente come fa dopo il login. Se non lo fa, il CRM
      // non si rompe — riporta al login, e la password nuova funziona.
      const token = await dependencies.signAccessTokenFn({
        sub: user.id,
        email: user.email,
        role: user.role,
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
      });

      return ok(reply, {
        changed: true,
        otherSessionsRevoked: true,
        token,
      });
    },
  );
};

const passwordRoute: FastifyPluginAsync = buildPasswordRoute();

export default passwordRoute;
