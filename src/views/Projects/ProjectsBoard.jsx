import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Col, Form, Row } from "react-bootstrap";
import { Plus } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import ModulePermissionGate from "../../components/guards/ModulePermissionGate";
import { createProject, isApiError, moveProject } from "../../modules/projects/api/projects.api";
import { useCategories, useProjects, useStages } from "../../modules/projects/hooks/useProjectsQueries";
import { useSelectedCategoryId } from "../../modules/projects/hooks/useSelectedCategoryId";
import ProjectsBoardLayout from "../../modules/projects/ui/board/ProjectsBoard";
import QuickCreateProjectModal from "../../modules/projects/ui/modals/QuickCreateProjectModal";
import EmptyState from "../../modules/projects/ui/states/EmptyState";
import ErrorState from "../../modules/projects/ui/states/ErrorState";
import LoadingState from "../../modules/projects/ui/states/LoadingState";
import { hasPermission } from "../../utils/workspaceAccess";

const sortCategories = (categories) =>
  [...categories].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder);
    const rightOrder = Number(right?.sortOrder);
    const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
    const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

    if (safeLeftOrder !== safeRightOrder) {
      return safeLeftOrder - safeRightOrder;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""), "it");
  });

const sortStages = (stages) =>
  [...stages].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder);
    const rightOrder = Number(right?.sortOrder);
    const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
    const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

    if (safeLeftOrder !== safeRightOrder) {
      return safeLeftOrder - safeRightOrder;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""), "it");
  });

const getErrorMessage = (error) => {
  if (!error) return "";
  if (isApiError(error)) return `${error.message} (${error.code || error.status || "API_ERROR"})`;
  return error?.message || "Errore inatteso";
};

const resolveProjectStageId = (project) => project?.stageId || project?.pipelineStageId || project?.stage?.id || "";
const withProjectStageId = (project, stageId) => ({ ...project, stageId, pipelineStageId: stageId });
const normalizeBoardProject = (project) => withProjectStageId(project, resolveProjectStageId(project));

const moveProjectInBoard = (projects, projectId, toStageId) => {
  const projectIndex = projects.findIndex((project) => String(project.id) === String(projectId));
  if (projectIndex === -1) return projects;

  const targetProject = projects[projectIndex];
  const fromStageId = resolveProjectStageId(targetProject);
  if (!toStageId || toStageId === fromStageId) return projects;

  const nextProjects = [...projects];
  nextProjects.splice(projectIndex, 1);
  nextProjects.push(withProjectStageId(targetProject, toStageId));
  return nextProjects;
};

const SectionCard = ({ children, className = "" }) => (
  <Card className={`border-0 shadow-sm rounded-4 ${className}`}>
    <Card.Body className="p-3 p-md-4">{children}</Card.Body>
  </Card>
);

