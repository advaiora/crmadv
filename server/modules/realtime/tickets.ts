import { nanoid } from 'nanoid';

// Biglietto usa-e-getta per autenticare la connessione WebSocket senza mettere il
// JWT nell'URL (regola privacy del progetto: mai dati sensibili nei query string,
// finiscono nei log). Il browser, con la sua normale autenticazione Bearer, chiede
// via HTTP un biglietto; lo presenta all'apertura del WebSocket; il server lo
// verifica e lo BRUCIA subito. Anche finendo in un log e' inutile: monouso e a
// scadenza brevissima, e non e' il JWT.

export type RealtimeTicketClaims = {
  userId: string;
  workspaceId: string;
};

type StoredTicket = RealtimeTicketClaims & { expiresAt: number };

// Scadenza volutamente cortissima: il biglietto vive il tempo di aprire il socket.
const TICKET_TTL_MS = 30_000;
// Lunghezza del codice: opaco e non indovinabile (non e' un JWT, e' solo un id).
const TICKET_SIZE = 32;

const tickets = new Map<string, StoredTicket>();

// Pulizia pigra: al momento di emettere si eliminano i biglietti scaduti, cosi'
// non serve un timer globale (che lascerebbe handle aperti nei test).
const sweepExpired = (now: number) => {
  for (const [ticket, stored] of tickets) {
    if (stored.expiresAt <= now) {
      tickets.delete(ticket);
    }
  }
};

export const issueRealtimeTicket = (claims: RealtimeTicketClaims, now: number = Date.now()): string => {
  sweepExpired(now);
  const ticket = nanoid(TICKET_SIZE);
  tickets.set(ticket, { userId: claims.userId, workspaceId: claims.workspaceId, expiresAt: now + TICKET_TTL_MS });
  return ticket;
};

// Consuma il biglietto: lo rimuove SEMPRE (monouso), poi verifica la scadenza.
// Ritorna le claims solo se il biglietto era valido e non scaduto.
export const consumeRealtimeTicket = (ticket: string, now: number = Date.now()): RealtimeTicketClaims | null => {
  const stored = tickets.get(ticket);
  if (!stored) {
    return null;
  }
  tickets.delete(ticket);
  if (stored.expiresAt <= now) {
    return null;
  }
  return { userId: stored.userId, workspaceId: stored.workspaceId };
};

export const REALTIME_TICKET_TTL_MS = TICKET_TTL_MS;

// Solo per i test: azzera lo store tra un caso e l'altro.
export const __resetRealtimeTicketsForTest = () => {
  tickets.clear();
};
