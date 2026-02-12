import React from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';

const PIPELINE_SETTINGS_PERMISSION = 'projects.edit'; // TODO: replace with projects.manage_pipeline when available.

const ProjectPipelineSettings = () => {
    return (
        <ModulePermissionGate
            requiredModule="projects"
            requiredPermission={PIPELINE_SETTINGS_PERMISSION}
            moduleName="Progetti"
        >
            <div className="container-fluid py-4">
                <div className="mb-3">
                    <Link to="/projects" className="text-primary">
                        &larr; Torna a Progetti
                    </Link>
                </div>

                <div className="mb-3">
                    <h3 className="mb-1">Impostazioni pipeline</h3>
                </div>

                <Card className="card-border">
                    <Card.Body>
                        <p className="text-muted mb-0">
                            Qui configurerai categorie e stages (Step 5)
                        </p>
                    </Card.Body>
                </Card>
            </div>
        </ModulePermissionGate>
    );
};

export default ProjectPipelineSettings;
