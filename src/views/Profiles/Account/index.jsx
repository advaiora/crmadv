import React, { useEffect, useMemo } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { toggleCollapsedNav } from '../../../redux/action/Theme';
import { useWorkspaceAccess } from '../../../hooks/useWorkspaceAccess';

const MODULE_ROUTES = {
  clients: '/apps/clients',
  quotes: '/apps/quotes',
  vault: '/apps/vault',
  projects: '/projects',
  checklists: '/checklists/templates',
  calendar: '/apps/calendar',
  branding: '/pages/workspace-branding',
};

const MODULE_LABELS = {
  clients: 'Clienti',
  quotes: 'Preventivi',
  vault: 'Vault',
  projects: 'Progetti',
  checklists: 'Memo Operativi',
  calendar: 'Calendario',
  branding: 'Branding',
};

const CORE_PERMISSIONS = [
  'clients.view',
  'clients.create',
  'quotes.view',
  'quotes.create',
  'quotes.send',
  'vault.view_list',
  'vault.reveal',
  'projects.view',
  'projects.edit',
  'calendar.view',
  'calendar.create',
  'calendar.edit',
  'checklists.view',
  'branding.manage',
];

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const prettifyPermission = (permission) => {
  if (!permission || typeof permission !== 'string') {
    return '-';
  }

  const [moduleKey, actionKey] = permission.split('.');
  if (!moduleKey || !actionKey) {
    return permission;
  }

  return `${MODULE_LABELS[moduleKey] || moduleKey} - ${actionKey}`;
};

const groupPermissionsByModule = (permissions) => {
  const grouped = {};

  permissions.forEach((permission) => {
    if (typeof permission !== 'string') {
      return;
    }

    const [moduleKey] = permission.split('.');
    const key = moduleKey || 'altro';

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(permission);
  });

  return Object.entries(grouped).sort(([left], [right]) => left.localeCompare(right));
};

