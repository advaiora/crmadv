// Logica PURA di lettura di TRUST_PROXY. Estratta da app.ts per lo stesso motivo di
// cors-origins.ts: e' una regola di sicurezza, e va provata da sola invece che accendendo
// tutta l'applicazione.
//
// Il problema che risolve. Dietro un proxy inverso — in produzione Traefik sulla VPS — la
// connessione che Fastify vede arriva dal proxy, non dall'utente. Senza questa opzione
// `request.ip` vale sempre l'indirizzo del proxy, con due conseguenze concrete: il registro
// attivita' (server/audit/audit.ts) segna quell'indirizzo al posto di quello vero, e il
// limitatore di frequenza mette tutti gli utenti nello stesso secchiello, perche' per lui
// sono un solo chiamante.
//
// Perche' il valore predefinito e' `false`. Fidarsi dell'intestazione X-Forwarded-For senza
// un proxy davanti significa lasciare che chiunque si dichiari l'indirizzo che preferisce:
// il registro diventerebbe falsificabile e il limite di frequenza aggirabile cambiando una
// riga della richiesta. Si accende quindi solo dove il proxy c'e' davvero, dicendo quanti
// proxy attraversa la richiesta: con il solo Traefik davanti, `TRUST_PROXY=1`.

const TRUST_PROXY_ENV_KEY = 'TRUST_PROXY';
const HOP_COUNT_PATTERN = /^\d+$/u;

// I tre valori accettati da Fastify che ci interessano: acceso/spento, numero di proxy
// fidati, oppure elenco di indirizzi/sottoreti separati da virgola.
export type TrustProxySetting = boolean | number | string;

export const normalizeTrustProxy = (rawValue: string | undefined): TrustProxySetting => {
  const normalized = rawValue?.trim() ?? '';
  if (!normalized) {
    return false;
  }

  const lowercased = normalized.toLowerCase();
  if (lowercased === 'true') {
    return true;
  }

  if (lowercased === 'false') {
    return false;
  }

  // Un numero = quanti proxy fidati stanno davanti. E' la forma da preferire: dice
  // "fidati di un salto soltanto" invece di "fidati di chiunque".
  if (HOP_COUNT_PATTERN.test(normalized)) {
    return Number(normalized);
  }

  // Tutto il resto e' un elenco di indirizzi o sottoreti fidate, che Fastify gira a
  // proxy-addr cosi' com'e'.
  return normalized;
};

export const parseTrustProxy = (): TrustProxySetting => normalizeTrustProxy(process.env[TRUST_PROXY_ENV_KEY]);
