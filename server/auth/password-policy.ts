// Regole della password dell'account, in un punto solo.
//
// Prima esistevano soltanto dentro `server/routes/auth.route.ts`, dove le usava
// la sola registrazione. Da quando il cambio password vive in un modulo suo
// (`server/modules/password/`) i punti che le usano sono due, e due copie della
// stessa costante divergono in silenzio: si finirebbe con un CRM che pretende 8
// caratteri in registrazione e ne accetta 6 al cambio, oppure — peggio, perche'
// non si vede affatto — con hash bcrypt di costo diverso a seconda di quale
// funzione li ha scritti.

/** Costo bcrypt. Deve restare identico ovunque si scriva un `passwordHash`. */
export const PASSWORD_SALT_ROUNDS = 12;

/** Lunghezza minima richiesta quando si SCEGLIE una password (registrazione, cambio). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Lunghezza minima accettata quando si PRESENTA una password gia' esistente
 * (accesso, verifica di quella attuale). Volutamente 1: rifiutare qui per
 * lunghezza direbbe all'attaccante qualcosa sulla password vera, e taglierebbe
 * fuori gli account creati prima che il minimo salisse a 8.
 */
export const EXISTING_PASSWORD_MIN_LENGTH = 1;

/** Tetto di lunghezza: bcrypt tronca oltre i 72 byte, e un corpo enorme e' un modo per sprecare CPU. */
export const MAX_PASSWORD_LENGTH = 1024;
