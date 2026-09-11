import type { FastifyRequest } from 'fastify';
import { ensureAccess } from '../../auth/guards.js';

export const MESSAGING_MODULE_KEY = 'messages';

export const MESSAGING_PERMISSIONS = {
  view: 'messages.view',
  send: 'messages.send',
  // Caricare un allegato ha una chiave sua: si vuole poter concedere "scrivere testo"
  // senza "caricare file". SCARICARE invece non ce l'ha - scaricare e' leggere, e passa
  // da `view` piu' il controllo mittente/destinatario dentro il service.
  attach: 'messages.attach',
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
