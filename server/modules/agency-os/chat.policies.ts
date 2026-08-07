import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';
import { CHAT_PERMISSIONS, type ChatPermissionKey } from '../../auth/rbac-catalog.js';
import { AI_PRODUCTION_MODULE_KEY } from './agency.policies.js';

export { CHAT_PERMISSIONS };

// Cancello delle rotte della Chat AI, con i permessi della chat: prima che
// esistessero, tutto girava su 'projects.view', quindi inviare un messaggio (che
// SPENDE) chiedeva lo stesso permesso della sola lettura.
//   chat.view     -> consultare le sessioni di cui si fa parte
//   chat.use      -> scrivere: inviare, invitare, allegare, azzerare, sciogliere
//   chat.moderate -> gestire i gruppi altrui senza leggerne i messaggi
//
// Il modulo richiesto era 'projects' per ripiego ("l'area Agency non ne ha uno suo").
// Dal 7/8/2026 e' 'ai_production', che e' l'area di cui la chat fa parte: spegnere la
// Pipeline non spegne piu' la chat AI, e spegnere la Produzione AI la spegne davvero.
export const ensureChatAccess = async (request: FastifyRequest, permissionKey: ChatPermissionKey) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, AI_PRODUCTION_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};
