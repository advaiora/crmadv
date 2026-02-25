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
import { Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import {
  createWebAsset,
  deleteWebAsset,
  listWebAssets,
  lookupWebAssetClients,
  lookupWebAssetProjects,
  setWebAssetPublished,
  updateWebAsset,
} from '../../modules/web-assets/api/webAssetsApi';
import WebAssetsModuleGate from '../../modules/web-assets/ui/WebAssetsModuleGate';
import {
  WEB_ASSETS_PAGE_SIZE_OPTIONS,
  WEB_ASSETS_PERMISSIONS,
  WEB_ASSET_STATUSES,
  WEB_ASSET_TYPES,
} from '../../modules/web-assets/ui/constants';
import '../../modules/web-assets/ui/web-assets-ui.css';
import { hasPermission } from '../../utils/workspaceAccess';

const EMPTY_FORM = {
  assetType: 'website',
  name: '',
  url: '',
  status: 'ACTIVE',
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

const typeLabelByValue = Object.fromEntries(
  WEB_ASSET_TYPES.map((entry) => [entry.value, entry.label]),
);
const statusLabelByValue = Object.fromEntries(
  WEB_ASSET_STATUSES.map((entry) => [entry.value, entry.label]),
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
    clientId: '',
    projectId: '',
  });
  const [draftSearch, setDraftSearch] = useState('');

  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState('');
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formMessage, setFormMessage] = useState('');

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const resetForm = useCallback(() => {
    setFormMode('create');
    setEditingId('');
    setFormState(EMPTY_FORM);
    setFormErrors({});
    setFormMessage('');
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await listWebAssets({
        q: filters.q || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        clientId: filters.clientId || undefined,
        projectId: filters.projectId || undefined,
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
  }, [filters.clientId, filters.projectId, filters.q, filters.status, filters.type, page, pageSize]);

  const loadLookups = useCallback(async () => {
    setPickerLoading(true);

    try {
      const [clientsResult, projectsResult] = await Promise.all([
        lookupWebAssetClients({ limit: 50 }),
        lookupWebAssetProjects({ limit: 50 }),
      ]);

      setClients(Array.isArray(clientsResult?.items) ? clientsResult.items : []);
      setProjects(Array.isArray(projectsResult?.items) ? projectsResult.items : []);
    } catch (_error) {
      setClients([]);
      setProjects([]);
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

      if (formMode === 'edit' && editingId) {
        await updateWebAsset(editingId, payload);
      } else {
        await createWebAsset(payload);
      }

      resetForm();
      setFormMessage(successMessage);
      await loadAssets();
    } catch (submitError) {
      setFormMessage(getApiErrorMessage(submitError, 'Operazione non riuscita'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item) => {
    setFormMode('edit');
    setEditingId(item.id);
    setFormErrors({});
    setFormMessage('');
    setFormState({
      assetType: item.assetType,
      name: item.name || '',
      url: item.url || '',
      status: item.status || 'ACTIVE',
      version: item.version || '',
      clientId: item.clientId || '',
      projectId: item.projectId || '',
      ownerUserId: item.ownerUserId || '',
      metadataText: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
    });
  };

  const handleDelete = async (itemId) => {
    const confirmed = window.confirm('Eliminare questo web asset?');
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
      await loadAssets();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, 'Impossibile eliminare asset'));
    } finally {
      setDeletingId('');
    }
  };

  const handlePublishToggle = async (item, nextPublished) => {
    setPublishingId(item.id);
    setError('');

    try {
      await setWebAssetPublished(item.id, nextPublished);
      await loadAssets();
    } catch (publishError) {
      setError(getApiErrorMessage(publishError, 'Impossibile aggiornare stato pubblicazione'));
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

  return (
    <WebAssetsModuleGate requiredPermission={WEB_ASSETS_PERMISSIONS.view}>
      {({ access }) => {
        const canCreate = hasPermission(access, WEB_ASSETS_PERMISSIONS.create);
        const canEdit = hasPermission(access, WEB_ASSETS_PERMISSIONS.edit);
        const canDelete = hasPermission(access, WEB_ASSETS_PERMISSIONS.delete);
        const canPublish = hasPermission(access, WEB_ASSETS_PERMISSIONS.publish);

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
                    <Button type="button" onClick={() => resetForm()}>
                      <Plus size={14} className="me-1" />
                      Nuovo asset
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
                              clientId: '',
                              projectId: '',
                            });
                          }}
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </Form>
                </Card.Body>
              </Card>

              {(canCreate || (canEdit && formMode === 'edit')) && (
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
                            disabled={submitting}
                          >
                            {WEB_ASSET_STATUSES.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
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
                          <td colSpan={10} className="text-center py-4 text-muted">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Caricamento asset...
                          </td>
                        </tr>
                      )}

                      {!loading && items.length === 0 && (
                        <tr>
                          <td colSpan={10} className="text-center py-4 text-muted">
                            Nessun web asset trovato.
                          </td>
                        </tr>
                      )}

                      {!loading && items.map((item) => (
                        <tr key={item.id}>
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
                            <Badge bg={statusBadgeVariant(item.status)}>
                              {statusLabelByValue[item.status] || item.status}
                            </Badge>
                          </td>
                          <td>{item.version || '-'}</td>
                          <td>{item.clientName || '-'}</td>
                          <td>{item.projectName || '-'}</td>
                          <td>{item.ownerName || item.ownerEmail || '-'}</td>
                          <td>{formatDateTime(item.updatedAt)}</td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2">
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
            </div>
          </div>
        );
      }}
    </WebAssetsModuleGate>
  );
};

export default WebAssetsPage;

