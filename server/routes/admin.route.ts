import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requestContext } from '../core/request-context.js';
import { requirePlatformAdmin } from '../guards/requirePlatformAdmin.js';
import { platformAdminService } from '../services/platform-admin.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

type UserParams = {
  userId: string;
};

type SearchQuery = {
  q?: string;
};

// Console Super Admin di piattaforma: rotte cross-workspace, protette dal guard
// requirePlatformAdmin (nessun header workspace, nessuna membership richiesta).
const adminRoute: FastifyPluginAsync = async (app) => {
  app.get('/admin/workspaces', async (request, reply) => {
    await requirePlatformAdmin(request);
    const workspaces = await platformAdminService.listWorkspaces();
    return ok(reply, { workspaces });
  });

  app.post<{ Body: unknown }>('/admin/workspaces', async (request, reply) => {
    const admin = await requirePlatformAdmin(request);
    const workspace = await platformAdminService.createWorkspace(request.body, admin.id);

    if (workspace) {
      await audit.log({
        event: 'admin.workspace.create',
        entityType: 'workspace',
        entityId: workspace.id,
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { name: workspace.name, slug: workspace.slug },
        request,
      });
    }

    return ok(reply, { workspace }, 201);
  });

  app.patch<{ Params: WorkspaceParams; Body: unknown }>(
    '/admin/workspaces/:workspaceId',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const workspace = await platformAdminService.updateWorkspace(
        request.params.workspaceId,
        request.body,
      );

      await audit.log({
        event: 'admin.workspace.update',
        entityType: 'workspace',
        entityId: workspace.id,
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { name: workspace.name, slug: workspace.slug },
        request,
      });

      return ok(reply, { workspace });
    },
  );

  app.post<{ Params: WorkspaceParams }>(
    '/admin/workspaces/:workspaceId/suspend',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const workspace = await platformAdminService.setWorkspaceSuspended(
        request.params.workspaceId,
        true,
      );

      await audit.log({
        event: 'admin.workspace.suspend',
        entityType: 'workspace',
        entityId: workspace.id,
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { slug: workspace.slug },
        request,
      });

      return ok(reply, { workspace });
    },
  );

  app.post<{ Params: WorkspaceParams }>(
    '/admin/workspaces/:workspaceId/activate',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const workspace = await platformAdminService.setWorkspaceSuspended(
        request.params.workspaceId,
        false,
      );

      await audit.log({
        event: 'admin.workspace.activate',
        entityType: 'workspace',
        entityId: workspace.id,
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { slug: workspace.slug },
        request,
      });

      return ok(reply, { workspace });
    },
  );

  app.get<{
    Querystring: { days?: string };
  }>('/admin/ai-usage', async (request, reply) => {
    await requirePlatformAdmin(request);
    const usage = await platformAdminService.getAiUsage({
      windowDays: platformAdminService.parseWindowDays(request.query?.days),
    });
    return ok(reply, usage);
  });

  app.get('/admin/ai-config', async (request, reply) => {
    await requirePlatformAdmin(request);
    const workspaces = await platformAdminService.getAiConfig();
    return ok(reply, { workspaces });
  });

  app.get('/admin/platform-admins', async (request, reply) => {
    await requirePlatformAdmin(request);
    const admins = await platformAdminService.listPlatformAdmins();
    return ok(reply, { admins });
  });

  app.get<{ Querystring: SearchQuery }>('/admin/users', async (request, reply) => {
    await requirePlatformAdmin(request);
    const query = platformAdminService.parseSearchQuery(request.query?.q);
    const users = await platformAdminService.searchUsers(query);
    return ok(reply, { users });
  });

  // Il Registro attività di una promozione o rimozione da Super Admin di
  // piattaforma (CRMA-81).
  //
  // Perché a mano e non per costruzione: l'intercettore automatico attribuisce
  // ogni scrittura a UN workspace, letto dalla riga toccata. Ma la riga toccata
  // qui è `User`, che di workspace non ne ha, e il fatto — un innalzamento di
  // privilegio che vale su tutta la piattaforma — non ne ha uno solo. Senza
  // questa annotazione l'automatica ripiegherebbe sul workspace da cui è entrato
  // l'amministratore, cioè scriverebbe «un utente è cambiato» nel registro
  // sbagliato: quello dell'attore invece che quelli della persona promossa.
  //
  // Si scrive quindi una riga in ognuno dei workspace di cui la persona è
  // membro, ed è la scelta fatta da Jacopo il 10/9/2026: la promozione non ha un
  // bersaglio unico, e quelli sono gli unici registri dove qualcuno ha motivo di
  // accorgersene. Un solo fatto può produrre più righe, ed è voluto.
  const auditPlatformAdminChange = async ({
    request,
    verb,
    actorUserId,
    user,
  }: {
    request: Parameters<typeof requirePlatformAdmin>[0];
    verb: 'promote' | 'demote';
    actorUserId: string;
    user: { id: string; email: string; name: string | null };
  }) => {
    const workspaceIds = await platformAdminService.listMemberWorkspaceIds(user.id);

    // Il bersaglio va marcato come annotato a mano anche quando i workspace sono
    // zero: senza il segno, l'automatica sopravvive e finisce nel registro
    // dell'attore, che è proprio l'attribuzione sbagliata da evitare.
    requestContext.markManualAudit('user', user.id);

    if (workspaceIds.length === 0) {
      // Una persona che non appartiene a nessun workspace non ha nessun registro
      // in cui comparire: il fatto resta solo nel log dell'applicazione. È il
      // limite noto della strada scelta, scritto qui perché chi lo incontra non
      // lo scambi per un guasto.
      app.log.warn(
        { actorUserId, targetUserId: user.id, verb },
        'Platform admin change not recorded in any activity log: user has no workspace membership',
      );
      return;
    }

    for (const workspaceId of workspaceIds) {
      await audit.log({
        event: `admin.platform_admin.${verb}`,
        entityType: 'user',
        entityId: user.id,
        actorUserId,
        workspaceId,
        metadata: {
          targetEmail: user.email,
          targetName: user.name,
          // Quante righe descrivono questo stesso fatto: senza il numero, chi
          // legge un registro solo non ha modo di sapere che ce ne sono altre.
          workspaceCount: workspaceIds.length,
        },
        request,
      });
    }
  };

  app.post<{ Body: unknown }>('/admin/platform-admins', async (request, reply) => {
    const admin = await requirePlatformAdmin(request);
    const userId = platformAdminService.parseUserId(request.body);
    const { user, changed } = await platformAdminService.promotePlatformAdmin(userId);

    if (changed) {
      await auditPlatformAdminChange({ request, verb: 'promote', actorUserId: admin.id, user });
    }

    app.log.info(
      { actorUserId: admin.id, targetUserId: user.id, changed },
      'Platform admin promoted from console',
    );

    return ok(reply, { user });
  });

  app.delete<{ Params: UserParams }>(
    '/admin/platform-admins/:userId',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const { user, changed } = await platformAdminService.demotePlatformAdmin(
        request.params.userId,
        admin.id,
      );

      if (changed) {
        await auditPlatformAdminChange({ request, verb: 'demote', actorUserId: admin.id, user });
      }

      app.log.info(
        { actorUserId: admin.id, targetUserId: user.id, changed },
        'Platform admin demoted from console',
      );

      return ok(reply, { user });
    },
  );
};

export default adminRoute;
