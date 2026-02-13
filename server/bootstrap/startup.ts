import { loadAndValidateRuntimeEnv, type RuntimeEnv, type RuntimeEnvOptions } from './runtime-env.js';

export const bootstrapRuntime = (options: RuntimeEnvOptions = {}): RuntimeEnv => {
  const runtimeEnv = loadAndValidateRuntimeEnv(options);

  console.info(
    `[bootstrap] ${runtimeEnv.prisma.previousEngineType === null ? 'PRISMA_CLIENT_ENGINE_TYPE not set' : `PRISMA_CLIENT_ENGINE_TYPE=${runtimeEnv.prisma.previousEngineType}`}; using ${runtimeEnv.prisma.engineType}`,
  );

  if (runtimeEnv.prisma.dotenvPrismaEnv.length > 0) {
    console.info('[bootstrap] PRISMA_* loaded from dotenv:', runtimeEnv.prisma.dotenvPrismaEnv);
  } else {
    console.info('[bootstrap] PRISMA_* loaded from dotenv: none');
  }

  console.info('[bootstrap] Effective PRISMA_* environment:', runtimeEnv.prisma.processPrismaEnv);

  return runtimeEnv;
};
