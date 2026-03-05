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

export const WEB_ASSET_DEPLOYMENT_ENVIRONMENTS = [
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'STAGING', label: 'Staging' },
  { value: 'PRODUCTION', label: 'Production' },
];

export const WEB_ASSET_VERSION_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'STAGED', label: 'Staged' },
  { value: 'LIVE', label: 'Live' },
];

export const WEB_ASSET_AUDIT_ACTION_OPTIONS = [
  { value: '', label: 'Tutte le azioni' },
  { value: 'web.asset.create', label: 'Create' },
  { value: 'web.asset.update', label: 'Edit' },
  { value: 'web.asset.delete', label: 'Delete' },
  { value: 'web.asset.publish', label: 'Publish' },
  { value: 'web.asset.unpublish', label: 'Unpublish' },
  { value: 'web.asset.link_client', label: 'Link Client' },
  { value: 'web.asset.link_project', label: 'Link Project' },
  { value: 'web.deployment.switch', label: 'Deployment Switch' },
  { value: 'web.version.create', label: 'Version Create' },
  { value: 'web.version.rollback', label: 'Version Rollback' },
  { value: 'web.health.check', label: 'Health Check' },
  { value: 'web.analytics.snapshot.create', label: 'Analytics Snapshot' },
  { value: 'web.analytics.event.create', label: 'Analytics Event' },
  { value: 'web.maintenance.create', label: 'Maintenance Create' },
  { value: 'web.maintenance.update', label: 'Maintenance Update' },
  { value: 'web.alert.update', label: 'Alert Update' },
];

export const WEB_ASSET_MAINTENANCE_STATUSES = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELED', label: 'Canceled' },
];

export const WEB_ASSET_ALERT_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export const WEB_ASSETS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
