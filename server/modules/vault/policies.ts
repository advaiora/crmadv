export const VAULT_MODULE_KEY = 'vault';

// Stable RBAC permission keys for Vault. Keep list/reveal separated.
export const VaultPermissions = {
  viewList: 'vault.view_list',
  create: 'vault.create',
  edit: 'vault.edit',
  reveal: 'vault.reveal',
  delete: 'vault.delete',
} as const;

export type VaultPermissionKey =
  (typeof VaultPermissions)[keyof typeof VaultPermissions];

export const VaultActions = {
  list: 'list',
  create: 'create',
  edit: 'edit',
  reveal: 'reveal',
  delete: 'delete',
} as const;

export type VaultAction = (typeof VaultActions)[keyof typeof VaultActions];

export const VaultActionPermissionMap: Record<VaultAction, VaultPermissionKey> = {
  [VaultActions.list]: VaultPermissions.viewList,
  [VaultActions.create]: VaultPermissions.create,
  [VaultActions.edit]: VaultPermissions.edit,
  // Critical action: never treat reveal as equivalent to view/list.
  [VaultActions.reveal]: VaultPermissions.reveal,
  [VaultActions.delete]: VaultPermissions.delete,
};

export const getVaultPermissionForAction = (
  action: VaultAction,
): VaultPermissionKey => VaultActionPermissionMap[action];

export const isVaultCriticalAction = (action: VaultAction): boolean =>
  action === VaultActions.reveal;

export const isVaultAuditRequiredAction = (action: VaultAction): boolean =>
  action === VaultActions.reveal;

