import React, { useMemo } from 'react';
import { Card, Col, Form, Row } from 'react-bootstrap';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import { isApiError } from '../../modules/projects/api/projects.api';
import { useCategories, useProjects, useStages } from '../../modules/projects/hooks/useProjectsQueries';
import { useSelectedCategoryId } from '../../modules/projects/hooks/useSelectedCategoryId';
import EmptyState from '../../modules/projects/ui/states/EmptyState';
import ErrorState from '../../modules/projects/ui/states/ErrorState';
import LoadingState from '../../modules/projects/ui/states/LoadingState';

const sortCategories = (categories) =>
    [...categories].sort((left, right) => {
        const leftOrder = Number(left?.sortOrder);
        const rightOrder = Number(right?.sortOrder);
        const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
        const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

        if (safeLeftOrder !== safeRightOrder) {
            return safeLeftOrder - safeRightOrder;
        }

        return String(left?.name || '').localeCompare(String(right?.name || ''), 'it');
    });

const getErrorMessage = (error) => {
    if (!error) {
        return '';
    }

    if (isApiError(error)) {
        return `${error.message} (${error.code || error.status || 'API_ERROR'})`;
    }

    return error?.message || 'Errore inatteso';
};

const ProjectsBoardContent = () => {
    const categoriesQuery = useCategories();
    const categories = useMemo(
        () => sortCategories(categoriesQuery.data || []),
        [categoriesQuery.data],
    );

    const { categoryId, setCategoryId } = useSelectedCategoryId(categories);
    const stagesQuery = useStages(categoryId);
    const projectsQuery = useProjects(categoryId);

    const stages = stagesQuery.data || [];
    const projects = projectsQuery.data || [];

    const stageNameById = useMemo(
        () => new Map(stages.map((stage) => [stage.id, stage.name])),
        [stages],
    );

    if (categoriesQuery.loading) {
        return <LoadingState message="Caricamento categorie progetto..." />;
    }

    if (categoriesQuery.error) {
        return (
            <ErrorState
                title="Errore categorie"
                message={getErrorMessage(categoriesQuery.error)}
                onRetry={categoriesQuery.refetch}
            />
        );
    }

    if (!categories.length) {
        return (
            <EmptyState
                title="Nessuna categoria disponibile"
                description="Crea almeno una categoria per iniziare a visualizzare la board."
            />
        );
    }

    return (
        <>
            <Card className="card-border mb-3">
                <Card.Body>
                    <Row className="g-3 align-items-end">
                        <Col md={6} lg={4}>
                            <Form.Group>
                                <Form.Label>Categoria</Form.Label>
                                <Form.Select
                                    value={categoryId}
                                    onChange={(event) => setCategoryId(event.target.value)}
                                >
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {(stagesQuery.loading || projectsQuery.loading) && (
                <LoadingState message="Caricamento stages e progetti..." />
            )}

            {(stagesQuery.error || projectsQuery.error) && (
                <ErrorState
                    title="Errore board progetti"
                    message={getErrorMessage(stagesQuery.error || projectsQuery.error)}
                    onRetry={() => {
                        stagesQuery.refetch();
                        projectsQuery.refetch();
                    }}
                />
            )}

            {!stagesQuery.loading && !projectsQuery.loading && !stagesQuery.error && !projectsQuery.error && (
                <>
                    <Card className="card-border mb-3">
                        <Card.Body>
                            <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
                                <div>
                                    <h6 className="mb-1">Board pronta per Step 3</h6>
                                    <p className="text-muted mb-0">
                                        Dati caricati: {stages.length} stage, {projects.length} progetti
                                    </p>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>

                    {projects.length === 0 ? (
                        <EmptyState
                            title="Nessun progetto trovato"
                            description="La categoria selezionata non contiene ancora progetti."
                        />
                    ) : (
                        <Card className="card-border">
                            <Card.Header className="bg-transparent py-3">
                                <h6 className="mb-0">Progetti caricati</h6>
                            </Card.Header>
                            <Card.Body>
                                <ul className="mb-0 ps-3">
                                    {projects.map((project) => (
                                        <li key={project.id} className="mb-2">
                                            <span className="fw-semibold">{project.name}</span>
                                            <span className="text-muted ms-2">
                                                (stage: {stageNameById.get(project.stageId) || project.stageId})
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </Card.Body>
                        </Card>
                    )}
                </>
            )}
        </>
    );
};

const ProjectsBoard = () => {
    return (
        <ModulePermissionGate
            requiredModule="projects"
            requiredPermission="projects.view"
            moduleName="Progetti"
        >
            <div className="container-fluid py-4">
                <div className="mb-3">
                    <h3 className="mb-1">Progetti</h3>
                    <p className="text-muted mb-0">Board</p>
                </div>
                <ProjectsBoardContent />
            </div>
        </ModulePermissionGate>
    );
};

export default ProjectsBoard;
