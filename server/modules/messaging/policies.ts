import type { FastifyRequest } from 'fastify';
import { ensureAccess } from '../../auth/guards.js';

export const MESSAGING_MODULE_KEY = 'messages';

export const MESSAGING_PERMISSIONS = {
  view: 'messages.view',
  send: 'messages.send',
  // «Cestina messaggio» (CRMA-165). Il nome segue quello dei vicini
  // (`clients.delete`) invece di inventare un verbo nuovo, regola ②-bis: dal
  // Cestino in avanti `.delete` significa ovunque "sposta nel cestino", e la
  // distruzione vera sta dietro `trash.purge`.
  delete: 'messages.delete',
} as const;

type MessagingPermissionKey =
  (typeof MESSAGING_PERMISSIONS)[keyof typeof MESSAGING_PERMISSIONS];

export const ensureMessagingAccess = async (
  request: FastifyRequest,
  permissionKey: MessagingPermissionKey,
) => {
  return ensureAccess(request, {
    moduleKey: MESSAGING_MODULE_KEY,
    permission: permissionKey,
  });
};
