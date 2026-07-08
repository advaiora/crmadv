import type { FastifyRequest } from 'fastify';
import { forbidden } from '../core/errors.js';
import { requireAuth } from './requireAuth.js';

// Guardiano per la Console Super Admin di piattaforma.
// A differenza degli altri guard NON richiede l'header del workspace ne' la membership:
// verifica solo che l'utente autenticato abbia il flag isPlatformAdmin.
export const requirePlatformAdmin = async (request: FastifyRequest) => {
  const user = await requireAuth(request);

  if (!user.isPlatformAdmin) {
    throw forbidden('Platform admin privileges are required');
  }

  return user;
};
