import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';
import { CHAT_PERMISSIONS, type ChatPermissionKey } from '../../auth/rbac-catalog.js';
import { PROJECTS_MODULE_KEY } from '../projects/projects.policies.js';

export { CHAT_PERMISSIONS };

// Cancello delle rotte della Chat AI. Ricalca ensureProjectsAccess — stesso modulo
// richiesto ('projects': l'area Agency non ne ha uno suo) — ma con i permessi della
// chat, che finora non esistevano: tutto girava su 'projects.view', quindi inviare
// un messaggio (che SPENDE) chiedeva lo stesso permesso della sola lettura.
//   chat.view     -> consultare le sessioni di cui si fa parte
//   chat.use      -> scrivere: inviare, invitare, allegare, azzerare, sciogliere
//   chat.moderate -> gestire i gruppi altrui senza leggerne i messaggi
export const ensureChatAccess = async (request: FastifyRequest, permissionKey: ChatPermissionKey) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, PROJECTS_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};
