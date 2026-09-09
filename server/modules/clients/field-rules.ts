import { badRequest } from '../../core/errors.js';

/**
 * Le regole di FORMA dei campi cliente: cosa e' un'email, cosa e' un codice
 * destinatario SDI, cosa e' un indirizzo di sito.
 *
 * Stanno qui e non in `service.ts` per due motivi. Il primo e' la soglia:
 * `service.ts` e' oltre la soglia-mostro (CLAUDE.md, «Dimensione dei file»), e
 * a un file sopra soglia non si aggiungono funzioni. Il secondo e' che queste
 * sono funzioni pure — nessun database, nessuna richiesta — e provate da sole
 * costano millisecondi (`field-rules.test.ts`).
 *
 * ⚠️ Le stesse regole vivono anche nel browser
 * (`src/modules/clients/ui/clientFormValidation.js`): quella e' comodita' per
 * chi compila, questa e' la garanzia. L'import massivo non passa dal form, e
 * chiama l'API direttamente: se una regola cambia, vanno cambiate tutte e due.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sette caratteri alfanumerici per le aziende, sei per la Pubblica
// Amministrazione. Senza questo controllo un codice TRONCATO (un incollaggio
// finito male) verrebbe salvato lo stesso, e il guasto si scoprirebbe solo
// quando l'Agenzia delle Entrate scarta la fattura.
export const SDI_CODE_REGEX = /^[A-Z0-9]{6,7}$/;

// Schema facoltativo (solo http/https), almeno un punto nel nome a dominio,
// niente spazi. Volutamente permissiva: "advaiora.com" e
// "https://www.advaiora.com/contatti" sono due modi legittimi di scrivere lo
// stesso sito, e il CRM non deve costringere a uno dei due.
export const WEBSITE_REGEX = /^(https?:\/\/)?[^\s./]+(\.[^\s./]+)+(\/\S*)?$/i;

const HTTP_SCHEME_REGEX = /^https?:\/\//i;
// Uno schema diverso da http/https non e' un indirizzo di sito, e un giorno
// finirebbe dentro un `href` (`javascript:`, `data:`, `mailto:`). Il "due punti"
// seguito da una CIFRA e' invece la porta di un indirizzo legittimo
// ("advaiora.com:8080"), e resta ammesso.
const FOREIGN_SCHEME_REGEX = /^[^\s/]*:(?!\d)/;

/**
 * Un'email gia' ripulita (trim e lunghezza li fa chi chiama): la abbassa e ne
 * controlla la forma. `fieldName` finisce nel messaggio perche' i campi email
 * sono due — `email` e `pecEmail` — e chi sbaglia deve capire quale dei due.
 */
export const normalizeEmailValue = (value: string | null, fieldName: string) => {
  if (!value) {
    return null;
  }

  const lowered = value.toLowerCase();
  if (!EMAIL_REGEX.test(lowered)) {
    throw badRequest(`${fieldName} must be a valid email`);
  }

  return lowered;
};

/** Codice destinatario SDI: si conserva in maiuscolo, come lo emette l'Agenzia. */
export const normalizeSdiCodeValue = (value: string | null, fieldName: string) => {
  if (!value) {
    return null;
  }

  const upper = value.toUpperCase();
  if (!SDI_CODE_REGEX.test(upper)) {
    throw badRequest(
      `${fieldName} must be 6 or 7 alphanumeric characters (6 for public administration)`,
    );
  }

  return upper;
};

/** Indirizzo del sito: si conserva com'e' stato scritto, non si riscrive. */
export const normalizeWebsiteValue = (value: string | null, fieldName: string) => {
  if (!value) {
    return null;
  }

  if (!HTTP_SCHEME_REGEX.test(value) && FOREIGN_SCHEME_REGEX.test(value)) {
    throw badRequest(`${fieldName} must be a valid web address`);
  }

  if (!WEBSITE_REGEX.test(value)) {
    throw badRequest(`${fieldName} must be a valid web address`);
  }

  return value;
};
