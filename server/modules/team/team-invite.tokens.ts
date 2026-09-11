import { createHmac, randomBytes } from 'node:crypto';
import { internalServerError } from '../../core/errors.js';

const TOKEN_BYTES = 32;

// Niente ripiego su AUTH_JWT_SECRET, e non e' una dimenticanza: con il ripiego
// ruotare il segreto delle sessioni cambiava anche la chiave dell'HMAC, quindi
// ogni invito gia' spedito smetteva di essere ritrovabile in banca dati - in
// silenzio, e proprio nel momento in cui si ruota una chiave, cioe' dopo un
// sospetto trapelamento. In piu' un solo segreto per due scopi allarga il danno
// di chi lo ottiene. La variabile e' obbligatoria ed e' validata all'avvio
// (server/bootstrap/runtime-env.ts): qui resta il controllo di chiusura, perche'
// questo modulo legge process.env al momento della chiamata.
const resolveInviteTokenSecret = () => {
  const secret = process.env.TEAM_INVITE_TOKEN_SECRET?.trim();
  if (!secret) {
    throw internalServerError(
      'Missing TEAM_INVITE_TOKEN_SECRET. Define a dedicated invite token secret in .env.',
    );
  }

  return secret;
};

export const generateInviteToken = () => randomBytes(TOKEN_BYTES).toString('hex');

export const hashInviteToken = (token: string) =>
  createHmac('sha256', resolveInviteTokenSecret()).update(token).digest('hex');
