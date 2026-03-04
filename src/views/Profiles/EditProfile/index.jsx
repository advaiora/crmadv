import React, { useEffect, useMemo } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { toggleCollapsedNav } from '../../../redux/action/Theme';
import { useWorkspaceAccess } from '../../../hooks/useWorkspaceAccess';

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

const initialsFromUser = (user) => {
  const displayName = user?.name?.trim();
  if (displayName) {
    const parts = displayName.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  }

  const fallback = user?.email?.trim();
  return fallback ? fallback.slice(0, 2).toUpperCase() : 'U';
};

const EditProfile = ({ toggleCollapsedNav }) => {
  const { access, loading, error, reload } = useWorkspaceAccess();

  useEffect(() => {
    toggleCollapsedNav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    user,
    workspace,
    branding,
    memberships,
    roles,
    permissions,
  } = useMemo(() => ({
    user: access?.user ?? null,
    workspace: access?.workspace ?? null,
    branding: access?.branding ?? null,
    memberships: Array.isArray(access?.memberships) ? access.memberships : [],
    roles: Array.isArray(access?.roles) ? access.roles : [],
    permissions: Array.isArray(access?.permissions) ? access.permissions : [],
  }), [access]);

  const canManageBranding = permissions.includes('branding.manage');
  const hasGoogleSignInConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

  return (
    <Container>
      <div className="hk-pg-header pt-7 pb-4">
        <h1 className="pg-title">Profilo e Preferenze</h1>
        <p>
          Sezione coerente con le funzionalita attive: identita account, membership workspace e accessi.
        </p>
      </div>

      <div className="hk-pg-body">
        {loading && (
          <div className="d-flex align-items-center gap-2 text-muted py-4">
            <Spinner animation="border" size="sm" />
            Caricamento impostazioni profilo...
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
            <Col lg={8}>
              <Card className="card-border h-100">
                <Card.Header>
                  <h6 className="mb-0">Identita account</h6>
                </Card.Header>
                <Card.Body className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3">
                  <div className="avatar avatar-xxl avatar-primary avatar-rounded">
                    <span className="initial-wrap fs-4">{initialsFromUser(user)}</span>
                  </div>
                  <div className="flex-grow-1">
                    <h4 className="mb-1">{user?.name || 'Utente'}</h4>
                    <div className="text-muted mb-2">{user?.email || '-'}</div>
                    <div className="d-flex flex-wrap gap-2">
                      <Badge bg="light" text="dark">Ruolo utente: {user?.role || '-'}</Badge>
                      <Badge bg="light" text="dark">Workspace: {workspace?.name || '-'}</Badge>
                      <Badge bg="light" text="dark">Ruoli RBAC: {roles.length}</Badge>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Button as={Link} to="/pages/profile" variant="outline-primary" size="sm">
                      Torna al profilo
                    </Button>
                    <Button as={Link} to="/pages/account" variant="primary" size="sm">
                      Accesso e moduli
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="card-border h-100">
                <Card.Header>
                  <h6 className="mb-0">Stato configurazione</h6>
                </Card.Header>
                <Card.Body>
                  <div className="small text-uppercase text-muted mb-2">Branding attivo</div>
                  <div className="fw-semibold mb-1">{branding?.companyName || workspace?.name || '-'}</div>
                  <div className="small text-muted mb-3">Support email: {branding?.supportEmail || '-'}</div>

                  <div className="small text-uppercase text-muted mb-2">Accesso Google</div>
                  <div className="small mb-3">
                    {hasGoogleSignInConfigured ? 'Configurato lato frontend' : 'Non configurato lato frontend'}
                  </div>

                  {canManageBranding && (
                    <Button as={Link} to="/pages/workspace-branding" variant="outline-light" size="sm">
                      Vai al branding
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col lg={12}>
              <Alert variant="info" className="mb-0">
                Le modifiche dirette a nome, email o password non sono ancora esposte in questa UI.
                Questa pagina mostra solo impostazioni realmente disponibili nel prodotto.
              </Alert>
            </Col>

            <Col lg={12}>
              <Card className="card-border">
                <Card.Header>
                  <h6 className="mb-0">Membership workspace</h6>
                </Card.Header>
                <Card.Body>
                  {memberships.length === 0 && (
                    <div className="text-muted small">Nessuna membership attiva.</div>
                  )}

                  {memberships.length > 0 && (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Workspace</th>
                            <th>Slug</th>
                            <th>Stato</th>
                            <th>Dal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberships.map((membership) => (
                            <tr key={`${membership.workspaceId}-${membership.createdAt}`}>
                              <td>{membership.workspace?.name || '-'}</td>
                              <td className="text-muted">{membership.workspace?.slug || '-'}</td>
                              <td>
                                <Badge bg={String(membership.status || '').toUpperCase() === 'ACTIVE' ? 'success' : 'secondary'}>
                                  {membership.status || '-'}
                                </Badge>
                              </td>
                              <td className="text-nowrap">{formatDateTime(membership.createdAt)}</td>
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

export default connect(mapStateToProps, { toggleCollapsedNav })(EditProfile);
