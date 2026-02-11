import React from 'react';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import { ShieldAlert, TriangleAlert, Users } from 'lucide-react';
import { useWorkspaceAccess } from '../../../hooks/useWorkspaceAccess';
import { hasModuleEnabled, hasPermission } from '../../../utils/workspaceAccess';
import { CLIENTS_MODULE_KEY, CLIENTS_PERMISSIONS } from './constants';

const ClientsModuleGate = ({
    requiredPermission = CLIENTS_PERMISSIONS.view,
    children,
}) => {
    const { access, loading, error, reload } = useWorkspaceAccess();

    if (loading) {
        return (
            <div className="d-flex align-items-center py-5 px-2">
                <Spinner animation="border" size="sm" className="me-2" role="status" />
                <span>Caricamento permessi workspace...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="danger" className="d-flex justify-content-between align-items-center gap-2">
                <div className="d-inline-flex align-items-center gap-2">
                    <TriangleAlert size={16} />
                    <span>{error}</span>
                </div>
                <Button variant="outline-danger" size="sm" onClick={() => void reload()}>
                    Riprova
                </Button>
            </Alert>
        );
    }

    if (!hasModuleEnabled(access, CLIENTS_MODULE_KEY)) {
        return (
            <Card className="card-border">
                <Card.Body className="py-5 text-center">
                    <span
                        className="d-inline-flex align-items-center justify-content-center mb-3 rounded-circle bg-light text-primary"
                        style={{ width: 52, height: 52 }}
                    >
                        <Users size={22} />
                    </span>
                    <h5 className="mb-2">Modulo non attivo</h5>
                    <p className="mb-0 text-muted">
                        Il modulo Clienti non e attivo per questo workspace.
                    </p>
                </Card.Body>
            </Card>
        );
    }

    if (requiredPermission && !hasPermission(access, requiredPermission)) {
        return (
            <Alert variant="warning" className="mb-0 d-inline-flex align-items-center gap-2">
                <ShieldAlert size={16} />
                <span>Non hai i permessi necessari per accedere a questa sezione.</span>
            </Alert>
        );
    }

    if (typeof children === 'function') {
        return children({ access, reload });
    }

    return children;
};

export default ClientsModuleGate;
