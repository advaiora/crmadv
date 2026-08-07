import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';
import {
  AI_PRODUCTION_MODULE_KEY,
  AI_PRODUCTION_PERMISSIONS,
  type AiProductionPermissionKey,
} from '../../auth/rbac-catalog.js';

export { AI_PRODUCTION_MODULE_KEY, AI_PRODUCTION_PERMISSIONS };

// Cancello delle rotte dell'area "Produzione AI" (7/8/2026). Fino a ieri non esisteva:
// tutte le rotte dell'area chiamavano ensureProjectsAccess, cioe' il cancello della
// Pipeline. Le due aree sono finestre diverse sullo stesso model Project, ma chi le usa
// non e' lo stesso: qui si fa produrre all'AI, e cio' costa.
//
//   ai_production.view            -> consultare progetti, brief, contenuti, report
//   ai_production.edit            -> creare e modificare a mano
//   ai_production.generate        -> far generare all'AI: SPENDE budget
//   ai_production.manage_settings -> provider, chiavi, modelli, tipi di progetto
//   ai_production.manage_budget   -> tetti di spesa e rendiconto consumi
export const ensureAiProductionAccess = async (
  request: FastifyRequest,
  permissionKey: AiProductionPermissionKey,
) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, AI_PRODUCTION_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};
