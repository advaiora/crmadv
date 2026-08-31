import bcrypt from 'bcrypt';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../audit/audit.js';
import {
  EXISTING_PASSWORD_MIN_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_SALT_ROUNDS,
} from '../../auth/password-policy.js';
import { HttpError, badRequest, unauthorized } from '../../core/errors.js';
import { userRepository } from '../../repositories/user.repository.js';

// Cambio della PROPRIA password, avendo gia' fatto l'accesso e conoscendo quella
// vecchia. Forma copiata da `server/modules/security/stepup/service.ts`
// (`setVaultPassword`), che e' la stessa cosa sulla password della cassaforte:
// dipendenze iniettate, cosi' il test non ha bisogno ne' di database ne' di bcrypt vero.
//
// ⚠️ Tre scelte deliberate, scritte qui perche' non si riscoprano per tentativi:
//
// 1. NESSUN CODICE 401, MAI. `src/lib/apiFetch.ts` cancella la sessione e rimanda
//    al login su qualunque 401. Rispondere 401 sulla password attuale sbagliata —
//    la cosa naturale da scrivere, ed e' cio' che fa l'accesso — significherebbe
//    disconnettere dal CRM chi sbaglia semplicemente a digitare: non vedrebbe
//    l'errore, vedrebbe la schermata di accesso. Quindi 400.
// 2. LE SESSIONI GIA' APERTE RESTANO VALIDE. Il JWT e' senza stato e dura 7 giorni
//    (`server/auth/jwt.ts`); non c'e' tabella sessioni, ne' denylist, ne' `tokenVersion`.
//    Cambiare la password NON caccia fuori nessuno. E' una decisione presa, non una
//    dimenticanza: revocare richiede una colonna nuova su `User` (`passwordChangedAt`)
//    e quindi una migrazione, che questo lavoro non porta. Va detto a schermo, e il
//    seguito e' un compito a se'.
// 3. NON SI TOCCA `vaultPasswordHash`. E' un'altra password (le Credenziali).
//    Nota pero' la conseguenza, gia' vera oggi: chi non ha impostato una password
//    di cassaforte propria la sblocca con quella dell'account, quindi cambiare
//    questa cambia anche la chiave della cassaforte.

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(EXISTING_PASSWORD_MIN_LENGTH).max(MAX_PASSWORD_LENGTH),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
}).strict();

/** Esiti registrati nel registro attivita'. Il motivo del rifiuto sta qui, non nella risposta HTTP. */
export const PASSWORD_AUDIT_EVENTS = {
  changed: 'auth.password.changed',
  changeFailed: 'auth.password.change_failed',
} as const;

const parseChangeOwnPasswordBody = (body: unknown) => {
  const parsed = changeOwnPasswordSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('Payload di cambio password non valido', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

type PasswordServiceDependencies = {
  userRepositoryApi: typeof userRepository;
  comparePasswordFn: (password: string, hash: string) => Promise<boolean>;
  hashPasswordFn: (password: string, rounds: number) => Promise<string>;
  auditLogFn: typeof audit.log;
};

const defaultDependencies: PasswordServiceDependencies = {
  userRepositoryApi: userRepository,
  comparePasswordFn: bcrypt.compare,
  hashPasswordFn: bcrypt.hash,
  auditLogFn: (input) => audit.log(input),
};

export const buildPasswordService = (
  dependencies: PasswordServiceDependencies = defaultDependencies,
) => ({
  async changeOwnPassword(input: {
    request: FastifyRequest;
    userId: string;
    workspaceId: string;
    body: unknown;
  }) {
    const parsed = parseChangeOwnPasswordBody(input.body);

    const user = await dependencies.userRepositoryApi.findByIdForLogin(input.userId);
    if (!user) {
      // Non e' un rifiuto del cambio password: il portatore del token non esiste
      // piu'. Qui il 401 e' corretto — la sessione va davvero buttata.
      throw unauthorized('Utente autenticato non trovato');
    }

    const logOutcome = (outcome: 'success' | 'failed', reason?: string) =>
      dependencies.auditLogFn({
        event: outcome === 'success'
          ? PASSWORD_AUDIT_EVENTS.changed
          : PASSWORD_AUDIT_EVENTS.changeFailed,
        actorUserId: user.id,
        workspaceId: input.workspaceId,
        entityType: 'user',
        entityId: user.id,
        metadata: {
          route: '/auth/password/change',
          outcome,
          ...(reason ? { reason } : {}),
        },
        request: input.request,
      });

    const refuse = async (reason: string, error: HttpError): Promise<never> => {
      await logOutcome('failed', reason);
      throw error;
    };

    // Chi e' entrato con Google puo' non avere nessuna password locale
    // (`passwordHash` e' opzionale su `User`). Non e' un errore interno ed e'
    // previsto: glielo si dice, con un codice che la maschera puo' riconoscere
    // per proporre l'unica cosa sensata, cioe' impostarne una.
    if (!user.passwordHash) {
      return refuse(
        'password_not_set',
        new HttpError(
          409,
          'PASSWORD_NOT_SET',
          "Questo account accede con Google e non ha una password del CRM: non c'e' niente da cambiare.",
        ),
      );
    }

    const isCurrentPasswordValid = await dependencies.comparePasswordFn(
      parsed.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      // Il messaggio dice che la password attuale non torna e basta: chi prova a
      // indovinare non deve ricavare altro, e chi ha davvero sbagliato a digitare
      // non ha bisogno di altro.
      return refuse(
        'invalid_current_password',
        new HttpError(400, 'INVALID_CURRENT_PASSWORD', 'La password attuale non è corretta.'),
      );
    }

    const isSamePassword = await dependencies.comparePasswordFn(
      parsed.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      return refuse(
        'password_unchanged',
        new HttpError(
          400,
          'PASSWORD_UNCHANGED',
          'La nuova password deve essere diversa da quella attuale.',
        ),
      );
    }

    const passwordHash = await dependencies.hashPasswordFn(parsed.newPassword, PASSWORD_SALT_ROUNDS);
    await dependencies.userRepositoryApi.updatePasswordHash(user.id, passwordHash);
    await logOutcome('success');
  },
});

export const passwordService = buildPasswordService();
