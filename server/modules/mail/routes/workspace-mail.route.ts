import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../../core/response.js';
import { MAIL_PERMISSIONS, ensureMailAccess } from '../policies.js';
import { mailService } from '../mail.service.js';

const workspaceMailRoute: FastifyPluginAsync = async (app) => {
  app.get('/mail', async (request, reply) => {
    const { workspaceId } = await ensureMailAccess(request, MAIL_PERMISSIONS.manage);
    const impostazioni = await mailService.getImpostazioni(workspaceId);
    return ok(reply, { impostazioni });
  });

  app.put<{ Body: unknown }>('/mail', async (request, reply) => {
    const { user, workspaceId } = await ensureMailAccess(request, MAIL_PERMISSIONS.manage);
    const impostazioni = await mailService.salvaImpostazioni({
      workspaceId,
      actorUserId: user.id,
      body: request.body,
      request,
    });
    return ok(reply, { impostazioni });
  });

  // Non spedisce niente a nessuno: apre la connessione, si autentica e chiude.
  app.post('/mail/test', async (request, reply) => {
    const { user, workspaceId } = await ensureMailAccess(request, MAIL_PERMISSIONS.manage);
    const esito = await mailService.provaConnessione({
      workspaceId,
      actorUserId: user.id,
      request,
    });
    return ok(reply, esito);
  });

  app.delete('/mail', async (request, reply) => {
    const { user, workspaceId } = await ensureMailAccess(request, MAIL_PERMISSIONS.manage);
    await mailService.eliminaImpostazioni({
      workspaceId,
      actorUserId: user.id,
      request,
    });
    reply.code(204);
    return reply.send();
  });
};

export default workspaceMailRoute;
