export const WEB_ASSETS_MODULE_KEY = 'web';

export const WEB_ASSETS_PERMISSIONS = {
  view: 'web.view',
  create: 'web.create',
  edit: 'web.edit',
  delete: 'web.delete',
  publish: 'web.publish',
};

export const WEB_ASSET_TYPES = [
  { value: 'website', label: 'Website' },
  { value: 'webapp', label: 'Web App' },
  { value: 'ecommerce', label: 'Ecommerce' },
];

export const WEB_ASSET_STATUSES = [
  { value: 'ACTIVE', label: 'Attivo' },
  { value: 'MAINTENANCE', label: 'Manutenzione' },
  { value: 'PAUSED', label: 'In pausa' },
  { value: 'ARCHIVED', label: 'Archiviato' },
];

export const WEB_ASSETS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
