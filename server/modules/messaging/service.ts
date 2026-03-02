import { z } from 'zod';
import { badRequest, notFound } from '../../core/errors.js';
import {
  messagingRepository,
  type WorkspaceMember,
} from './repository.js';

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

const ensurePeer = async (workspaceId: string, userId: string, peerUserId: string) => {
  const normalizedPeerUserId = peerUserId.trim();
  if (!normalizedPeerUserId) {
    throw badRequest('userId is required');
  }

  if (normalizedPeerUserId === userId) {
    throw badRequest('Cannot open a conversation with yourself');
  }

  const peer = await messagingRepository.getWorkspaceMember(workspaceId, normalizedPeerUserId);
  if (!peer) {
    throw notFound('Workspace member not found');
  }

  return peer;
};

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
) => ({
  id: item.id,
  senderUserId: item.senderUserId,
  recipientUserId: item.recipientUserId,
  body: item.body,
  readAt: toIso(item.readAt),
  createdAt: item.createdAt.toISOString(),
  isMine: item.senderUserId === userId,
});

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
    const peer = await ensurePeer(input.workspaceId, input.userId, input.peerUserId);
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

    return {
      peer,
      items: orderedMessages.map((item) => mapMessage(item, input.userId)),
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
    const peer = await ensurePeer(input.workspaceId, input.userId, input.peerUserId);
    const payload = this.parseSendMessagePayload(input.payload);

    const message = await messagingRepository.createMessage({
      workspaceId: input.workspaceId,
      senderUserId: input.userId,
      recipientUserId: peer.userId,
      body: payload.body,
    });

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
    const peer = await ensurePeer(input.workspaceId, input.userId, input.peerUserId);
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
};
