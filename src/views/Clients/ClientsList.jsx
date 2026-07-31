import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Placeholder } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import { Download, Plus, TriangleAlert, Upload, Users } from "lucide-react";
import ClientsModuleGate from "../../modules/clients/ui/ClientsModuleGate";
import { deleteClient, listClients } from "../../modules/clients/ui/clientApi";
import { CLIENTS_PERMISSIONS } from "../../modules/clients/ui/constants";
import { ClientEmptyState, ClientFiltersBar, ClientGridRow, ClientMobileCard, ClientTagsEditorModal, ClientsListPagination, PageHeader } from "../../modules/clients/ui/components";
import { getClientTypeLabel } from "../../modules/clients/ui/helpers";
import { getSortLabel, parsePageSize, parsePositiveInt, parseSort, parseType } from "../../modules/clients/ui/listQueryParams";
import { useClientTagsEditor } from "../../modules/clients/ui/useClientTagsEditor";
import { useClientsCsvTransfer } from "../../modules/clients/ui/useClientsCsvTransfer";
import "../../modules/clients/ui/clients-ui.css";
import { hasPermission } from "../../utils/workspaceAccess";

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
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const fileInputRef = useRef(null);

  // Divulgazione progressiva: apre/chiude la "linguetta" di una riga cliente.
  // Multi-open (Set): piu' righe possono restare espanse insieme.
  const toggleExpanded = useCallback((clientId) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }, []);
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

  // Import/export CSV nell'hook dedicato: errori sull'unico canale della
  // pagina (setError), refresh della lista dopo un import riuscito.
  const csvTransfer = useClientsCsvTransfer({ onError: setError, onImported: loadClients });

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

  // Callback stabili: cosi' le righe memoizzate (ClientGridRow, ClientMobileCard)
  // NON si ri-renderizzano quando si apre/chiude la linguetta di un'altra riga.
  const onDeleteClient = useCallback(
    async (client) => {
      try {
        await deleteClient(client.id);
        await loadClients();
      } catch (deleteError) {
        setError(deleteError?.message || "Errore durante eliminazione cliente.");
        throw deleteError;
      }
    },
    [loadClients],
  );

  const handleOpenClient = useCallback(
    (entry) =>
      history.push({
        pathname: `/apps/clients/${entry.id}`,
        state: { fromListSearch: location.search },
      }),
    [history, location.search],
  );

  const handleEditClient = useCallback(
    (entry) =>
      history.push({
        pathname: `/apps/clients/${entry.id}/edit`,
        state: { fromListSearch: location.search },
      }),
    [history, location.search],
  );

  const triggerImport = () => {
    if (!fileInputRef.current || csvTransfer.importing) {
      return;
    }

    fileInputRef.current.click();
  };

  const onImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await csvTransfer.importFromFile(file);
    event.target.value = "";
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

  // Stato+logica del modal tag nell'hook dedicato; al salvataggio riflette
  // i tag nella lista locale (updateClientTagsInState) senza ricaricare.
  const tagsEditor = useClientTagsEditor({ onSaved: updateClientTagsInState });

  const renderLoadingRows = () => (
    <>
      {[1, 2, 3, 4, 5].map((row) => (
        <div className="clients-grid-row clients-grid-row--loading" role="row" key={row}>
          <Placeholder as="div" animation="glow">
            <Placeholder xs={12} />
          </Placeholder>
        </div>
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
          <div className="container-fluid clients-page-container page-flat">
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
                      disabled={!canCreate || csvTransfer.importing}
                      onClick={triggerImport}
                      className="d-none d-sm-inline-flex align-items-center gap-2 clients-import-export-btn"
                    >
                      <Upload size={15} />
                      {csvTransfer.importing ? "Importazione..." : "Importa CSV"}
                    </Button>
                    <Button
                      variant="outline-secondary"
                      disabled={csvTransfer.exporting}
                      onClick={() =>
                        void csvTransfer.exportWithFilters({
                          query: activeQuery || undefined,
                          sort: activeSort,
                          type: activeType !== "all" ? activeType : undefined,
                        })
                      }
                      className="d-none d-sm-inline-flex align-items-center gap-2 clients-import-export-btn"
                    >
                      <Download size={15} />
                      {csvTransfer.exporting ? "Esportazione..." : "Esporta CSV"}
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

              {csvTransfer.actionMessage && (
                <Alert variant={csvTransfer.actionMessage.variant} dismissible onClose={csvTransfer.dismissMessage}>
                  <div>{csvTransfer.actionMessage.text}</div>
                  {Array.isArray(csvTransfer.actionMessage.errors) && csvTransfer.actionMessage.errors.length > 0 && (
                    <div className="mt-2 small">
                      {csvTransfer.actionMessage.errors.map((entry) => (
                        <div key={`${entry.row}-${entry.message}`}>
                          Riga {entry.row}: {entry.message}
                        </div>
                      ))}
                    </div>
                  )}
                </Alert>
              )}

              <Card className="clients-list-card card-border flat-keep mb-3">
                <Card.Body className="py-2">
                  <div className="clients-grid d-none d-md-block">
                    <div className="clients-grid-inner" role="table" aria-label="Elenco clienti">
                      <div className="clients-grid-head" role="row">
                        <div className="clients-grid-cell clients-col-disclosure" role="columnheader">
                          <span className="visually-hidden">Espandi</span>
                        </div>
                        <div className="clients-grid-cell" role="columnheader">Nome</div>
                        <div className="clients-grid-cell" role="columnheader">Tipo</div>
                        <div className="clients-grid-cell" role="columnheader">Email</div>
                        <div className="clients-grid-cell" role="columnheader">Telefono</div>
                        <div className="clients-grid-cell" role="columnheader">Tag</div>
                        <div className="clients-grid-cell clients-cell-actions" role="columnheader">
                          Azioni
                        </div>
                      </div>
                      <div className="clients-grid-body" role="rowgroup">
                        {loading && renderLoadingRows()}
                        {!loading &&
                          items.length > 0 &&
                          items.map((client) => (
                            <ClientGridRow
                              key={client.id}
                              client={client}
                              isExpanded={expandedIds.has(client.id)}
                              canEdit={canEdit}
                              canDelete={canDelete}
                              onToggle={toggleExpanded}
                              onOpen={handleOpenClient}
                              onEdit={handleEditClient}
                              onDelete={onDeleteClient}
                              onEditTags={tagsEditor.open}
                            />
                          ))}
                      </div>
                    </div>
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
                        <ClientMobileCard
                          key={client.id}
                          client={client}
                          isExpanded={expandedIds.has(client.id)}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onToggle={toggleExpanded}
                          onOpen={handleOpenClient}
                          onEdit={handleEditClient}
                          onDelete={onDeleteClient}
                          onEditTags={tagsEditor.open}
                        />
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

              <ClientTagsEditorModal editor={tagsEditor} />

              <ClientsListPagination
                pageInfo={clientsData.pageInfo}
                totalPages={paginationTotalPages}
                activePage={activePage}
                visibleCount={activeType !== "all" ? items.length : null}
                loading={loading}
                onGoToPage={goToPage}
              />
            </div>
          </div>
        );
      }}
    </ClientsModuleGate>
  );
};

export default ClientsList;
