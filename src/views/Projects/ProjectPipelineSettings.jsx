import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Row } from "react-bootstrap";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import ModulePermissionGate from "../../components/guards/ModulePermissionGate";
import { useChecklistTemplates } from "../../modules/checklists/hooks/useChecklistsQueries";
import {
  useCreateCategory,
  useCreateStage,
  useDeleteCategory,
  useDeleteStage,
  usePipelineCategories,
  usePipelineStages,
  useReorderStages,
  useUpdateCategory,
  useUpdateStage,
} from "../../modules/projects/hooks/usePipelineSettingsQueries";
import { useSelectedPipelineCategoryId } from "../../modules/projects/hooks/useSelectedPipelineCategoryId";
import { useStageChecklistRules } from "../../modules/projects/hooks/useStageChecklistRules";
import EmptyState from "../../modules/projects/ui/states/EmptyState";
import ErrorState from "../../modules/projects/ui/states/ErrorState";
import LoadingState from "../../modules/projects/ui/states/LoadingState";
import ConfirmDeleteModal from "../../modules/projects/ui/modals/ConfirmDeleteModal";
import EditStageModal from "../../modules/projects/ui/modals/EditStageModal";
import RenameCategoryModal from "../../modules/projects/ui/modals/RenameCategoryModal";
import CategoriesPanel, { CategoryNameForm } from "../../modules/projects/ui/pipeline/CategoriesPanel";
import CreateStageForm from "../../modules/projects/ui/pipeline/CreateStageForm";
import StageList from "../../modules/projects/ui/pipeline/StageList";
import {
  getErrorMessage,
  isInUseError,
  isLastStageError,
  sortCategories,
  sortStages,
} from "../../modules/projects/ui/pipeline.utils";
import { hasPermission } from "../../utils/workspaceAccess";
import "../../styles/css/project-pipeline-settings.css";
import { readBrandingColor } from "../../lib/brandingColors";

const PIPELINE_SETTINGS_PERMISSION = "projects.edit"; // TODO: replace with a dedicated pipeline-manage permission when available.

const emptyNewStage = (defaultColor) => ({
  name: "",
  color: defaultColor,
  isClosed: false,
  isGated: false,
  gateChecklistTemplateId: "",
  autoCreateInstance: true,
});

