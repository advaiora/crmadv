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
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const frontendGoogleClientId = process.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.trim() ?? '';

  app.log.info(
    {
      database: runtimeEnv.databaseTarget,
    },
    'Database configuration loaded',
  );

  if (!googleClientId) {
    app.log.error('GOOGLE_CLIENT_ID is missing. /auth/google will fail until this env var is configured.');
  } else {
    app.log.info(
      {
        googleClientId,
        googleClientIdLength: googleClientId.length,
        allowedOrigins: allowedOrigins || '(not-set)',
      },
      'GOOGLE_CLIENT_ID configured',
    );
    if (frontendGoogleClientId && frontendGoogleClientId !== googleClientId) {
      app.log.warn(
        {
          googleClientIdLength: googleClientId.length,
          viteGoogleClientIdLength: frontendGoogleClientId.length,
        },
        'Frontend/backend Google client ID mismatch detected in environment',
      );
    }
    app.log.info(
      {
        hints: [
          'Ensure this client ID is the same in frontend VITE_GOOGLE_CLIENT_ID',
          'Ensure Authorized JavaScript origins in Google Cloud include your frontend origin',
          'Redirect URI is not required for GIS popup flow; required only for redirect flow',
        ],
      },
      'Google OAuth configuration hints',
    );
  }

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
