import React from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { TriangleAlert } from 'lucide-react';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { hasModuleEnabled, hasPermission } from '../../utils/workspaceAccess';
import AccessDeniedScreen from './AccessDeniedScreen';
import ModuleDisabledScreen from './ModuleDisabledScreen';

const ModulePermissionGate = ({
    requiredModule,
    requiredPermission,
    moduleName,
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

    if (requiredModule && !hasModuleEnabled(access, requiredModule)) {
        return <ModuleDisabledScreen moduleName={moduleName || requiredModule} />;
    }

    if (requiredPermission && !hasPermission(access, requiredPermission)) {
        return <AccessDeniedScreen />;
    }

    if (typeof children === 'function') {
        return children({ access, reload });
    }

    return children;
};

export default ModulePermissionGate;
