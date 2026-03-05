import React from 'react';
import classNames from 'classnames';
import { Draggable } from '@hello-pangea/dnd';
import { Badge, Card, Spinner } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';
import {
    FALLBACK_STAGE_COLOR,
    normalizeStageColor,
    rgbCsvFromHex,
    rgbaFromHex,
    resolveStageTextColor,
} from './stageColor.utils';

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
    (Array.isArray(project?.clientNames) && project.clientNames.length > 0
        ? project.clientNames.join(', ')
        : (Array.isArray(project?.clients) && project.clients.length > 0
            ? project.clients.map((client) => client.name).join(', ')
            : (project?.clientName || project?.client?.name || '-')))
);

const resolveOwnerName = (project) => (
    project?.ownerName
    || project?.owner?.name
    || ''
);

const ProjectCard = ({
    project,
    stageColor,
    stageName,
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
    const resolvedStageColor = normalizeStageColor(stageColor, FALLBACK_STAGE_COLOR);
    const resolvedStageName = String(stageName || project?.stage?.name || 'Stage');
    const stageBadgeStyle = {
        '--project-stage-color': resolvedStageColor,
        '--project-stage-color-rgb': rgbCsvFromHex(resolvedStageColor),
        '--project-stage-badge-bg-light': rgbaFromHex(resolvedStageColor, 0.12),
        '--project-stage-badge-bg-dark': rgbaFromHex(resolvedStageColor, 0.18),
        '--project-stage-badge-border': rgbaFromHex(resolvedStageColor, 0.35),
        '--project-stage-text-color': resolveStageTextColor(resolvedStageColor),
    };

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
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={{
                        ...provided.draggableProps.style,
                        ...stageBadgeStyle,
                    }}
                    className={classNames('projects-board-card-wrap', {
                        'is-draggable': canMove && !isTemporary,
                        'is-dragging': snapshot.isDragging,
                        'is-moving': isMoving,
                    })}
                    title={!canMove ? moveDisabledReason : undefined}
                >
                    <div className="projects-board-card-accent" aria-hidden="true" />
                    <Card
                        {...(canMove && !isTemporary ? provided.dragHandleProps : {})}
                        className={classNames('card-border projects-board-card', {
                            'is-draggable': canMove && !isTemporary,
                            'is-dragging': snapshot.isDragging,
                            'is-moving': isMoving,
                        })}
                        onClick={onOpenProject}
                        role="button"
                    >
                        <Card.Body className="py-2 px-3 ps-4">
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                <span className="projects-board-stage-badge">{resolvedStageName}</span>
                                {isTemporary && (
                                    <Badge bg="warning" text="dark">
                                        Nuovo
                                    </Badge>
                                )}
                            </div>

                            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                <h6 className="mb-0 projects-board-card-title">{project?.name || 'Senza nome'}</h6>
                                {isMoving && (
                                    <Spinner animation="border" size="sm" role="status" />
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
                </div>
            )}
        </Draggable>
    );
};

export default ProjectCard;