const ProjectsBoardContent = ({ access }) => {
  const categoriesQuery = useCategories();
  const categories = useMemo(() => sortCategories(categoriesQuery.data || []), [categoriesQuery.data]);

  const { categoryId, setCategoryId } = useSelectedCategoryId(categories);
  const stagesQuery = useStages(categoryId);
  const projectsQuery = useProjects(categoryId);

  const stages = useMemo(() => sortStages(stagesQuery.data || []), [stagesQuery.data]);
  const [boardProjects, setBoardProjects] = useState([]);
  const boardProjectsRef = useRef([]);
  const [movingProjectIds, setMovingProjectIds] = useState(() => new Set());

  const [isQuickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateSubmitting, setQuickCreateSubmitting] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState("");
  const [quickCreateDraft, setQuickCreateDraft] = useState({
    name: "",
    description: "",
    value: "",
    dueDate: "",
    clientIds: [],
  });

  const canMove = hasPermission(access, "projects.edit");
  const canOverrideGate = hasPermission(access, "checklists.override_gate");
  const canCreate = hasPermission(access, "projects.create") || hasPermission(access, "projects.edit");
  const defaultStageId = stages[0]?.id || "";
  const quickCreateDisabledReason = !canCreate ? "Non hai permessi" : !defaultStageId ? "Nessuno stage configurato per questa categoria" : "";

  useEffect(() => {
    const normalizedProjects = (projectsQuery.data || []).map(normalizeBoardProject);
    setBoardProjects(normalizedProjects);
  }, [projectsQuery.data]);

  useEffect(() => {
    boardProjectsRef.current = boardProjects;
  }, [boardProjects]);

  useEffect(() => {
    setQuickCreateOpen(false);
    setQuickCreateError("");
  }, [categoryId]);

  const refetchBoard = useCallback(() => {
    stagesQuery.refetch();
    projectsQuery.refetch();
  }, [projectsQuery, stagesQuery]);

  const showMoveConflictToast = useCallback(() => {
    toast.error(
      ({ closeToast }) => (
        <div className="d-flex flex-column gap-2">
          <span>Qualcuno ha aggiornato il progetto. Ricarica la board.</span>
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={() => {
              closeToast?.();
              void projectsQuery.refetch();
            }}
          >
            Ricarica
          </Button>
        </div>
      ),
      { autoClose: 7000 },
    );
  }, [projectsQuery]);

  const handleMove = useCallback(
    async (projectId, toStageId) => {
      if (!canMove) return;

      let previousProjects = null;

      setBoardProjects((currentProjects) => {
        const nextProjects = moveProjectInBoard(currentProjects, projectId, toStageId);
        if (nextProjects === currentProjects) return currentProjects;
        previousProjects = currentProjects;
        return nextProjects;
      });

      if (!previousProjects) return;

      setMovingProjectIds((current) => {
        const next = new Set(current);
        next.add(projectId);
        return next;
      });

      try {
        await moveProject(projectId, { toStageId });
        void projectsQuery.refetch();
      } catch (error) {
        setBoardProjects(previousProjects);

        if (isApiError(error) && error.status === 403) {
          if (error.code === "GATE_BLOCKED") {
            if (canOverrideGate) {
              const reason = window.prompt("Gate checklist bloccato. Inserisci una motivazione (min 10 caratteri) per forzare il passaggio:");
              const normalizedReason = typeof reason === "string" ? reason.trim() : "";
              if (normalizedReason.length >= 10) {
                try {
                  await moveProject(projectId, {
                    toStageId,
                    overrideGate: true,
                    overrideReason: normalizedReason,
                  });
                  toast.success("Stage aggiornato con override gate");
                  void projectsQuery.refetch();
                  return;
                } catch (overrideError) {
                  toast.error(getErrorMessage(overrideError) || "Override gate non riuscito");
                  return;
                }
              }
            }

            const missingCount = Array.isArray(error.details?.missingItems)
              ? error.details.missingItems.reduce((count, item) => {
                const missing = Array.isArray(item?.missingRequiredItemIds)
                  ? item.missingRequiredItemIds.length
                  : 0;
                return count + missing;
              }, 0)
              : 0;
            toast.error(
              missingCount > 0
                ? `Gate checklist bloccato: completa ${missingCount} item obbligatori prima di spostare lo stage.`
                : "Gate checklist bloccato: completa gli item obbligatori prima di spostare lo stage.",
            );
            return;
          }
        }

        if (isApiError(error) && error.status === 409) {
          showMoveConflictToast();
          return;
        }

        toast.error("Impossibile spostare il progetto");
      } finally {
        setMovingProjectIds((current) => {
          const next = new Set(current);
          next.delete(projectId);
          return next;
        });
      }
    },
    [canMove, canOverrideGate, projectsQuery, showMoveConflictToast],
  );

  const openQuickCreate = useCallback(() => {
    if (!canCreate || !defaultStageId) return;
    setQuickCreateError("");
    setQuickCreateOpen(true);
  }, [canCreate, defaultStageId]);

  const closeQuickCreate = useCallback(() => {
    if (quickCreateSubmitting) return;
    setQuickCreateOpen(false);
  }, [quickCreateSubmitting]);

  const handleQuickCreateSubmit = useCallback(
    async (values) => {
      if (!canCreate) return;

      if (!defaultStageId) {
        setQuickCreateError("Nessuno stage configurato per questa categoria.");
        return;
      }

      setQuickCreateSubmitting(true);
      setQuickCreateError("");
      setQuickCreateOpen(false);

      const optimisticId = `temp-${Date.now()}`;
      const previousProjects = boardProjectsRef.current;
      const now = new Date().toISOString();

      const optimisticProject = normalizeBoardProject({
        id: optimisticId,
        name: values.name,
        description: values.description || null,
        value: values.value ?? null,
        dueDate: values.dueDate || null,
        clientId: values.clientId || null,
        clientIds: values.clientIds || [],
        clientName: values.clientName || null,
        clientNames: Array.isArray(values.clients) ? values.clients.map((client) => client.name) : [],
        clients: Array.isArray(values.clients)
          ? values.clients.map((client) => ({ id: client.id, name: client.name }))
          : [],
        categoryId,
        stageId: defaultStageId,
        createdAt: now,
        updatedAt: now,
      });

      setBoardProjects((currentProjects) => [...currentProjects, optimisticProject]);

      try {
        const payload = { name: values.name, categoryId, stageId: defaultStageId };
        if (values.clientId) payload.clientId = values.clientId;
        if (Array.isArray(values.clientIds)) payload.clientIds = values.clientIds;
        if (values.description !== undefined) payload.description = values.description;
        if (values.value !== undefined) payload.value = values.value;
        if (values.dueDate !== undefined) payload.dueDate = values.dueDate;

        const createdProject = await createProject(payload);
        const normalizedCreatedProject = normalizeBoardProject({
          ...createdProject,
          stageId: resolveProjectStageId(createdProject) || defaultStageId,
        });

        setBoardProjects((currentProjects) => currentProjects.map((project) => (project.id === optimisticId ? normalizedCreatedProject : project)));

        setQuickCreateDraft({
          name: "",
          description: "",
          value: "",
          dueDate: "",
          clientIds: [],
        });
        toast.success("Creato");
        void projectsQuery.refetch();
      } catch (error) {
        setBoardProjects(previousProjects);
        setQuickCreateDraft({
          name: values.name || "",
          description: values.description || "",
          value: values.value !== undefined && values.value !== null ? String(values.value) : "",
          dueDate: values.dueDate || "",
          clientIds: Array.isArray(values.clientIds) ? values.clientIds : [],
        });
        setQuickCreateError(getErrorMessage(error) || "Errore creazione progetto");
        setQuickCreateOpen(true);
        toast.error("Errore creazione progetto");
      } finally {
        setQuickCreateSubmitting(false);
      }
    },
    [canCreate, categoryId, defaultStageId, projectsQuery],
  );

  // ====== Stati “incorniciati” ======
  if (categoriesQuery.loading) {
    return (
      <SectionCard>
        <LoadingState message="Caricamento categorie progetto..." />
      </SectionCard>
    );
  }

  if (categoriesQuery.error) {
    return (
      <SectionCard>
        <ErrorState title="Errore categorie" message={getErrorMessage(categoriesQuery.error)} onRetry={categoriesQuery.refetch} />
      </SectionCard>
    );
  }

  if (!categories.length) {
    return (
      <SectionCard>
        <EmptyState title="Nessuna categoria disponibile" description="Crea almeno una categoria per iniziare a visualizzare la board." />
      </SectionCard>
    );
  }

  const projectsCount = boardProjects.length;
  const stagesCount = stages.length;

  return (
    <>
      {/* Toolbar */}
      <SectionCard className="mb-3">
        <Row className="g-3 align-items-end">
          <Col xs={12} lg={6}>
            <Form.Group>
              <Form.Label className="small text-muted mb-1">Categoria</Form.Label>
              <Form.Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="py-2">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col xs={12} lg={6} className="d-flex justify-content-lg-end">
            <div className="d-grid d-lg-flex gap-2">
              <Button
                variant="primary"
                onClick={openQuickCreate}
                disabled={Boolean(quickCreateDisabledReason)}
                title={quickCreateDisabledReason || undefined}
                className="d-inline-flex align-items-center justify-content-center gap-2 py-2 px-3 rounded-3"
              >
                <Plus size={16} />
                Nuovo progetto
              </Button>
            </div>
          </Col>
        </Row>
      </SectionCard>

      {/* Board container */}
      <div className="rounded-4">
        {stagesQuery.loading && (
          <SectionCard className="mb-3">
            <LoadingState message="Caricamento stage..." />
          </SectionCard>
        )}

        {(stagesQuery.error || projectsQuery.error) && (
          <SectionCard className="mb-3">
            <ErrorState title="Errore board progetti" message={getErrorMessage(stagesQuery.error || projectsQuery.error)} onRetry={refetchBoard} />
          </SectionCard>
        )}

        {!stagesQuery.loading && projectsQuery.loading && !stagesQuery.error && (
          <SectionCard className="mb-3">
            <LoadingState message="Caricamento progetti..." />
          </SectionCard>
        )}

        {!stagesQuery.loading && !projectsQuery.loading && !stagesQuery.error && !projectsQuery.error && (
          <>
            {!stages.length && (
              <SectionCard className="mb-3">
                <EmptyState title="Nessuno stage configurato per questa categoria" description="Configura almeno uno stage per visualizzare la board." />
              </SectionCard>
            )}

            {stages.length > 0 && boardProjects.length === 0 && (
              <SectionCard className="mb-3">
                <EmptyState title="Nessun progetto in questa pipeline" description="Aggiungi un progetto per iniziare a popolare le colonne." />
              </SectionCard>
            )}

            {stages.length > 0 && boardProjects.length > 0 && (
              <div className="mt-2">
                {/* Board già gestisce la UI interna */}
                <ProjectsBoardLayout
                  categoryId={categoryId}
                  stages={stages}
                  projects={boardProjects}
                  onMove={handleMove}
                  canMove={canMove}
                  onQuickCreate={openQuickCreate}
                  movingProjectIds={movingProjectIds}
                />
              </div>
            )}
          </>
        )}
      </div>

      <QuickCreateProjectModal
        show={isQuickCreateOpen}
        onHide={closeQuickCreate}
        onSubmit={handleQuickCreateSubmit}
        submitting={quickCreateSubmitting}
        submitError={quickCreateError}
        categoryId={categoryId}
        defaultStageId={defaultStageId}
        initialValues={quickCreateDraft}
      />
    </>
  );
};

const ProjectsBoard = () => {
  return (
    <ModulePermissionGate requiredModule="projects" requiredPermission="projects.view" moduleName="Progetti">
      {({ access }) => (
        <div className="container-fluid py-4 projects-page">
          {/* Page header */}
          <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-2 mb-3">
            <div>
              <h3 className="mb-1 fw-semibold">Progetti</h3>
              <p className="text-muted mb-0">Board operativa per categoria</p>
            </div>
          </div>

          <ProjectsBoardContent access={access} />

          <ToastContainer position="bottom-right" theme="light" />
        </div>
      )}
    </ModulePermissionGate>
  );
};

export default ProjectsBoard;
