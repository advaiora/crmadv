import React from 'react';
import { Button, Card } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import { hasPermission } from '../../utils/workspaceAccess';

const ProjectDetail = () => {
    const { id } = useParams();

    return (
        <ModulePermissionGate
            requiredModule="projects"
            requiredPermission="projects.view"
            moduleName="Progetti"
        >
            {({ access }) => (
                <div className="container-fluid py-4">
                    <div className="mb-3">
                        <Link to="/projects" className="text-primary">
                            &larr; Torna a Progetti
                        </Link>
                    </div>

                    <div className="mb-3">
                        <h3 className="mb-1">Dettaglio progetto</h3>
                        <p className="text-muted mb-0">
                            ID progetto: <code>{id}</code>
                        </p>
                    </div>

                    <Card className="card-border">
                        <Card.Header className="bg-transparent">
                            <h6 className="mb-0">Azioni</h6>
                        </Card.Header>
                        <Card.Body className="d-flex flex-wrap gap-2">
                            {hasPermission(access, 'projects.edit') && (
                                <Button variant="primary" disabled>
                                    Modifica
                                </Button>
                            )}
                            {hasPermission(access, 'projects.delete') && (
                                <Button variant="danger" disabled>
                                    Elimina
                                </Button>
                            )}
                            {!hasPermission(access, 'projects.edit') && !hasPermission(access, 'projects.delete') && (
                                <p className="text-muted mb-0">Nessuna azione disponibile con i permessi attuali.</p>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            )}
        </ModulePermissionGate>
    );
};

export default ProjectDetail;