const Account = ({ toggleCollapsedNav }) => {
  const { access, loading, error, reload } = useWorkspaceAccess();

  useEffect(() => {
    toggleCollapsedNav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    workspace,
    roles,
    permissions,
    enabledModules,
    recentActivity,
  } = useMemo(() => ({
    workspace: access?.workspace ?? null,
    roles: Array.isArray(access?.roles) ? access.roles : [],
    permissions: Array.isArray(access?.permissions) ? access.permissions : [],
    enabledModules: Array.isArray(access?.enabledModules) ? access.enabledModules : [],
    recentActivity: Array.isArray(access?.recentActivity) ? access.recentActivity : [],
  }), [access]);

  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const moduleRows = useMemo(() => {
    const uniqueModules = new Set([...enabledModules, ...Object.keys(MODULE_LABELS)]);
    return Array.from(uniqueModules)
      .sort((left, right) => left.localeCompare(right))
      .map((moduleKey) => {
        const isEnabled = enabledModules.includes(moduleKey);
        const route = MODULE_ROUTES[moduleKey] || null;
        const hasViewPermission =
          permissionSet.has(`${moduleKey}.view`)
          || permissionSet.has(`${moduleKey}.manage`)
          || permissionSet.has(`${moduleKey}.view_list`);

        return {
          moduleKey,
          label: MODULE_LABELS[moduleKey] || moduleKey,
          enabled: isEnabled,
          canAccess: isEnabled && hasViewPermission,
          route,
        };
      });
  }, [enabledModules, permissionSet]);

  const groupedPermissions = useMemo(() => groupPermissionsByModule(permissions), [permissions]);

  const visibleRecentActivity = recentActivity.slice(0, 8);

  return (
    <Container>
      <div className="hk-pg-header pt-7 pb-4">
        <h1 className="pg-title">Account e Accesso</h1>
        <p>
          Ruoli, permessi e moduli realmente disponibili nel workspace corrente.
        </p>
      </div>

      <div className="hk-pg-body">
        {loading && (
          <div className="d-flex align-items-center gap-2 text-muted py-4">
            <Spinner animation="border" size="sm" />
            Caricamento account...
          </div>
        )}

        {!loading && error && (
          <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>{error}</span>
            <Button variant="outline-danger" size="sm" onClick={() => void reload()}>
              Riprova
            </Button>
          </Alert>
        )}

        {!loading && !error && (
          <Row className="g-3">
            <Col xl={3} md={6}>
              <Card className="card-border">
                <Card.Body>
                  <div className="small text-muted">Workspace</div>
                  <h5 className="mb-0">{workspace?.name || '-'}</h5>
                </Card.Body>
              </Card>
            </Col>
            <Col xl={3} md={6}>
              <Card className="card-border">
                <Card.Body>
                  <div className="small text-muted">Ruoli</div>
                  <h3 className="mb-0">{roles.length}</h3>
                </Card.Body>
              </Card>
            </Col>
            <Col xl={3} md={6}>
              <Card className="card-border">
                <Card.Body>
                  <div className="small text-muted">Permessi</div>
                  <h3 className="mb-0">{permissions.length}</h3>
                </Card.Body>
              </Card>
            </Col>
            <Col xl={3} md={6}>
              <Card className="card-border">
                <Card.Body>
                  <div className="small text-muted">Moduli abilitati</div>
                  <h3 className="mb-0">{enabledModules.length}</h3>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={7}>
              <Card className="card-border h-100">
                <Card.Header className="d-flex align-items-center justify-content-between">
                  <h6 className="mb-0">Matrice moduli</h6>
                  <Button as={Link} to="/pages/profile" variant="outline-primary" size="sm">
                    Torna al profilo
                  </Button>
                </Card.Header>
                <Card.Body>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Modulo</th>
                          <th>Stato</th>
                          <th>Accesso utente</th>
                          <th className="text-end">Apri</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moduleRows.map((row) => (
                          <tr key={row.moduleKey}>
                            <td>{row.label}</td>
                            <td>
                              <Badge bg={row.enabled ? 'success' : 'secondary'}>
                                {row.enabled ? 'Abilitato' : 'Disabilitato'}
                              </Badge>
                            </td>
                            <td>
                              <Badge bg={row.canAccess ? 'primary' : 'light'} text={row.canAccess ? undefined : 'dark'}>
                                {row.canAccess ? 'Consentito' : 'Non consentito'}
                              </Badge>
                            </td>
                            <td className="text-end">
                              {row.route && row.canAccess && (
                                <Button as={Link} to={row.route} size="sm" variant="outline-light">
                                  Apri
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={5}>
              <Card className="card-border h-100">
                <Card.Header>
                  <h6 className="mb-0">Permessi core</h6>
                </Card.Header>
                <Card.Body className="d-flex flex-wrap gap-2 align-content-start">
                  {CORE_PERMISSIONS.map((permission) => {
                    const active = permissionSet.has(permission);
                    return (
                      <Badge key={permission} bg={active ? 'primary' : 'light'} text={active ? undefined : 'dark'}>
                        {prettifyPermission(permission)}
                      </Badge>
                    );
                  })}
                </Card.Body>
              </Card>
            </Col>

            <Col lg={6}>
              <Card className="card-border h-100">
                <Card.Header>
                  <h6 className="mb-0">Permessi assegnati (completi)</h6>
                </Card.Header>
                <Card.Body>
                  {groupedPermissions.length === 0 && (
                    <div className="text-muted small">Nessun permesso disponibile.</div>
                  )}

                  {groupedPermissions.map(([moduleKey, modulePermissions]) => (
                    <div key={moduleKey} className="mb-3">
                      <div className="small text-uppercase text-muted mb-2">
                        {MODULE_LABELS[moduleKey] || moduleKey}
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {modulePermissions.map((permission) => (
                          <Badge bg="light" text="dark" key={permission}>
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </Col>

            <Col lg={6}>
              <Card className="card-border h-100">
                <Card.Header>
                  <h6 className="mb-0">Attivita recente</h6>
                </Card.Header>
                <Card.Body>
                  {visibleRecentActivity.length === 0 && (
                    <div className="text-muted small">Nessuna attivita recente disponibile.</div>
                  )}

                  {visibleRecentActivity.length > 0 && (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Azione</th>
                            <th>Entita</th>
                            <th>Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRecentActivity.map((item) => (
                            <tr key={item.id}>
                              <td>{item.action || '-'}</td>
                              <td>{item.entityType || '-'}</td>
                              <td className="text-nowrap">{formatDateTime(item.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </div>
    </Container>
  );
};

const mapStateToProps = ({ theme }) => {
  const { navCollapsed } = theme;
  return { navCollapsed };
};

export default connect(mapStateToProps, { toggleCollapsedNav })(Account);
