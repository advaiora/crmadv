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

export const enforcePasswordChangeRateLimit = (input: {
  userId: string;
  nowMs?: number;
}) => {
  const key = `password:change:${input.userId}`;
  const nowMs = input.nowMs ?? Date.now();
  const activeWindow = inMemoryPasswordRateLimitStore.get(key);

  if (!activeWindow || nowMs - activeWindow.startedAtMs >= CHANGE_PASSWORD_WINDOW_MS) {
    inMemoryPasswordRateLimitStore.set(key, {
      startedAtMs: nowMs,
      count: 1,
    });
    return;
  }

  if (activeWindow.count >= CHANGE_PASSWORD_MAX_REQUESTS) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      'Troppi tentativi di cambio password. Riprova fra qualche minuto.',
    );
  }

  activeWindow.count += 1;
  inMemoryPasswordRateLimitStore.set(key, activeWindow);
};

export const resetPasswordRateLimitStoreForTests = () => {
  inMemoryPasswordRateLimitStore.clear();
};
