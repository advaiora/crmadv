import { AsyncLocalStorage } from 'node:async_hooks';

// Contesto di richiesta basato su AsyncLocalStorage.
// Serve a portare informazioni "di chi sta agendo" (es. userId) fino ai livelli
// profondi (servizi/repository) senza doverle passare a mano attraverso decine
// di firme di funzione. Lo store viene inizializzato una volta per richiesta
// nell'hook onRequest e valorizzato dall'autenticazione (requireAuthIdentity).
// I job di sistema (senza richiesta HTTP) semplicemente non hanno store: userId
// resta null, che è il comportamento corretto (nessun utente umano coinvolto).

type RequestStore = {
  userId: string | null;
};

const storage = new AsyncLocalStorage<RequestStore>();

export const requestContext = {
  // Inizializza lo store per la richiesta corrente e tutte le sue continuazioni.
  start(): void {
    storage.enterWith({ userId: null });
  },

  setUserId(userId: string | null): void {
    const store = storage.getStore();
    if (store) {
      store.userId = userId;
    }
  },

  getUserId(): string | null {
    return storage.getStore()?.userId ?? null;
  },
};
