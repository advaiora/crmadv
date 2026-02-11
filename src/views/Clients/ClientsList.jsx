import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Modal, Placeholder, Row, Table } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Plus, TriangleAlert, Upload, Users } from "lucide-react";
import ClientsModuleGate from "../../modules/clients/ui/ClientsModuleGate";
import { deleteClient, exportClients, importClients, listClients, updateClient } from "../../modules/clients/ui/clientApi";
import { CLIENTS_PAGE_SIZE_OPTIONS, CLIENTS_PERMISSIONS, CLIENTS_PRESET_TAGS, CLIENTS_SORT_OPTIONS } from "../../modules/clients/ui/constants";
import { ClientActionsMenu, ClientAvatar, ClientEmptyState, ClientFiltersBar, ClientTypeBadge, PageHeader } from "../../modules/clients/ui/components";
import { getClientTypeLabel, getTagBadgeStyle } from "../../modules/clients/ui/helpers";
import "../../modules/clients/ui/clients-ui.css";
import { hasPermission } from "../../utils/workspaceAccess";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseSort = (value) => {
  const hasOption = CLIENTS_SORT_OPTIONS.some((option) => option.value === value);
  return hasOption ? value : "-updatedAt";
};

const parseType = (value) => (value === "person" || value === "company" ? value : "all");

const parsePageSize = (value) => {
  const parsed = parsePositiveInt(value, CLIENTS_PAGE_SIZE_OPTIONS[0]);
  return CLIENTS_PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : CLIENTS_PAGE_SIZE_OPTIONS[0];
};

const getSortLabel = (sort) => CLIENTS_SORT_OPTIONS.find((option) => option.value === sort)?.label || "Aggiornati di recente";
const hasTag = (tags, tagValue) => tags.some((tag) => tag.toLowerCase() === tagValue.toLowerCase());

