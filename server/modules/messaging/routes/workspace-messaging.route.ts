import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../../../audit/audit.js';
import { ok } from '../../../core/response.js';
import {
  ensureMessagingAccess,
  MESSAGING_PERMISSIONS,
} from '../policies.js';
import { messagingService } from '../service.js';

type ConversationParams = {
  userId: string;
};

const workspaceMessagingRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: unknown }>('/messages/users', async (request, reply) => {
    const { user, workspace } = await ensureMessagingAccess(request, MESSAGING_PERMISSIONS.view);

    const result = await messagingService.listContacts({
      workspaceId: workspace.id,
      userId: user.id,
      query: request.query,
    });

    return ok(reply, result);
  });

  app.get<{ Params: ConversationParams; Querystring: unknown }>(
    '/messages/conversations/:userId',
    async (request, reply) => {
      const { user, workspace } = await ensureMessagingAccess(request, MESSAGING_PERMISSIONS.view);

      const result = await messagingService.listConversation({
        workspaceId: workspace.id,
        userId: user.id,
        peerUserId: request.params.userId,
        query: request.query,
      });

      return ok(reply, result);
    },
  );

  app.post<{ Params: ConversationParams; Body: unknown }>(
    '/messages/conversations/:userId/messages',
    async (request, reply) => {
      const { user, workspace } = await ensureMessagingAccess(request, MESSAGING_PERMISSIONS.send);

      const result = await messagingService.sendMessage({
        workspaceId: workspace.id,
        userId: user.id,
        peerUserId: request.params.userId,
        payload: request.body,
      });

      await audit.log({
        event: 'messages.send',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'workspace_message',
        entityId: result.message.id,
        metadata: {
          recipientUserId: result.peer.userId,
          bodyLength: result.message.body.length,
        },
        request,
      });

      return ok(reply, result, 201);
    },
  );

  app.post<{ Params: ConversationParams }>(
    '/messages/conversations/:userId/read',
    async (request, reply) => {
      const { user, workspace } = await ensureMessagingAccess(request, MESSAGING_PERMISSIONS.view);

      const result = await messagingService.markConversationAsRead({
        workspaceId: workspace.id,
        userId: user.id,
        peerUserId: request.params.userId,
      });

      await audit.log({
        event: 'messages.read',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          peerUserId: result.peer.userId,
          updatedCount: result.updatedCount,
        },
        request,
      });

      return ok(reply, result);
    },
  );
};

export default workspaceMessagingRoute;
