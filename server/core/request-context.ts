import { AsyncLocalStorage } from 'node:async_hooks';

// Contesto di richiesta basato su AsyncLocalStorage.
// Serve a portare informazioni "di chi sta agendo" (es. userId) fino ai livelli
// profondi (servizi/repository) senza doverle passare a mano attraverso decine
// di firme di funzione. Lo store viene inizializzato una volta per richiesta
// nell'hook onRequest e valorizzato dall'autenticazione (requireAuthIdentity).
// I job di sistema (senza richiesta HTTP) semplicemente non hanno store: userId
// resta null, che è il comportamento corretto (nessun utente umano coinvolto).
//
// Dal Registro attività (CRMA-28) lo store porta anche il workspace corrente e
// due strutture usate dall'intercettore automatico delle scritture:
//
// - `pendingEntries`  le registrazioni raccolte dall'intercettore durante la
//                     richiesta, scritte tutte insieme alla fine (vedi
//                     server/audit/audit-interceptor.ts). Rinviare la scrittura
//                     serve a due cose: non scrivere dentro una transazione che
//                     potrebbe ancora annullarsi, e poter scartare le automatiche
//                     là dove c'è già un'annotazione scritta a mano.
// - `manualTargets`   le coppie tipo:id già annotate a mano nella stessa
//                     richiesta. L'annotazione a mano vince sempre: dice
//                     «ha inviato il preventivo al cliente», l'automatica direbbe
//                     solo «una riga di preventivo è cambiata».

export type PendingAuditEntry = {
  action: string;
  entityType: string;
  entityId: string | null;
  workspaceId: string;
  actorUserId: string | null;
  operation: string;
  affectedCount: number;
};

export type RequestStore = {
  userId: string | null;
  workspaceId: string | null;
  pendingEntries: Map<string, PendingAuditEntry>;
  manualTargets: Set<string>;
  // Quante registrazioni automatiche sono state scartate perché la richiesta ha
  // superato il tetto: si perde il dettaglio, non il fatto che sia successo.
  droppedEntries: number;
};

// Tetto al numero di registrazioni automatiche distinte per richiesta. Un import
// che crea diecimila clienti non deve produrre diecimila righe di registro: oltre
// il tetto si conta e basta, e il conteggio finisce in una riga di riepilogo.
export const MAX_PENDING_AUDIT_ENTRIES = 200;

const storage = new AsyncLocalStorage<RequestStore>();

const createStore = (): RequestStore => ({
  userId: null,
  workspaceId: null,
  pendingEntries: new Map(),
  manualTargets: new Set(),
  droppedEntries: 0,
});

export const requestContext = {
  // Inizializza lo store per la richiesta corrente e tutte le sue continuazioni,
  // e lo restituisce. Chi svuota le registrazioni a fine richiesta deve tenersi
  // questo riferimento: l'hook onResponse gira dopo che la risposta è partita e
  // non è garantito che si trovi ancora nella stessa catena asincrona, quindi
  // cercare lo store con AsyncLocalStorage a quel punto può tornare vuoto.
  start(): RequestStore {
    const store = createStore();
    storage.enterWith(store);
    return store;
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

  setWorkspaceId(workspaceId: string | null): void {
    const store = storage.getStore();
    if (store) {
      store.workspaceId = workspaceId;
    }
  },

  getWorkspaceId(): string | null {
    return storage.getStore()?.workspaceId ?? null;
  },

  // Segna che per questo bersaglio esiste già un'annotazione scritta a mano:
  // l'intercettore non ne aggiungerà una automatica.
  markManualAudit(entityType: string, entityId: string | null | undefined): void {
    const store = storage.getStore();
    if (store && entityType) {
      store.manualTargets.add(`${entityType}:${entityId ?? ''}`);
    }
  },

  addPendingAuditEntry(key: string, entry: PendingAuditEntry): void {
    const store = storage.getStore();
    if (!store) {
      return;
    }

    const existing = store.pendingEntries.get(key);
    if (existing) {
      existing.affectedCount += entry.affectedCount;
      return;
    }

    if (store.pendingEntries.size >= MAX_PENDING_AUDIT_ENTRIES) {
      store.droppedEntries += 1;
      return;
    }

    store.pendingEntries.set(key, entry);
  },

  // Restituisce le registrazioni automatiche da scrivere, già ripulite da quelle
  // che duplicherebbero un'annotazione a mano, e svuota lo store: chiamarla due
  // volte non riscrive niente.
  drainPendingAuditEntries(
    explicitStore?: RequestStore,
  ): { entries: PendingAuditEntry[]; dropped: number } {
    const store = explicitStore ?? storage.getStore();
    if (!store) {
      return { entries: [], dropped: 0 };
    }

    const entries = [...store.pendingEntries.values()].filter(
      (entry) => !store.manualTargets.has(`${entry.entityType}:${entry.entityId ?? ''}`),
    );
    const dropped = store.droppedEntries;

    store.pendingEntries.clear();
    store.manualTargets.clear();
    store.droppedEntries = 0;

    return { entries, dropped };
  },
};
