import { HttpError } from '../../core/errors.js';

// Il plugin @fastify/rate-limit e' registrato con `global: false` (server/app.ts),
// quindi una rotta senza limite proprio non ne ha nessuno.
//
// Qui il limite e' PER UTENTE, e solo per utente. Quello per indirizzo lo mette
// gia' la rotta col suo `config.rateLimit`, e i due misurano cose diverse:
// l'indirizzo ferma chi bussa da fuori, l'utente ferma chi tira a indovinare la
// password attuale da dentro una sessione rubata. Mettere l'indirizzo anche in
// questa chiave sarebbe un peggioramento silenzioso: chi cambia rete si
// ritroverebbe un contatore nuovo di zecca, cioe' altri dieci tentativi.
//
// ⚠️ Il conteggio sta in memoria di processo: si azzera a ogni riavvio dell'API e
// non e' condiviso fra piu' istanze. Va bene per una sola agenzia su un solo
// processo — che e' lo scenario di oggi — e va dichiarato invece che scoperto.
// Stesso compromesso gia' accettato da `server/modules/team/rate-limit.ts`.

export const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
export const CHANGE_PASSWORD_MAX_REQUESTS = 10;

type RateLimitWindow = {
  startedAtMs: number;
  count: number;
};

const inMemoryPasswordRateLimitStore = new Map<string, RateLimitWindow>();

const enforceWindow = (input: {
  key: string;
  nowMs: number;
  windowMs: number;
  maxRequests: number;
  message: string;
}) => {
  const activeWindow = inMemoryPasswordRateLimitStore.get(input.key);

  if (!activeWindow || input.nowMs - activeWindow.startedAtMs >= input.windowMs) {
    inMemoryPasswordRateLimitStore.set(input.key, {
      startedAtMs: input.nowMs,
      count: 1,
    });
    return;
  }

  if (activeWindow.count >= input.maxRequests) {
    throw new HttpError(429, 'RATE_LIMITED', input.message);
  }

  activeWindow.count += 1;
  inMemoryPasswordRateLimitStore.set(input.key, activeWindow);
};

export const enforcePasswordChangeRateLimit = (input: {
  userId: string;
  nowMs?: number;
}) => {
  enforceWindow({
    key: `password:change:${input.userId}`,
    nowMs: input.nowMs ?? Date.now(),
    windowMs: CHANGE_PASSWORD_WINDOW_MS,
    maxRequests: CHANGE_PASSWORD_MAX_REQUESTS,
    message: 'Troppi tentativi di cambio password. Riprova fra qualche minuto.',
  });
};

// --- Recupero password (rotte PUBBLICHE) ---------------------------------
//
// Qui il limite non e' un di piu': le rotte del recupero non chiedono nessuna
// sessione, quindi chi bussa e' anonimo per definizione e non c'e' nessun
// `userId` su cui contare. Restano due chiavi, e misurano cose diverse:
//
// - per INDIRIZZO, per fermare chi tempesta di richieste (ogni richiesta manda
//   un'email vera a qualcuno: senza limite sarebbe uno strumento per molestare
//   una casella altrui);
// - per EMAIL richiesta, perche' cambiare rete e' facile e la vittima da
//   proteggere e' quella casella li'.
//
// ⚠️ Nessuno dei due deve mai far trapelare SE l'indirizzo esista: si contano le
// richieste ricevute, non quelle andate a buon fine. Contare solo le email
// realmente spedite renderebbe il 429 un modo per sapere quali indirizzi sono
// registrati.

export const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000;
export const RESET_REQUEST_MAX_PER_IP = 5;
export const RESET_REQUEST_MAX_PER_EMAIL = 3;

export const RESET_CONFIRM_WINDOW_MS = 15 * 60 * 1000;
export const RESET_CONFIRM_MAX_PER_IP = 10;

export const enforcePasswordResetRequestRateLimit = (input: {
  requestIp: string;
  email: string;
  nowMs?: number;
}) => {
  const nowMs = input.nowMs ?? Date.now();

  enforceWindow({
    key: `password:reset:request:ip:${input.requestIp}`,
    nowMs,
    windowMs: RESET_REQUEST_WINDOW_MS,
    maxRequests: RESET_REQUEST_MAX_PER_IP,
    message: 'Troppe richieste di recupero password. Riprova fra qualche minuto.',
  });

  enforceWindow({
    key: `password:reset:request:email:${input.email.toLowerCase()}`,
    nowMs,
    windowMs: RESET_REQUEST_WINDOW_MS,
    maxRequests: RESET_REQUEST_MAX_PER_EMAIL,
    message: 'Troppe richieste di recupero password. Riprova fra qualche minuto.',
  });
};

export const enforcePasswordResetConfirmRateLimit = (input: {
  requestIp: string;
  nowMs?: number;
}) => {
  enforceWindow({
    key: `password:reset:confirm:ip:${input.requestIp}`,
    nowMs: input.nowMs ?? Date.now(),
    windowMs: RESET_CONFIRM_WINDOW_MS,
    maxRequests: RESET_CONFIRM_MAX_PER_IP,
    message: 'Troppi tentativi di reimpostazione. Riprova fra qualche minuto.',
  });
};

export const resetPasswordRateLimitStoreForTests = () => {
  inMemoryPasswordRateLimitStore.clear();
};
