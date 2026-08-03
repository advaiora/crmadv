import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { ArrowRight } from 'react-feather';
import { Button, Form } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';
import { useWindowWidth } from '@react-hook/window-size';
import StageColumn from './StageColumn';
import { sortStages } from '../pipelineSettings.utils';
import './projects-board.css';

const resolveProjectStageId = (project) => (
    project?.stageId
    || project?.pipelineStageId
    || project?.stage?.id
    || ''
);

const formatCurrencyValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
        }).format(numericValue);
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

const ProjectsBoard = ({
    categoryId,
    stages,
    projects,
    onMove,
    canMove,
    movingProjectIds = new Set(),
}) => {
    const history = useHistory();
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth < 992;
    const sortedStages = useMemo(() => sortStages(stages || []), [stages]);
    const [mobileTargetStageByProject, setMobileTargetStageByProject] = useState({});

    const projectsByStage = useMemo(() => {
        const groupedProjects = new Map();

        sortedStages.forEach((stage) => {
            groupedProjects.set(stage.id, []);
        });

        (projects || []).forEach((project) => {
            const stageId = resolveProjectStageId(project);
            if (!stageId || !groupedProjects.has(stageId)) {
                return;
            }

            groupedProjects.get(stageId).push(project);
        });

        return groupedProjects;
    }, [projects, sortedStages]);

    useEffect(() => {
        const nextTargets = {};

        (projects || []).forEach((project) => {
            const projectId = String(project?.id || '');
            const currentStageId = resolveProjectStageId(project);
            const fallbackTarget = sortedStages.find((stage) => String(stage.id) !== String(currentStageId))?.id
                || currentStageId
                || '';
            nextTargets[projectId] = fallbackTarget;
        });

        setMobileTargetStageByProject(nextTargets);
    }, [projects, sortedStages]);

    const onDragEnd = (result) => {
        if (!canMove || isMobile) {
            return;
        }

        const { destination, source, draggableId } = result;
        if (!destination) {
            return;
        }

        if (destination.droppableId === source.droppableId) {
            return;
        }

        if (typeof onMove === 'function') {
            onMove(draggableId, destination.droppableId, destination.index);
        }
    };

    const handleMobileStageTargetChange = (projectId, stageId) => {
        setMobileTargetStageByProject((current) => ({
            ...current,
            [String(projectId)]: stageId,
        }));
    };

    const openProjectDetail = (projectId) => {
        if (!projectId || String(projectId).startsWith('temp-')) {
            return;
        }

        history.push(`/projects/${projectId}`);
    };

    if (isMobile) {
        return (
            <div className="projects-mobile-stage-list" data-category-id={categoryId}>
                {sortedStages.map((stage) => {
                    const stageProjects = projectsByStage.get(stage.id) || [];
                    return (
                        <section key={stage.id} className="projects-mobile-stage-group">
                            <header className="projects-mobile-stage-header">
                                <h6 className="mb-0">{stage?.name || 'Stage'}</h6>
                                <span className="badge bg-secondary">{stageProjects.length}</span>
                            </header>

                            <div className="projects-mobile-stage-body">
                                {stageProjects.length === 0 && (
                                    <p className="text-muted small mb-0">Nessun progetto</p>
                                )}

                                {stageProjects.map((project) => {
                                    const projectId = String(project?.id || '');
                                    const currentStageId = resolveProjectStageId(project);
                                    const targetStageId = mobileTargetStageByProject[projectId] || currentStageId;
                                    const isMoving = movingProjectIds.has(project.id);

                                    return (
                                        <article key={projectId} className="projects-mobile-card">
                                            <button
                                                type="button"
                                                className="projects-mobile-card-link"
                                                onClick={() => openProjectDetail(project?.id)}
                                            >
                                                <div className="projects-mobile-card-title">{project?.name || 'Senza nome'}</div>
                                                <div className="projects-mobile-card-meta">Cliente: {resolveClientName(project)}</div>
                                                {formatCurrencyValue(project?.value) && (
                                                    <div className="projects-mobile-card-meta">Valore: {formatCurrencyValue(project?.value)}</div>
                                                )}
                                                {formatDateValue(project?.dueDate) && (
                                                    <div className="projects-mobile-card-meta">Scadenza: {formatDateValue(project?.dueDate)}</div>
                                                )}
                                            </button>

                                            {canMove && !String(project?.id || '').startsWith('temp-') ? (
                                                <div className="projects-mobile-card-move">
                                                    <Form.Select
                                                        size="sm"
                                                        value={targetStageId}
                                                        onChange={(event) => handleMobileStageTargetChange(projectId, event.target.value)}
                                                    >
                                                        {sortedStages.map((optionStage) => (
                                                            <option key={optionStage.id} value={optionStage.id}>
                                                                {optionStage.name}
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline-secondary"
                                                        disabled={isMoving || !targetStageId || String(targetStageId) === String(currentStageId)}
                                                        onClick={() => onMove?.(project.id, targetStageId)}
                                                        className="projects-mobile-move-btn"
                                                    >
                                                        <ArrowRight size={14} />
                                                        Sposta
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="projects-board-shell" data-category-id={categoryId}>
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="projects-board-columns">
                    {sortedStages.map((stage) => (
                        <StageColumn
                            key={stage.id}
                            stage={stage}
                            projects={projectsByStage.get(stage.id) || []}
                            canMove={canMove}
                            moveDisabledReason="permessi insufficienti"
                            movingProjectIds={movingProjectIds}
                        />
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
};

export default ProjectsBoard;
