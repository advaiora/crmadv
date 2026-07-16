import type { FastifyPluginAsync } from 'fastify';
import fastifyWebsocket, { type WebSocket } from '@fastify/websocket';
import { nanoid } from 'nanoid';
import { ok } from '../../core/response.js';
import { isOriginAllowed } from '../../core/cors-origins.js';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';
import { aiConversationRepository } from '../../repositories/ai-conversation.repository.js';
import {
  issueRealtimeTicket,
  consumeRealtimeTicket,
  REALTIME_TICKET_TTL_MS,
} from './tickets.js';
import {
  type RealtimeConnection,
  subscribe,
  unsubscribe,
  removeConnection,
  userChannel,
} from './hub.js';

// Stato "aperto" di un socket ws (WebSocket.OPEN === 1). Confrontiamo il numero per
// non dipendere dalle costanti del pacchetto.
const WS_OPEN = 1;

const CONVERSATION_CHANNEL_PREFIX = 'conversation:';

type RealtimeQuery = { ticket?: string };

// Gestisce una richiesta di (dis)iscrizione a un canale conversazione arrivata dal
// client. I canali UTENTE non sono negoziabili: sono auto-iscritti al momento della
// connessione (ognuno riceve solo i propri). Per un canale conversazione si concede
// l'iscrizione solo se l'utente e' partecipante ATTIVO (non congelato) di quella
// sessione — cosi' non si puo' spiare il segnale di conversazioni altrui.
const handleSubscription = async (
  socket: WebSocket,
  connection: RealtimeConnection,
  action: 'subscribe' | 'unsubscribe',
  channel: string,
) => {
  if (!channel.startsWith(CONVERSATION_CHANNEL_PREFIX)) {
    return;
  }
  const conversationId = channel.slice(CONVERSATION_CHANNEL_PREFIX.length);
  if (!conversationId) {
    return;
  }

  if (action === 'unsubscribe') {
    unsubscribe(connection, channel);
    return;
  }

  const allowed = await aiConversationRepository.isParticipant(conversationId, connection.userId);
  if (connection.isOpen() !== true) {
    return;
  }
  if (!allowed) {
    socket.send(JSON.stringify({ type: 'subscribe.denied', channel }));
    return;
  }
  subscribe(connection, channel);
  socket.send(JSON.stringify({ type: 'subscribe.ok', channel }));
};

const realtimeRoute: FastifyPluginAsync = async (app) => {
  await app.register(fastifyWebsocket);

  // HTTP autenticato (Bearer normale) che emette il biglietto usa-e-getta. Il client
  // lo chiede subito prima di aprire il WebSocket.
  app.post('/realtime/ticket', async (request, reply) => {
    const user = await requireAuth(request);
    const workspace = await requireWorkspace(request, user.id);
    const ticket = issueRealtimeTicket({ userId: user.id, workspaceId: workspace.id });
    return ok(reply, { ticket, expiresInMs: REALTIME_TICKET_TTL_MS });
  });

  // WebSocket. L'autenticazione e' il biglietto (nell'URL, ma monouso e a scadenza
  // brevissima: non e' il JWT). In piu' si controlla l'Origin, come per le richieste
  // HTTP: un WebSocket da un'origine non ammessa viene chiuso.
  app.get<{ Querystring: RealtimeQuery }>('/realtime', { websocket: true }, (socket, request) => {
    if (!isOriginAllowed(request.headers.origin)) {
      socket.close(4003, 'origin not allowed');
      return;
    }

    const claims = typeof request.query.ticket === 'string'
      ? consumeRealtimeTicket(request.query.ticket)
      : null;
    if (!claims) {
      socket.close(4001, 'invalid ticket');
      return;
    }

    const connection: RealtimeConnection = {
      id: nanoid(12),
      userId: claims.userId,
      workspaceId: claims.workspaceId,
      channels: new Set<string>(),
      send: (data) => socket.send(data),
      isOpen: () => socket.readyState === WS_OPEN,
    };

    // Auto-iscrizione al proprio canale utente (messaggistica 1-a-1: il destinatario
    // e' identificato dal suo userId). Nessuna negoziazione: ognuno il suo.
    subscribe(connection, userChannel(connection.userId));
    socket.send(JSON.stringify({ type: 'ready' }));

    socket.on('message', (raw: Buffer) => {
      let frame: unknown;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (typeof frame !== 'object' || frame === null) {
        return;
      }
      const action = (frame as { action?: unknown }).action;

      if (action === 'ping') {
        if (connection.isOpen()) {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }

      if (action === 'subscribe' || action === 'unsubscribe') {
        const channel = (frame as { channel?: unknown }).channel;
        if (typeof channel === 'string' && channel.length > 0) {
          void handleSubscription(socket, connection, action, channel);
        }
      }
    });

    socket.on('close', () => removeConnection(connection));
    socket.on('error', () => removeConnection(connection));
  });
};

export default realtimeRoute;
