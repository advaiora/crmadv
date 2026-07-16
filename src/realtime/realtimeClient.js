import { apiPost } from '../utils/apiClient';
import { buildApiUrl } from '../lib/apiFetch';

// Client WebSocket in tempo reale (Fase 4). Singleton di modulo: una sola connessione
// per l'intera app, condivisa da chat AI e messaggistica.
//
// Autenticazione col BIGLIETTO usa-e-getta: prima si chiede via HTTP (Bearer normale)
// un biglietto monouso, poi si apre il WebSocket presentandolo. Il biglietto vive
// pochi secondi e non e' il JWT: metterlo nell'URL non viola la regola privacy.
//
// Modello degli eventi: "segnale + refetch". Dal server arrivano segnali leggeri
// ("la conversazione X e' cambiata" / "hai un nuovo messaggio"), MAI il contenuto.
// Chi ascolta ricarica dal proprio endpoint autorizzato. Qui si fa solo il trasporto.

const WS_OPEN = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

let socket = null;
let connecting = false;
let shouldRun = false; // vero finche' c'e' almeno un ascoltatore
let reconnectAttempts = 0;
let reconnectTimer = null;
let heartbeatTimer = null;

// conversationId -> Set(handler). Gli ascoltatori della chat AI, per conversazione.
const conversationHandlers = new Map();
// Ascoltatori della messaggistica (il canale utente e' auto-iscritto lato server).
const messagingHandlers = new Set();
// Ascoltatori dello STATO di connessione: servono ai componenti per rallentare il
// polling di sicurezza quando il tempo reale e' attivo, e riaccelerarlo se cade.
const statusHandlers = new Set();
let connected = false;

const setConnected = (value) => {
  if (connected === value) {
    return;
  }
  connected = value;
  for (const handler of statusHandlers) {
    try {
      handler(connected);
    } catch {
      // un ascoltatore che scoppia non ferma gli altri
    }
  }
};

export const isRealtimeConnected = () => connected;

// Iscrive un ascoltatore allo stato di connessione. Chiama subito con lo stato
// corrente, poi a ogni cambiamento. Ritorna la funzione per disiscriversi.
export const subscribeStatus = (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  statusHandlers.add(handler);
  try {
    handler(connected);
  } catch {
    // ignora
  }
  return () => {
    statusHandlers.delete(handler);
  };
};

const buildWebSocketUrl = (ticket) => {
  const url = new URL(buildApiUrl('/realtime'), window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('ticket', ticket);
  return url.toString();
};

const conversationChannel = (conversationId) => `conversation:${conversationId}`;

const sendFrame = (payload) => {
  if (socket && socket.readyState === WS_OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => sendFrame({ action: 'ping' }), HEARTBEAT_INTERVAL_MS);
};

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const resubscribeAll = () => {
  for (const conversationId of conversationHandlers.keys()) {
    sendFrame({ action: 'subscribe', channel: conversationChannel(conversationId) });
  }
};

const handleMessage = (raw) => {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return;
  }
  if (!event || typeof event !== 'object') {
    return;
  }

  if (event.type === 'chat.changed' && typeof event.conversationId === 'string') {
    const handlers = conversationHandlers.get(event.conversationId);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // Un ascoltatore che scoppia non deve fermare gli altri.
        }
      }
    }
    return;
  }

  if (event.type === 'message.new') {
    for (const handler of messagingHandlers) {
      try {
        handler(event);
      } catch {
        // idem
      }
    }
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer || !shouldRun) {
    return;
  }
  const delay = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void openSocket();
  }, delay);
};

const openSocket = async () => {
  if (connecting || (socket && socket.readyState <= WS_OPEN)) {
    return;
  }
  connecting = true;
  try {
    const data = await apiPost('/realtime/ticket', {});
    const ticket = data?.ticket;
    if (!ticket || !shouldRun) {
      return; // gli ascoltatori se ne sono andati mentre chiedevamo il biglietto
    }
    const ws = new WebSocket(buildWebSocketUrl(ticket));
    socket = ws;
    ws.onopen = () => {
      reconnectAttempts = 0;
      setConnected(true);
      resubscribeAll();
      startHeartbeat();
    };
    ws.onmessage = (messageEvent) => handleMessage(messageEvent.data);
    ws.onclose = () => {
      stopHeartbeat();
      socket = null;
      setConnected(false);
      if (shouldRun) {
        scheduleReconnect();
      }
    };
    ws.onerror = () => {
      // La chiusura seguira' e gestira' la riconnessione: qui non facciamo nulla.
    };
  } catch {
    socket = null;
    setConnected(false);
    if (shouldRun) {
      scheduleReconnect();
    }
  } finally {
    connecting = false;
  }
};

const ensureConnection = () => {
  if (!socket && !connecting && shouldRun) {
    void openSocket();
  }
};

const teardownIfIdle = () => {
  if (conversationHandlers.size > 0 || messagingHandlers.size > 0) {
    return;
  }
  shouldRun = false;
  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopHeartbeat();
  setConnected(false);
  if (socket) {
    const closing = socket;
    socket = null;
    try {
      closing.close();
    } catch {
      // ignora: stavamo comunque chiudendo
    }
  }
};

// Iscrive un ascoltatore ai cambiamenti di UNA conversazione della chat AI.
// Ritorna la funzione per disiscriversi.
export const subscribeConversation = (conversationId, handler) => {
  if (!conversationId || typeof handler !== 'function') {
    return () => {};
  }
  let handlers = conversationHandlers.get(conversationId);
  if (!handlers) {
    handlers = new Set();
    conversationHandlers.set(conversationId, handlers);
  }
  handlers.add(handler);
  shouldRun = true;
  ensureConnection();
  sendFrame({ action: 'subscribe', channel: conversationChannel(conversationId) });

  return () => {
    const set = conversationHandlers.get(conversationId);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        conversationHandlers.delete(conversationId);
        sendFrame({ action: 'unsubscribe', channel: conversationChannel(conversationId) });
      }
    }
    teardownIfIdle();
  };
};

// Iscrive un ascoltatore agli eventi di nuova messaggistica (canale utente, gia'
// auto-iscritto lato server). Ritorna la funzione per disiscriversi.
export const subscribeMessaging = (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  messagingHandlers.add(handler);
  shouldRun = true;
  ensureConnection();

  return () => {
    messagingHandlers.delete(handler);
    teardownIfIdle();
  };
};
