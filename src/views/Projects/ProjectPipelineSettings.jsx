import React, { useMemo } from "react";
import { Card, Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import ModulePermissionGate from "../../components/guards/ModulePermissionGate";
import { useChecklistTemplates } from "../../modules/checklists/hooks/useChecklistsQueries";
import { usePipelineCategories, usePipelineStages } from "../../modules/projects/hooks/usePipelineSettingsQueries";
import { usePipelineCategoryActions } from "../../modules/projects/hooks/usePipelineCategoryActions";
import { usePipelineStageActions } from "../../modules/projects/hooks/usePipelineStageActions";
import { useSelectedPipelineCategoryId } from "../../modules/projects/hooks/useSelectedPipelineCategoryId";
import { useStageChecklistRules } from "../../modules/projects/hooks/useStageChecklistRules";
import EmptyState from "../../modules/projects/ui/states/EmptyState";
import ErrorState from "../../modules/projects/ui/states/ErrorState";
import LoadingState from "../../modules/projects/ui/states/LoadingState";
import ConfirmDeleteModal from "../../modules/projects/ui/modals/ConfirmDeleteModal";
import EditStageModal from "../../modules/projects/ui/modals/EditStageModal";
import RenameCategoryModal from "../../modules/projects/ui/modals/RenameCategoryModal";
import CategoriesPanel, { CategoryNameForm } from "../../modules/projects/ui/pipeline/CategoriesPanel";
import StagesPanel from "../../modules/projects/ui/pipeline/StagesPanel";
import { notifyOutcome } from "../../modules/projects/ui/notifyOutcome";
import { getErrorMessage, sortCategories } from "../../modules/projects/ui/pipeline.utils";
import { hasPermission } from "../../utils/workspaceAccess";
import "../../styles/css/project-pipeline-settings.css";
import { readBrandingColor } from "../../lib/brandingColors";

const PIPELINE_SETTINGS_PERMISSION = "projects.edit"; // TODO: replace with a dedicated pipeline-manage permission when available.

const PipelineSettingsContent = ({ access }) => {
  const defaultStageColor = readBrandingColor("--bs-primary", "#0d6efd");
  const categoriesQuery = usePipelineCategories();
  const categories = useMemo(() => sortCategories(categoriesQuery.data || []), [categoriesQuery.data]);

  const { categoryId, setCategoryId } = useSelectedPipelineCategoryId(categories);
  const stagesQuery = usePipelineStages(categoryId);
  const checklistTemplatesQuery = useChecklistTemplates();

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

  const categoryActions = usePipelineCategoryActions({ categoriesQuery, categoryId, setCategoryId });
  const stageActions = usePipelineStageActions({ categoryId, stagesQuery, activeChecklistTemplates, defaultStageColor });

  const { rulesByStageId, toggleTemplate, toggleGate, saveRules } = useStageChecklistRules({
    categoryId,
    stages: stageActions.stages,
    enabled: canManageStageChecklistRules,
  });

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    notifyOutcome(await categoryActions.createCategory(), "Categoria creata");
  };

  const handleCreateStage = async (event) => {
    event.preventDefault();
    notifyOutcome(await stageActions.createStage(), "Stage creato");
  };

  const handleSaveCategoryRename = async () => notifyOutcome(await categoryActions.saveRename(), "Salvato");
  const handleDeleteCategory = async () => notifyOutcome(await categoryActions.deleteCategory(), "Categoria eliminata");
  const handleSaveStage = async () => notifyOutcome(await stageActions.saveStage(), "Salvato");
  const handleDeleteStage = async () => notifyOutcome(await stageActions.deleteStage(), "Stage eliminato");
  const handleMoveStage = async (index, direction) => notifyOutcome(await stageActions.moveStage(index, direction), "Salvato", { autoClose: 1300 });
  const handleSaveStageRules = async (stageId) => notifyOutcome(await saveRules(stageId), "Regole checklist salvate");

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
              value={categoryActions.newCategoryName}
              onChange={categoryActions.setNewCategoryName}
              onSubmit={handleCreateCategory}
              creating={categoryActions.creating}
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
              newCategoryName={categoryActions.newCategoryName}
              onNewCategoryNameChange={categoryActions.setNewCategoryName}
              onCreateCategory={handleCreateCategory}
              onEditCategory={categoryActions.setEditingCategory}
              onDeleteCategory={categoryActions.setDeletingCategory}
              creating={categoryActions.creating}
            />
          </Col>

          <Col xl={8}>
            <StagesPanel
              selectedCategoryName={selectedCategory?.name || ""}
              canCreateStage={Boolean(categoryId)}
              showCreateForm={stageActions.showCreateForm}
              onToggleCreateForm={() => stageActions.setShowCreateForm((current) => !current)}
              onOpenCreateForm={() => stageActions.setShowCreateForm(true)}
              newStage={stageActions.newStage}
              onNewStageChange={(patch) => stageActions.setNewStage((current) => ({ ...current, ...patch }))}
              onSubmitCreateStage={handleCreateStage}
              onCancelCreateStage={stageActions.closeCreateForm}
              creatingStage={stageActions.creating}
              loading={stagesQuery.loading}
              errorMessage={stagesQuery.error ? getErrorMessage(stagesQuery.error) : ""}
              onRetry={stagesQuery.refetch}
              stages={stageActions.stages}
              defaultStageColor={defaultStageColor}
              checklistTemplates={activeChecklistTemplates}
              checklistTemplateNameById={checklistTemplateNameById}
              canManageChecklistRules={canManageStageChecklistRules}
              stageRulesByStageId={rulesByStageId}
              reordering={stageActions.reordering}
              onMoveStage={(index, direction) => void handleMoveStage(index, direction)}
              onEditStage={stageActions.setEditingStage}
              onDeleteStage={stageActions.setDeletingStage}
              onToggleRuleTemplate={toggleTemplate}
              onToggleRuleGate={toggleGate}
              onSaveRules={(stageId) => void handleSaveStageRules(stageId)}
            />
          </Col>
        </Row>
      )}

      <RenameCategoryModal
        category={categoryActions.editingCategory}
        onChange={(name) => categoryActions.setEditingCategory((current) => ({ ...(current || {}), name }))}
        onCancel={() => categoryActions.setEditingCategory(null)}
        onSave={() => void handleSaveCategoryRename()}
        saving={categoryActions.renaming}
      />

      <ConfirmDeleteModal
        show={Boolean(categoryActions.deletingCategory)}
        title="Eliminare categoria?"
        message="Questa azione puo fallire se la categoria e in uso."
        onCancel={() => categoryActions.setDeletingCategory(null)}
        onConfirm={() => void handleDeleteCategory()}
        confirming={categoryActions.deleting}
      />

      <EditStageModal
        stage={stageActions.editingStage}
        checklistTemplates={activeChecklistTemplates}
        defaultColor={defaultStageColor}
        onChange={(patch) => stageActions.setEditingStage((current) => ({ ...(current || {}), ...patch }))}
        onCancel={() => stageActions.setEditingStage(null)}
        onSave={() => void handleSaveStage()}
        saving={stageActions.saving}
      />

      <ConfirmDeleteModal
        show={Boolean(stageActions.deletingStage)}
        title="Eliminare stage?"
        message="Vuoi eliminare questo stage? Questa azione non e reversibile."
        onCancel={() => stageActions.setDeletingStage(null)}
        onConfirm={() => void handleDeleteStage()}
        confirming={stageActions.deleting}
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
