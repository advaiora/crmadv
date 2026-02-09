import Fastify from 'fastify';
import { audit } from './audit/audit.js';
import { readHeaderValue } from './auth/devAuth.js';
import { isHttpError } from './core/errors.js';
import { fail, ok } from './core/response.js';
import { requireAuth } from './guards/requireAuth.js';
import { requireModuleEnabled } from './guards/requireModule.js';
import { requirePermission } from './guards/requirePermission.js';
import { requireWorkspace } from './guards/requireWorkspace.js';
import { prisma } from './prisma.js';

const app = Fastify({
  logger: true,
});

app.setErrorHandler((error, request, reply) => {
  if (isHttpError(error)) {
    return fail(reply, error.statusCode, error.code, error.message, error.details);
  }

  request.log.error(error, 'Unhandled server error');
  return fail(reply, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
});

app.setNotFoundHandler((_request, reply) =>
  fail(reply, 404, 'NOT_FOUND', 'Resource not found'),
);

app.get('/health', async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      db: 'up',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    app.log.error(error, 'Healthcheck failed');
    reply.code(503);

    return {
      status: 'degraded',
      db: 'down',
      timestamp: new Date().toISOString(),
    };
  }
});

app.get('/whoami', async (request, reply) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);

  const requiredModule = readHeaderValue(request, 'x-required-module') ?? 'modules';
  const requiredPermission =
    readHeaderValue(request, 'x-required-permission') ?? 'modules.manage';

  await requireModuleEnabled(workspace.id, requiredModule);
  await requirePermission(user.id, workspace.id, requiredPermission);

  await audit.log({
    event: 'debug.whoami',
    actorUserId: user.id,
    workspaceId: workspace.id,
    metadata: {
      requiredModule,
      requiredPermission,
    },
    request,
  });

  return ok(reply, {
    user,
    workspace,
    authorization: {
      module: requiredModule,
      permission: requiredPermission,
    },
  });
});

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';

const start = async () => {
  try {
    await app.listen({ host, port });
    app.log.info(`API listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error, 'Failed to start API server');
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down API server');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void start();
