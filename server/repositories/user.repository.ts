import { prisma } from '../prisma.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isPlatformAdmin: true,
  themePreference: true,
  avatarUrl: true,
} as const;

const loginUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isPlatformAdmin: true,
  passwordHash: true,
  vaultPasswordHash: true,
} as const;

export const userRepository = {
  findById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
  },

  findByIdForLogin(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: loginUserSelect,
    });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: userSelect,
    });
  },

  findByEmailForLogin(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: loginUserSelect,
    });
  },

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    return Boolean(user?.isPlatformAdmin);
  },

  updateVaultPasswordHash(userId: string, vaultPasswordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { vaultPasswordHash },
      select: loginUserSelect,
    });
  },
};

export type AuthUser = Awaited<ReturnType<typeof userRepository.findById>>;
