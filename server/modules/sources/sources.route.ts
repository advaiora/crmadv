import type { FastifyPluginAsync } from 'fastify';
import { badRequest } from '../../core/errors.js';
import { ok } from '../../core/response.js';
import { PROJECTS_PERMISSIONS, ensureProjectsAccess } from '../projects/projects.policies.js';
import { indexSourceBestEffort } from './sources.indexing.js';
import { sourcesService } from './sources.service.js';

// Indicizza la fonte per il RAG in modo best-effort (non blocca la risposta).
// `source` è la vista serializzata "full" (contiene `content`).
const indexAfterWrite = (
  workspaceId: string,
  source: { id: string; projectId: string; status: string; content?: string },
  logger: { warn: (msg: string) => void },
) =>
  indexSourceBestEffort(
    {
      workspaceId,
      projectId: source.projectId,
      id: source.id,
      content: source.content ?? '',
      status: source.status,
    },
    { logger },
  );

// Modulo Fonti (V4). Le fonti appartengono a un progetto, quindi sono protette
// dai permessi del modulo Progetti: lettura projects.view, gestione projects.edit.

type ProjectParams = { projectId: string };
type SourceParams = { id: string };

const sourcesRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: ProjectParams }>(
    '/projects/:projectId/sources',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const items = await sourcesService.listSources(workspace.id, request.params.projectId);
      return ok(reply, { items });
    },
  );

  app.post<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:projectId/sources',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const source = await sourcesService.createSource({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        actorUserId: user.id,
        body: request.body,
        request,
      });
      await indexAfterWrite(workspace.id, source, request.log);
      return ok(reply, { source }, 201);
    },
  );

  // Caricamento file come fonte (Word/PDF/TXT/CSV/MD): multipart, un solo file.
  app.post<{ Params: ProjectParams }>(
    '/projects/:projectId/sources/files',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);

      let file;
      try {
        file = await request.file();
      } catch (error) {
        // Il limite dimensione (20MB) scatta durante la lettura dello stream.
        if (error instanceof Error && /file too large|request file too large/i.test(error.message)) {
          throw badRequest('File troppo grande (massimo 20MB)');
        }
        throw error;
      }
      if (!file) {
        throw badRequest('Nessun file caricato');
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (error) {
        if (error instanceof Error && /file too large|request file too large/i.test(error.message)) {
          throw badRequest('File troppo grande (massimo 20MB)');
        }
        throw error;
      }

      const source = await sourcesService.createFileSource({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        actorUserId: user.id,
        file: {
          buffer,
          fileName: file.filename || 'file',
          mimeType: file.mimetype || '',
        },
        request,
      });
      await indexAfterWrite(workspace.id, source, request.log);
      return ok(reply, { source }, 201);
    },
  );

  // Reindicizza (vettorizza) tutte le fonti di un progetto. Utile quando la chiave
  // OpenAI viene configurata dopo aver già caricato le fonti. Best-effort per fonte.
  app.post<{ Params: ProjectParams }>(
    '/projects/:projectId/sources/reindex',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const items = await sourcesService.listIndexableSources(workspace.id, request.params.projectId);
      let indexed = 0;
      let chunks = 0;
      for (const item of items) {
        const outcome = await indexAfterWrite(
          workspace.id,
          { id: item.id, projectId: item.projectId, status: item.status, content: item.content ?? '' },
          request.log,
        );
        if (outcome.indexed) {
          indexed += 1;
          chunks += outcome.chunks ?? 0;
        }
      }
      return ok(reply, { total: items.length, indexed, chunks });
    },
  );

  app.get<{ Params: SourceParams }>('/sources/:id', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const source = await sourcesService.getSource(workspace.id, request.params.id);
    return ok(reply, { source });
  });

  app.post<{ Params: SourceParams }>('/sources/:id/refresh', async (request, reply) => {
    const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
    const source = await sourcesService.refreshSource({
      workspaceId: workspace.id,
      id: request.params.id,
      actorUserId: user.id,
      request,
    });
    await indexAfterWrite(workspace.id, source, request.log);
    return ok(reply, { source });
  });

  app.delete<{ Params: SourceParams }>('/sources/:id', async (request, reply) => {
    const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
    await sourcesService.deleteSource({
      workspaceId: workspace.id,
      id: request.params.id,
      actorUserId: user.id,
      request,
    });
    reply.code(204);
    return reply.send();
  });
};

export default sourcesRoute;