const ClientsList = () => {
  const history = useHistory();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeQuery = (params.get("query") || "").trim();
  const activePage = parsePositiveInt(params.get("page"), 1);
  const activeSort = parseSort(params.get("sort"));
  const activeType = parseType(params.get("type"));
  const activePageSize = parsePageSize(params.get("pageSize"));

  const [searchValue, setSearchValue] = useState(activeQuery);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tagEditorClient, setTagEditorClient] = useState(null);
  const [tagEditorTags, setTagEditorTags] = useState([]);
  const [tagEditorDraft, setTagEditorDraft] = useState("");
  const [tagEditorSaving, setTagEditorSaving] = useState(false);
  const [tagEditorError, setTagEditorError] = useState("");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState(null);
  const fileInputRef = useRef(null);
  const [clientsData, setClientsData] = useState({
    items: [],
    pageInfo: {
      page: activePage,
      pageSize: activePageSize,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });

  useEffect(() => {
    setSearchValue(activeQuery);
  }, [activeQuery]);

  const updateRouteQuery = useCallback(
    (nextParams) => {
      const routeParams = new URLSearchParams(location.search);

      Object.entries(nextParams).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "" || value === "all") {
          routeParams.delete(key);
          return;
        }

        routeParams.set(key, String(value));
      });

      history.push({
        pathname: "/apps/clients",
        search: routeParams.toString(),
      });
    },
    [history, location.search],
  );

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await listClients({
        query: activeQuery || undefined,
        page: activePage,
        pageSize: activePageSize,
        sort: activeSort,
        type: activeType !== "all" ? activeType : undefined,
      });

      setClientsData({
        items: result.items || [],
        pageInfo: result.pageInfo || {
          page: activePage,
          pageSize: activePageSize,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    } catch (loadError) {
      setError(loadError?.message || "Errore durante il caricamento clienti.");
    } finally {
      setLoading(false);
    }
  }, [activePage, activePageSize, activeQuery, activeSort, activeType]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const items = useMemo(() => {
    if (activeType === "all") {
      return clientsData.items;
    }

    return clientsData.items.filter((client) => client.type === activeType);
  }, [activeType, clientsData.items]);

  const activeFilters = useMemo(() => {
    const filters = [];

    if (activeQuery) {
      filters.push(`Ricerca: ${activeQuery}`);
    }
    if (activeType !== "all") {
      filters.push(`Tipo: ${getClientTypeLabel(activeType)}`);
    }
    if (activeSort !== "-updatedAt") {
      filters.push(`Ordine: ${getSortLabel(activeSort)}`);
    }

    return filters;
  }, [activeQuery, activeSort, activeType]);

  const hasSearchContext = activeQuery || activeType !== "all";

  const onSearchSubmit = (event) => {
    event.preventDefault();
    updateRouteQuery({
      query: searchValue.trim() || undefined,
      page: 1,
      sort: activeSort,
      type: activeType,
      pageSize: activePageSize,
    });
  };

  const onResetFilters = () => {
    setSearchValue("");
    history.push("/apps/clients");
  };

  const onDeleteClient = async (client) => {
    try {
      await deleteClient(client.id);
      await loadClients();
    } catch (deleteError) {
      setError(deleteError?.message || "Errore durante eliminazione cliente.");
      throw deleteError;
    }
  };

  const triggerImport = () => {
    if (!fileInputRef.current || importing) {
      return;
    }

    fileInputRef.current.click();
  };

  const onImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setError("");
    setActionMessage(null);

    try {
      const csv = await file.text();
      const result = await importClients({
        csv,
        dryRun: false,
      });

      const summary = result.summary || {};
      const failedRows = Number(summary.failedRows || 0);
      const createdRows = Number(summary.createdRows || 0);
      const totalRows = Number(summary.totalRows || 0);
      const errorsPreview = Array.isArray(summary.errors) ? summary.errors.slice(0, 5) : [];

      setActionMessage({
        variant: failedRows > 0 ? "warning" : "success",
        text: `Import completato: ${createdRows} creati, ${failedRows} falliti su ${totalRows} righe.`,
        errors: errorsPreview,
      });

      await loadClients();
    } catch (importError) {
      setError(importError?.message || "Errore durante importazione clienti.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const onExportClients = async () => {
    if (exporting) {
      return;
    }

    setExporting(true);
    setError("");
    setActionMessage(null);

    try {
      const { blob, filename } = await exportClients({
        query: activeQuery || undefined,
        sort: activeSort,
        type: activeType !== "all" ? activeType : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setActionMessage({
        variant: "success",
        text: `Export completato: file ${filename} scaricato.`,
        errors: [],
      });
    } catch (exportError) {
      setError(exportError?.message || "Errore durante esportazione clienti.");
    } finally {
      setExporting(false);
    }
  };

  const goToPage = (nextPage) => {
    updateRouteQuery({
      query: activeQuery || undefined,
      page: nextPage,
      sort: activeSort,
      type: activeType,
      pageSize: activePageSize,
    });
  };

  const updateClientTagsInState = useCallback((clientId, tags) => {
    setClientsData((prev) => ({
      ...prev,
      items: prev.items.map((entry) =>
        entry.id === clientId
          ? {
              ...entry,
              tags,
            }
          : entry,
      ),
    }));
  }, []);

  const openTagsModal = (client) => {
    setTagEditorClient(client);
    setTagEditorTags(Array.isArray(client.tags) ? client.tags.filter(Boolean) : []);
    setTagEditorDraft("");
    setTagEditorError("");
  };

  const closeTagsModal = (force = false) => {
    const shouldForceClose = force === true;
    if (tagEditorSaving && !shouldForceClose) {
      return;
    }

    setTagEditorClient(null);
    setTagEditorTags([]);
    setTagEditorDraft("");
    setTagEditorError("");
  };

  const togglePresetTagInModal = (presetTag) => {
    setTagEditorTags((prev) => (hasTag(prev, presetTag) ? prev.filter((tag) => tag.toLowerCase() !== presetTag.toLowerCase()) : [...prev, presetTag]));
  };

  const removeTagInModal = (tagToRemove) => {
    setTagEditorTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const addCustomTagInModal = () => {
    const normalized = tagEditorDraft.trim();
    if (!normalized) {
      return;
    }

    setTagEditorTags((prev) => (hasTag(prev, normalized) ? prev : [...prev, normalized]));
    setTagEditorDraft("");
  };

  const saveTagsFromModal = async () => {
    if (!tagEditorClient) {
      return;
    }

    setTagEditorSaving(true);
    setTagEditorError("");

    try {
      await updateClient(tagEditorClient.id, { tags: tagEditorTags });
      updateClientTagsInState(tagEditorClient.id, tagEditorTags);
      closeTagsModal(true);
    } catch (updateError) {
      setTagEditorError(updateError?.message || "Errore durante aggiornamento tag cliente.");
    } finally {
      setTagEditorSaving(false);
    }
  };

  const renderClientTags = (client, maxVisible = 3, canEdit = false) => {
    const tags = Array.isArray(client?.tags) ? client.tags.filter(Boolean) : [];
    const visibleTags = tags.slice(0, maxVisible);
    const remainingCount = tags.length - visibleTags.length;

    return (
      <div className="clients-tags clients-list-tags">
        {visibleTags.length === 0 && <span className="text-muted small">Nessun tag</span>}
        {visibleTags.map((tag) => (
          <span key={`${client.id}-${tag}`} className="badge clients-tag-badge" style={getTagBadgeStyle(tag)}>
            {tag}
          </span>
        ))}
        {remainingCount > 0 && <span className="badge bg-light text-muted border">+{remainingCount}</span>}
        {canEdit && (
          <Button type="button" size="sm" variant="outline-secondary" className="clients-tag-edit-btn" onClick={() => openTagsModal(client)}>
            Modifica tag
          </Button>
        )}
      </div>
    );
  };

  const renderLoadingRows = () => (
    <>
      {[1, 2, 3, 4, 5].map((row) => (
        <tr key={row}>
          <td colSpan={6}>
            <Placeholder as="div" animation="glow">
              <Placeholder xs={12} />
            </Placeholder>
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <ClientsModuleGate requiredPermission={CLIENTS_PERMISSIONS.view}>
      {({ access }) => {
        const canCreate = hasPermission(access, CLIENTS_PERMISSIONS.create);
        const canEdit = hasPermission(access, CLIENTS_PERMISSIONS.edit);
        const canDelete = hasPermission(access, CLIENTS_PERMISSIONS.delete);
        const paginationTotalPages = Math.max(clientsData.pageInfo.totalPages || 0, 1);

        return (
          <div className="container-fluid clients-page-container">
            <div className="clients-page-shell pt-3">
              <PageHeader
                icon={Users}
                title="Clienti"
                subtitle="Gestisci anagrafiche, contatti e note"
                sticky={false}
                breadcrumbs={[
                  { label: "Dashboard", to: "/dashboard" },
                  { label: "Clienti", active: true },
                ]}
                actions={
                  <>
                    {canCreate && (
                      <Button as={Link} to="/apps/clients/new" className="d-inline-flex align-items-center gap-2">
                        <Plus size={15} />
                        Nuovo cliente
                      </Button>
                    )}
                    <Button
                      variant="outline-secondary"
                      disabled={!canCreate || importing}
                      onClick={triggerImport}
                      className="d-inline-flex align-items-center gap-2 clients-import-export-btn"
                    >
                      <Upload size={15} />
                      {importing ? "Importazione..." : "Importa CSV"}
                    </Button>
                    <Button
                      variant="outline-secondary"
                      disabled={exporting}
                      onClick={() => void onExportClients()}
                      className="d-inline-flex align-items-center gap-2 clients-import-export-btn"
                    >
                      <Download size={15} />
                      {exporting ? "Esportazione..." : "Esporta CSV"}
                    </Button>
                  </>
                }
              />
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="d-none" onChange={(event) => void onImportFileChange(event)} />

              <ClientFiltersBar
                searchValue={searchValue}
                typeValue={activeType}
                sortValue={activeSort}
                pageSize={activePageSize}
                activeFilters={activeFilters}
                onSearchChange={setSearchValue}
                onTypeChange={(value) =>
                  updateRouteQuery({
                    query: activeQuery || undefined,
                    type: value,
                    sort: activeSort,
                    page: 1,
                    pageSize: activePageSize,
                  })
                }
                onSortChange={(value) =>
                  updateRouteQuery({
                    query: activeQuery || undefined,
                    type: activeType,
                    sort: value,
                    page: 1,
                    pageSize: activePageSize,
                  })
                }
                onPageSizeChange={(value) =>
                  updateRouteQuery({
                    query: activeQuery || undefined,
                    type: activeType,
                    sort: activeSort,
                    page: 1,
                    pageSize: value,
                  })
                }
                onSubmit={onSearchSubmit}
                onReset={onResetFilters}
              />

              {error && (
                <Alert variant="danger" className="d-flex justify-content-between align-items-center">
                  <div className="d-inline-flex align-items-center gap-2">
                    <TriangleAlert size={16} />
                    <span>{error}</span>
                  </div>
                  <Button variant="outline-danger" size="sm" onClick={() => void loadClients()}>
                    Riprova
                  </Button>
                </Alert>
              )}

              {actionMessage && (
                <Alert variant={actionMessage.variant} dismissible onClose={() => setActionMessage(null)}>
                  <div>{actionMessage.text}</div>
                  {Array.isArray(actionMessage.errors) && actionMessage.errors.length > 0 && (
                    <div className="mt-2 small">
                      {actionMessage.errors.map((entry) => (
                        <div key={`${entry.row}-${entry.message}`}>
                          Riga {entry.row}: {entry.message}
                        </div>
                      ))}
                    </div>
                  )}
                </Alert>
              )}

              <Card className="clients-list-card card-border mb-3">
                <Card.Body className="py-2">
                  <div className="table-responsive d-none d-md-block">
                    <Table hover className="clients-list-table mb-0">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Tipo</th>
                          <th>Email</th>
                          <th>Telefono</th>
                          <th>Tag</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && renderLoadingRows()}
                        {!loading &&
                          items.length > 0 &&
                          items.map((client) => (
                            <tr key={client.id}>
                              <td>
                                <div className="clients-row-primary">
                                  <ClientAvatar name={client.name} type={client.type} />
                                  <div>
                                    <p className="clients-row-name">{client.name}</p>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <ClientTypeBadge type={client.type} />
                              </td>
                              <td>{client.email || <span className="text-muted">-</span>}</td>
                              <td>{client.phone || <span className="text-muted">-</span>}</td>
                              <td>{renderClientTags(client, 3, canEdit)}</td>
                              <td className="text-end">
                                <ClientActionsMenu
                                  client={client}
                                  canEdit={canEdit}
                                  canDelete={canDelete}
                                  onOpen={(entry) =>
                                    history.push({
                                      pathname: `/apps/clients/${entry.id}`,
                                      state: { fromListSearch: location.search },
                                    })
                                  }
                                  onEdit={(entry) =>
                                    history.push({
                                      pathname: `/apps/clients/${entry.id}/edit`,
                                      state: { fromListSearch: location.search },
                                    })
                                  }
                                  onDelete={onDeleteClient}
                                />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  </div>

                  <div className="d-md-none py-2">
                    {loading && (
                      <>
                        {[1, 2, 3].map((item) => (
                          <Card key={item} className="clients-mobile-card mb-2">
                            <Placeholder as="div" animation="glow">
                              <Placeholder xs={12} />
                            </Placeholder>
                          </Card>
                        ))}
                      </>
                    )}
                    {!loading &&
                      items.length > 0 &&
                      items.map((client) => (
                        <div className="clients-mobile-card" key={client.id}>
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div className="d-flex align-items-center gap-2">
                              <ClientAvatar name={client.name} type={client.type} size="sm" />
                              <div>
                                <div className="fw-semibold">{client.name}</div>
                                <div className="text-muted clients-mobile-meta">{client.email || "Email non impostata"}</div>
                              </div>
                            </div>
                            <ClientActionsMenu
                              client={client}
                              canEdit={canEdit}
                              canDelete={canDelete}
                              onOpen={(entry) =>
                                history.push({
                                  pathname: `/apps/clients/${entry.id}`,
                                  state: { fromListSearch: location.search },
                                })
                              }
                              onEdit={(entry) =>
                                history.push({
                                  pathname: `/apps/clients/${entry.id}/edit`,
                                  state: { fromListSearch: location.search },
                                })
                              }
                              onDelete={onDeleteClient}
                            />
                          </div>
                          <div className="d-flex justify-content-between align-items-center mt-3">
                            <ClientTypeBadge type={client.type} />
                            <div className="clients-mobile-tags">{renderClientTags(client, 2, canEdit)}</div>
                          </div>
                          <div className="text-muted clients-mobile-meta mt-2">{client.phone || "Telefono non impostato"}</div>
                        </div>
                      ))}
                  </div>
                </Card.Body>
              </Card>

              {!loading && items.length === 0 && (
                <ClientEmptyState
                  mode={hasSearchContext ? "search" : "empty"}
                  query={activeQuery}
                  canCreate={canCreate}
                  onCreate={() => history.push("/apps/clients/new")}
                  onReset={onResetFilters}
                />
              )}

              <Modal show={Boolean(tagEditorClient)} onHide={() => closeTagsModal(false)} centered dialogClassName="clients-tags-modal">
                <Modal.Header closeButton={!tagEditorSaving}>
                  <Modal.Title>Modifica tag cliente</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <p className="mb-2 small text-muted">{tagEditorClient ? `Cliente: ${tagEditorClient.name}` : ""}</p>

                  {tagEditorError && (
                    <Alert variant="danger" className="py-2 px-3 mb-3">
                      {tagEditorError}
                    </Alert>
                  )}

                  <div className="clients-tags mb-3">
                    {tagEditorTags.length === 0 && <span className="text-muted small">Nessun tag</span>}
                    {tagEditorTags.map((tag) => (
                      <span key={`modal-tag-${tag}`} className="badge clients-tag-badge" style={getTagBadgeStyle(tag)}>
                        {tag}
                        <button
                          type="button"
                          className="clients-tag-remove-btn"
                          onClick={() => removeTagInModal(tag)}
                          disabled={tagEditorSaving}
                          aria-label={`Rimuovi tag ${tag}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="clients-tag-presets mb-3">
                    {CLIENTS_PRESET_TAGS.map((presetTag) => (
                      <Button
                        key={`modal-preset-${presetTag}`}
                        type="button"
                        variant={hasTag(tagEditorTags, presetTag) ? "primary" : "outline-secondary"}
                        size="sm"
                        className="clients-tag-preset-btn"
                        onClick={() => togglePresetTagInModal(presetTag)}
                        disabled={tagEditorSaving}
                      >
                        {presetTag}
                      </Button>
                    ))}
                  </div>

                  <Form.Group>
                    <Form.Label className="small mb-1">Aggiungi tag personalizzato</Form.Label>
                    <div className="input-group input-group-sm">
                      <Form.Control
                        value={tagEditorDraft}
                        onChange={(event) => setTagEditorDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") {
                            return;
                          }

                          event.preventDefault();
                          addCustomTagInModal();
                        }}
                        placeholder="Nuovo tag"
                        disabled={tagEditorSaving}
                      />
                      <Button type="button" variant="outline-secondary" onClick={addCustomTagInModal} disabled={tagEditorSaving || !tagEditorDraft.trim()}>
                        Aggiungi
                      </Button>
                    </div>
                  </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="outline-secondary" onClick={() => closeTagsModal(false)} disabled={tagEditorSaving}>
                    Annulla
                  </Button>
                  <Button variant="primary" onClick={() => void saveTagsFromModal()} disabled={tagEditorSaving}>
                    {tagEditorSaving ? "Salvataggio..." : "Salva tag"}
                  </Button>
                </Modal.Footer>
              </Modal>

              <Row className="align-items-center mt-3 gy-2">
                <Col md={6}>
                  <div className="text-muted small">
                    Totale clienti: {clientsData.pageInfo.totalItems}
                    {activeType !== "all" && <span> - visibili in pagina: {items.length}</span>}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="clients-pagination-wrap d-flex justify-content-md-end align-items-center">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => goToPage(activePage - 1)}
                      disabled={!clientsData.pageInfo.hasPrevPage || loading}
                      className="clients-pagination-btn"
                      aria-label="Pagina precedente"
                    >
                      <ChevronLeft size={15} />
                    </Button>
                    <span className="small clients-pagination-status">
                      Pagina {clientsData.pageInfo.page} di {paginationTotalPages}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => goToPage(activePage + 1)}
                      disabled={!clientsData.pageInfo.hasNextPage || loading}
                      className="clients-pagination-btn"
                      aria-label="Pagina successiva"
                    >
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        );
      }}
    </ClientsModuleGate>
  );
};

export default ClientsList;
