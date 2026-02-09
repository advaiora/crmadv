import { prisma } from '../prisma.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
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
};

export type AuthUser = Awaited<ReturnType<typeof userRepository.findById>>;
