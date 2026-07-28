import type { FastifyPluginAsync } from 'fastify';
import { badRequest, forbidden } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { getUserWorkspaceSystemRoleName, SYSTEM_ROLE_NAME } from '../../../auth/workspace-bootstrap.js';
import { prisma } from '../../../prisma.js';
import { PROJECTS_PERMISSIONS, ensureProjectsAccess } from '../../projects/projects.policies.js';
import { CHAT_PERMISSIONS, ensureChatAccess } from '../chat.policies.js';
import { agencyService } from '../agency.service.js';
import { brandingRepository } from '../../../repositories/branding.repository.js';
import { renderClientReportPdf } from '../reports/client-report-pdf.js';
import { performanceReportingService } from '../reporting/performance.service.js';
import { excelIngestionService } from '../reporting/excel-ingestion.service.js';

type AgencyProjectParams = {
  projectId: string;
};

type AgencyProjectFileParams = AgencyProjectParams & {
  fileId: string;
};

type AgencyWebProjectParams = AgencyProjectParams & {
  webProjectId: string;
};

type AgencyPerformanceSnapshotParams = AgencyProjectParams & {
  snapshotId: string;
};

type AgencyMetricSetParams = {
  metricSetId: string;
};

type AgencyPerformanceSnapshotQuery = {
  source?: string;
  limit?: string;
};

type AgencySourceFileQuery = {
  download?: string;
};

// Ambito della chat passato come parametro (rotte allegati, Fase 3a; rotte sessioni).
type AgencyChatScopeQuery = {
  scope?: string;
  targetId?: string;
};

// Sessione precisa da aprire. Opzionale: senza, si atterra sull'ultima dell'utente
// per quell'ambito (e se non ne ha nessuna se ne crea una sua).
type AgencyChatSessionQuery = {
  conversationId?: string;
};

// Bersaglio d'ambito della chat a partire da scope + id. Le rotte degli allegati
// (Fase 3a) sono uniche per tutti e tre gli ambiti — l'ambito viaggia come
// parametro invece che nel percorso, per non triplicare le rotte.
const parseChatScopeTarget = (scope: unknown, targetId: unknown) => {
  if (scope === 'general') {
    return { scope: 'general' as const };
  }
  if (typeof targetId !== 'string' || targetId.trim() === '') {
    throw badRequest('Id del bersaglio mancante per questo ambito.');
  }
  if (scope === 'project') {
    return { scope: 'project' as const, projectId: targetId };
  }
  if (scope === 'client') {
    return { scope: 'client' as const, clientId: targetId };
  }
  throw badRequest('Ambito chat non valido.');
};

const isAgencySuperadmin = async (workspaceId: string, userId: string) => {
  const roleName = await getUserWorkspaceSystemRoleName({
    tx: prisma,
    workspaceId,
    userId,
  });

  return roleName === SYSTEM_ROLE_NAME.superadmin;
};

const ensureAgencySuperadminAccess = async (request: Parameters<typeof ensureProjectsAccess>[0]) => {
  const access = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
  const canManage = await isAgencySuperadmin(access.workspace.id, access.user.id);
  if (!canManage) {
    throw forbidden('Solo un Superadmin puo gestire le impostazioni runtime Agency.');
  }

  return access;
};

