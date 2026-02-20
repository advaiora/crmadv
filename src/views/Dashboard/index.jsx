import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Row } from 'react-bootstrap';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { fetchWorkspaceAccess, hasPermission } from '../../utils/workspaceAccess';
import '../../styles/css/dashboard-ui.css';

const Dashboard = ({ toggleCollapsedNav }) => {
    const [access, setAccess] = useState(null);
    const [loadingAccess, setLoadingAccess] = useState(false);
    const [accessError, setAccessError] = useState('');

    const loadDashboardAccess = useCallback(async () => {
        setLoadingAccess(true);
        setAccessError('');

        try {
            const result = await fetchWorkspaceAccess();
            setAccess(result);
        } catch (error) {
            setAccess(null);
            setAccessError(error?.message || 'Impossibile caricare i dati dashboard.');
        } finally {
            setLoadingAccess(false);
        }
    }, []);

    useEffect(() => {
        toggleCollapsedNav(false);
        void loadDashboardAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const workspaceName = access?.branding?.companyName || access?.workspace?.name || 'Workspace';
    const recentActivity = access?.recentActivity || [];
    const permissions = access?.permissions || [];
    const enabledModules = access?.enabledModules || [];
    const roles = access?.roles || [];

    const canViewClients = hasPermission(access, 'clients.view');
    const canViewProjects = hasPermission(access, 'projects.view');
    const canViewChecklists = hasPermission(access, 'checklists.view');
    const canManageBranding = hasPermission(access, 'branding.manage');

    const kpiItems = useMemo(() => ([
        {
            label: 'Moduli attivi',
            value: enabledModules.length,
            helper: 'Feature abilitate nel workspace',
        },
        {
            label: 'Permessi utente',
            value: permissions.length,
            helper: 'Permessi attivi nel tuo ruolo',
        },
        {
            label: 'Ruoli assegnati',
            value: roles.length,
            helper: 'Ruoli attivi per il tuo account',
        },
        {
            label: 'Attivita recenti',
            value: recentActivity.length,
            helper: 'Eventi tracciati di recente',
        },
    ]), [enabledModules.length, permissions.length, recentActivity.length, roles.length]);

    const formatActivityTime = (isoDate) => {
        if (!isoDate) {
            return '';
        }

        const parsedDate = new Date(isoDate);
        if (Number.isNaN(parsedDate.getTime())) {
            return '';
        }

        return parsedDate.toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActivityActor = (item) => item?.actor?.name || item?.actor?.email || 'Sistema';

    return (
        <Container fluid className="dashboard-shell py-4">
            <div className="dashboard-hero mb-4">
                <div className="dashboard-hero-content">
                    <h1 className="dashboard-title mb-1">Dashboard Operativa</h1>
                    <p className="dashboard-subtitle mb-0">
                        Panoramica del workspace <strong>{workspaceName}</strong> con metriche e attivita principali.
                    </p>
                </div>
                <div className="dashboard-hero-actions">
                    {canViewProjects && (
                        <Button as={Link} to="/projects" variant="primary" size="sm">
                            Vai ai progetti
                        </Button>
                    )}
                    {canViewClients && (
                        <Button as={Link} to="/apps/clients" variant="outline-primary" size="sm">
                            Lista clienti
                        </Button>
                    )}
                    {canViewChecklists && (
                        <Button as={Link} to="/checklists/templates" variant="outline-primary" size="sm">
                            Memo operativi
                        </Button>
                    )}
                    {canManageBranding && (
                        <Button as={Link} to="/pages/workspace-branding" variant="outline-primary" size="sm">
                            Branding workspace
                        </Button>
                    )}
                </div>
            </div>

            {accessError && (
                <Alert variant="danger" className="mb-4">
                    {accessError}
                </Alert>
            )}

            <Row className="g-3 mb-4">
                {kpiItems.map((item) => (
                    <Col key={item.label} xxl={3} md={6}>
                        <Card className="card-border h-100 dashboard-kpi-card">
                            <Card.Body>
                                <div className="dashboard-kpi-label">{item.label}</div>
                                <div className="dashboard-kpi-value">{loadingAccess ? '...' : item.value}</div>
                                <div className="dashboard-kpi-helper">{item.helper}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row className="g-3 mb-3">
                <Col md={12}>
                    <Card className="card-border h-100">
                        <Card.Header className="card-header-action">
                            <h6>Attivita recenti</h6>
                        </Card.Header>
                        <Card.Body className="dashboard-activity-body">
                            {loadingAccess && <div className="text-muted fs-7">Caricamento attivita...</div>}
                            {!loadingAccess && recentActivity.length === 0 && (
                                <div className="text-muted fs-7">Nessuna attivita recente disponibile.</div>
                            )}
                            {!loadingAccess && recentActivity.length > 0 && (
                                <ul className="dashboard-activity-list mb-0">
                                    {recentActivity.slice(0, 6).map((item) => (
                                        <li key={item.id} className="dashboard-activity-item">
                                            <div className="dashboard-activity-title">
                                                {String(item.action || 'Evento').replaceAll('.', ' ')}
                                            </div>
                                            <div className="dashboard-activity-meta">
                                                {getActivityActor(item)}
                                                {item.entityType ? ` - ${item.entityType}` : ''}
                                                {item.createdAt ? ` - ${formatActivityTime(item.createdAt)}` : ''}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default connect(null, { toggleCollapsedNav })(Dashboard);
