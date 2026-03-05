// StageColumn.jsx
import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Badge } from "react-bootstrap";
import ProjectCard from "./ProjectCard";

const StageColumn = ({ stage, projects, canMove, moveDisabledReason, movingProjectIds }) => {
  return (
    <div className="projects-stage-column">
      <div className="projects-stage-header">
        <h6 className="mb-0">{stage?.name || "Stage"}</h6>
        <Badge bg="secondary">{projects.length}</Badge>
      </div>

      <Droppable droppableId={String(stage?.id || "")}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`projects-stage-dropzone ${snapshot.isDraggingOver ? "is-dragging-over" : ""}`}
            title={!canMove ? moveDisabledReason : undefined}
          >
            {projects.length === 0 && <p className="text-muted small mb-0 py-2 px-1">Nessun progetto</p>}

            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                stageColor={stage?.color}
                stageName={stage?.name}
                index={index}
                canMove={canMove}
                moveDisabledReason={moveDisabledReason}
                isMoving={movingProjectIds.has(project.id)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default StageColumn;
