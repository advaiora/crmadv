import { pathToFileURL } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { bootstrapRuntime } from './bootstrap/startup.js';
import type { RuntimeEnv } from './bootstrap/runtime-env.js';

type DisconnectablePrismaClient = {
  $disconnect: () => Promise<void>;
};

type StartedServer = {
  app: FastifyInstance;
  runtimeEnv: RuntimeEnv;
  prismaClient: DisconnectablePrismaClient;
};

export const startServer = async (): Promise<StartedServer> => {
  const runtimeEnv = bootstrapRuntime();
  const { initializePrisma } = await import('./prisma.js');
  const prismaClient = initializePrisma(runtimeEnv.databaseUrl);
  const { createApp } = await import('./app.js');
  const app = createApp();

  app.log.info(
    {
      database: runtimeEnv.databaseTarget,
    },
    'Database configuration loaded',
  );

  await app.listen({ host: runtimeEnv.apiHost, port: runtimeEnv.apiPort });
  app.log.info(`API listening on http://${runtimeEnv.apiHost}:${runtimeEnv.apiPort}`);

  return { app, runtimeEnv, prismaClient };
};

const shutdown = async (signal: string, app: FastifyInstance, prismaClient: DisconnectablePrismaClient) => {
  app.log.info({ signal }, 'Shutting down API server');
  await app.close();
  await prismaClient.$disconnect();
  process.exit(0);
};

const run = async () => {
  let startedServer: StartedServer | null = null;

  try {
    startedServer = await startServer();
    const { app, prismaClient } = startedServer;

    process.on('SIGINT', () => {
      void shutdown('SIGINT', app, prismaClient);
    });

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM', app, prismaClient);
    });
  } catch (error) {
    if (startedServer?.prismaClient) {
      await startedServer.prismaClient.$disconnect();
    }

    // Fast fail on bootstrap errors (invalid env or startup failures).
    console.error(error);
    process.exit(1);
  }
};

const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  void run();
}
