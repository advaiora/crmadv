import { createHmac, randomBytes } from 'node:crypto';
import { internalServerError } from '../../core/errors.js';

// Stessa forma di `server/modules/team/team-invite.tokens.ts`, ed e' voluto: e'
// la sola forma di token al portatore gia' collaudata nel progetto.
//
// Perche' HMAC e non bcrypt: il token e' 32 byte casuali, non una password. Non
// c'e' niente da indovinare a forza bruta, quindi non serve un hash lento — e
// uno lento renderebbe impossibile la cosa importante, cioe' RITROVARE la riga
// partendo dal token (`findByTokenHash`), che con bcrypt costringerebbe a
// leggere tutte le righe e confrontarle una per una.
//
// Perche' con un segreto e non uno sha256 nudo: chi si portasse via il database
// avrebbe in mano solo impronte inutili, perche' senza il segreto non puo'
// calcolare l'impronta di un token che si e' inventato.

const TOKEN_BYTES = 32;

const resolveResetTokenSecret = () => {
  const explicitSecret = process.env.PASSWORD_RESET_TOKEN_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const fallbackSecret = process.env.AUTH_JWT_SECRET?.trim();
  if (fallbackSecret) {
    return fallbackSecret;
  }

  throw internalServerError('Password reset token secret is not configured');
};

/** Il valore che finisce nel link dell'email. A database non ci arriva mai. */
export const generateResetToken = () => randomBytes(TOKEN_BYTES).toString('hex');

/** L'impronta salvata in `PasswordResetToken.tokenHash` (64 caratteri, ci sta in VarChar(128)). */
export const hashResetToken = (token: string) =>
  createHmac('sha256', resolveResetTokenSecret()).update(token).digest('hex');
