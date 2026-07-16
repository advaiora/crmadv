// Hub delle connessioni WebSocket in tempo reale. Tiene, per ogni "canale", i socket
// iscritti, e sa trasmettere un evento a tutti gli iscritti di un canale.
//
// Strategia: "segnale + refetch". Nel canale NON viaggiano i contenuti dei messaggi,
// ma solo un segnale leggero ("qualcosa e' cambiato nella conversazione X" / "hai un
// nuovo messaggio da Y"). Ogni client, ricevuto il segnale, RICARICA dal suo endpoint
// gia' autorizzato. Cosi' la sicurezza resta quella delle rotte HTTP esistenti e qui
// non si serializza nulla di sensibile.
//
// L'hub non dipende dal tipo WebSocket concreto: ogni connessione espone solo `send`
// e `isOpen`, cosi' e' testabile senza aprire socket veri.

export type RealtimeConnection = {
  id: string;
  userId: string;
  workspaceId: string;
  channels: Set<string>;
  send: (data: string) => void;
  isOpen: () => boolean;
};

// Nomi dei canali. Un canale per conversazione (chat AI) e uno per utente
// (messaggistica 1-a-1: il destinatario e' identificato dal suo userId).
export const userChannel = (userId: string) => `user:${userId}`;
export const conversationChannel = (conversationId: string) => `conversation:${conversationId}`;

const channelSubscribers = new Map<string, Set<RealtimeConnection>>();

export const subscribe = (connection: RealtimeConnection, channel: string) => {
  connection.channels.add(channel);
  let subscribers = channelSubscribers.get(channel);
  if (!subscribers) {
    subscribers = new Set();
    channelSubscribers.set(channel, subscribers);
  }
  subscribers.add(connection);
};

export const unsubscribe = (connection: RealtimeConnection, channel: string) => {
  connection.channels.delete(channel);
  const subscribers = channelSubscribers.get(channel);
  if (!subscribers) {
    return;
  }
  subscribers.delete(connection);
  if (subscribers.size === 0) {
    channelSubscribers.delete(channel);
  }
};

// Rimuove del tutto una connessione (alla chiusura del socket): la toglie da ogni
// canale a cui era iscritta, senza lasciare Set vuoti in giro.
export const removeConnection = (connection: RealtimeConnection) => {
  for (const channel of connection.channels) {
    const subscribers = channelSubscribers.get(channel);
    if (subscribers) {
      subscribers.delete(connection);
      if (subscribers.size === 0) {
        channelSubscribers.delete(channel);
      }
    }
  }
  connection.channels.clear();
};

// Trasmette un evento a tutti i socket aperti iscritti al canale. `exclude` serve a
// non rimandare l'evento al mittente stesso (che ha gia' la risposta HTTP in mano).
export const broadcast = (
  channel: string,
  payload: Record<string, unknown>,
  options: { excludeConnectionId?: string } = {},
): number => {
  const subscribers = channelSubscribers.get(channel);
  if (!subscribers || subscribers.size === 0) {
    return 0;
  }
  const data = JSON.stringify(payload);
  let delivered = 0;
  for (const connection of subscribers) {
    if (options.excludeConnectionId && connection.id === options.excludeConnectionId) {
      continue;
    }
    if (!connection.isOpen()) {
      continue;
    }
    try {
      connection.send(data);
      delivered += 1;
    } catch {
      // Un socket morente non deve impedire la consegna agli altri: si ignora e si
      // prosegue; la sua rimozione avverra' comunque alla chiusura.
    }
  }
  return delivered;
};

export const broadcastToConversation = (
  conversationId: string,
  payload: Record<string, unknown>,
  options: { excludeConnectionId?: string } = {},
) => broadcast(conversationChannel(conversationId), payload, options);

export const broadcastToUser = (
  userId: string,
  payload: Record<string, unknown>,
  options: { excludeConnectionId?: string } = {},
) => broadcast(userChannel(userId), payload, options);

// Solo per i test: stato pulito tra un caso e l'altro.
export const __resetHubForTest = () => {
  channelSubscribers.clear();
};

export const __hubChannelCountForTest = () => channelSubscribers.size;
