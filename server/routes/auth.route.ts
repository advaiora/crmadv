import bcrypt from 'bcrypt';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest, unauthorized } from '../core/errors.js';
import { ok } from '../core/response.js';
import { userRepository } from '../repositories/user.repository.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const authRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: unknown }>('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      throw badRequest('Invalid login payload', {
        issues: parsed.error.flatten(),
      });
    }

    const credentials = parsed.data;
    const user = await userRepository.findByEmailForLogin(credentials.email);

    if (!user || !user.passwordHash) {
      throw unauthorized('Credenziali non valide');
    }

    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      throw unauthorized('Credenziali non valide');
    }

    return ok(reply, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  });
};

export default authRoute;
