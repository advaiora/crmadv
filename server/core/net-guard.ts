// Protezioni anti-SSRF condivise.
//
// La classificazione di un host come "privato o locale" (e quindi da bloccare) e la
// validazione di un URL http(s) pubblico sono codice sensibile: devono stare in UN
// posto solo. Qui vivono i predicati puri (riusati dal logo dei PDF in server/core/pdf.ts)
// e un `safeFetch` piu' robusto — usato dove il server segue un URL scelto dall'utente
// (SEO scan e healthcheck dei web asset) — che oltre al controllo dell'hostname risolve
// il DNS e ri-valida ogni redirect, chiudendo il caso "dominio pubblico che punta a un IP
// interno".

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];

const DEFAULT_MAX_REDIRECTS = 3;

// Errore dedicato: permette al chiamante di distinguere un blocco anti-SSRF da un
// generico errore di rete (timeout, DNS assente, host irraggiungibile).
export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export const isPrivateIpv4Address = (host: string): boolean => {
  const parts = host.split('.').map((segment) => Number.parseInt(segment, 10));
  if (parts.length !== 4 || parts.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
    return false;
  }

  if (parts[0] === 0) {
    return true;
  }
  if (parts[0] === 10) {
    return true;
  }
  if (parts[0] === 127) {
    return true;
  }
  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return false;
};

export const isPrivateIpv6Address = (host: string): boolean => {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  );
};

// Vero se una stringa IP (v4 o v6) e' privata/loopback/link-local e quindi da bloccare.
export const isBlockedIpAddress = (ip: string): boolean => {
  const version = isIP(ip);
  if (version === 4) {
    return isPrivateIpv4Address(ip);
  }
  if (version === 6) {
    return isPrivateIpv6Address(ip);
  }
  return false;
};

// Vero se un hostname (nome o IP letterale) e' da bloccare: nomi locali noti, suffissi
// interni, o IP privati scritti direttamente nell'URL.
export const isBlockedHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (LOCAL_HOSTNAMES.has(normalized)) {
    return true;
  }

  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }

  if (isIP(normalized) !== 0 && isBlockedIpAddress(normalized)) {
    return true;
  }

  return false;
};

type AssertPublicHttpUrlOptions = {
  // In produzione si accetta solo https; in sviluppo anche http (come per il logo dei PDF).
  allowHttp?: boolean;
};

// Valida che `rawUrl` sia un URL http(s) verso un host pubblico. Lancia SsrfBlockedError
// altrimenti. Non risolve il DNS: e' il primo strato (schema + hostname letterale).
export const assertPublicHttpUrl = (
  rawUrl: string,
  options: AssertPublicHttpUrlOptions = {},
): URL => {
  const allowHttp = options.allowHttp ?? process.env.NODE_ENV !== 'production';

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('URL non valido.');
  }

  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw new SsrfBlockedError(`Protocollo non consentito: ${parsed.protocol}`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new SsrfBlockedError('Host privato o locale non consentito.');
  }

  return parsed;
};

// Secondo strato, in forma di classificazione. Tenuto separato dalle due porte
// d'ingresso qui sotto perche' i loro chiamanti hanno bisogni opposti: chi segue un URL
// deve INTERROMPERE (eccezione), chi collauda un server di posta deve DECIDERE (booleano)
// e rispondere lo stesso, con l'esito scritto dentro. Una sola risoluzione DNS, due letture.
type EsitoRisoluzione = 'pubblico' | 'privato' | 'non-risolvibile';

const classificaRisoluzione = async (hostname: string): Promise<EsitoRisoluzione> => {
  // Un IP letterale e' gia' stato validato da isBlockedHostname: niente DNS da fare.
  if (isIP(hostname) !== 0) {
    return 'pubblico';
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return 'non-risolvibile';
  }

  if (addresses.length === 0) {
    return 'non-risolvibile';
  }

  return addresses.some((entry) => isBlockedIpAddress(entry.address)) ? 'privato' : 'pubblico';
};

// Risolve il DNS dell'host e blocca se una qualsiasi risoluzione punta a un IP
// privato/loopback. Chiude il caso "dominio pubblico -> 127.0.0.1 / metadata cloud".
// Fail-closed: se il DNS non risolve, si blocca.
const assertHostResolvesToPublicIp = async (hostname: string): Promise<void> => {
  const esito = await classificaRisoluzione(hostname);

  if (esito === 'non-risolvibile') {
    throw new SsrfBlockedError('Host non risolvibile.');
  }

  if (esito === 'privato') {
    throw new SsrfBlockedError('Host che risolve a un indirizzo privato.');
  }
};

/**
 * Vero se `hostname` sta — o finisce — dentro una rete privata: nome locale noto,
 * suffisso interno, IP privato scritto in chiaro, oppure nome pubblico che risolve a un
 * indirizzo privato.
 *
 * Lo usa la «Prova connessione» del server di posta, che a differenza di `safeFetch`
 * deve rispondere `200` con l'esito negativo invece di interrompere: le serve un
 * booleano, non un'eccezione.
 *
 * ⚠️ Un host che non risolve affatto torna `false`, all'opposto del fail-closed di
 * `safeFetch`. La differenza e' voluta e sta nel danno che si previene: verso un nome che
 * non risolve non si apre nessuna connessione comunque, quindi non c'e' nessuna sonda da
 * chiudere — mentre rispondere "e' un indirizzo di rete privata" a chi ha solo sbagliato a
 * digitare lo manderebbe a cercare un guasto che non esiste. Chi invece deve NEGARE
 * l'accesso a una risorsa usi `safeFetch`/`assertPublicHttpUrl`, che si chiudono anche
 * sul dubbio.
 */
export const isPrivateNetworkHost = async (hostname: string): Promise<boolean> =>
  isBlockedHostname(hostname) || (await classificaRisoluzione(hostname)) === 'privato';

type SafeFetchOptions = {
  timeoutMs: number;
  allowHttp?: boolean;
  maxRedirects?: number;
  headers?: Record<string, string>;
};

// Fetch GET verso un URL scelto dall'utente, con protezione anti-SSRF completa:
// validazione schema+host, risoluzione DNS, e follow manuale dei redirect ri-validando
// ogni hop. Restituisce la Response finale (non lancia sui 4xx/5xx: il chiamante li legge).
// Lancia SsrfBlockedError sui blocchi e AbortError/errori di rete sul resto.
export const safeFetch = async (rawUrl: string, options: SafeFetchOptions): Promise<Response> => {
  const allowHttp = options.allowHttp ?? process.env.NODE_ENV !== 'production';
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let currentUrl = rawUrl;

    for (let redirectCount = 0; ; redirectCount += 1) {
      const parsed = assertPublicHttpUrl(currentUrl, { allowHttp });
      await assertHostResolvesToPublicIp(parsed.hostname);

      const response = await fetch(parsed, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: options.headers,
      });

      const isRedirect = response.status >= 300 && response.status < 400;
      const location = response.headers.get('location');
      if (!isRedirect || !location) {
        return response;
      }

      if (redirectCount >= maxRedirects) {
        throw new SsrfBlockedError('Troppi redirect.');
      }

      // Il Location puo' essere relativo: risolvilo rispetto all'URL corrente e ri-valida.
      currentUrl = new URL(location, parsed).toString();
    }
  } finally {
    clearTimeout(timeout);
  }
};
