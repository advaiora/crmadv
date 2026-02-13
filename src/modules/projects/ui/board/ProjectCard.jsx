import React from 'react';
import classNames from 'classnames';
import { Draggable } from '@hello-pangea/dnd';
import { Badge, Card, Spinner } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';

const formatCurrencyValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    }

    if (typeof value === 'string') {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
            return new Intl.NumberFormat('it-IT', {
                style: 'currency',
                currency: 'EUR',
            }).format(numericValue);
        }

        return value;
    }

    return String(value);
};

const formatDateValue = (dateValue) => {
    if (!dateValue) {
        return '';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(dateValue);
    }

    return new Intl.DateTimeFormat('it-IT').format(parsedDate);
};

const resolveClientName = (project) => (
    project?.clientName
    || project?.client?.name
    || '-'
);

const resolveOwnerName = (project) => (
    project?.ownerName
    || project?.owner?.name
    || ''
);

const ProjectCard = ({
    project,
    index,
    canMove,
    moveDisabledReason = 'permessi insufficienti',
    isMoving = false,
}) => {
    const history = useHistory();
    const dueDate = formatDateValue(project?.dueDate);
    const value = formatCurrencyValue(project?.value);
    const ownerName = resolveOwnerName(project);
    const isTemporary = String(project?.id || '').startsWith('temp-');

    const onOpenProject = () => {
        if (!project?.id || isTemporary) {
            return;
        }

        history.push(`/projects/${project.id}`);
    };

    return (
        <Draggable
            draggableId={String(project?.id || '')}
            index={index}
            isDragDisabled={!canMove || isTemporary}
        >
            {(provided, snapshot) => (
                <Card
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...(canMove && !isTemporary ? provided.dragHandleProps : {})}
                    className={classNames('card-border projects-board-card', {
                        'is-draggable': canMove && !isTemporary,
                        'is-dragging': snapshot.isDragging,
                        'is-moving': isMoving,
                    })}
                    onClick={onOpenProject}
                    role="button"
                    title={!canMove ? moveDisabledReason : undefined}
                >
                    <Card.Body className="py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <h6 className="mb-0 projects-board-card-title">{project?.name || 'Senza nome'}</h6>
                            {isMoving && (
                                <Spinner animation="border" size="sm" role="status" />
                            )}
                            {isTemporary && (
                                <Badge bg="warning" text="dark">
                                    Nuovo
                                </Badge>
                            )}
                        </div>

                        <div className="small text-muted mb-2">
                            Cliente: <span className="text-body">{resolveClientName(project)}</span>
                        </div>

                        {value && (
                            <div className="mb-1">
                                <div className="text-muted projects-board-meta-label">Valore</div>
                                <div className="projects-board-meta-value">{value}</div>
                            </div>
                        )}

                        {dueDate && (
                            <div className="mb-1">
                                <div className="text-muted projects-board-meta-label">Scadenza</div>
                                <div className="projects-board-meta-value">{dueDate}</div>
                            </div>
                        )}

                        {ownerName && (
                            <div className="mb-0">
                                <div className="text-muted projects-board-meta-label">Owner</div>
                                <div className="projects-board-meta-value">{ownerName}</div>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            )}
        </Draggable>
    );
};

export default ProjectCard;
