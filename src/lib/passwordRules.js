// Le regole della password viste dal lato di chi le digita, in un punto solo.
//
// Le stesse tre maschere — cambio password in «Impostazioni Account», pagina
// `/reset-password`, richiesta del link dalla schermata di accesso — hanno
// bisogno delle stesse due cose: sapere quando una password nuova e' accettabile
// prima di mandarla al server, e tradurre in italiano i codici di errore che il
// server distingue apposta. Scritte tre volte, divergono in silenzio.
//
// ⚠️ MIN_PASSWORD_LENGTH e' una COPIA a mano di `MIN_PASSWORD_LENGTH` in
// `server/auth/password-policy.ts`: il frontend non importa dal backend. Serve
// solo ad anticipare a schermo un rifiuto che il server farebbe comunque — se le
// due divergono, comanda il server, e il sintomo e' un campo dichiarato valido
// che poi torna indietro con un errore generico.

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Il messaggio dopo una richiesta di recupero password.
 *
 * ⚠️ Non dice mai «ti abbiamo mandato un'email», e non e' una sfumatura: il
 * server risponde `requested: true` sia che l'indirizzo esista sia che non
 * esista, apposta, perche' il recupero password non diventi un modo per scoprire
 * chi ha un account nel CRM. Una maschera piu' precisa della risposta butterebbe
 * via quella protezione.
 */
export const NEUTRAL_RESET_REQUEST_MESSAGE =
  'Se l\'indirizzo è registrato, riceverai un messaggio con il link per reimpostare la password.';

/** Traduzioni dei codici di errore che il server distingue. La chiave e' `error.code`. */
export const PASSWORD_ERROR_MESSAGES = {
  INVALID_CURRENT_PASSWORD: 'La password attuale non è corretta.',
  PASSWORD_UNCHANGED: 'La password nuova deve essere diversa da quella attuale.',
  PASSWORD_NOT_SET:
    'Questo account entra con Google e non ha ancora una password del CRM: non c\'è una password attuale da confermare.',
  INVALID_RESET_TOKEN: 'Questo link non è più valido: potrebbe essere scaduto o già usato.',
};

/**
 * Controlla la password nuova e la sua ripetizione.
 *
 * Torna un oggetto di errori per campo, vuoto quando va tutto bene: e' la forma
 * che le maschere del progetto usano gia' (`fieldErrors` in `Login.jsx`).
 */
export const validateNewPassword = (newPassword, confirmPassword) => {
  const errors = {};

  if (!newPassword) {
    errors.newPassword = 'Scegli una password nuova';
  } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Ripeti la password nuova';
  } else if (newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = 'Le due password non coincidono';
  }

  return errors;
};

/** L'email, controllata quel tanto che basta per non mandare al server una richiesta vuota. */
export const validateResetEmail = (email) => {
  const normalized = typeof email === 'string' ? email.trim() : '';

  if (!normalized) {
    return 'Inserisci il tuo indirizzo email';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return 'Email non valida';
  }

  return '';
};

/**
 * Il messaggio da mostrare per un errore tornato dall'API.
 *
 * Si guarda prima il codice, perche' e' la sola cosa stabile: i messaggi del
 * server cambiano, i codici no.
 */
export const resolvePasswordErrorMessage = (error, fallbackMessage) => {
  const code = error?.code;
  if (code && PASSWORD_ERROR_MESSAGES[code]) {
    return PASSWORD_ERROR_MESSAGES[code];
  }

  const serverMessage = typeof error?.message === 'string' ? error.message.trim() : '';
  return serverMessage || fallbackMessage;
};
