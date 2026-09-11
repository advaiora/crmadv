import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../../core/errors.js';
import {
  messagingRepository,
  type WorkspaceMember,
} from './repository.js';
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  validateAttachment,
} from './attachments.js';
import { broadcastToUser } from '../realtime/hub.js';

const DEFAULT_CONTACTS_LIMIT = 50;
const DEFAULT_MESSAGES_LIMIT = 100;
const MAX_CONTACTS_LIMIT = 100;
const MAX_MESSAGES_LIMIT = 200;
const MAX_SEARCH_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 4000;
const CONVERSATION_SNAPSHOT_LIMIT = 1500;

const contactsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(MAX_SEARCH_LENGTH)
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CONTACTS_LIMIT).optional(),
});

const conversationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_MESSAGES_LIMIT).optional(),
  before: z.string().datetime().optional(),
});

const sendMessagePayloadSchema = z.object({
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

const parseWithSchema = <T>(schema: z.ZodType<T>, input: unknown, errorMessage: string): T => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(errorMessage, {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

const toMessagePreview = (value: string) => {
  const normalized = value.trim();
  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
};

/**
 * Trova l'altro capo della conversazione.
 *
 * `allowTrashed` e' la regola di questo compito messa in una riga: **leggere**
 * una conversazione con un contatto cestinato si puo' (la cronologia non si
 * cancella), **scriverci** no. Chi chiama dichiara quale dei due sta facendo,
 * invece di lasciarlo decidere al filtro del repository.
 *
 * La riga si chiede sempre `includeTrashed: true` e si decide qui: cosi' un
 * contatto nel cestino risponde "non puoi scrivergli" invece di "non esiste",
 * che sarebbe una bugia e manderebbe chi legge a cercare un guasto altrove.
 */
const ensurePeer = async (
  workspaceId: string,
  userId: string,
  peerUserId: string,
  options: { allowTrashed: boolean },
) => {
  const normalizedPeerUserId = peerUserId.trim();
  if (!normalizedPeerUserId) {
    throw badRequest('userId is required');
  }

  if (normalizedPeerUserId === userId) {
    throw badRequest('Cannot open a conversation with yourself');
  }

  const peer = await messagingRepository.getWorkspaceMember(workspaceId, normalizedPeerUserId, {
    includeTrashed: true,
  });
  if (!peer) {
    throw notFound('Workspace member not found');
  }

  if (peer.isTrashed && !options.allowTrashed) {
    throw badRequest('Cannot send messages to a contact in the trash');
  }

  return peer;
};

type AttachmentRecord = {
  id: string;
  messageId: string;
  label: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  createdByUserId: string | null;
};

const mapAttachment = (item: AttachmentRecord) => ({
  id: item.id,
  messageId: item.messageId,
  label: item.label,
  mimeType: item.mimeType,
  fileSize: item.fileSize,
  createdAt: item.createdAt.toISOString(),
});

const mapMessage = (
  item: {
    id: string;
    senderUserId: string;
    recipientUserId: string;
    body: string;
    readAt: Date | null;
    createdAt: Date;
  },
  userId: string,
  attachments: AttachmentRecord[] = [],
) => ({
  id: item.id,
  senderUserId: item.senderUserId,
  recipientUserId: item.recipientUserId,
  body: item.body,
  readAt: toIso(item.readAt),
  createdAt: item.createdAt.toISOString(),
  isMine: item.senderUserId === userId,
  attachments: attachments.map(mapAttachment),
});

// Il messaggio dev'essere di QUESTO workspace e l'utente dev'esserne uno dei due capi.
// E' il controllo che regge tutto il resto: senza, un id indovinato basterebbe a
// leggere l'allegato di una conversazione altrui. Sta qui, sul server, e non dipende
// da quali bottoni l'interfaccia mostra o nasconde.
const ensureMessageParticipant = (
  message: { senderUserId: string; recipientUserId: string },
  userId: string,
) => {
  if (message.senderUserId !== userId && message.recipientUserId !== userId) {
    throw forbidden('Questo messaggio non fa parte delle tue conversazioni.');
  }
};

type ConversationStats = {
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

const buildConversationStatsByPeer = (
  items: {
    senderUserId: string;
    recipientUserId: string;
    body: string;
    readAt: Date | null;
    createdAt: Date;
  }[],
  userId: string,
) => {
  const statsByPeer = new Map<string, ConversationStats>();

  for (const item of items) {
    const peerUserId = item.senderUserId === userId ? item.recipientUserId : item.senderUserId;
    if (!statsByPeer.has(peerUserId)) {
      statsByPeer.set(peerUserId, {
        lastMessagePreview: toMessagePreview(item.body),
        lastMessageAt: item.createdAt.toISOString(),
        unreadCount: 0,
      });
    }

    if (item.senderUserId === peerUserId && item.recipientUserId === userId && item.readAt === null) {
      const stats = statsByPeer.get(peerUserId);
      if (stats) {
        stats.unreadCount += 1;
      }
    }
  }

  return statsByPeer;
};

const sortContacts = (
  contacts: (WorkspaceMember & ConversationStats)[],
) =>
  contacts.sort((left, right) => {
    const leftTime = left.lastMessageAt ? Date.parse(left.lastMessageAt) : 0;
    const rightTime = right.lastMessageAt ? Date.parse(right.lastMessageAt) : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    const leftLabel = (left.name || left.email).toLowerCase();
    const rightLabel = (right.name || right.email).toLowerCase();
    return leftLabel.localeCompare(rightLabel);
  });

export const messagingService = {
  parseContactsQuery(query: unknown) {
    return parseWithSchema(contactsQuerySchema, query ?? {}, 'Invalid messaging contacts query');
  },

  parseConversationQuery(query: unknown) {
    return parseWithSchema(conversationQuerySchema, query ?? {}, 'Invalid messaging conversation query');
  },

  parseSendMessagePayload(payload: unknown) {
    return parseWithSchema(sendMessagePayloadSchema, payload ?? {}, 'Invalid message payload');
  },

  async listContacts(input: {
    workspaceId: string;
    userId: string;
    query: unknown;
  }) {
    const parsedQuery = this.parseContactsQuery(input.query);
    const limit = parsedQuery.limit ?? DEFAULT_CONTACTS_LIMIT;
    const queryText = parsedQuery.q?.trim() || undefined;

    const contacts = await messagingRepository.listWorkspaceMembers({
      workspaceId: input.workspaceId,
      excludeUserId: input.userId,
      query: queryText,
      limit,
    });

    const peerUserIds = contacts.map((item) => item.userId);
    const snapshotItems = await messagingRepository.listConversationMessagesForUserAndPeers({
      workspaceId: input.workspaceId,
      userId: input.userId,
      peerUserIds,
      limit: CONVERSATION_SNAPSHOT_LIMIT,
    });
    const statsByPeer = buildConversationStatsByPeer(snapshotItems, input.userId);

    const items = sortContacts(
      contacts.map((item) => {
        const stats = statsByPeer.get(item.userId);
        return {
          ...item,
          lastMessagePreview: stats?.lastMessagePreview ?? null,
          lastMessageAt: stats?.lastMessageAt ?? null,
          unreadCount: stats?.unreadCount ?? 0,
        };
      }),
    );

    return {
      items,
    };
  },

  async listConversation(input: {
    workspaceId: string;
    userId: string;
    peerUserId: string;
    query: unknown;
  }) {
    // Lettura: un contatto cestinato si apre ancora, la cronologia resta.
    const peer = await ensurePeer(input.workspaceId, input.userId, input.peerUserId, {
      allowTrashed: true,
    });
    const parsedQuery = this.parseConversationQuery(input.query);
    const limit = parsedQuery.limit ?? DEFAULT_MESSAGES_LIMIT;
    const before = parsedQuery.before ? new Date(parsedQuery.before) : undefined;

    const messages = await messagingRepository.listConversationMessages({
      workspaceId: input.workspaceId,
      userId: input.userId,
      peerUserId: peer.userId,
      limit,
      before,
    });

    const orderedMessages = [...messages].reverse();
    const oldestMessage = orderedMessages[0] ?? null;

    // Gli allegati della pagina in una lettura sola (niente N+1), senza i byte.
    const attachments = await messagingRepository.listAttachmentsForMessages(
      orderedMessages.map((item) => item.id),
    );
    const attachmentsByMessage = new Map<string, AttachmentRecord[]>();
    for (const attachment of attachments) {
      const bucket = attachmentsByMessage.get(attachment.messageId);
      if (bucket) {
        bucket.push(attachment);
      } else {
        attachmentsByMessage.set(attachment.messageId, [attachment]);
      }
    }

    return {
      peer,
      items: orderedMessages.map((item) =>
        mapMessage(item, input.userId, attachmentsByMessage.get(item.id) ?? []),
      ),
      pageInfo: {
        limit,
        hasMore: messages.length === limit,
        nextBefore: oldestMessage ? oldestMessage.createdAt.toISOString() : null,
      },
    };
  },

  async sendMessage(input: {
    workspaceId: string;
    userId: string;
    peerUserId: string;
    payload: unknown;
  }) {
    // Scrittura: qui il cestino chiude. Il picker non lo propone piu', ma
    // l'indirizzo della conversazione resta raggiungibile a mano, ed e' da li'
    // che un messaggio nuovo arriverebbe a un contatto cestinato.
    const peer = await ensurePeer(input.workspaceId, input.userId, input.peerUserId, {
      allowTrashed: false,
    });
    const payload = this.parseSendMessagePayload(input.payload);

    const message = await messagingRepository.createMessage({
      workspaceId: input.workspaceId,
      senderUserId: input.userId,
      recipientUserId: peer.userId,
      body: payload.body,
    });

    // Tempo reale (Fase 4): segnale leggero "hai un nuovo messaggio", niente contenuto.
    // Chi lo riceve ricarica dal proprio endpoint autorizzato. `withUserId` e' l'altro
    // capo della conversazione toccata, dal punto di vista di chi riceve il segnale:
    // per il destinatario e' il mittente, per gli altri tab del mittente e' il peer.
    // Best-effort: se nessuno e' connesso non fa nulla, e non deve mai far fallire l'invio.
    broadcastToUser(peer.userId, { type: 'message.new', withUserId: input.userId });
    broadcastToUser(input.userId, { type: 'message.new', withUserId: peer.userId });

    return {
      peer,
      message: mapMessage(message, input.userId),
    };
  },

  async markConversationAsRead(input: {
    workspaceId: string;
    userId: string;
    peerUserId: string;
  }) {
    // Lettura: segnare come letta una conversazione che si puo' ancora aprire
    // deve restare possibile anche se il contatto e' finito nel cestino,
    // altrimenti i suoi non-letti resterebbero appesi per sempre.
    const peer = await ensurePeer(input.workspaceId, input.userId, input.peerUserId, {
      allowTrashed: true,
    });
    const result = await messagingRepository.markConversationAsRead({
      workspaceId: input.workspaceId,
      userId: input.userId,
      peerUserId: peer.userId,
    });

    return {
      peer,
      updatedCount: result.count,
    };
  },

  /**
   * Sposta un messaggio nel cestino (CRMA-165).
   *
   * E' l'unica delle quattro entita' del perimetro per cui il gesto non
   * esisteva affatto: fino a oggi un messaggio interno, una volta inviato, non
   * si poteva togliere in nessun modo.
   *
   * Il 404 quando il messaggio non e' tuo e' voluto e non e' un 403
   * mascherato: rispondere «esiste ma non e' tuo» direbbe a chiunque, provando
   * un id alla volta, quali conversazioni esistono in azienda. Chi cestina un
   * messaggio proprio vede la stessa risposta che vedrebbe se l'id fosse
   * inventato, ed e' quello che deve succedere.
   */
  async trashMessage(input: {
    workspaceId: string;
    userId: string;
    messageId: string;
  }) {
    const messageId = input.messageId.trim();
    if (!messageId) {
      throw badRequest('messageId is required');
    }

    const trashed = await messagingRepository.markMessageTrashed({
      workspaceId: input.workspaceId,
      messageId,
      actorUserId: input.userId,
    });

    if (!trashed) {
      throw notFound('Message not found');
    }

    return {
      messageId,
    };
  },

  // --- Allegati (A1 punto 8a) ---

  // Carica un allegato SU UN MESSAGGIO GIA' INVIATO. Niente bozze: vedi il commento
  // sul modello WorkspaceMessageAttachment in schema.prisma.
  //
  // Chi puo': solo il MITTENTE del messaggio. Ricevere un messaggio non da' il diritto
  // di attaccarci qualcosa - il messaggio resta di chi l'ha scritto.
  async addAttachment(input: {
    workspaceId: string;
    userId: string;
    messageId: string;
    file: { buffer: Buffer; fileName: string; mimeType: string };
  }) {
    const message = await messagingRepository.findMessageForAttachment(
      input.workspaceId,
      input.messageId,
    );
    if (!message) {
      throw notFound('Messaggio non trovato.');
    }

    if (message.senderUserId !== input.userId) {
      throw forbidden('Si possono allegare file solo ai messaggi che hai inviato tu.');
    }

    const alreadyAttached = await messagingRepository.countAttachmentsForMessage(message.id);
    if (alreadyAttached >= MAX_ATTACHMENTS_PER_MESSAGE) {
      throw badRequest(
        `Un messaggio puo' avere al massimo ${MAX_ATTACHMENTS_PER_MESSAGE} allegati.`,
      );
    }

    const validated = validateAttachment(input.file);

    const attachment = await messagingRepository.createAttachment({
      workspaceId: input.workspaceId,
      messageId: message.id,
      createdByUserId: input.userId,
      label: validated.label,
      mimeType: validated.mimeType,
      fileSize: validated.fileSize,
      data: validated.buffer,
    });

    // Stesso segnale leggero dell'invio: chi riceve ricarica dal proprio endpoint
    // autorizzato. Best-effort, non deve mai far fallire il caricamento.
    broadcastToUser(message.recipientUserId, {
      type: 'message.new',
      withUserId: message.senderUserId,
    });
    broadcastToUser(message.senderUserId, {
      type: 'message.new',
      withUserId: message.recipientUserId,
    });

    return { attachment: mapAttachment(attachment) };
  },

  // Byte veri di un allegato, per il download. Due filtri, ENTRAMBI necessari:
  // il workspace della riga e l'appartenenza alla conversazione.
  async getAttachmentFile(input: {
    workspaceId: string;
    userId: string;
    attachmentId: string;
  }) {
    const row = await messagingRepository.findAttachmentBinary(input.attachmentId);
    // Workspace diverso: "non trovato", non "vietato" - un 403 confermerebbe che quell'id
    // esiste da qualche altra parte.
    if (!row || row.binary === null || row.workspaceId !== input.workspaceId) {
      throw notFound('Allegato non trovato.');
    }

    ensureMessageParticipant(row.message, input.userId);

    return {
      data: Buffer.from(row.binary.data),
      mimeType: row.mimeType,
      label: row.label,
    };
  },

  // Cancella un allegato. Lo puo' fare chi l'ha caricato, che per costruzione e' il
  // mittente del messaggio.
  async removeAttachment(input: {
    workspaceId: string;
    userId: string;
    attachmentId: string;
  }) {
    const row = await messagingRepository.findAttachmentForDelete(input.attachmentId);
    if (!row || row.workspaceId !== input.workspaceId) {
      throw notFound('Allegato non trovato.');
    }

    if (row.message.senderUserId !== input.userId) {
      throw forbidden('Puoi togliere solo gli allegati dei messaggi che hai inviato tu.');
    }

    await messagingRepository.deleteAttachment(row.id);

    return { id: row.id, messageId: row.message.id };
  },
};
