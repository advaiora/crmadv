import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import AccessDeniedScreen from '../../components/guards/AccessDeniedScreen';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import ProjectChecklistPanel from '../../modules/checklists/ui/ProjectChecklistPanel';
import {
    deleteProject,
    getProjectStageHistory,
    isApiError,
    updateProject,
} from '../../modules/projects/api/projects.api';
import { useProject } from '../../modules/projects/hooks/useProjectsQueries';
import ProjectAccessPanel from '../../modules/projects/ui/detail/ProjectAccessPanel';
import ProjectDetailsCard from '../../modules/projects/ui/detail/ProjectDetailsCard';
import ProjectEditForm from '../../modules/projects/ui/detail/ProjectEditForm';
import ProjectHeader from '../../modules/projects/ui/detail/ProjectHeader';
import ProjectStageHistory from '../../modules/projects/ui/detail/ProjectStageHistory';
import ErrorState from '../../modules/projects/ui/states/ErrorState';
import { getErrorMessage } from '../../modules/projects/ui/pipelineSettings.utils';
import { hasPermission } from '../../utils/workspaceAccess';

const ProjectNotFoundState = ({ backPath }) => (
    <div className="py-4">
        <h4 className="mb-2">Progetto non trovato</h4>
        <p className="text-muted mb-3">
            Il progetto richiesto non esiste o e stato eliminato.
        </p>
        <Button as={Link} to={backPath} variant="outline-primary">
            Torna ai progetti
        </Button>
    </div>
);

const ProjectDetailContent = ({ access, id }) => {
    const history = useHistory();
    const location = useLocation();
    const projectQuery = useProject(id);

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [projectSnapshot, setProjectSnapshot] = useState(null);
    const [historyState, setHistoryState] = useState({
        data: null,
        loading: false,
        error: null,
    });

    const canEdit = hasPermission(access, 'projects.edit');
    const canDelete = hasPermission(access, 'projects.delete');

    useEffect(() => {
        setProjectSnapshot(null);
        setIsEditing(false);
        setSaveError('');
        setShowDeleteConfirm(false);
        setHistoryState({
            data: null,
            loading: false,
            error: null,
        });
    }, [id]);

    useEffect(() => {
        if (projectQuery.data) {
            setProjectSnapshot(projectQuery.data);
        }
    }, [projectQuery.data]);

    const project = projectSnapshot || projectQuery.data;

    const listPath = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const categoryId = params.get('categoryId');
        return categoryId ? `/projects?categoryId=${encodeURIComponent(categoryId)}` : '/projects';
    }, [location.search]);

    const loadStageHistory = useCallback(async () => {
        if (!project?.id) {
            setHistoryState({
                data: null,
                loading: false,
                error: null,
            });
            return;
        }

        setHistoryState((current) => ({
            ...current,
            loading: true,
            error: null,
        }));

        try {
            const stageHistory = await getProjectStageHistory(project.id);
            setHistoryState({
                data: stageHistory,
                loading: false,
                error: null,
            });
        } catch (error) {
            setHistoryState({
                data: null,
                loading: false,
                error,
            });
        }
    }, [project?.id]);

    useEffect(() => {
        if (!project?.id) {
            return;
        }

        void loadStageHistory();
    }, [loadStageHistory, project?.id]);

    const handleToggleEdit = () => {
        if (!canEdit) {
            return;
        }

        setSaveError('');
        setIsEditing((current) => !current);
    };

    const handleSave = async (patch) => {
        if (!project?.id || saving) {
            return;
        }

        setSaving(true);
        setSaveError('');

        try {
            const updatedProject = await updateProject(project.id, patch);
            setProjectSnapshot(updatedProject);
            setIsEditing(false);
            toast.success('Salvato');
            projectQuery.refetch();
        } catch (error) {
            setSaveError(getErrorMessage(error) || 'Errore salvataggio');
            toast.error('Errore salvataggio');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!project?.id || deleting) {
            return;
        }

        setDeleting(true);

        try {
            await deleteProject(project.id);
            toast.success('Eliminato');
            history.push(listPath);
        } catch (_error) {
            toast.error('Impossibile eliminare');
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (projectQuery.loading && !project) {
        return (
            <>
                <ProjectHeader loading canEdit={false} canDelete={false} />
                <ProjectDetailsCard loading />
                <ProjectStageHistory
                    history={null}
                    loading
                    error={null}
                />
            </>
        );
    }

    if (projectQuery.error) {
        if (isApiError(projectQuery.error) && projectQuery.error.status === 403) {
            return <AccessDeniedScreen />;
        }

        if (isApiError(projectQuery.error) && projectQuery.error.status === 404) {
            return <ProjectNotFoundState backPath={listPath} />;
        }

        return (
            <ErrorState
                title="Errore dettaglio progetto"
                message={getErrorMessage(projectQuery.error)}
                onRetry={projectQuery.refetch}
            />
        );
    }

    if (!project) {
        return <ProjectNotFoundState backPath={listPath} />;
    }

    return (
        <>
            <div className="mb-3">
                <Link to={listPath} className="text-primary">
                    &larr; Torna a Progetti
                </Link>
            </div>

            <ProjectHeader
                project={project}
                loading={false}
                canEdit={canEdit}
                canDelete={canDelete}
                isEditing={isEditing}
                onToggleEdit={handleToggleEdit}
                onDelete={() => setShowDeleteConfirm(true)}
            />

            {isEditing && canEdit ? (
                <ProjectEditForm
                    project={project}
                    submitting={saving}
                    errorMessage={saveError}
                    onSubmit={handleSave}
                    onCancel={() => setIsEditing(false)}
                    supportedFields={['name', 'description', 'value', 'dueDate', 'clientIds']}
                />
            ) : (
                <ProjectDetailsCard project={project} loading={false} />
            )}

            <ProjectStageHistory
                history={historyState.data}
                loading={historyState.loading}
                error={historyState.error}
                onRetry={loadStageHistory}
            />

            <ProjectChecklistPanel project={project} access={access} />

            <ProjectAccessPanel projectId={project.id} />

            <Modal
                show={showDeleteConfirm}
                onHide={() => setShowDeleteConfirm(false)}
                centered
            >
                <Modal.Header closeButton={!deleting}>
                    <Modal.Title>Eliminare progetto?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Vuoi eliminare questo progetto? Questa azione non e reversibile.
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="outline-secondary"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
                    >
                        Annulla
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                    >
                        {deleting ? 'Eliminazione...' : 'Elimina'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

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
                    <ProjectDetailContent access={access} id={id} />
                    <ToastContainer position="bottom-right" theme="light" />
                </div>
            )}
        </ModulePermissionGate>
    );
};

export default ProjectDetail;
