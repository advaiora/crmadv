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

const HTTP_SCHEME_REGEX = /^https?:\/\//i;
// Cosa segue i due punti quando NON sono uno schema ma una porta: solo cifre,
// e poi la fine o l'inizio del percorso ("advaiora.com:8080/contatti").
const PORT_AFTER_COLON_REGEX = /^\d+([/?#]|$)/;

/**
 * Il sito non ha vincoli di FORMA, e non e' una dimenticanza: il form a schermo
 * non ne ha nessuno e lo dichiara nel suo test («sito web e referente non hanno
 * vincoli di forma», `src/modules/clients/ui/clientFormValidation.test.js`).
 * Un server piu' severo del browser renderebbe non salvabile una scheda appena
 * dichiarata valida — e in un CRM d'agenzia «da definire» o «in costruzione»
 * sono contenuti legittimi di quel campo.
 *
 * L'unica cosa che resta fuori e' uno SCHEMA diverso da http/https
 * (`javascript:`, `data:`, `vbscript:`): non e' un indirizzo di sito, e il
 * giorno in cui quel valore diventera' un collegamento cliccabile sarebbe la
 * strada per farci passare del codice. Il "due punti" di una porta non e' uno
 * schema e resta ammesso.
 */
const hasForeignScheme = (value: string) => {
  if (HTTP_SCHEME_REGEX.test(value)) {
    return false;
  }

  const colonIndex = value.indexOf(':');
  if (colonIndex === -1) {
    return false;
  }

  return !PORT_AFTER_COLON_REGEX.test(value.slice(colonIndex + 1));
};

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

  if (hasForeignScheme(value)) {
    throw badRequest(`${fieldName} must be a valid web address`);
  }

  return value;
};
