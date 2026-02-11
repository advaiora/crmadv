import { prisma } from '../prisma.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

const loginUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  passwordHash: true,
} as const;

export const userRepository = {
  findById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
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
};

export type AuthUser = Awaited<ReturnType<typeof userRepository.findById>>;
