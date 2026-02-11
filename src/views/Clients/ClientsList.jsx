import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Placeholder, Row, Table } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import { Download, Plus, TriangleAlert, Upload, Users } from "lucide-react";
import ClientsModuleGate from "../../modules/clients/ui/ClientsModuleGate";
import { deleteClient, listClients } from "../../modules/clients/ui/clientApi";
import { CLIENTS_PAGE_SIZE_OPTIONS, CLIENTS_PERMISSIONS, CLIENTS_SORT_OPTIONS } from "../../modules/clients/ui/constants";
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

  const goToPage = (nextPage) => {
    updateRouteQuery({
      query: activeQuery || undefined,
      page: nextPage,
      sort: activeSort,
      type: activeType,
      pageSize: activePageSize,
    });
  };

  const renderClientTags = (client, maxVisible = 3) => {
    const tags = Array.isArray(client?.tags) ? client.tags.filter(Boolean) : [];
    if (tags.length === 0) {
      return <span className="text-muted small">Nessun tag</span>;
    }

    const visibleTags = tags.slice(0, maxVisible);
    const remainingCount = tags.length - visibleTags.length;

    return (
      <div className="clients-tags clients-list-tags">
        {visibleTags.map((tag) => (
          <span
            key={`${client.id}-${tag}`}
            className="badge clients-tag-badge"
            style={getTagBadgeStyle(tag)}
          >
            {tag}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="badge bg-light text-muted border">+{remainingCount}</span>
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
                    <Button variant="outline-secondary" disabled className="d-inline-flex align-items-center gap-2">
                      <Upload size={15} />
                      Importa
                      <small className="opacity-75">(coming soon)</small>
                    </Button>
                    <Button variant="outline-secondary" disabled className="d-inline-flex align-items-center gap-2">
                      <Download size={15} />
                      Esporta
                      <small className="opacity-75">(coming soon)</small>
                    </Button>
                  </>
                }
              />

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
                                    <div className="clients-row-meta">
                                      {client.email || "Email non impostata"}
                                      {" - "}
                                      {client.phone || "Telefono non impostato"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <ClientTypeBadge type={client.type} />
                              </td>
                              <td>{client.email || <span className="text-muted">-</span>}</td>
                              <td>{client.phone || <span className="text-muted">-</span>}</td>
                              <td>{renderClientTags(client, 3)}</td>
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
                            <div className="clients-mobile-tags">{renderClientTags(client, 2)}</div>
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

              <Row className="align-items-center mt-3 gy-2">
                <Col md={6}>
                  <div className="text-muted small">
                    Totale clienti: {clientsData.pageInfo.totalItems}
                    {activeType !== "all" && <span> - visibili in pagina: {items.length}</span>}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="d-flex justify-content-md-end align-items-center gap-2">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => goToPage(activePage - 1)}
                      disabled={!clientsData.pageInfo.hasPrevPage || loading}
                    >
                      Previous
                    </Button>
                    <span className="small text-muted">
                      Pagina {clientsData.pageInfo.page} di {paginationTotalPages}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => goToPage(activePage + 1)}
                      disabled={!clientsData.pageInfo.hasNextPage || loading}
                    >
                      Next
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
