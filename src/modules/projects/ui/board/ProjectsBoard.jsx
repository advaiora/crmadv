import React, { useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import StageColumn from './StageColumn';
import './projects-board.css';

const sortStages = (stages) =>
    [...stages].sort((left, right) => {
        const leftOrder = Number(left?.sortOrder);
        const rightOrder = Number(right?.sortOrder);
        const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
        const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

        if (safeLeftOrder !== safeRightOrder) {
            return safeLeftOrder - safeRightOrder;
        }

        return String(left?.name || '').localeCompare(String(right?.name || ''), 'it');
    });

const resolveProjectStageId = (project) => (
    project?.stageId
    || project?.pipelineStageId
    || project?.stage?.id
    || ''
);

const ProjectsBoard = ({
    categoryId,
    stages,
    projects,
    onMove,
    canMove,
    onQuickCreate,
    movingProjectIds = new Set(),
}) => {
    const sortedStages = useMemo(() => sortStages(stages || []), [stages]);

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

    const onDragEnd = (result) => {
        if (!canMove) {
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
