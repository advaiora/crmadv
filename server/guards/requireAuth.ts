import type { FastifyRequest } from 'fastify';
import { resolveDevIdentity } from '../auth/devAuth.js';
import { unauthorized } from '../core/errors.js';
import { userRepository } from '../repositories/user.repository.js';

export const requireAuth = async (request: FastifyRequest) => {
  const identity = resolveDevIdentity(request);

  if (!identity.userId && !identity.email) {
    throw unauthorized('Authentication headers are missing', {
      expected: ['x-user-id', 'x-user-email'],
    });
  }

  const user = identity.userId
    ? await userRepository.findById(identity.userId)
    : await userRepository.findByEmail(identity.email as string);

  if (!user) {
    throw unauthorized('Authenticated user was not found');
  }

  return user;
};
