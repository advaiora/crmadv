import { PrismaClient } from '@prisma/client';

type PrismaGlobal = typeof globalThis & {
  __prisma?: PrismaClient;
};

const globalForPrisma = globalThis as PrismaGlobal;
let prismaClient: PrismaClient | null = null;

const createPrismaClient = (databaseUrl: string) =>
  new PrismaClient({
    log: ['warn', 'error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

const getInitializedPrisma = () => {
  if (prismaClient) {
    return prismaClient;
  }

  if (process.env.NODE_ENV !== 'production' && globalForPrisma.__prisma) {
    prismaClient = globalForPrisma.__prisma;
    return prismaClient;
  }

  throw new Error('Prisma client is not initialized. Call initializePrisma() after env validation.');
};

export const initializePrisma = (databaseUrl: string) => {
  if (prismaClient) {
    return prismaClient;
  }

  if (process.env.NODE_ENV !== 'production' && globalForPrisma.__prisma) {
    prismaClient = globalForPrisma.__prisma;
    return prismaClient;
  }

  prismaClient = createPrismaClient(databaseUrl);

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__prisma = prismaClient;
  }

  return prismaClient;
};

export const hasPrismaClient = () =>
  prismaClient !== null || (process.env.NODE_ENV !== 'production' && Boolean(globalForPrisma.__prisma));

export const resetPrismaForTests = async () => {
  if (prismaClient) {
    await prismaClient.$disconnect();
  }

  prismaClient = null;

  if (process.env.NODE_ENV !== 'production') {
    delete globalForPrisma.__prisma;
  }
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getInitializedPrisma();
    const value = (client as unknown as Record<PropertyKey, unknown>)[property];

    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }

    return value;
  },
});
