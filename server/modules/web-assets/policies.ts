import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const WEB_ASSETS_MODULE_KEY = 'web';

export const WEB_ASSETS_PERMISSIONS = {
  view: 'web.view',
  create: 'web.create',
  edit: 'web.edit',
  delete: 'web.delete',
  publish: 'web.publish',
  unpublish: 'web.unpublish',
  versionCreate: 'web.version.create',
  versionRollback: 'web.version.rollback',
} as const;

export type WebAssetsPermissionKey =
  (typeof WEB_ASSETS_PERMISSIONS)[keyof typeof WEB_ASSETS_PERMISSIONS];

type EnsureWebAssetsAccessDependencies = {
  requireAuthFn: typeof requireAuth;
  requireWorkspaceFn: typeof requireWorkspace;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
};

const defaultDependencies: EnsureWebAssetsAccessDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
};

export const buildEnsureWebAssetsAccess = (
  dependencies: EnsureWebAssetsAccessDependencies = defaultDependencies,
) => {
  return async (
    request: FastifyRequest,
    permissionKey: WebAssetsPermissionKey,
  ) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    await dependencies.requireModuleEnabledFn(workspace.id, WEB_ASSETS_MODULE_KEY);
    await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);

    return { user, workspace };
  };
};

export const ensureWebAssetsAccess = buildEnsureWebAssetsAccess();

// SEO (agganciato il 7/8/2026). Il modulo 'seo' e i suoi quattro permessi esistevano
// nel catalogo dal principio, ma NESSUNA rotta li controllava: la scansione e i report
// SEO giravano su web.view / web.edit, cioe' chiunque potesse vedere un sito poteva
// anche lanciargli addosso una scansione. Erano quattro caselle che non governavano
// niente — la stessa finta scelta che la fase A2 serve a togliere.
//   ⚠️ seo.export e seo.manage_settings restano senza rotta: le funzioni non esistono
//   ancora (esportazione e impostazioni SEO sono previste piu' avanti). Sono le uniche
//   due voci del catalogo che oggi non governano nulla, ed e' scritto in roadmap.
export const SEO_MODULE_KEY = 'seo';

export const SEO_PERMISSIONS = {
  view: 'seo.view',
  runScan: 'seo.run_scan',
  export: 'seo.export',
  manageSettings: 'seo.manage_settings',
} as const;

export type SeoPermissionKey = (typeof SEO_PERMISSIONS)[keyof typeof SEO_PERMISSIONS];

export const buildEnsureSeoAccess = (
  dependencies: EnsureWebAssetsAccessDependencies = defaultDependencies,
) => {
  return async (request: FastifyRequest, permissionKey: SeoPermissionKey) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    // Servono entrambi i moduli: la scheda SEO vive dentro un sito in gestione,
    // quindi spegnere i Siti spegne anche la sua SEO.
    await dependencies.requireModuleEnabledFn(workspace.id, WEB_ASSETS_MODULE_KEY);
    await dependencies.requireModuleEnabledFn(workspace.id, SEO_MODULE_KEY);
    await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);

    return { user, workspace };
  };
};

export const ensureSeoAccess = buildEnsureSeoAccess();