const PipelineSettingsContent = ({ access }) => {
  const defaultStageColor = readBrandingColor("--bs-primary", "#0d6efd");
  const categoriesQuery = usePipelineCategories();
  const categories = useMemo(() => sortCategories(categoriesQuery.data || []), [categoriesQuery.data]);

  const { categoryId, setCategoryId } = useSelectedPipelineCategoryId(categories);
  const stagesQuery = usePipelineStages(categoryId);
  const checklistTemplatesQuery = useChecklistTemplates();

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const createStageMutation = useCreateStage();
  const updateStageMutation = useUpdateStage();
  const deleteStageMutation = useDeleteStage();
  const reorderStagesMutation = useReorderStages();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);

  const [showCreateStageForm, setShowCreateStageForm] = useState(false);
  const [newStage, setNewStage] = useState(() => emptyNewStage(defaultStageColor));

  const [editingStage, setEditingStage] = useState(null);
  const [deletingStage, setDeletingStage] = useState(null);
  const [localStages, setLocalStages] = useState([]);

  useEffect(() => {
    setLocalStages(sortStages(stagesQuery.data || []));
  }, [stagesQuery.data]);

  const activeChecklistTemplates = useMemo(
    () => (checklistTemplatesQuery.data || []).filter((template) => !template.isArchived),
    [checklistTemplatesQuery.data],
  );
  const checklistTemplateNameById = useMemo(
    () => new Map(activeChecklistTemplates.map((template) => [template.id, template.name])),
    [activeChecklistTemplates],
  );

  const selectedCategory = useMemo(() => categories.find((category) => category.id === categoryId) || null, [categories, categoryId]);
  const canManageStageChecklistRules = hasPermission(access, "checklists.manage_templates");

  const { rulesByStageId, toggleTemplate, toggleGate, saveRules } = useStageChecklistRules({
    categoryId,
    stages: localStages,
    enabled: canManageStageChecklistRules,
  });

  const handleSaveStageRules = async (stageId) => {
    const { attempted, error } = await saveRules(stageId);
    if (!attempted) {
      return;
    }

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Regole checklist salvate");
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();

    const normalizedName = newCategoryName.trim();
    if (!normalizedName) {
      toast.error("Nome categoria obbligatorio");
      return;
    }

    try {
      const createdCategory = await createCategoryMutation.mutate({
        name: normalizedName,
      });

      setNewCategoryName("");
      await categoriesQuery.refetch();
      setCategoryId(createdCategory?.id || "");
      toast.success("Categoria creata");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore creazione categoria");
    }
  };

  const handleSaveCategoryRename = async () => {
    if (!editingCategory?.id) {
      return;
    }

    const normalizedName = String(editingCategory.name || "").trim();
    if (!normalizedName) {
      toast.error("Nome categoria obbligatorio");
      return;
    }

    try {
      await updateCategoryMutation.mutate(editingCategory.id, {
        name: normalizedName,
      });
      setEditingCategory(null);
      await categoriesQuery.refetch();
      toast.success("Salvato");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore salvataggio categoria");
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory?.id) {
      return;
    }

    try {
      await deleteCategoryMutation.mutate(deletingCategory.id);
      const deletedCategoryId = deletingCategory.id;
      setDeletingCategory(null);
      await categoriesQuery.refetch();
      if (deletedCategoryId === categoryId) {
        setCategoryId("");
      }
      toast.success("Categoria eliminata");
    } catch (error) {
      if (isInUseError(error)) {
        toast.error("Categoria in uso: elimina prima stage e progetti");
        return;
      }

      toast.error(getErrorMessage(error) || "Errore eliminazione categoria");
    }
  };

  const closeCreateStageForm = () => {
    setNewStage(emptyNewStage(defaultStageColor));
    setShowCreateStageForm(false);
  };

  const handleCreateStage = async (event) => {
    event.preventDefault();

    if (!categoryId) {
      toast.error("Seleziona una categoria");
      return;
    }

    const normalizedName = newStage.name.trim();
    if (!normalizedName) {
      toast.error("Nome stage obbligatorio");
      return;
    }
    if (newStage.isGated && !newStage.gateChecklistTemplateId) {
      toast.error("Seleziona un template checklist per il gate");
      return;
    }
    if (newStage.isGated && activeChecklistTemplates.length === 0) {
      toast.error("Nessun template checklist attivo disponibile");
      return;
    }

    try {
      await createStageMutation.mutate(categoryId, {
        name: normalizedName,
        isClosed: Boolean(newStage.isClosed),
        color: newStage.color || undefined,
        isGated: Boolean(newStage.isGated),
        gateChecklistTemplateId: newStage.isGated ? newStage.gateChecklistTemplateId || null : null,
        autoCreateInstance: Boolean(newStage.autoCreateInstance),
        sortOrder: localStages.length,
      });
      closeCreateStageForm();
      await stagesQuery.refetch();
      toast.success("Stage creato");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore creazione stage");
    }
  };

  const handleSaveStage = async () => {
    if (!editingStage?.id) {
      return;
    }

    const normalizedName = String(editingStage.name || "").trim();
    if (!normalizedName) {
      toast.error("Nome stage obbligatorio");
      return;
    }
    if (editingStage.isGated && !editingStage.gateChecklistTemplateId) {
      toast.error("Seleziona un template checklist per il gate");
      return;
    }

    try {
      await updateStageMutation.mutate(editingStage.id, {
        name: normalizedName,
        isClosed: Boolean(editingStage.isClosed),
        color: editingStage.color || null,
        isGated: Boolean(editingStage.isGated),
        gateChecklistTemplateId: editingStage.isGated ? editingStage.gateChecklistTemplateId || null : null,
        autoCreateInstance: Boolean(editingStage.autoCreateInstance),
      });
      setEditingStage(null);
      await stagesQuery.refetch();
      toast.success("Salvato");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Errore salvataggio stage");
    }
  };

  const handleDeleteStage = async () => {
    if (!deletingStage?.id) {
      return;
    }

    if (localStages.length <= 1) {
      toast.error("Devi avere almeno uno stage nella categoria");
      setDeletingStage(null);
      return;
    }

    try {
      await deleteStageMutation.mutate(deletingStage.id);
      setDeletingStage(null);
      await stagesQuery.refetch();
      toast.success("Stage eliminato");
    } catch (error) {
      if (isInUseError(error)) {
        toast.error("Stage in uso: sposta prima i progetti");
        return;
      }

      if (isLastStageError(error)) {
        toast.error("Devi avere almeno uno stage nella categoria");
        return;
      }

      toast.error(getErrorMessage(error) || "Errore eliminazione stage");
    }
  };

  const handleMoveStage = async (index, direction) => {
    if (!categoryId || reorderStagesMutation.loading) {
      return;
    }

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= localStages.length) {
      return;
    }

    const previousStages = [...localStages];
    const nextStages = [...localStages];
    const temp = nextStages[index];
    nextStages[index] = nextStages[targetIndex];
    nextStages[targetIndex] = temp;

    setLocalStages(nextStages);

    try {
      await reorderStagesMutation.mutate(
        categoryId,
        nextStages.map((stage) => stage.id),
      );
      toast.success("Salvato", { autoClose: 1300 });
      stagesQuery.refetch();
    } catch (_error) {
      setLocalStages(previousStages);
      toast.error("Errore salvataggio ordine");
    }
  };

  if (categoriesQuery.loading) {
    return <LoadingState message="Caricamento categorie pipeline..." />;
  }

  if (categoriesQuery.error) {
    return <ErrorState title="Errore categorie pipeline" message={getErrorMessage(categoriesQuery.error)} onRetry={categoriesQuery.refetch} />;
  }

  return (
    <>
      <div className="mb-3">
        <Link to="/projects" className="text-primary">
          &larr; Torna a Progetti
        </Link>
      </div>

      <div className="mb-3">
        <h3 className="mb-1">Impostazioni pipeline</h3>
      </div>

      {categories.length === 0 && (
        <Card className="card-border mb-3">
          <Card.Body>
            <EmptyState title="Nessuna categoria. Creane una per iniziare." description="Aggiungi una categoria pipeline per configurare gli stage." />

            <CategoryNameForm
              className="mt-3"
              wide
              value={newCategoryName}
              onChange={setNewCategoryName}
              onSubmit={handleCreateCategory}
              creating={createCategoryMutation.loading}
            />
          </Card.Body>
        </Card>
      )}

      {categories.length > 0 && (
        <Row className="g-3">
          <Col xl={4}>
            <CategoriesPanel
              categories={categories}
              selectedCategoryId={categoryId}
              onSelectCategory={setCategoryId}
              newCategoryName={newCategoryName}
              onNewCategoryNameChange={setNewCategoryName}
              onCreateCategory={handleCreateCategory}
              onEditCategory={setEditingCategory}
              onDeleteCategory={setDeletingCategory}
              creating={createCategoryMutation.loading}
            />
          </Col>

          <Col xl={8}>
            <Card className="card-border">
              <Card.Header className="bg-transparent d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <h6 className="mb-0">Stage {selectedCategory ? `- ${selectedCategory.name}` : ""}</h6>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="d-inline-flex align-items-center gap-2"
                  onClick={() => setShowCreateStageForm((current) => !current)}
                  disabled={!categoryId}
                >
                  <Plus size={14} />
                  Stage
                </Button>
              </Card.Header>
              <Card.Body>
                {showCreateStageForm && (
                  <CreateStageForm
                    values={newStage}
                    onChange={(patch) => setNewStage((current) => ({ ...current, ...patch }))}
                    checklistTemplates={activeChecklistTemplates}
                    onSubmit={handleCreateStage}
                    onCancel={closeCreateStageForm}
                    saving={createStageMutation.loading}
                  />
                )}

                {stagesQuery.loading && <LoadingState message="Caricamento stage..." />}

                {stagesQuery.error && <ErrorState title="Errore stage" message={getErrorMessage(stagesQuery.error)} onRetry={stagesQuery.refetch} />}

                {!stagesQuery.loading && !stagesQuery.error && localStages.length === 0 && (
                  <Alert variant="warning" className="mb-0 d-flex justify-content-between align-items-center">
                    <span>Questa categoria non ha stage, aggiungine uno.</span>
                    <Button type="button" variant="outline-warning" size="sm" onClick={() => setShowCreateStageForm(true)}>
                      Aggiungi stage
                    </Button>
                  </Alert>
                )}

                {!stagesQuery.loading && !stagesQuery.error && localStages.length > 0 && (
                  <StageList
                    stages={localStages}
                    defaultStageColor={defaultStageColor}
                    checklistTemplateNameById={checklistTemplateNameById}
                    checklistTemplates={activeChecklistTemplates}
                    canManageChecklistRules={canManageStageChecklistRules}
                    stageRulesByStageId={rulesByStageId}
                    reordering={reorderStagesMutation.loading}
                    onMoveStage={(index, direction) => void handleMoveStage(index, direction)}
                    onEditStage={setEditingStage}
                    onDeleteStage={setDeletingStage}
                    onToggleRuleTemplate={toggleTemplate}
                    onToggleRuleGate={toggleGate}
                    onSaveRules={(stageId) => void handleSaveStageRules(stageId)}
                  />
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <RenameCategoryModal
        category={editingCategory}
        onChange={(name) => setEditingCategory((current) => ({ ...(current || {}), name }))}
        onCancel={() => setEditingCategory(null)}
        onSave={() => void handleSaveCategoryRename()}
        saving={updateCategoryMutation.loading}
      />

      <ConfirmDeleteModal
        show={Boolean(deletingCategory)}
        title="Eliminare categoria?"
        message="Questa azione puo fallire se la categoria e in uso."
        onCancel={() => setDeletingCategory(null)}
        onConfirm={() => void handleDeleteCategory()}
        confirming={deleteCategoryMutation.loading}
      />

      <EditStageModal
        stage={editingStage}
        checklistTemplates={activeChecklistTemplates}
        defaultColor={defaultStageColor}
        onChange={(patch) => setEditingStage((current) => ({ ...(current || {}), ...patch }))}
        onCancel={() => setEditingStage(null)}
        onSave={() => void handleSaveStage()}
        saving={updateStageMutation.loading}
      />

      <ConfirmDeleteModal
        show={Boolean(deletingStage)}
        title="Eliminare stage?"
        message="Vuoi eliminare questo stage? Questa azione non e reversibile."
        onCancel={() => setDeletingStage(null)}
        onConfirm={() => void handleDeleteStage()}
        confirming={deleteStageMutation.loading}
      />

      <ToastContainer position="bottom-right" theme="light" />
    </>
  );
};

const ProjectPipelineSettings = () => {
  return (
    <ModulePermissionGate requiredModule="projects" requiredPermission={PIPELINE_SETTINGS_PERMISSION} moduleName="Progetti">
      {({ access }) => (
        <div className="container-fluid py-4 pipeline-page">
          <PipelineSettingsContent access={access} />
        </div>
      )}
    </ModulePermissionGate>
  );
};

export default ProjectPipelineSettings;
