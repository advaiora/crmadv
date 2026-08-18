import type { FastifyRequest } from 'fastify';
import { ensureAccess } from '../../auth/guards.js';
import {
  MAIL_MODULE_KEY,
  MAIL_PERMISSIONS,
  type MailPermissionKey,
} from '../../auth/rbac-catalog.js';

// La chiave del modulo e quella del permesso stanno nel catalogo, non qui: sono
// le stesse stringhe che finiscono nella pagina "Ruoli e permessi", e riscriverle
// una seconda volta significherebbe che prima o poi divergono.
export { MAIL_MODULE_KEY, MAIL_PERMISSIONS };
export type { MailPermissionKey };

/**
 * Un permesso solo, e non una coppia vedi/gestisci: i parametri di un server di
 * posta non hanno un pubblico di sola lettura. Chi li guarda li guarda per
 * cambiarli, e l'unico campo che varrebbe la pena proteggere di piu' — la
 * password — non esce mai dal server, nemmeno a chi ha questo permesso.
 */
export const ensureMailAccess = (
  request: FastifyRequest,
  permissionKey: MailPermissionKey = MAIL_PERMISSIONS.manage,
) =>
  ensureAccess(request, {
    moduleKey: MAIL_MODULE_KEY,
    permission: permissionKey,
  });
