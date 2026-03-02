import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import { Eye, GitCompare, History, Pencil, Plus, RefreshCw, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import {
  compareWebAssetVersions,
  createWebAssetAnalyticsEvent,
  createWebAssetAnalyticsSnapshot,
  createWebAssetMaintenance,
  createWebAssetVersion,
  createWebAsset,
  deleteWebAsset,
  getWebAsset,
  listWebAssetAlerts,
  listWebAssetAnalytics,
  listWebAssetAuditLogs,
  listWebAssetHealth,
  listWebAssetMaintenance,
  listWebAssetVersions,
  listWebAssets,
  lookupWebAssetClients,
  lookupWebAssetOwners,
  lookupWebAssetProjects,
  runWebAssetHealthCheck,
  rollbackWebAssetVersion,
  setWebAssetPublished,
  switchWebAssetDeployment,
  updateWebAssetAlert,
  updateWebAssetMaintenance,
  updateWebAsset,
} from '../../modules/web-assets/api/webAssetsApi';
import WebAssetsModuleGate from '../../modules/web-assets/ui/WebAssetsModuleGate';
import {
  WEB_ASSET_AUDIT_ACTION_OPTIONS,
  WEB_ASSET_ALERT_STATUSES,
  WEB_ASSET_DEPLOYMENT_ENVIRONMENTS,
  WEB_ASSET_MAINTENANCE_STATUSES,
  WEB_ASSETS_PAGE_SIZE_OPTIONS,
  WEB_ASSETS_PERMISSIONS,
  WEB_ASSET_STATUSES,
  WEB_ASSET_TYPES,
  WEB_ASSET_VERSION_STATUSES,
} from '../../modules/web-assets/ui/constants';
import {
  getWebAssetStatusOptions,
  isWebAssetStatusFieldDisabled,
} from '../../modules/web-assets/ui/permissions';
import '../../modules/web-assets/ui/web-assets-ui.css';
import 'react-toastify/dist/ReactToastify.css';
import { hasPermission } from '../../utils/workspaceAccess';

const EMPTY_FORM = {
  assetType: 'website',
  name: '',
  url: '',
  status: 'MAINTENANCE',
  deploymentEnvironment: 'DEVELOPMENT',
  version: '',
  clientId: '',
  projectId: '',
  ownerUserId: '',
  metadataText: '',
};

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const toIsoStringFromLocalInput = (value) => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
};

const getApiErrorMessage = (error, fallbackMessage) => {
  const status = Number(error?.status);
  if (status === 403) {
    return 'Non hai permessi';
  }
  if (status === 404) {
    return 'Risorsa non trovata';
  }
  if (status === 409) {
    return 'Conflitto: verifica URL o dati gia esistenti';
  }

  return error?.message || fallbackMessage;
};

const statusBadgeVariant = (status) => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'MAINTENANCE':
      return 'warning';
    case 'PAUSED':
      return 'secondary';
    case 'ARCHIVED':
      return 'dark';
    default:
      return 'secondary';
  }
};

const versionStatusBadgeVariant = (status) => {
  switch (status) {
    case 'LIVE':
      return 'success';
    case 'STAGED':
      return 'warning';
    default:
      return 'secondary';
  }
};

const toReleaseStageStatus = (assetStatus) => {
  switch (assetStatus) {
    case 'ACTIVE':
      return 'LIVE';
    case 'PAUSED':
      return 'STAGED';
    default:
      return 'DRAFT';
  }
};

const versionStatusLabelByValue = Object.fromEntries(
  WEB_ASSET_VERSION_STATUSES.map((entry) => [entry.value, entry.label]),
);

const auditActionLabelByValue = Object.fromEntries(
  WEB_ASSET_AUDIT_ACTION_OPTIONS
    .filter((entry) => entry.value)
    .map((entry) => [entry.value, entry.label]),
);

const typeLabelByValue = Object.fromEntries(
  WEB_ASSET_TYPES.map((entry) => [entry.value, entry.label]),
);
const statusLabelByValue = Object.fromEntries(
  WEB_ASSET_STATUSES.map((entry) => [entry.value, entry.label]),
);
const environmentLabelByValue = Object.fromEntries(
  WEB_ASSET_DEPLOYMENT_ENVIRONMENTS.map((entry) => [entry.value, entry.label]),
);
const maintenanceStatusLabelByValue = Object.fromEntries(
  WEB_ASSET_MAINTENANCE_STATUSES.map((entry) => [entry.value, entry.label]),
);
const alertStatusLabelByValue = Object.fromEntries(
  WEB_ASSET_ALERT_STATUSES.map((entry) => [entry.value, entry.label]),
);

const WebAssetsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [publishingId, setPublishingId] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(WEB_ASSETS_PAGE_SIZE_OPTIONS[1] || 20);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    pageSize: WEB_ASSETS_PAGE_SIZE_OPTIONS[1] || 20,
    totalItems: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  const [filters, setFilters] = useState({
    q: '',
    type: '',
    status: '',
    environment: '',
    clientId: '',
    projectId: '',
    ownerUserId: '',
  });
  const [draftSearch, setDraftSearch] = useState('');

  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState('');
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formMessage, setFormMessage] = useState('');

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [owners, setOwners] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState('');
  const [versionMessage, setVersionMessage] = useState('');
  const [versionSubmitting, setVersionSubmitting] = useState(false);
  const [rollbackingVersionId, setRollbackingVersionId] = useState('');
  const [versionForm, setVersionForm] = useState({
    versionNumber: '',
    versionStatus: 'DRAFT',
    changelog: '',
    releaseNotes: '',
  });

  const [compareSelection, setCompareSelection] = useState({
    leftVersionId: '',
    rightVersionId: '',
  });
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);

  const [auditItems, setAuditItems] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
  });
  const [auditPageInfo, setAuditPageInfo] = useState({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  const [deploymentSubmitting, setDeploymentSubmitting] = useState(false);
  const [deploymentForm, setDeploymentForm] = useState({
    environment: 'DEVELOPMENT',
    versionNumber: '',
    changelog: '',
    releaseNotes: '',
  });

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthData, setHealthData] = useState({ checks: [], summary: null, alerts: [] });
  const [healthMessage, setHealthMessage] = useState('');

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({ snapshots: [], events: [], summary: null, topEvents: [] });
  const [analyticsMessage, setAnalyticsMessage] = useState('');
  const [snapshotForm, setSnapshotForm] = useState({
    provider: 'manual',
    sourceLabel: '',
    periodStart: '',
    periodEnd: '',
    sessions: '0',
    users: '0',
    pageViews: '0',
    bounceRate: '',
    avgLoadTimeMs: '',
    uptimePercent: '',
    errorRate: '',
  });
  const [eventForm, setEventForm] = useState({
    eventName: '',
    eventLabel: '',
    count: '1',
  });

  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceForm, setMaintenanceForm] = useState({
    startsAt: '',
    endsAt: '',
    timezone: 'UTC',
    reason: '',
    notifyEmail: '',
    notifySms: '',
  });

  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsItems, setAlertsItems] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [detailSection, setDetailSection] = useState('overview');
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  const resetForm = useCallback(() => {
    setFormMode('create');
    setEditingId('');
    setFormState(EMPTY_FORM);
    setFormErrors({});
    setFormMessage('');
    setShowAssetForm(false);
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await listWebAssets({
        q: filters.q || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        environment: filters.environment || undefined,
        clientId: filters.clientId || undefined,
        projectId: filters.projectId || undefined,
        ownerUserId: filters.ownerUserId || undefined,
        page,
        pageSize,
      });

      setItems(Array.isArray(result?.items) ? result.items : []);
      setPageInfo(result?.pageInfo || {
        page,
        pageSize,
        totalItems: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      });
    } catch (loadError) {
      setItems([]);
      setError(getApiErrorMessage(loadError, 'Errore caricamento web assets'));
    } finally {
      setLoading(false);
    }
  }, [filters.clientId, filters.environment, filters.ownerUserId, filters.projectId, filters.q, filters.status, filters.type, page, pageSize]);

  const loadLookups = useCallback(async () => {
    setPickerLoading(true);

    try {
      const [clientsResult, projectsResult, ownersResult] = await Promise.all([
        lookupWebAssetClients({ limit: 50 }),
        lookupWebAssetProjects({ limit: 50 }),
        lookupWebAssetOwners({ limit: 50 }),
      ]);

      setClients(Array.isArray(clientsResult?.items) ? clientsResult.items : []);
      setProjects(Array.isArray(projectsResult?.items) ? projectsResult.items : []);
      setOwners(Array.isArray(ownersResult?.items) ? ownersResult.items : []);
    } catch (_error) {
      setClients([]);
      setProjects([]);
      setOwners([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (!selectedAsset?.id) {
      return;
    }

    const refreshed = items.find((item) => item.id === selectedAsset.id);
    if (refreshed) {
      setSelectedAsset(refreshed);
    }
  }, [items, selectedAsset]);

  useEffect(() => {
    if (!selectedAsset) {
      return;
    }

    setDeploymentForm((current) => ({
      ...current,
      environment: selectedAsset.deploymentEnvironment || 'DEVELOPMENT',
    }));
  }, [selectedAsset]);

  const loadVersions = useCallback(async (assetId) => {
    if (!assetId) {
      setVersions([]);
      setCompareSelection({ leftVersionId: '', rightVersionId: '' });
      setCompareResult(null);
      return;
    }

    setVersionsLoading(true);
    setVersionsError('');

    try {
      const result = await listWebAssetVersions(assetId, { limit: 50 });
      const itemsList = Array.isArray(result?.items) ? result.items : [];
      setVersions(itemsList);

      if (itemsList.length > 1) {
        setCompareSelection({
          leftVersionId: itemsList[0].id,
          rightVersionId: itemsList[1].id,
        });
      } else {
        setCompareSelection({ leftVersionId: '', rightVersionId: '' });
      }
    } catch (loadError) {
      setVersions([]);
      setVersionsError(getApiErrorMessage(loadError, 'Errore caricamento versioni'));
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async (assetId) => {
    if (!assetId) {
      setHealthData({ checks: [], summary: null, alerts: [] });
      return;
    }

    setHealthLoading(true);
    try {
      const result = await listWebAssetHealth(assetId, { limit: 30 });
      setHealthData({
        checks: Array.isArray(result?.checks) ? result.checks : [],
        summary: result?.summary || null,
        alerts: Array.isArray(result?.alerts) ? result.alerts : [],
      });
    } catch (_error) {
      setHealthData({ checks: [], summary: null, alerts: [] });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (assetId) => {
    if (!assetId) {
      setAnalyticsData({ snapshots: [], events: [], summary: null, topEvents: [] });
      return;
    }

    setAnalyticsLoading(true);
    try {
      const result = await listWebAssetAnalytics(assetId, {
        snapshotsLimit: 30,
        eventsLimit: 200,
      });
      setAnalyticsData({
        snapshots: Array.isArray(result?.snapshots) ? result.snapshots : [],
        events: Array.isArray(result?.events) ? result.events : [],
        summary: result?.summary || null,
        topEvents: Array.isArray(result?.topEvents) ? result.topEvents : [],
      });
    } catch (_error) {
      setAnalyticsData({ snapshots: [], events: [], summary: null, topEvents: [] });
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadMaintenance = useCallback(async (assetId) => {
    if (!assetId) {
      setMaintenanceItems([]);
      return;
    }

    setMaintenanceLoading(true);
    try {
      const result = await listWebAssetMaintenance(assetId, { limit: 30 });
      setMaintenanceItems(Array.isArray(result?.items) ? result.items : []);
    } catch (_error) {
      setMaintenanceItems([]);
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async (assetId) => {
    if (!assetId) {
      setAlertsItems([]);
      return;
    }

    setAlertsLoading(true);
    try {
      const result = await listWebAssetAlerts(assetId, { limit: 100 });
      setAlertsItems(Array.isArray(result?.items) ? result.items : []);
    } catch (_error) {
      setAlertsItems([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const loadAssetDeepData = useCallback(async (assetId) => {
    await Promise.all([
      loadVersions(assetId),
      loadHealth(assetId),
      loadAnalytics(assetId),
      loadMaintenance(assetId),
      loadAlerts(assetId),
    ]);
  }, [loadAlerts, loadAnalytics, loadHealth, loadMaintenance, loadVersions]);

  const loadAudit = useCallback(async (overrides = {}) => {
    const nextPage = overrides.page || auditPage;
    const nextAction = overrides.action !== undefined ? overrides.action : auditFilters.action;
    setAuditLoading(true);
    setAuditError('');

    try {
      const result = await listWebAssetAuditLogs({
        page: nextPage,
        pageSize: auditPageInfo.pageSize || 10,
        action: nextAction || undefined,
        assetId: selectedAsset?.id || undefined,
      });

      setAuditItems(Array.isArray(result?.items) ? result.items : []);
      setAuditPage(nextPage);
      setAuditFilters((current) => ({
        ...current,
        action: nextAction,
      }));
      setAuditPageInfo(result?.pageInfo || {
        page: nextPage,
        pageSize: auditPageInfo.pageSize || 10,
        totalItems: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      });
    } catch (loadError) {
      setAuditItems([]);
      setAuditError(getApiErrorMessage(loadError, 'Errore caricamento audit log'));
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters.action, auditPage, auditPageInfo.pageSize, selectedAsset?.id]);

  const selectedProjectOptions = useMemo(() => {
    if (!formState.clientId) {
      return projects;
    }

    return projects.filter((project) =>
      !project.clientId || project.clientId === formState.clientId);
  }, [projects, formState.clientId]);

  const filterProjectOptions = useMemo(() => {
    if (!filters.clientId) {
      return projects;
    }

    return projects.filter((project) =>
      !project.clientId || project.clientId === filters.clientId);
  }, [projects, filters.clientId]);

  const setField = (field) => (event) => {
    const value = event?.target?.value ?? '';
    setFormState((current) => ({
      ...current,
      [field]: value,
      ...(field === 'clientId' ? { projectId: '' } : {}),
    }));

    setFormErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formState.name.trim()) {
      nextErrors.name = 'Nome obbligatorio';
    }

    const urlValue = formState.url.trim();
    if (!urlValue) {
      nextErrors.url = 'URL obbligatorio';
    } else {
      try {
        // eslint-disable-next-line no-new
        new URL(urlValue);
      } catch (_error) {
        nextErrors.url = 'URL non valido';
      }
    }

    const metadataValue = formState.metadataText.trim();
    if (metadataValue) {
      try {
        JSON.parse(metadataValue);
      } catch (_error) {
        nextErrors.metadataText = 'Metadata deve essere un JSON valido';
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = () => {
    const metadataValue = formState.metadataText.trim();
    const metadata = metadataValue ? JSON.parse(metadataValue) : null;

    const basePayload = {
      name: formState.name.trim(),
      url: formState.url.trim(),
      status: formState.status || 'ACTIVE',
      deploymentEnvironment: formState.deploymentEnvironment || 'DEVELOPMENT',
      version: formState.version.trim() || null,
      clientId: formState.clientId || null,
      projectId: formState.projectId || null,
      ownerUserId: formState.ownerUserId.trim() || null,
      metadata,
    };

    if (formMode === 'create') {
      return {
        ...basePayload,
        assetType: formState.assetType,
      };
    }

    return basePayload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setFormMessage('');

    try {
      const payload = buildPayload();
      const successMessage = formMode === 'edit'
        ? 'Asset aggiornato con successo.'
        : 'Asset creato con successo.';
      const updatedAssetId = formMode === 'edit' ? editingId : '';

      if (formMode === 'edit' && editingId) {
        await updateWebAsset(editingId, payload);
      } else {
        await createWebAsset(payload);
      }

      resetForm();
      setFormMessage(successMessage);
      toast.success(successMessage);
      await loadAssets();
      if (updatedAssetId) {
        await loadAssetDeepData(updatedAssetId);
      }
    } catch (submitError) {
      const message = getApiErrorMessage(submitError, 'Operazione non riuscita');
      setFormMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item) => {
    setFormMode('edit');
    setEditingId(item.id);
    setSelectedAsset(item);
    setShowAssetForm(true);
    setDetailSection('overview');
    void loadAssetDeepData(item.id);
    setCompareResult(null);
    setVersionMessage('');
    setFormErrors({});
    setFormMessage('');
    setFormState({
      assetType: item.assetType,
      name: item.name || '',
      url: item.url || '',
      status: item.status || 'ACTIVE',
      deploymentEnvironment: item.deploymentEnvironment || 'DEVELOPMENT',
      version: item.version || '',
      clientId: item.clientId || '',
      projectId: item.projectId || '',
      ownerUserId: item.ownerUserId || '',
      metadataText: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
    });
  };

  const handleViewAsset = async (item) => {
    setSelectedAsset(item);
    setDetailSection('overview');
    setVersionMessage('');
    setCompareResult(null);
    try {
      const detail = await getWebAsset(item.id);
      setSelectedAsset(detail?.asset || item);
    } catch (_error) {
      setSelectedAsset(item);
    }

    await loadAssetDeepData(item.id);
  };

  const handleDelete = async (itemId) => {
    const confirmed = window.confirm('Eliminare questo web asset? L\'operazione non può essere annullata.');
    if (!confirmed) {
      return;
    }

    setDeletingId(itemId);
    setError('');

    try {
      await deleteWebAsset(itemId);
      if (editingId === itemId) {
        resetForm();
      }
      if (selectedAsset?.id === itemId) {
        setSelectedAsset(null);
        setVersions([]);
        setCompareSelection({ leftVersionId: '', rightVersionId: '' });
        setCompareResult(null);
      }
      await loadAssets();
      toast.success('Asset eliminato.');
    } catch (deleteError) {
      const message = getApiErrorMessage(deleteError, 'Impossibile eliminare asset');
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId('');
    }
  };

  const handlePublishToggle = async (item, nextPublished) => {
    const warningMessage = nextPublished
      ? 'Confermi la pubblicazione dell\'asset in ambiente live?'
      : 'Confermi l\'unpublish? L\'asset verrà rimosso dallo stato live.';
    const confirmed = window.confirm(warningMessage);
    if (!confirmed) {
      return;
    }

    setPublishingId(item.id);
    setError('');

    try {
      await setWebAssetPublished(item.id, nextPublished);
      await loadAssets();
      if (selectedAsset?.id === item.id) {
        await loadAssetDeepData(item.id);
      }
      toast.success(nextPublished ? 'Asset pubblicato.' : 'Asset rimosso dalla pubblicazione.');
    } catch (publishError) {
      const message = getApiErrorMessage(publishError, 'Impossibile aggiornare stato pubblicazione');
      setError(message);
      toast.error(message);
    } finally {
      setPublishingId('');
    }
  };

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({
      ...current,
      q: draftSearch.trim(),
    }));
  };

  const applyQuickFilter = (field, value) => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [field]: value || '',
    }));
  };

  const handleCreateVersion = async (event) => {
    event.preventDefault();
    if (!selectedAsset?.id) {
      return;
    }

    setVersionSubmitting(true);
    setVersionMessage('');

    try {
      const payload = {
        versionNumber: versionForm.versionNumber.trim() || null,
        versionStatus: versionForm.versionStatus,
        changelog: versionForm.changelog.trim() || null,
        releaseNotes: versionForm.releaseNotes.trim() || null,
      };

      await createWebAssetVersion(selectedAsset.id, payload);
      setVersionMessage('Versione salvata.');
      toast.success('Versione salvata.');
      setVersionForm((current) => ({ ...current, changelog: '', releaseNotes: '' }));
      await loadVersions(selectedAsset.id);
      await loadAssets();
    } catch (versionError) {
      const message = getApiErrorMessage(versionError, 'Impossibile creare versione');
      setVersionMessage(message);
      toast.error(message);
    } finally {
      setVersionSubmitting(false);
    }
  };

  const handleCompareVersions = async () => {
    if (!selectedAsset?.id || !compareSelection.leftVersionId || !compareSelection.rightVersionId) {
      return;
    }

    setCompareLoading(true);
    setCompareResult(null);

    try {
      const result = await compareWebAssetVersions(selectedAsset.id, compareSelection);
      setCompareResult(result || null);
    } catch (compareError) {
      setVersionsError(getApiErrorMessage(compareError, 'Impossibile confrontare versioni'));
    } finally {
      setCompareLoading(false);
    }
  };

  const handleRollbackVersion = async (versionId) => {
    if (!selectedAsset?.id || !versionId) {
      return;
    }

    const confirmed = window.confirm('Ripristinare questa versione? Verrà creata una nuova revisione di rollback.');
    if (!confirmed) {
      return;
    }

    setRollbackingVersionId(versionId);
    setVersionMessage('');
    setVersionsError('');

    try {
      const result = await rollbackWebAssetVersion(selectedAsset.id, versionId);
      if (result?.asset) {
        setSelectedAsset(result.asset);
      }
      setVersionMessage('Rollback completato.');
      toast.success('Rollback completato.');
      await loadAssets();
      await loadAssetDeepData(selectedAsset.id);
    } catch (rollbackError) {
      const message = getApiErrorMessage(rollbackError, 'Rollback non riuscito');
      setVersionsError(message);
      toast.error(message);
    } finally {
      setRollbackingVersionId('');
    }
  };

  const handleSwitchDeployment = async () => {
    if (!selectedAsset?.id) {
      return;
    }

    setDeploymentSubmitting(true);
    setFormMessage('');
    try {
      await switchWebAssetDeployment(selectedAsset.id, {
        environment: deploymentForm.environment,
        versionNumber: deploymentForm.versionNumber.trim() || null,
        changelog: deploymentForm.changelog.trim() || null,
        releaseNotes: deploymentForm.releaseNotes.trim() || null,
      });
      setFormMessage('Deployment environment aggiornato.');
      await loadAssets();
      await loadAssetDeepData(selectedAsset.id);
    } catch (switchError) {
      setFormMessage(getApiErrorMessage(switchError, 'Impossibile aggiornare deployment'));
    } finally {
      setDeploymentSubmitting(false);
    }
  };

  const handleRunHealthCheck = async () => {
    if (!selectedAsset?.id) {
      return;
    }

    setHealthMessage('');
    setHealthLoading(true);
    try {
      await runWebAssetHealthCheck(selectedAsset.id);
      setHealthMessage('Health check completato.');
      await Promise.all([loadHealth(selectedAsset.id), loadAlerts(selectedAsset.id)]);
    } catch (checkError) {
      setHealthMessage(getApiErrorMessage(checkError, 'Health check non riuscito'));
    } finally {
      setHealthLoading(false);
    }
  };

  const handleCreateAnalyticsSnapshot = async (event) => {
    event.preventDefault();
    if (!selectedAsset?.id) {
      return;
    }

    setAnalyticsMessage('');
    try {
      await createWebAssetAnalyticsSnapshot(selectedAsset.id, {
        provider: snapshotForm.provider.trim() || 'manual',
        sourceLabel: snapshotForm.sourceLabel.trim() || null,
        periodStart: toIsoStringFromLocalInput(snapshotForm.periodStart),
        periodEnd: toIsoStringFromLocalInput(snapshotForm.periodEnd),
        sessions: Number(snapshotForm.sessions || 0),
        users: Number(snapshotForm.users || 0),
        pageViews: Number(snapshotForm.pageViews || 0),
        bounceRate: snapshotForm.bounceRate ? Number(snapshotForm.bounceRate) : null,
        avgLoadTimeMs: snapshotForm.avgLoadTimeMs ? Number(snapshotForm.avgLoadTimeMs) : null,
        uptimePercent: snapshotForm.uptimePercent ? Number(snapshotForm.uptimePercent) : null,
        errorRate: snapshotForm.errorRate ? Number(snapshotForm.errorRate) : null,
      });
      setAnalyticsMessage('Snapshot analytics salvata.');
      await loadAnalytics(selectedAsset.id);
    } catch (snapshotError) {
      setAnalyticsMessage(getApiErrorMessage(snapshotError, 'Salvataggio snapshot non riuscito'));
    }
  };

  const handleCreateAnalyticsEvent = async (event) => {
    event.preventDefault();
    if (!selectedAsset?.id) {
      return;
    }

    setAnalyticsMessage('');
    try {
      await createWebAssetAnalyticsEvent(selectedAsset.id, {
        eventName: eventForm.eventName.trim(),
        eventLabel: eventForm.eventLabel.trim() || null,
        count: Number(eventForm.count || 1),
      });
      setEventForm((current) => ({
        ...current,
        eventName: '',
        eventLabel: '',
        count: '1',
      }));
      setAnalyticsMessage('Evento analytics registrato.');
      await loadAnalytics(selectedAsset.id);
    } catch (eventError) {
      setAnalyticsMessage(getApiErrorMessage(eventError, 'Evento analytics non registrato'));
    }
  };

  const handleCreateMaintenance = async (event) => {
    event.preventDefault();
    if (!selectedAsset?.id) {
      return;
    }

    setMaintenanceMessage('');
    try {
      await createWebAssetMaintenance(selectedAsset.id, {
        startsAt: toIsoStringFromLocalInput(maintenanceForm.startsAt),
        endsAt: toIsoStringFromLocalInput(maintenanceForm.endsAt),
        timezone: maintenanceForm.timezone.trim() || null,
        reason: maintenanceForm.reason.trim() || null,
        notifyEmail: maintenanceForm.notifyEmail.trim() || null,
        notifySms: maintenanceForm.notifySms.trim() || null,
      });
      setMaintenanceMessage('Maintenance window creata.');
      await Promise.all([loadMaintenance(selectedAsset.id), loadAlerts(selectedAsset.id)]);
    } catch (maintenanceError) {
      setMaintenanceMessage(getApiErrorMessage(maintenanceError, 'Creazione maintenance non riuscita'));
    }
  };

  const handleUpdateMaintenanceStatus = async (maintenanceId, status) => {
    if (!selectedAsset?.id) {
      return;
    }

    setMaintenanceMessage('');
    try {
      await updateWebAssetMaintenance(selectedAsset.id, maintenanceId, { status });
      await loadMaintenance(selectedAsset.id);
    } catch (maintenanceError) {
      setMaintenanceMessage(getApiErrorMessage(maintenanceError, 'Aggiornamento maintenance non riuscito'));
    }
  };

  const handleUpdateAlertStatus = async (alertId, status) => {
    if (!selectedAsset?.id) {
      return;
    }

    try {
      await updateWebAssetAlert(selectedAsset.id, alertId, { status });
      await loadAlerts(selectedAsset.id);
    } catch (_error) {
      // no-op
    }
  };

  return (
    <WebAssetsModuleGate requiredPermission={WEB_ASSETS_PERMISSIONS.view}>
      {({ access }) => {
        const canCreate = hasPermission(access, WEB_ASSETS_PERMISSIONS.create);
        const canEdit = hasPermission(access, WEB_ASSETS_PERMISSIONS.edit);
        const canDelete = hasPermission(access, WEB_ASSETS_PERMISSIONS.delete);
        const canPublish = hasPermission(access, WEB_ASSETS_PERMISSIONS.publish);
        const canAuditView = hasPermission(access, 'audit.view');
        const statusSelectDisabled = isWebAssetStatusFieldDisabled({
          submitting,
          canPublish,
          formMode,
          currentStatus: formState.status,
        });

        const statusOptions = getWebAssetStatusOptions({
          statuses: WEB_ASSET_STATUSES,
          canPublish,
          currentStatus: formState.status,
        });

        return (
          <div className="container-fluid web-assets-page">
            <div className="pt-3">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
                <div>
                  <h3 className="mb-1">Web Asset Management</h3>
                  <p className="text-muted mb-0">Gestisci Website, Web App ed Ecommerce collegati al CRM.</p>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => void loadAssets()}
                    disabled={loading}
                  >
                    <RefreshCw size={14} className="me-1" />
                    Aggiorna
                  </Button>
                  {canCreate && (
                    <Button
                      type="button"
                      onClick={() => {
                        if (showAssetForm && formMode === 'create') {
                          setShowAssetForm(false);
                          return;
                        }

                        setFormMode('create');
                        setEditingId('');
                        setFormState(EMPTY_FORM);
                        setFormErrors({});
                        setFormMessage('');
                        setShowAssetForm(true);
                      }}
                    >
                      <Plus size={14} className="me-1" />
                      {showAssetForm && formMode === 'create' ? 'Chiudi form' : 'Nuovo asset'}
                    </Button>
                  )}
                </div>
              </div>

              <Card className="card-border mb-3">
                <Card.Body>
                  <Form onSubmit={applySearch}>
                    <div className="web-assets-filters">
                      <Form.Group>
                        <Form.Label className="small">Ricerca</Form.Label>
                        <Form.Control
                          value={draftSearch}
                          onChange={(event) => setDraftSearch(event.target.value)}
                          placeholder="Nome, URL o ID"
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="small">Tipo</Form.Label>
                        <Form.Select
                          value={filters.type}
                          onChange={(event) => {
                            setPage(1);
                            setFilters((current) => ({ ...current, type: event.target.value }));
                          }}
                        >
                          <option value="">Tutti</option>
                          {WEB_ASSET_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="small">Stato</Form.Label>
                        <Form.Select
                          value={filters.status}
                          onChange={(event) => {
                            setPage(1);
                            setFilters((current) => ({ ...current, status: event.target.value }));
                          }}
                        >
                          <option value="">Tutti</option>
                          {WEB_ASSET_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>

                      <div className="d-flex align-items-end gap-2">
                        <Button type="submit" className="w-100">
                          Cerca
                        </Button>
                        <Button
                          type="button"
                          variant="outline-secondary"
                          className="w-100"
                          onClick={() => {
                            setPage(1);
                            setDraftSearch('');
                            setFilters({
                              q: '',
                              type: '',
                              status: '',
                              environment: '',
                              clientId: '',
                              projectId: '',
                              ownerUserId: '',
                            });
                          }}
                        >
                          Reset
                        </Button>
                      </div>

                      <div className="d-flex align-items-end">
                        <Button
                          type="button"
                          variant="link"
                          className="text-decoration-none px-0"
                          onClick={() => setShowAdvancedFilters((current) => !current)}
                        >
                          {showAdvancedFilters ? 'Nascondi filtri avanzati' : 'Mostra filtri avanzati'}
                        </Button>
                      </div>

                      {showAdvancedFilters && (
                        <>
                          <Form.Group>
                            <Form.Label className="small">Environment</Form.Label>
                            <Form.Select
                              value={filters.environment}
                              onChange={(event) => {
                                setPage(1);
                                setFilters((current) => ({ ...current, environment: event.target.value }));
                              }}
                            >
                              <option value="">Tutti</option>
                              {WEB_ASSET_DEPLOYMENT_ENVIRONMENTS.map((environment) => (
                                <option key={environment.value} value={environment.value}>{environment.label}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group>
                            <Form.Label className="small">Cliente</Form.Label>
                            <Form.Select
                              value={filters.clientId}
                              onChange={(event) => {
                                setPage(1);
                                setFilters((current) => ({
                                  ...current,
                                  clientId: event.target.value,
                                  projectId: '',
                                }));
                              }}
                            >
                              <option value="">Tutti i clienti</option>
                              {clients.map((client) => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group>
                            <Form.Label className="small">Progetto</Form.Label>
                            <Form.Select
                              value={filters.projectId}
                              onChange={(event) => {
                                setPage(1);
                                setFilters((current) => ({ ...current, projectId: event.target.value }));
                              }}
                            >
                              <option value="">Tutti i progetti</option>
                              {filterProjectOptions.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group>
                            <Form.Label className="small">Owner</Form.Label>
                            <Form.Select
                              value={filters.ownerUserId}
                              onChange={(event) => {
                                setPage(1);
                                setFilters((current) => ({ ...current, ownerUserId: event.target.value }));
                              }}
                            >
                              <option value="">Tutti gli owner</option>
                              {owners.map((owner) => (
                                <option key={owner.id} value={owner.id}>
                                  {owner.name}
                                  {owner.email ? ` (${owner.email})` : ''}
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group>
                            <Form.Label className="small">Righe pagina</Form.Label>
                            <Form.Select
                              value={pageSize}
                              onChange={(event) => {
                                const nextPageSize = Number(event.target.value) || 20;
                                setPage(1);
                                setPageSize(nextPageSize);
                              }}
                            >
                              {WEB_ASSETS_PAGE_SIZE_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </>
                      )}
                    </div>
                  </Form>
                </Card.Body>
              </Card>

              {(canCreate || (canEdit && formMode === 'edit')) && showAssetForm && (
                <Card className="card-border mb-3">
                  <Card.Header className="bg-transparent border-0 pb-0">
                    <h5 className="mb-1">
                      {formMode === 'edit' ? 'Modifica asset' : 'Nuovo asset'}
                    </h5>
                    <p className="text-muted mb-0 small">
                      Campi principali: URL, stato, versione, metadati, collegamenti client/progetto.
                    </p>
                  </Card.Header>
                  <Card.Body>
                    {formMessage && (
                      <Alert variant={formMessage.includes('successo') ? 'success' : 'danger'} className="py-2">
                        {formMessage}
                      </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                      <div className="web-assets-form-grid mb-3">
                        <Form.Group>
                          <Form.Label>Tipo</Form.Label>
                          <Form.Select
                            value={formState.assetType}
                            onChange={setField('assetType')}
                            disabled={formMode === 'edit' || submitting}
                          >
                            {WEB_ASSET_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>Nome</Form.Label>
                          <Form.Control
                            value={formState.name}
                            onChange={setField('name')}
                            isInvalid={Boolean(formErrors.name)}
                            disabled={submitting}
                          />
                          <Form.Control.Feedback type="invalid">
                            {formErrors.name}
                          </Form.Control.Feedback>
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>URL</Form.Label>
                          <Form.Control
                            value={formState.url}
                            onChange={setField('url')}
                            isInvalid={Boolean(formErrors.url)}
                            placeholder="https://..."
                            disabled={submitting}
                          />
                          <Form.Control.Feedback type="invalid">
                            {formErrors.url}
                          </Form.Control.Feedback>
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>Stato</Form.Label>
                          <Form.Select
                            value={formState.status}
                            onChange={setField('status')}
                            disabled={statusSelectDisabled}
                          >
                            {statusOptions.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </Form.Select>
                          {!canPublish && (
                            <Form.Text className="text-muted">
                              Gli stati Publish/Unpublish richiedono il permesso web.publish.
                            </Form.Text>
                          )}
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>Deployment</Form.Label>
                          <Form.Select
                            value={formState.deploymentEnvironment}
                            onChange={setField('deploymentEnvironment')}
                            disabled={submitting}
                          >
                            {WEB_ASSET_DEPLOYMENT_ENVIRONMENTS.map((environment) => (
                              <option key={environment.value} value={environment.value}>{environment.label}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>Versione</Form.Label>
                          <Form.Control
                            value={formState.version}
                            onChange={setField('version')}
                            placeholder="v1.0.0"
                            disabled={submitting}
                          />
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>Owner (userId)</Form.Label>
                          <Form.Control
                            value={formState.ownerUserId}
                            onChange={setField('ownerUserId')}
                            placeholder="vuoto = utente corrente"
                            disabled={submitting}
                          />
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>Cliente</Form.Label>
                          <Form.Select
                            value={formState.clientId}
                            onChange={setField('clientId')}
                            disabled={submitting || pickerLoading}
                          >
                            <option value="">Nessuno</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                                {client.email ? ` (${client.email})` : ''}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>

                        <Form.Group>
                          <Form.Label>Progetto</Form.Label>
                          <Form.Select
                            value={formState.projectId}
                            onChange={setField('projectId')}
                            disabled={submitting || pickerLoading}
                          >
                            <option value="">Nessuno</option>
                            {selectedProjectOptions.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                                {project.clientName ? ` (${project.clientName})` : ''}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </div>

                      <Form.Group className="mb-3">
                        <Form.Label>Metadata (JSON)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={5}
                          value={formState.metadataText}
                          onChange={setField('metadataText')}
                          isInvalid={Boolean(formErrors.metadataText)}
                          placeholder='Esempio: {"framework":"nextjs","hosting":"vercel"}'
                          disabled={submitting}
                        />
                        <Form.Control.Feedback type="invalid">
                          {formErrors.metadataText}
                        </Form.Control.Feedback>
                      </Form.Group>

                      <div className="d-flex gap-2">
                        <Button type="submit" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Salvataggio...
                            </>
                          ) : (
                            <>
                              <Save size={14} className="me-1" />
                              {formMode === 'edit' ? 'Aggiorna asset' : 'Crea asset'}
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline-secondary"
                          onClick={resetForm}
                          disabled={submitting}
                        >
                          <X size={14} className="me-1" />
                          Annulla
                        </Button>
                      </div>
                    </Form>
                  </Card.Body>
                </Card>
              )}

              {error && <Alert variant="danger">{error}</Alert>}

              <Card className="card-border">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                    <div className="small text-muted">
                      Totale asset: {pageInfo.totalItems}
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        type="button"
                        variant="outline-secondary"
                        size="sm"
                        disabled={loading || !pageInfo.hasPrevPage}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                      >
                        Precedente
                      </Button>
                      <Button
                        type="button"
                        variant="outline-secondary"
                        size="sm"
                        disabled={loading || !pageInfo.hasNextPage}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        Successiva
                      </Button>
                    </div>
                  </div>

                  <Table responsive hover className="web-assets-table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Tipo</th>
                        <th>URL</th>
                        <th>Stato</th>
                        <th>Environment</th>
                        <th>Versione</th>
                        <th>Cliente</th>
                        <th>Progetto</th>
                        <th>Owner</th>
                        <th>Aggiornato</th>
                        <th className="text-end">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={11} className="text-center py-4 text-muted">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Caricamento asset...
                          </td>
                        </tr>
                      )}

                      {!loading && items.length === 0 && (
                        <tr>
                          <td colSpan={11} className="text-center py-4 text-muted">
                            Nessun web asset trovato.
                          </td>
                        </tr>
                      )}

                      {!loading && items.map((item) => (
                        <tr
                          key={item.id}
                          className={selectedAsset?.id === item.id ? 'web-assets-row-selected' : ''}
                        >
                          <td>
                            <div className="fw-semibold">{item.name}</div>
                            <div className="small text-muted">{item.id.slice(0, 8).toUpperCase()}</div>
                          </td>
                          <td>{typeLabelByValue[item.assetType] || item.assetType}</td>
                          <td>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="web-assets-url d-inline-block"
                              title={item.url}
                            >
                              {item.url}
                            </a>
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1">
                              <Badge bg={statusBadgeVariant(item.status)}>
                                {statusLabelByValue[item.status] || item.status}
                              </Badge>
                              <Badge bg={versionStatusBadgeVariant(toReleaseStageStatus(item.status))}>
                                {versionStatusLabelByValue[toReleaseStageStatus(item.status)] || toReleaseStageStatus(item.status)}
                              </Badge>
                            </div>
                          </td>
                          <td className="small">{environmentLabelByValue[item.deploymentEnvironment] || item.deploymentEnvironment}</td>
                          <td>{item.version || '-'}</td>
                          <td>
                            {item.clientId && item.clientName ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 text-decoration-none"
                                onClick={() => applyQuickFilter('clientId', item.clientId)}
                              >
                                {item.clientName}
                              </Button>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>
                            {item.projectId && item.projectName ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 text-decoration-none"
                                onClick={() => applyQuickFilter('projectId', item.projectId)}
                              >
                                {item.projectName}
                              </Button>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{item.ownerName || item.ownerEmail || '-'}</td>
                          <td>{formatDateTime(item.updatedAt)}</td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => void handleViewAsset(item)}
                              >
                                <Eye size={14} className="me-1" />
                                View
                              </Button>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => handleStartEdit(item)}
                                >
                                  <Pencil size={14} className="me-1" />
                                  Modifica
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => void handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                >
                                  <Trash2 size={14} className="me-1" />
                                  {deletingId === item.id ? 'Elimino...' : 'Elimina'}
                                </Button>
                              )}
                              {canPublish && item.status === 'ACTIVE' && (
                                <Button
                                  size="sm"
                                  variant="outline-warning"
                                  onClick={() => void handlePublishToggle(item, false)}
                                  disabled={publishingId === item.id}
                                >
                                  {publishingId === item.id ? 'Aggiorno...' : 'Unpublish'}
                                </Button>
                              )}
                              {canPublish && item.status === 'PAUSED' && (
                                <Button
                                  size="sm"
                                  variant="outline-success"
                                  onClick={() => void handlePublishToggle(item, true)}
                                  disabled={publishingId === item.id}
                                >
                                  {publishingId === item.id ? 'Aggiorno...' : 'Publish'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  <Row className="align-items-center">
                    <Col className="small text-muted">
                      Pagina {pageInfo.page} di {pageInfo.totalPages}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {selectedAsset && (
                <Card className="card-border mt-3">
                  <Card.Body className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                    <div>
                      <div className="small text-muted mb-1">Asset selezionato</div>
                      <h5 className="mb-1">{selectedAsset.name}</h5>
                      <div className="small text-muted">
                        {typeLabelByValue[selectedAsset.assetType] || selectedAsset.assetType}
                        {' · '}
                        ultimo aggiornamento {formatDateTime(selectedAsset.updatedAt)}
                      </div>
                      <div className="d-flex gap-2 flex-wrap mt-2">
                        <Badge bg={statusBadgeVariant(selectedAsset.status)}>
                          {statusLabelByValue[selectedAsset.status] || selectedAsset.status}
                        </Badge>
                        <Badge bg={versionStatusBadgeVariant(toReleaseStageStatus(selectedAsset.status))}>
                          {versionStatusLabelByValue[toReleaseStageStatus(selectedAsset.status)] || toReleaseStageStatus(selectedAsset.status)}
                        </Badge>
                        <Badge bg="info">
                          {environmentLabelByValue[selectedAsset.deploymentEnvironment] || selectedAsset.deploymentEnvironment}
                        </Badge>
                      </div>
                    </div>
                    <div className="web-assets-detail-nav">
                      <Button
                        size="sm"
                        variant={detailSection === 'overview' ? 'primary' : 'outline-secondary'}
                        onClick={() => setDetailSection('overview')}
                      >
                        Panoramica
                      </Button>
                      <Button
                        size="sm"
                        variant={detailSection === 'versions' ? 'primary' : 'outline-secondary'}
                        onClick={() => setDetailSection('versions')}
                      >
                        Versioni
                      </Button>
                      <Button
                        size="sm"
                        variant={detailSection === 'monitoring' ? 'primary' : 'outline-secondary'}
                        onClick={() => setDetailSection('monitoring')}
                      >
                        Monitoring
                      </Button>
                      <Button
                        size="sm"
                        variant={detailSection === 'analytics' ? 'primary' : 'outline-secondary'}
                        onClick={() => setDetailSection('analytics')}
                      >
                        Analytics
                      </Button>
                      <Button
                        size="sm"
                        variant={detailSection === 'maintenance' ? 'primary' : 'outline-secondary'}
                        onClick={() => setDetailSection('maintenance')}
                      >
                        Maintenance
                      </Button>
                      {canAuditView && (
                        <Button
                          size="sm"
                          variant={showAuditPanel ? 'primary' : 'outline-secondary'}
                          onClick={() => setShowAuditPanel((current) => !current)}
                        >
                          Audit
                        </Button>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              )}

              {selectedAsset && detailSection === 'overview' && (
                <Card className="card-border mt-3">
                  <Card.Body>
                    <Row className="g-3">
                      <Col md={4}>
                        <Card>
                          <Card.Body>
                            <div className="small text-muted">Versioni totali</div>
                            <h4 className="mb-0">{versions.length}</h4>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col md={6}>
                        <Card>
                          <Card.Body>
                            <div className="small text-muted">Uptime</div>
                            <h4 className="mb-0">{healthData?.summary?.uptimePercent ?? 0}%</h4>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                    <div className="small text-muted mt-3">
                      Usa i pulsanti sopra per entrare nelle sezioni operative.
                    </div>
                  </Card.Body>
                </Card>
              )}

              {selectedAsset && detailSection === 'versions' && (
                <Card className="card-border mt-3">
                  <Card.Header className="bg-transparent border-0 pb-0 d-flex justify-content-between align-items-start gap-2 flex-wrap">
                    <div>
                      <h5 className="mb-1 d-flex align-items-center gap-2">
                        <History size={16} />
                        Version History
                      </h5>
                      <p className="small text-muted mb-0">
                        {selectedAsset.name} ({selectedAsset.assetType})
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => void loadVersions(selectedAsset.id)}
                      disabled={versionsLoading}
                    >
                      <RefreshCw size={14} className="me-1" />
                      Aggiorna versioni
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    {versionMessage && (
                      <Alert variant={versionMessage.includes('non') ? 'danger' : 'success'} className="py-2">
                        {versionMessage}
                      </Alert>
                    )}
                    {versionsError && (
                      <Alert variant="danger" className="py-2">
                        {versionsError}
                      </Alert>
                    )}

                    {canEdit && (
                      <Form className="mb-3" onSubmit={handleCreateVersion}>
                        <Row className="g-2">
                          <Col md={3}>
                            <Form.Label className="small">Versione</Form.Label>
                            <Form.Control
                              value={versionForm.versionNumber}
                              onChange={(event) => setVersionForm((current) => ({
                                ...current,
                                versionNumber: event.target.value,
                              }))}
                              placeholder="v1.2.0"
                              disabled={versionSubmitting}
                            />
                          </Col>
                          <Col md={3}>
                            <Form.Label className="small">Stato versione</Form.Label>
                            <Form.Select
                              value={versionForm.versionStatus}
                              onChange={(event) => setVersionForm((current) => ({
                                ...current,
                                versionStatus: event.target.value,
                              }))}
                              disabled={versionSubmitting}
                            >
                              {WEB_ASSET_VERSION_STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={4}>
                            <Form.Label className="small">Changelog</Form.Label>
                            <Form.Control
                              value={versionForm.changelog}
                              onChange={(event) => setVersionForm((current) => ({
                                ...current,
                                changelog: event.target.value,
                              }))}
                              placeholder="Es: aggiornato layout homepage"
                              disabled={versionSubmitting}
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Label className="small">Release Notes</Form.Label>
                            <Form.Control
                              value={versionForm.releaseNotes || ''}
                              onChange={(event) => setVersionForm((current) => ({
                                ...current,
                                releaseNotes: event.target.value,
                              }))}
                              placeholder="Note rilascio"
                              disabled={versionSubmitting}
                            />
                          </Col>
                          <Col md={12} className="d-flex align-items-end justify-content-end">
                            <Button type="submit" className="w-100" disabled={versionSubmitting}>
                              {versionSubmitting ? 'Salvo...' : 'Salva versione'}
                            </Button>
                          </Col>
                        </Row>
                      </Form>
                    )}

                    <div className="d-flex gap-2 align-items-end flex-wrap mb-3">
                      <Form.Group>
                        <Form.Label className="small">Confronta sinistra</Form.Label>
                        <Form.Select
                          value={compareSelection.leftVersionId}
                          onChange={(event) => setCompareSelection((current) => ({
                            ...current,
                            leftVersionId: event.target.value,
                          }))}
                          disabled={versionsLoading || versions.length < 2}
                        >
                          <option value="">Seleziona</option>
                          {versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {(version.versionNumber || version.id.slice(0, 8)).toUpperCase()} - {versionStatusLabelByValue[version.versionStatus] || version.versionStatus}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label className="small">Confronta destra</Form.Label>
                        <Form.Select
                          value={compareSelection.rightVersionId}
                          onChange={(event) => setCompareSelection((current) => ({
                            ...current,
                            rightVersionId: event.target.value,
                          }))}
                          disabled={versionsLoading || versions.length < 2}
                        >
                          <option value="">Seleziona</option>
                          {versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {(version.versionNumber || version.id.slice(0, 8)).toUpperCase()} - {versionStatusLabelByValue[version.versionStatus] || version.versionStatus}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => void handleCompareVersions()}
                        disabled={compareLoading || !compareSelection.leftVersionId || !compareSelection.rightVersionId}
                      >
                        <GitCompare size={14} className="me-1" />
                        {compareLoading ? 'Confronto...' : 'Confronta'}
                      </Button>
                    </div>

                    {compareResult && (
                      <Card className="mb-3">
                        <Card.Body className="py-2">
                          <div className="small text-muted mb-2">Differenze tra versioni selezionate</div>
                          {Object.keys(compareResult?.changes || {}).length === 0 && (
                            <div className="small text-muted">Nessuna differenza rilevata.</div>
                          )}
                          {Object.entries(compareResult?.changes || {}).map(([field, value]) => (
                            <div key={field} className="small mb-1">
                              <strong>{field}</strong>: {JSON.stringify(value?.from ?? null)} {'->'} {JSON.stringify(value?.to ?? null)}
                            </div>
                          ))}
                        </Card.Body>
                      </Card>
                    )}

                    <Table responsive hover size="sm">
                      <thead>
                        <tr>
                          <th>Versione</th>
                          <th>Stato</th>
                          <th>Changelog</th>
                          <th>Release Notes</th>
                          <th>Utente</th>
                          <th>Data</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versionsLoading && (
                          <tr>
                            <td colSpan={7} className="text-center text-muted py-3">
                              <Spinner animation="border" size="sm" className="me-2" />
                              Caricamento versioni...
                            </td>
                          </tr>
                        )}
                        {!versionsLoading && versions.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center text-muted py-3">
                              Nessuna versione disponibile.
                            </td>
                          </tr>
                        )}
                        {!versionsLoading && versions.map((version) => (
                          <tr key={version.id}>
                            <td>{version.versionNumber || version.id.slice(0, 8).toUpperCase()}</td>
                            <td>
                              <Badge bg={versionStatusBadgeVariant(version.versionStatus)}>
                                {versionStatusLabelByValue[version.versionStatus] || version.versionStatus}
                              </Badge>
                            </td>
                            <td className="small">{version.changelog || '-'}</td>
                            <td className="small">{version.releaseNotes || '-'}</td>
                            <td className="small">{version.createdByName || version.createdByEmail || '-'}</td>
                            <td className="small">{formatDateTime(version.createdAt)}</td>
                            <td className="text-end">
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="outline-warning"
                                  onClick={() => void handleRollbackVersion(version.id)}
                                  disabled={rollbackingVersionId === version.id}
                                >
                                  <RotateCcw size={14} className="me-1" />
                                  {rollbackingVersionId === version.id ? 'Rollback...' : 'Rollback'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {selectedAsset && (detailSection === 'monitoring' || detailSection === 'analytics' || detailSection === 'maintenance') && (
                <Card className="card-border mt-3">
                  <Card.Header className="bg-transparent border-0 pb-0">
                    <h5 className="mb-1">Deployment & Monitoring</h5>
                    <p className="small text-muted mb-0">
                      Ambiente corrente: {environmentLabelByValue[selectedAsset.deploymentEnvironment] || selectedAsset.deploymentEnvironment}
                    </p>
                  </Card.Header>
                  <Card.Body>
                    {detailSection === 'monitoring' && (
                      <Row className="g-3 mb-3">
                      <Col lg={6}>
                        <Card>
                          <Card.Body>
                            <h6 className="mb-2">Switch Environment</h6>
                            <div className="small text-muted mb-2">Stato deploy: {selectedAsset.status}</div>
                            {canPublish ? (
                              <div className="d-flex gap-2 flex-wrap">
                                <Form.Select
                                  value={deploymentForm.environment}
                                  onChange={(event) => setDeploymentForm((current) => ({
                                    ...current,
                                    environment: event.target.value,
                                  }))}
                                >
                                  {WEB_ASSET_DEPLOYMENT_ENVIRONMENTS.map((environment) => (
                                    <option key={environment.value} value={environment.value}>{environment.label}</option>
                                  ))}
                                </Form.Select>
                                <Form.Control
                                  value={deploymentForm.versionNumber}
                                  onChange={(event) => setDeploymentForm((current) => ({
                                    ...current,
                                    versionNumber: event.target.value,
                                  }))}
                                  placeholder="Versione"
                                />
                                <Form.Control
                                  value={deploymentForm.changelog}
                                  onChange={(event) => setDeploymentForm((current) => ({
                                    ...current,
                                    changelog: event.target.value,
                                  }))}
                                  placeholder="Changelog deploy"
                                />
                                <Form.Control
                                  value={deploymentForm.releaseNotes}
                                  onChange={(event) => setDeploymentForm((current) => ({
                                    ...current,
                                    releaseNotes: event.target.value,
                                  }))}
                                  placeholder="Release notes"
                                />
                                <Button
                                  type="button"
                                  variant="outline-primary"
                                  disabled={deploymentSubmitting}
                                  onClick={() => void handleSwitchDeployment()}
                                >
                                  {deploymentSubmitting ? 'Aggiorno...' : 'Switch'}
                                </Button>
                              </div>
                            ) : (
                              <div className="small text-muted">Permesso web.publish richiesto per lo switch.</div>
                            )}
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col lg={6}>
                        <Card>
                          <Card.Body>
                            <h6 className="mb-2">Health Check</h6>
                            {healthMessage && (
                              <Alert variant={healthMessage.includes('non') ? 'danger' : 'success'} className="py-2">
                                {healthMessage}
                              </Alert>
                            )}
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                              <div className="small text-muted">
                                Uptime: {healthData?.summary?.uptimePercent ?? 0}% | Error rate: {healthData?.summary?.errorRate ?? 0}%
                              </div>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  disabled={healthLoading}
                                  onClick={() => void handleRunHealthCheck()}
                                >
                                  {healthLoading ? 'Controllo...' : 'Run check'}
                                </Button>
                              )}
                            </div>
                            <div className="small text-muted">
                              Ultimo check: {formatDateTime(healthData?.summary?.lastCheckAt)}
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                      </Row>
                    )}

                    {(detailSection === 'monitoring' || detailSection === 'analytics') && (
                      <Row className="g-3 mb-3">
                      <Col lg={12}>
                        <Card>
                          <Card.Body>
                            <h6 className="mb-2">Analytics Summary</h6>
                            {analyticsMessage && (
                              <Alert variant={analyticsMessage.includes('non') ? 'danger' : 'success'} className="py-2">
                                {analyticsMessage}
                              </Alert>
                            )}
                            <div className="small text-muted mb-1">
                              Sessions delta: {analyticsData?.summary?.sessionsDelta ?? '-'}
                            </div>
                            <div className="small text-muted mb-1">
                              Users delta: {analyticsData?.summary?.usersDelta ?? '-'}
                            </div>
                            <div className="small text-muted">
                              Top events: {analyticsData?.topEvents?.slice(0, 3).map((entry) => `${entry.eventName} (${entry.count})`).join(', ') || '-'}
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                      </Row>
                    )}

                    {canEdit && detailSection === 'analytics' && (
                      <Row className="g-3 mb-3">
                        <Col lg={6}>
                          <Card>
                            <Card.Body>
                              <h6 className="mb-2">Add Analytics Snapshot</h6>
                              <Form onSubmit={handleCreateAnalyticsSnapshot}>
                                <div className="d-grid gap-2">
                                  <Form.Control value={snapshotForm.provider} onChange={(event) => setSnapshotForm((current) => ({ ...current, provider: event.target.value }))} placeholder="provider" />
                                  <Form.Control value={snapshotForm.sourceLabel} onChange={(event) => setSnapshotForm((current) => ({ ...current, sourceLabel: event.target.value }))} placeholder="source label" />
                                  <Form.Control type="datetime-local" value={snapshotForm.periodStart} onChange={(event) => setSnapshotForm((current) => ({ ...current, periodStart: event.target.value }))} />
                                  <Form.Control type="datetime-local" value={snapshotForm.periodEnd} onChange={(event) => setSnapshotForm((current) => ({ ...current, periodEnd: event.target.value }))} />
                                  <Form.Control value={snapshotForm.sessions} onChange={(event) => setSnapshotForm((current) => ({ ...current, sessions: event.target.value }))} placeholder="sessions" />
                                  <Form.Control value={snapshotForm.users} onChange={(event) => setSnapshotForm((current) => ({ ...current, users: event.target.value }))} placeholder="users" />
                                  <Form.Control value={snapshotForm.pageViews} onChange={(event) => setSnapshotForm((current) => ({ ...current, pageViews: event.target.value }))} placeholder="page views" />
                                  <Button type="submit">Salva snapshot</Button>
                                </div>
                              </Form>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col lg={6}>
                          <Card>
                            <Card.Body>
                              <h6 className="mb-2">Track Custom Event</h6>
                              <Form onSubmit={handleCreateAnalyticsEvent}>
                                <div className="d-grid gap-2">
                                  <Form.Control value={eventForm.eventName} onChange={(event) => setEventForm((current) => ({ ...current, eventName: event.target.value }))} placeholder="event name" required />
                                  <Form.Control value={eventForm.eventLabel} onChange={(event) => setEventForm((current) => ({ ...current, eventLabel: event.target.value }))} placeholder="event label" />
                                  <Form.Control value={eventForm.count} onChange={(event) => setEventForm((current) => ({ ...current, count: event.target.value }))} placeholder="count" />
                                  <Button type="submit">Registra evento</Button>
                                </div>
                              </Form>
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                    )}

                    {detailSection === 'maintenance' && (
                      <Row className="g-3">
                      <Col lg={6}>
                        <Card>
                          <Card.Body>
                            <h6 className="mb-2">Scheduled Maintenance</h6>
                            {maintenanceMessage && (
                              <Alert variant={maintenanceMessage.includes('non') ? 'danger' : 'success'} className="py-2">
                                {maintenanceMessage}
                              </Alert>
                            )}
                            {canEdit && (
                              <Form onSubmit={handleCreateMaintenance} className="d-grid gap-2 mb-3">
                                <Form.Control type="datetime-local" value={maintenanceForm.startsAt} onChange={(event) => setMaintenanceForm((current) => ({ ...current, startsAt: event.target.value }))} required />
                                <Form.Control type="datetime-local" value={maintenanceForm.endsAt} onChange={(event) => setMaintenanceForm((current) => ({ ...current, endsAt: event.target.value }))} required />
                                <Form.Control value={maintenanceForm.reason} onChange={(event) => setMaintenanceForm((current) => ({ ...current, reason: event.target.value }))} placeholder="reason" />
                                <Form.Control value={maintenanceForm.notifyEmail} onChange={(event) => setMaintenanceForm((current) => ({ ...current, notifyEmail: event.target.value }))} placeholder="notify email" />
                                <Form.Control value={maintenanceForm.notifySms} onChange={(event) => setMaintenanceForm((current) => ({ ...current, notifySms: event.target.value }))} placeholder="notify sms" />
                                <Button type="submit">Crea finestra</Button>
                              </Form>
                            )}
                            <Table size="sm" responsive>
                              <thead>
                                <tr>
                                  <th>Start</th>
                                  <th>End</th>
                                  <th>Status</th>
                                  <th className="text-end">Azioni</th>
                                </tr>
                              </thead>
                              <tbody>
                                {maintenanceLoading && (
                                  <tr>
                                    <td colSpan={4} className="small text-muted">Caricamento...</td>
                                  </tr>
                                )}
                                {!maintenanceLoading && maintenanceItems.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="small text-muted">Nessuna maintenance window.</td>
                                  </tr>
                                )}
                                {!maintenanceLoading && maintenanceItems.map((item) => (
                                  <tr key={item.id}>
                                    <td className="small">{formatDateTime(item.startsAt)}</td>
                                    <td className="small">{formatDateTime(item.endsAt)}</td>
                                    <td className="small">{maintenanceStatusLabelByValue[item.status] || item.status}</td>
                                    <td className="text-end">
                                      {canEdit && (
                                        <Form.Select
                                          size="sm"
                                          value={item.status}
                                          onChange={(event) => void handleUpdateMaintenanceStatus(item.id, event.target.value)}
                                        >
                                          {WEB_ASSET_MAINTENANCE_STATUSES.map((status) => (
                                            <option key={status.value} value={status.value}>{status.label}</option>
                                          ))}
                                        </Form.Select>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col lg={6}>
                        <Card>
                          <Card.Body>
                            <h6 className="mb-2">Alerts</h6>
                            <Table size="sm" responsive>
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th>Status</th>
                                  <th>Message</th>
                                  <th className="text-end">Azioni</th>
                                </tr>
                              </thead>
                              <tbody>
                                {alertsLoading && (
                                  <tr>
                                    <td colSpan={4} className="small text-muted">Caricamento...</td>
                                  </tr>
                                )}
                                {!alertsLoading && alertsItems.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="small text-muted">Nessun alert.</td>
                                  </tr>
                                )}
                                {!alertsLoading && alertsItems.map((item) => (
                                  <tr key={item.id}>
                                    <td className="small">{item.type}</td>
                                    <td className="small">{alertStatusLabelByValue[item.status] || item.status}</td>
                                    <td className="small">{item.message}</td>
                                    <td className="text-end">
                                      {canEdit && (
                                        <Form.Select
                                          size="sm"
                                          value={item.status}
                                          onChange={(event) => void handleUpdateAlertStatus(item.id, event.target.value)}
                                        >
                                          {WEB_ASSET_ALERT_STATUSES.map((status) => (
                                            <option key={status.value} value={status.value}>{status.label}</option>
                                          ))}
                                        </Form.Select>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </Card.Body>
                        </Card>
                      </Col>
                      </Row>
                    )}
                  </Card.Body>
                </Card>
              )}

              {canAuditView && showAuditPanel && (
                <Card className="card-border mt-3">
                  <Card.Header className="bg-transparent border-0 pb-0 d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <div>
                      <h5 className="mb-1">Audit Dashboard</h5>
                      <p className="small text-muted mb-0">Log azioni su web asset (create, edit, delete, publish, rollback).</p>
                    </div>
                    <div className="d-flex gap-2">
                      <Form.Select
                        value={auditFilters.action}
                        onChange={(event) => {
                          void loadAudit({ page: 1, action: event.target.value });
                        }}
                      >
                        {WEB_ASSET_AUDIT_ACTION_OPTIONS.map((option) => (
                          <option key={option.value || 'all'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Form.Select>
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => void loadAudit()}
                        disabled={auditLoading}
                      >
                        <RefreshCw size={14} className="me-1" />
                        Aggiorna audit
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    {auditError && <Alert variant="danger" className="py-2">{auditError}</Alert>}

                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                      <div className="small text-muted">Totale eventi: {auditPageInfo.totalItems}</div>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => {
                            const nextPage = Math.max(1, auditPage - 1);
                            void loadAudit({ page: nextPage });
                          }}
                          disabled={auditLoading || !auditPageInfo.hasPrevPage}
                        >
                          Precedente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => {
                            const nextPage = auditPage + 1;
                            void loadAudit({ page: nextPage });
                          }}
                          disabled={auditLoading || !auditPageInfo.hasNextPage}
                        >
                          Successiva
                        </Button>
                      </div>
                    </div>

                    <Table responsive hover size="sm">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Azione</th>
                          <th>Utente</th>
                          <th>Asset</th>
                          <th>Dettagli</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLoading && (
                          <tr>
                            <td colSpan={5} className="text-center py-3 text-muted">
                              <Spinner animation="border" size="sm" className="me-2" />
                              Caricamento audit...
                            </td>
                          </tr>
                        )}
                        {!auditLoading && auditItems.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-3 text-muted">
                              Nessun evento audit disponibile.
                            </td>
                          </tr>
                        )}
                        {!auditLoading && auditItems.map((entry) => (
                          <tr key={entry.id}>
                            <td className="small">{formatDateTime(entry.createdAt)}</td>
                            <td className="small">{auditActionLabelByValue[entry.action] || entry.action}</td>
                            <td className="small">{entry.actor?.name || entry.actor?.email || '-'}</td>
                            <td className="small">{entry.entityId ? entry.entityId.slice(0, 8).toUpperCase() : '-'}</td>
                            <td className="small text-truncate" style={{ maxWidth: 420 }}>
                              {entry.metadata ? JSON.stringify(entry.metadata) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}
              <ToastContainer position="bottom-right" theme="light" />
            </div>
          </div>
        );
      }}
    </WebAssetsModuleGate>
  );
};

export default WebAssetsPage;