const workspaceAgencyRoute: FastifyPluginAsync = async (app) => {
  app.get('/agency/projects', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const projects = await agencyService.listWorkspaceProjects(workspace.id);

    return ok(reply, {
      projects,
    });
  });

  app.post<{ Body: unknown }>('/agency/projects', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.create);
    const project = await agencyService.createProject({
      workspaceId: workspace.id,
      body: request.body,
    });

    return ok(reply, {
      project,
    });
  });

  // Progetti per il selettore della Chat globale (Fase 2): filtrati per la
  // visibilita' dell'utente, con flag "assegnato a me" e "ha Fonti indicizzate".
  app.get('/agency/chat/projects', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
    const projects = await agencyService.listChatProjects({
      workspaceId: workspace.id,
      userId: user.id,
    });

    return ok(reply, {
      projects,
    });
  });

  // Modelli selezionabili nel selettore di Chat AI (deciso 20/7/2026: provider + modello,
  // ambito per sessione). Sola lettura → chat.view, come le altre GET della chat.
  app.get('/agency/chat/models', async (request, reply) => {
    const { workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
    const models = await agencyService.listChatModels({ workspaceId: workspace.id });

    return ok(reply, {
      models,
    });
  });

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const project = await agencyService.getProject(workspace.id, request.params.projectId);

      return ok(reply, {
        project,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/overview',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const overview = await agencyService.getProjectOverview(workspace.id, request.params.projectId);

      return ok(reply, {
        overview,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/brain',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const brain = await agencyService.getProjectBrain(workspace.id, request.params.projectId);

      return ok(reply, {
        brain,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/working-context',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const workingContext = await agencyService.buildProjectWorkingContext(workspace.id, request.params.projectId);

      return ok(reply, {
        workingContext,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/discovery',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const discovery = await agencyService.getProjectDiscovery(workspace.id, request.params.projectId);

      return ok(reply, {
        discovery,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/discovery/regenerate-from-sources',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const discovery = await agencyService.regenerateProjectDiscoveryFromSources(workspace.id, request.params.projectId);

      return ok(reply, {
        discovery,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/discovery/generate-from-sources',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const discovery = await agencyService.generateProjectDiscoveryFromSourcesWithAi(workspace.id, request.params.projectId);

      return ok(reply, {
        discovery,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/discovery/regenerate-section',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const discovery = await agencyService.regenerateProjectDiscoverySectionFromSources({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        discovery,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/discovery/generate-section',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const discovery = await agencyService.generateProjectDiscoverySectionWithAi({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        discovery,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/sources',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const sources = await agencyService.getProjectSources(workspace.id, request.params.projectId);

      return ok(reply, {
        sources,
      });
    },
  );

  app.put<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/sources',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const sources = await agencyService.saveProjectSources({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        sources,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/sources/files',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const file = await request.file();
      if (!file) {
        throw badRequest('Missing multipart file field.');
      }

      const buffer = await file.toBuffer();
      const uploadedFile = await agencyService.uploadProjectSourceFile({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        originalName: file.filename || 'source-file',
        mimeType: file.mimetype || '',
        buffer,
      });

      return ok(reply, {
        file: uploadedFile,
      });
    },
  );

  app.get<{ Params: AgencyProjectFileParams; Querystring: AgencySourceFileQuery }>(
    '/agency/projects/:projectId/sources/files/:fileId',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const sourceFile = await agencyService.getProjectSourceFile({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        fileId: request.params.fileId,
      });
      const download = request.query.download === '1' || request.query.download === 'true';

      reply
        .header('Content-Type', sourceFile.contentType)
        .header('Content-Length', sourceFile.buffer.byteLength)
        .header('Content-Disposition', sourceFile.disposition(download));

      return reply.send(sourceFile.buffer);
    },
  );

  app.delete<{ Params: AgencyProjectFileParams }>(
    '/agency/projects/:projectId/sources/files/:fileId',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const sources = await agencyService.deleteProjectSourceFile({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        fileId: request.params.fileId,
      });

      return ok(reply, {
        sources,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/sources/competitors/search',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const body = typeof request.body === 'object' && request.body !== null
        ? request.body as { dryRun?: unknown }
        : {};
      const competitorSearch = await agencyService.searchProjectCompetitors({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        dryRun: body.dryRun === true,
      });

      return ok(reply, {
        competitorSearch,
      });
    },
  );

  app.get('/agency/settings/provider-status', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const competitorSearch = await agencyService.getCompetitorSearchSettings(workspace.id);

    return ok(reply, {
      competitorSearch,
    });
  });

  app.get('/agency/ai/status', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const ai = await agencyService.getAgencyAiStatus(workspace.id);

    return ok(reply, {
      ai,
    });
  });

  app.get('/agency/settings/runtime', async (request, reply) => {
    const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const canManage = await isAgencySuperadmin(workspace.id, user.id);
    const runtimeSettings = await agencyService.getAgencyRuntimeSettings({
      workspaceId: workspace.id,
      canManage,
    });

    return ok(reply, {
      runtimeSettings,
    });
  });

  app.put<{ Body: unknown }>('/agency/settings/runtime', async (request, reply) => {
    const { user, workspace } = await ensureAgencySuperadminAccess(request);
    const runtimeSettings = await agencyService.saveAgencyRuntimeSettings({
      workspaceId: workspace.id,
      actorUserId: user.id,
      body: request.body,
    });

    return ok(reply, {
      runtimeSettings,
    });
  });

  app.get<{
    Querystring: { days?: string; userId?: string; model?: string; functionName?: string; projectId?: string };
  }>('/agency/settings/ai-usage', async (request, reply) => {
    const { workspace } = await ensureAgencySuperadminAccess(request);
    const parseDays = (raw?: string) => {
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : 30;
    };
    const parseFilter = (raw?: string) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return value ? value : undefined;
    };
    const usage = await agencyService.getWorkspaceAiUsage({
      workspaceId: workspace.id,
      windowDays: parseDays(request.query?.days),
      userId: parseFilter(request.query?.userId),
      model: parseFilter(request.query?.model),
      functionName: parseFilter(request.query?.functionName),
      projectId: parseFilter(request.query?.projectId),
    });

    return ok(reply, { usage });
  });

  app.get<{ Params: AgencyProjectParams; Querystring: AgencyChatSessionQuery }>(
    '/agency/projects/:projectId/chat',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
      const chat = await agencyService.getProjectChat({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        conversationId: request.query.conversationId,
      });

      return ok(reply, { chat });
    },
  );

  app.post<{ Params: AgencyProjectParams; Querystring: AgencyChatSessionQuery; Body: unknown }>(
    '/agency/projects/:projectId/chat',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const chat = await agencyService.sendProjectChatMessage({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        conversationId: request.query.conversationId,
        body: request.body,
      });

      return ok(reply, { chat });
    },
  );

  app.delete<{ Params: AgencyProjectParams; Querystring: AgencyChatSessionQuery }>(
    '/agency/projects/:projectId/chat',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const chat = await agencyService.clearProjectChat({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        conversationId: request.query.conversationId,
      });

      return ok(reply, { chat });
    },
  );

  // Partecipanti della chat condivisa di progetto (Fase 1 — invito esplicito).
  app.get<{ Params: AgencyProjectParams; Querystring: AgencyChatSessionQuery }>(
    '/agency/projects/:projectId/chat/participants',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
      const participants = await agencyService.listProjectChatParticipants({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        conversationId: request.query.conversationId,
      });

      return ok(reply, { participants });
    },
  );

  app.post<{ Params: AgencyProjectParams; Querystring: AgencyChatSessionQuery; Body: unknown }>(
    '/agency/projects/:projectId/chat/participants',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const participants = await agencyService.addProjectChatParticipant({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        conversationId: request.query.conversationId,
        body: request.body,
      });

      return ok(reply, { participants });
    },
  );

  app.delete<{ Params: AgencyProjectParams & { memberId: string }; Querystring: AgencyChatSessionQuery }>(
    '/agency/projects/:projectId/chat/participants/:memberId',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const participants = await agencyService.removeProjectChatParticipant({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        conversationId: request.query.conversationId,
        targetUserId: request.params.memberId,
      });

      return ok(reply, { participants });
    },
  );

  // --- Chat AI ambito CLIENTE (Fase 2): RAG su tutti i progetti del cliente. ---
  // conversationId (opzionale) apre una SESSIONE precisa; senza, si atterra
  // sull'ultima dell'utente (o se ne crea una sua). Vale per tutti e tre gli ambiti.
  app.get<{ Params: { clientId: string }; Querystring: AgencyChatSessionQuery }>(
    '/agency/chat/client/:clientId',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
      const chat = await agencyService.getScopedChat({
        workspaceId: workspace.id,
        userId: user.id,
        target: { scope: 'client', clientId: request.params.clientId },
        conversationId: request.query.conversationId,
      });
      return ok(reply, { chat });
    },
  );

  app.post<{ Params: { clientId: string }; Querystring: AgencyChatSessionQuery; Body: unknown }>(
    '/agency/chat/client/:clientId',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const chat = await agencyService.sendScopedChatMessage({
        workspaceId: workspace.id,
        userId: user.id,
        target: { scope: 'client', clientId: request.params.clientId },
        conversationId: request.query.conversationId,
        body: request.body,
      });
      return ok(reply, { chat });
    },
  );

  app.delete<{ Params: { clientId: string }; Querystring: AgencyChatSessionQuery }>(
    '/agency/chat/client/:clientId',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const chat = await agencyService.clearScopedChat({
        workspaceId: workspace.id,
        userId: user.id,
        target: { scope: 'client', clientId: request.params.clientId },
        conversationId: request.query.conversationId,
      });
      return ok(reply, { chat });
    },
  );

  app.get<{ Params: { clientId: string }; Querystring: AgencyChatSessionQuery }>(
    '/agency/chat/client/:clientId/participants',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
      const participants = await agencyService.listScopedChatParticipants({
        workspaceId: workspace.id,
        userId: user.id,
        target: { scope: 'client', clientId: request.params.clientId },
        conversationId: request.query.conversationId,
      });
      return ok(reply, { participants });
    },
  );

  app.post<{ Params: { clientId: string }; Querystring: AgencyChatSessionQuery; Body: unknown }>(
    '/agency/chat/client/:clientId/participants',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const participants = await agencyService.addScopedChatParticipant({
        workspaceId: workspace.id,
        userId: user.id,
        target: { scope: 'client', clientId: request.params.clientId },
        conversationId: request.query.conversationId,
        body: request.body,
      });
      return ok(reply, { participants });
    },
  );

  app.delete<{ Params: { clientId: string; memberId: string }; Querystring: AgencyChatSessionQuery }>(
    '/agency/chat/client/:clientId/participants/:memberId',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const participants = await agencyService.removeScopedChatParticipant({
        workspaceId: workspace.id,
        userId: user.id,
        target: { scope: 'client', clientId: request.params.clientId },
        conversationId: request.query.conversationId,
        targetUserId: request.params.memberId,
      });
      return ok(reply, { participants });
    },
  );

  // --- Chat AI ambito GENERALE (Fase 2): niente contesto CRM. Fino al 15/7/2026 era
  // UNA conversazione per l'intero workspace: chi non la apriva per primo non ne era
  // partecipante e restava senza messaggi e senza poter scrivere. Ora ognuno ha le
  // proprie sessioni. ---
  app.get<{ Querystring: AgencyChatSessionQuery }>('/agency/chat/general', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
    const chat = await agencyService.getScopedChat({
      workspaceId: workspace.id,
      userId: user.id,
      target: { scope: 'general' },
      conversationId: request.query.conversationId,
    });
    return ok(reply, { chat });
  });

  app.post<{ Querystring: AgencyChatSessionQuery; Body: unknown }>('/agency/chat/general', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
    const chat = await agencyService.sendScopedChatMessage({
      workspaceId: workspace.id,
      userId: user.id,
      target: { scope: 'general' },
      conversationId: request.query.conversationId,
      body: request.body,
    });
    return ok(reply, { chat });
  });

  app.delete<{ Querystring: AgencyChatSessionQuery }>('/agency/chat/general', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
    const chat = await agencyService.clearScopedChat({
      workspaceId: workspace.id,
      userId: user.id,
      target: { scope: 'general' },
      conversationId: request.query.conversationId,
    });
    return ok(reply, { chat });
  });

  app.get<{ Querystring: AgencyChatSessionQuery }>('/agency/chat/general/participants', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
    const participants = await agencyService.listScopedChatParticipants({
      workspaceId: workspace.id,
      userId: user.id,
      target: { scope: 'general' },
      conversationId: request.query.conversationId,
    });
    return ok(reply, { participants });
  });

  app.post<{ Querystring: AgencyChatSessionQuery; Body: unknown }>('/agency/chat/general/participants', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
    const participants = await agencyService.addScopedChatParticipant({
      workspaceId: workspace.id,
      userId: user.id,
      target: { scope: 'general' },
      conversationId: request.query.conversationId,
      body: request.body,
    });
    return ok(reply, { participants });
  });

  app.delete<{ Params: { memberId: string }; Querystring: AgencyChatSessionQuery }>(
    '/agency/chat/general/participants/:memberId',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const participants = await agencyService.removeScopedChatParticipant({
        workspaceId: workspace.id,
        userId: user.id,
        target: { scope: 'general' },
        conversationId: request.query.conversationId,
        targetUserId: request.params.memberId,
      });
      return ok(reply, { participants });
    },
  );

  // --- Allegati della chat (Fase 3a): documenti ed elementi CRM, validi per tutti
  // e tre gli ambiti (ambito passato come scope + targetId). ---

  // --- SESSIONI della chat (15/7/2026, spec sez. 4-bis). Un ambito ha N sessioni:
  // queste rotte sono l'elenco e il ciclo di vita. Uniche per tutti e tre gli ambiti,
  // come le rotte allegati. ---

  // Elenco delle sessioni dell'utente sull'ambito (la "lista chat" della UI).
  app.get<{ Querystring: AgencyChatScopeQuery }>('/agency/chat/sessions', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
    const sessions = await agencyService.listScopedChatSessions({
      workspaceId: workspace.id,
      userId: user.id,
      target: parseChatScopeTarget(request.query.scope, request.query.targetId),
    });
    return ok(reply, { sessions });
  });

  // Nuova sessione sull'ambito ("Nuova chat").
  app.post<{ Body: AgencyChatScopeQuery }>('/agency/chat/sessions', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
    const body = request.body ?? {};
    const session = await agencyService.createScopedChatSession({
      workspaceId: workspace.id,
      userId: user.id,
      target: parseChatScopeTarget(body.scope, body.targetId),
    });
    return ok(reply, { session });
  });

  // Rinomina: il titolo automatico (prime parole del primo messaggio) si sovrascrive.
  app.patch<{ Params: { conversationId: string }; Body: AgencyChatScopeQuery & { title?: string } }>(
    '/agency/chat/sessions/:conversationId',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const body = request.body ?? {};
      const session = await agencyService.renameScopedChatSession({
        workspaceId: workspace.id,
        userId: user.id,
        target: parseChatScopeTarget(body.scope, body.targetId),
        conversationId: request.params.conversationId,
        title: String(body.title ?? ''),
      });
      return ok(reply, { session });
    },
  );

  // Sciogli il gruppo: la sessione torna solitaria per chi esegue, gli altri la
  // ritrovano congelata in sola lettura.
  app.post<{ Params: { conversationId: string }; Body: AgencyChatScopeQuery }>(
    '/agency/chat/sessions/:conversationId/disband',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const body = request.body ?? {};
      const participants = await agencyService.disbandScopedChat({
        workspaceId: workspace.id,
        userId: user.id,
        target: parseChatScopeTarget(body.scope, body.targetId),
        conversationId: request.params.conversationId,
      });
      return ok(reply, { participants });
    },
  );

  // "Riprendi in una nuova chat": duplica una sessione congelata (fino a frozenAt).
  app.post<{ Params: { conversationId: string }; Body: AgencyChatScopeQuery }>(
    '/agency/chat/sessions/:conversationId/resume',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const body = request.body ?? {};
      const session = await agencyService.resumeScopedChatSession({
        workspaceId: workspace.id,
        userId: user.id,
        target: parseChatScopeTarget(body.scope, body.targetId),
        conversationId: request.params.conversationId,
      });
      return ok(reply, { session });
    },
  );

  // conversationId: la sessione su cui vive la bozza. Deve seguire l'allegato per
  // tutto il giro (elenco, caricamento, invio): la bozza si carica su una sessione e
  // l'invio accetta solo le bozze di QUELLA sessione. Senza, la bozza finirebbe
  // sull'ultima sessione dell'utente mentre lui scrive in un'altra, e l'invio la
  // rifiuterebbe con "Allegato non valido o gia inviato".
  app.get<{ Querystring: AgencyChatScopeQuery & AgencyChatSessionQuery }>(
    '/agency/chat/attachments',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
      const attachments = await agencyService.listScopedChatAttachments({
        workspaceId: workspace.id,
        userId: user.id,
        target: parseChatScopeTarget(request.query.scope, request.query.targetId),
        conversationId: request.query.conversationId,
      });
      return ok(reply, { attachments });
    },
  );

  // Multipart: l'ambito viaggia in querystring perche' il corpo e' il file.
  app.post<{ Querystring: AgencyChatScopeQuery & AgencyChatSessionQuery }>(
    '/agency/chat/attachments/file',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const target = parseChatScopeTarget(request.query.scope, request.query.targetId);
      const file = await request.file();
      if (!file) {
        throw badRequest('Nessun file caricato.');
      }
      const buffer = await file.toBuffer();
      const attachment = await agencyService.addScopedChatFileAttachment({
        workspaceId: workspace.id,
        userId: user.id,
        target,
        conversationId: request.query.conversationId,
        file: {
          buffer,
          fileName: file.filename || 'allegato',
          mimeType: file.mimetype || '',
        },
      });
      return ok(reply, { attachment });
    },
  );

  app.post<{ Body: AgencyChatScopeQuery & AgencyChatSessionQuery }>(
    '/agency/chat/attachments/entity',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
      const body = request.body ?? {};
      const attachment = await agencyService.addScopedChatEntityAttachment({
        workspaceId: workspace.id,
        userId: user.id,
        target: parseChatScopeTarget(body.scope, body.targetId),
        conversationId: body.conversationId,
        body,
      });
      return ok(reply, { attachment });
    },
  );

  app.delete<{ Params: { attachmentId: string } }>('/agency/chat/attachments/:attachmentId', async (request, reply) => {
    const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.use);
    const result = await agencyService.removeScopedChatAttachment({
      workspaceId: workspace.id,
      userId: user.id,
      attachmentId: request.params.attachmentId,
    });
    return ok(reply, result);
  });

  // Download/anteprima dell'ORIGINALE di un allegato file. Ritorna i byte grezzi (non
  // l'involucro { data }): scaricare e' lettura, quindi basta chat.view. Il filename
  // ha un fallback ASCII piu' la versione UTF-8 (RFC 5987), sanificato contro header
  // injection.
  app.get<{ Params: { attachmentId: string } }>(
    '/agency/chat/attachments/:attachmentId/file',
    async (request, reply) => {
      const { user, workspace } = await ensureChatAccess(request, CHAT_PERMISSIONS.view);
      const file = await agencyService.getScopedChatAttachmentFile({
        workspaceId: workspace.id,
        userId: user.id,
        attachmentId: request.params.attachmentId,
      });
      const asciiName = file.label.replace(/[^\w.\-]+/g, '_').slice(0, 100) || 'allegato';
      reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.label)}`)
        .header('Cache-Control', 'private, no-store');
      return reply.send(file.data);
    },
  );

  app.get('/agency/ai/estimates', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const estimates = await agencyService.getWorkspaceAiCostEstimates(workspace.id);

    return ok(reply, { estimates });
  });

  app.get('/agency/settings/ai-budgets', async (request, reply) => {
    const { workspace } = await ensureAgencySuperadminAccess(request);
    const budgets = await agencyService.getAiBudgets(workspace.id);

    return ok(reply, { budgets });
  });

  app.put<{ Body: unknown }>('/agency/settings/ai-budgets', async (request, reply) => {
    const { workspace } = await ensureAgencySuperadminAccess(request);
    const budgets = await agencyService.saveAiBudgets({
      workspaceId: workspace.id,
      body: request.body,
    });

    return ok(reply, { budgets });
  });

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/web',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const web = await agencyService.getProjectWeb(workspace.id, request.params.projectId);

      return ok(reply, {
        web,
      });
    },
  );

  app.put<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/web',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const web = await agencyService.saveProjectWeb({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        web,
      });
    },
  );

  app.post<{ Params: AgencyWebProjectParams }>(
    '/agency/projects/:projectId/web-projects/:webProjectId/generate-ai',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const web = await agencyService.generateProjectWebProjectWithAi({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        webProjectId: request.params.webProjectId,
      });

      return ok(reply, {
        web,
      });
    },
  );

  app.post<{ Params: AgencyWebProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/web-projects/:webProjectId/generate-block-ai',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const web = await agencyService.generateProjectWebBlockWithAi({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        webProjectId: request.params.webProjectId,
        body: request.body,
      });

      return ok(reply, {
        web,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/ads',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const ads = await agencyService.getProjectAds(workspace.id, request.params.projectId);

      return ok(reply, {
        ads,
      });
    },
  );

  app.put<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/ads',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const ads = await agencyService.saveProjectAds({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        ads,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/ads/generate-asset-ai',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const ads = await agencyService.generateProjectAdsAssetWithAi({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        ads,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/reports/input',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const input = await agencyService.buildProjectReportInput(workspace.id, request.params.projectId);

      return ok(reply, {
        input,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/reports/client/input',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const input = await agencyService.buildProjectClientReportInput(workspace.id, request.params.projectId);

      return ok(reply, {
        input,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/reports/client',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const clientReport = await agencyService.getProjectClientReport(workspace.id, request.params.projectId);

      return ok(reply, {
        clientReport,
      });
    },
  );

  app.put<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/reports/client',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const clientReport = await agencyService.saveProjectClientReport({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        clientReport,
      });
    },
  );

  // Export PDF brandizzato del report cliente (V6). Stessa autorizzazione della
  // lettura (projects.view). Serve i byte come application/pdf in download.
  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/reports/client/pdf',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const projectId = request.params.projectId;

      const [clientReport, branding, project] = await Promise.all([
        agencyService.getProjectClientReport(workspace.id, projectId),
        brandingRepository.findByWorkspaceId(workspace.id),
        prisma.project.findFirst({
          where: { workspaceId: workspace.id, id: projectId },
          select: { client: { select: { name: true } } },
        }),
      ]);

      const workspaceLabel = branding?.workspaceName?.trim() || workspace.name;
      const pdfBuffer = await renderClientReportPdf(
        {
          projectName: clientReport.input.projectName,
          projectTypeLabel: clientReport.input.projectTypeLabel,
          clientName: project?.client?.name ?? null,
          generatedAt: clientReport.output.generatedAt,
          report: clientReport.output,
        },
        {
          name: workspaceLabel,
          supportEmail: branding?.supportEmail ?? null,
          supportPhone: branding?.supportPhone ?? null,
          supportAddress: branding?.supportAddress ?? null,
          logoUrl: branding?.logoUrl ?? null,
          primaryColor: branding?.primaryColor ?? null,
          secondaryColor: branding?.secondaryColor ?? null,
        },
      );

      const safeName = clientReport.input.projectName.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || projectId.slice(0, 8);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Length', String(pdfBuffer.byteLength));
      reply.header('Content-Disposition', `attachment; filename="report_cliente_${safeName}.pdf"`);
      return reply.send(pdfBuffer);
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/diagnosis/input',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const input = await agencyService.buildProjectDiagnosisInput(workspace.id, request.params.projectId);

      return ok(reply, {
        input,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/diagnosis',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const diagnosis = await agencyService.getProjectDiagnosis(workspace.id, request.params.projectId);

      return ok(reply, {
        diagnosis,
      });
    },
  );

  app.put<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/diagnosis',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const diagnosis = await agencyService.saveProjectDiagnosis({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        diagnosis,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/reports',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const report = await agencyService.getProjectReport(workspace.id, request.params.projectId);

      return ok(reply, {
        report,
      });
    },
  );

  app.put<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/reports',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const report = await agencyService.saveProjectReport({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        report,
      });
    },
  );

  app.get('/agency/reports', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const reports = await agencyService.getWorkspaceReports(workspace.id);

    return ok(reply, {
      reports,
    });
  });

  app.put<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/discovery',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const discovery = await agencyService.saveProjectDiscovery({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        body: request.body,
      });

      return ok(reply, {
        discovery,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/alerts',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const alerts = await agencyService.getProjectAlerts(workspace.id, request.params.projectId);

      return ok(reply, {
        alerts,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/alerts/sync',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const alerts = await agencyService.syncProjectAlerts(workspace.id, request.params.projectId);

      return ok(reply, {
        alerts,
      });
    },
  );

  app.get('/agency/alerts', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const alerts = await agencyService.getWorkspaceAlerts(workspace.id);

    return ok(reply, {
      alerts,
    });
  });

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/opportunities/input',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const input = await agencyService.buildProjectOpportunityInput(workspace.id, request.params.projectId);

      return ok(reply, {
        input,
      });
    },
  );

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/opportunities',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const opportunities = await agencyService.getProjectOpportunities(workspace.id, request.params.projectId);

      return ok(reply, {
        opportunities,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/opportunities/sync',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const opportunities = await agencyService.syncProjectOpportunities(workspace.id, request.params.projectId);

      return ok(reply, {
        opportunities,
      });
    },
  );

  app.get('/agency/opportunities', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const opportunities = await agencyService.getWorkspaceOpportunities(workspace.id);

    return ok(reply, {
      opportunities,
    });
  });

  app.get<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/tasks',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const tasks = await agencyService.getProjectTasks(workspace.id, request.params.projectId);

      return ok(reply, {
        tasks,
      });
    },
  );

  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/tasks/sync',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const tasks = await agencyService.syncProjectTasks(workspace.id, request.params.projectId);

      return ok(reply, {
        tasks,
      });
    },
  );

  // === Reportistica multi-sorgente (V6): serbatoio dati ===
  // Storico delle rilevazioni di performance per progetto. Permessi riusati da
  // Progetti (view/create/delete), come il resto dell'area Agency.
  app.get<{ Params: AgencyProjectParams; Querystring: AgencyPerformanceSnapshotQuery }>(
    '/agency/projects/:projectId/performance/snapshots',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const snapshots = await performanceReportingService.listProjectSnapshots({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        query: request.query,
      });

      return ok(reply, { snapshots });
    },
  );

  app.post<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/performance/snapshots',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.create);
      const snapshot = await performanceReportingService.createProjectSnapshot({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        body: request.body,
      });

      return ok(reply, { snapshot });
    },
  );

  // "Aggiorna ora": rileva e SALVA una nuova fotografia da un connettore (stub).
  app.post<{ Params: AgencyProjectParams; Body: unknown }>(
    '/agency/projects/:projectId/performance/refresh',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.create);
      const snapshot = await performanceReportingService.refreshProjectSnapshot({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        body: request.body,
      });

      return ok(reply, { snapshot });
    },
  );

  app.delete<{ Params: AgencyPerformanceSnapshotParams }>(
    '/agency/projects/:projectId/performance/snapshots/:snapshotId',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.delete);
      const deleted = await performanceReportingService.deleteProjectSnapshot({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        snapshotId: request.params.snapshotId,
      });

      return ok(reply, { deleted });
    },
  );

  // Descrittori dei connettori (card della dashboard, modello "Provider AI").
  app.get('/agency/performance/connectors', async (request, reply) => {
    await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const connectors = performanceReportingService.listConnectors();

    return ok(reply, { connectors });
  });

  // Set di metriche salvabili ("carne'"), condivisi a livello di workspace.
  app.get('/agency/performance/metric-sets', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const metricSets = await performanceReportingService.listMetricSets({
      workspaceId: workspace.id,
    });

    return ok(reply, { metricSets });
  });

  app.post<{ Body: unknown }>('/agency/performance/metric-sets', async (request, reply) => {
    const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.create);
    const metricSet = await performanceReportingService.createMetricSet({
      workspaceId: workspace.id,
      userId: user.id,
      body: request.body,
    });

    return ok(reply, { metricSet });
  });

  app.patch<{ Params: AgencyMetricSetParams; Body: unknown }>(
    '/agency/performance/metric-sets/:metricSetId',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const metricSet = await performanceReportingService.updateMetricSet({
        workspaceId: workspace.id,
        id: request.params.metricSetId,
        body: request.body,
      });

      return ok(reply, { metricSet });
    },
  );

  app.delete<{ Params: AgencyMetricSetParams }>(
    '/agency/performance/metric-sets/:metricSetId',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.delete);
      const deleted = await performanceReportingService.deleteMetricSet({
        workspaceId: workspace.id,
        id: request.params.metricSetId,
      });

      return ok(reply, { deleted });
    },
  );

  // === Ingestion Excel (sotto-modulo Excel+AI) ===
  // Upload di un file Excel del cliente -> l'AI propone la mappatura -> anteprima
  // con riconciliazione -> (commit) scrittura degli snapshot source=EXCEL.
  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/performance/excel/preview',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.create);
      const uploaded = await request.file();
      if (!uploaded) {
        throw badRequest('Nessun file caricato.');
      }
      const buffer = await uploaded.toBuffer();
      const preview = await excelIngestionService.preview({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        buffer,
        filename: uploaded.filename,
      });

      return ok(reply, preview);
    },
  );

  app.post<{ Params: AgencyProjectParams }>(
    '/agency/projects/:projectId/performance/excel/commit',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.create);
      let buffer: Buffer | null = null;
      let filename = 'import.xlsx';
      let mappingRaw = '';
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          buffer = await part.toBuffer();
          filename = part.filename;
        } else if (part.fieldname === 'mapping' && typeof part.value === 'string') {
          mappingRaw = part.value;
        }
      }
      if (!buffer) {
        throw badRequest('Nessun file caricato.');
      }
      let mapping: unknown = {};
      if (mappingRaw) {
        try {
          mapping = JSON.parse(mappingRaw);
        } catch (_error) {
          throw badRequest('Mappatura non valida (JSON).');
        }
      }
      const result = await excelIngestionService.commit({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        userId: user.id,
        buffer,
        filename,
        mapping,
      });

      return ok(reply, result);
    },
  );
};

export default workspaceAgencyRoute;
