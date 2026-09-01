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
  // 100.64.0.0/10, la fascia che gli operatori usano per il NAT di quartiere:
  // non e' instradabile su internet, quindi da qui dentro punta a una rete
  // altrui, non a un server pubblico.
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return false;
};

/**
 * Espande un IPv6 nei suoi otto gruppi da 16 bit, o `null` se non e' un IPv6.
 *
 * Serve perche' lo stesso indirizzo si scrive in molti modi — `::1`,
 * `0:0:0:0:0:0:0:1`, `::ffff:127.0.0.1`, `::ffff:7f00:1` — e giudicarlo dai
 * primi caratteri della stringa vuol dire riconoscerne uno e lasciar passare
 * gli altri quattro. E' esattamente cosi' che `::ffff:10.0.0.5` scavalcava il
 * guardiano della «Prova connessione» il 1/9/2026: bastava riscrivere
 * `10.0.0.5` in un'altra forma.
 */
const espandiIpv6 = (host: string): number[] | null => {
  // La zona (`fe80::1%eth0`) non cambia l'indirizzo: si toglie prima.
  const senzaZona = host.trim().toLowerCase().split('%')[0];
  if (isIP(senzaZona) !== 6) {
    return null;
  }

  // Coda in forma IPv4 (`::ffff:127.0.0.1`): diventa due gruppi esadecimali.
  let testo = senzaZona;
  const codaIpv4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(testo);
  if (codaIpv4) {
    const ottetti = codaIpv4[1].split('.').map((parte) => Number.parseInt(parte, 10));
    const alto = ((ottetti[0] << 8) | ottetti[1]).toString(16);
    const basso = ((ottetti[2] << 8) | ottetti[3]).toString(16);
    testo = `${testo.slice(0, codaIpv4.index)}${alto}:${basso}`;
  }

  const [sinistra, destra] = testo.split('::');
  const teste = sinistra ? sinistra.split(':') : [];
  const code = destra !== undefined && destra ? destra.split(':') : [];
  const riempimento = destra === undefined ? [] : new Array(8 - teste.length - code.length).fill('0');
  const gruppi = [...teste, ...riempimento, ...code];
  if (gruppi.length !== 8) {
    return null;
  }

  return gruppi.map((gruppo) => Number.parseInt(gruppo || '0', 16));
};

export const isPrivateIpv6Address = (host: string): boolean => {
  const gruppi = espandiIpv6(host);
  if (!gruppi) {
    return false;
  }

  const primiSeiVuoti = gruppi.slice(0, 6).every((gruppo) => gruppo === 0);

  // `::` (indirizzo non specificato) e `::1` (loopback), in qualunque forma
  // siano scritti. `::` non e' un indirizzo innocuo: connettercisi significa
  // connettersi a 127.0.0.1.
  if (primiSeiVuoti && gruppi[6] === 0 && gruppi[7] <= 1) {
    return true;
  }

  // `::ffff:a.b.c.d` (IPv4 mappato) e `::a.b.c.d` (IPv4 compatibile): dentro
  // c'e' un IPv4 vero, e va giudicato con le regole degli IPv4.
  const mappatoIpv4 = gruppi.slice(0, 5).every((gruppo) => gruppo === 0) && (gruppi[5] === 0xffff || primiSeiVuoti);
  if (mappatoIpv4) {
    const ipv4 = [gruppi[6] >> 8, gruppi[6] & 0xff, gruppi[7] >> 8, gruppi[7] & 0xff].join('.');
    return isPrivateIpv4Address(ipv4);
  }

  // fe80::/10 link-local.
  if (gruppi[0] >= 0xfe80 && gruppi[0] <= 0xfebf) {
    return true;
  }

  // fc00::/7, gli indirizzi che ognuno si assegna in casa propria.
  if ((gruppi[0] & 0xfe00) === 0xfc00) {
    return true;
  }

  return false;
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

/**
 * La risoluzione DNS, iniettabile. Il caso per cui questo secondo strato
 * esiste — «dominio pubblico che punta a 10.0.0.5» — non si puo' provare
 * altrimenti: servirebbe una zona DNS vera sotto controllo del test.
 */
export type RisolutoreDns = (
  hostname: string,
  options: { all: true },
) => Promise<Array<{ address: string }>>;

const classificaRisoluzione = async (
  hostname: string,
  risolvi: RisolutoreDns = lookup as RisolutoreDns,
): Promise<EsitoRisoluzione> => {
  // Un IP letterale non ha niente da risolvere: si giudica direttamente. NON si
  // da' per scontato che l'abbia gia' filtrato `isBlockedHostname` — quella era
  // una precondizione scritta qui e da rispettare altrove, cioe' una trappola
  // per il chiamante successivo.
  if (isIP(hostname) !== 0) {
    return isBlockedIpAddress(hostname) ? 'privato' : 'pubblico';
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await risolvi(hostname, { all: true });
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
// Toglie da un pezzo di testo tutto cio' che un IP non puo' contenere: virgolette,
// parentesi, virgole finali. Resta un candidato che `isIP` sa giudicare.
const ripulisciCandidato = (token: string): string =>
  token.replace(/^[^0-9a-f:.]+/i, '').replace(/[^0-9a-f:.]+$/i, '');

/**
 * Vero se dentro `testo` compare un indirizzo IP privato o di loopback.
 *
 * Serve a non ritrasmettere a chi ha premuto un pulsante il messaggio d'errore di
 * una libreria che ha appena parlato con la rete interna. Il caso concreto e' il
 * messaggio di nodemailer — `connect ECONNREFUSED 10.0.0.5:587` — quando l'host
 * passa il controllo ma la libreria risolve il DNS una seconda volta per conto
 * suo e ottiene una risposta diversa: senza questo, l'indirizzo interno tornava
 * indietro dalla porta accanto.
 *
 * Si lavora per parole invece che con una sola espressione regolare perche' un
 * IPv6 non ha confini di parola (`::1:587` non e' delimitato da niente) e
 * perche' la porta appiccicata in fondo va tolta prima di giudicare — due cose
 * che un'espressione sola sbaglia in silenzio. Ogni candidato passa comunque da
 * `isIP`: un falso candidato non costa niente, uno mancato costerebbe il
 * controllo.
 */
export const mentionsPrivateIpAddress = (testo: string): boolean => {
  for (const parola of testo.split(/\s+/)) {
    const token = ripulisciCandidato(parola);
    if (!token) {
      continue;
    }

    const candidati = [token, token.replace(/:\d+$/, ''), token.replace(/\.$/, '')];
    if (candidati.some((candidato) => isIP(candidato) !== 0 && isBlockedIpAddress(candidato))) {
      return true;
    }
  }

  return false;
};

export const isPrivateNetworkHost = async (
  hostname: string,
  risolvi?: RisolutoreDns,
): Promise<boolean> =>
  isBlockedHostname(hostname) || (await classificaRisoluzione(hostname, risolvi)) === 'privato';

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
