import React from 'react';
import { Badge, Button, Placeholder } from 'react-bootstrap';

const resolveStageLabel = (project) => (
    project?.stage?.name
    || project?.stageName
    || project?.stageId
    || project?.pipelineStageId
    || '—'
);

const ProjectHeader = ({
    project,
    loading,
    canEdit,
    canDelete,
    isEditing,
    onToggleEdit,
    onDelete,
}) => {
    return (
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
                {loading ? (
                    <Placeholder as="h3" animation="glow" className="mb-2">
                        <Placeholder xs={5} />
                    </Placeholder>
                ) : (
                    <h3 className="mb-2">{project?.name || 'Progetto'}</h3>
                )}
                <div className="d-flex align-items-center gap-2">
                    <span className="text-muted">Stage</span>
                    {loading ? (
                        <Placeholder as="span" animation="glow">
                            <Placeholder xs={3} />
                        </Placeholder>
                    ) : (
                        <Badge bg="light" text="dark">{resolveStageLabel(project)}</Badge>
                    )}
                </div>
            </div>

            <div className="d-flex align-items-center gap-2">
                {canEdit && (
                    <Button
                        type="button"
                        variant={isEditing ? 'outline-secondary' : 'primary'}
                        onClick={onToggleEdit}
                        disabled={loading}
                    >
                        {isEditing ? 'Annulla' : 'Modifica'}
                    </Button>
                )}
                {canDelete && (
                    <Button
                        type="button"
                        variant="danger"
                        onClick={onDelete}
                        disabled={loading}
                    >
                        Elimina
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ProjectHeader;
