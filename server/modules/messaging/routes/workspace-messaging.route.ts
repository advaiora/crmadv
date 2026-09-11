import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../../../audit/audit.js';
import { badRequest } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import {
  ensureMessagingAccess,
  MESSAGING_PERMISSIONS,
} from '../policies.js';
import { messagingService } from '../service.js';

type ConversationParams = {
  userId: string;
};

type MessageParams = {
  messageId: string;
};

type AttachmentParams = {
  attachmentId: string;
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
        entityType: 'workspace_message',
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

  // --- Allegati (A1 punto 8a) ---

  // Multipart: il file viaggia come allegato VERO, non dentro il corpo JSON. E' l'errore
  // gia' corretto sull'import clienti, dove il tetto di ~1 MiB del body Fastify faceva
  // fallire i file grossi.
  app.post<{ Params: MessageParams }>(
    '/messages/:messageId/attachments',
    async (request, reply) => {
      const { user, workspace } = await ensureMessagingAccess(
        request,
        MESSAGING_PERMISSIONS.attach,
      );

      const file = await request.file();
      if (!file) {
        throw badRequest('Nessun file caricato.');
      }

      const buffer = await file.toBuffer();
      // @fastify/multipart tronca in silenzio al tetto globale e alza questa bandiera:
      // senza il controllo, un file troppo grosso finirebbe salvato a meta'.
      if (file.file.truncated) {
        throw badRequest(
          'Il file supera il limite consentito per gli allegati ai messaggi.',
        );
      }

      const result = await messagingService.addAttachment({
        workspaceId: workspace.id,
        userId: user.id,
        messageId: request.params.messageId,
        file: {
          buffer,
          fileName: file.filename || 'allegato',
          mimeType: file.mimetype || '',
        },
      });

      await audit.log({
        event: 'messages.attachment.upload',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'workspace_message_attachment',
        entityId: result.attachment.id,
        metadata: {
          messageId: request.params.messageId,
          label: result.attachment.label,
          mimeType: result.attachment.mimeType,
          fileSize: result.attachment.fileSize,
        },
        request,
      });

      return ok(reply, result, 201);
    },
  );

  // Download dell'originale: byte grezzi, non l'involucro { data }. Scaricare e' leggere,
  // quindi basta messages.view - la barriera e' il filtro per workspace e appartenenza
  // dentro il service, applicato SEMPRE, non un bottone nascosto nell'interfaccia.
  app.get<{ Params: AttachmentParams }>(
    '/messages/attachments/:attachmentId/file',
    async (request, reply) => {
      const { user, workspace } = await ensureMessagingAccess(
        request,
        MESSAGING_PERMISSIONS.view,
      );

      const file = await messagingService.getAttachmentFile({
        workspaceId: workspace.id,
        userId: user.id,
        attachmentId: request.params.attachmentId,
      });

      // Nome sanificato due volte: fallback ASCII fra virgolette piu' la versione UTF-8
      // (RFC 5987). Serve contro l'header injection e contro i nomi che romperebbero
      // l'intestazione.
      const asciiName = file.label.replace(/[^\w.\-]+/g, '_').slice(0, 100) || 'allegato';
      reply
        .header('Content-Type', file.mimeType)
        // `attachment` e non `inline`: un allegato dei messaggi si scarica, non si apre
        // dentro la nostra origine. Con nosniff toglie di mezzo il rendering di un file
        // ostile spacciato per un tipo innocuo.
        .header(
          'Content-Disposition',
          `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.label)}`,
        )
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private, no-store');

      return reply.send(file.data);
    },
  );

  app.delete<{ Params: AttachmentParams }>(
    '/messages/attachments/:attachmentId',
    async (request, reply) => {
      const { user, workspace } = await ensureMessagingAccess(
        request,
        MESSAGING_PERMISSIONS.attach,
      );

      const result = await messagingService.removeAttachment({
        workspaceId: workspace.id,
        userId: user.id,
        attachmentId: request.params.attachmentId,
      });

      await audit.log({
        event: 'messages.attachment.delete',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'workspace_message_attachment',
        entityId: result.id,
        metadata: {
          messageId: result.messageId,
        },
        request,
      });

      return ok(reply, result);
    },
  );
};

export default workspaceMessagingRoute;
