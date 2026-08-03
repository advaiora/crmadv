import { Alert, Button, Card } from "react-bootstrap";
import { Plus } from "lucide-react";
import ErrorState from "../states/ErrorState";
import LoadingState from "../states/LoadingState";
import CreateStageForm from "./CreateStageForm";
import StageList from "./StageList";

// Colonna destra della pagina impostazioni pipeline: intestazione col
// pulsante "Stage", modulo di creazione, e l'elenco stage con i suoi stati
// (caricamento, errore, categoria senza stage). Estratta da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// Componente di sola composizione: stato e azioni restano al chiamante.
//
// Due comandi distinti per il modulo di creazione: il pulsante in
// intestazione COMMUTA (riclic = chiudi), quello nell'avviso "senza stage"
// APRE e basta — se il modulo e' gia' aperto non deve chiuderlo.
const StagesPanel = ({
  selectedCategoryName,
  canCreateStage,
  showCreateForm,
  onToggleCreateForm,
  onOpenCreateForm,
  newStage,
  onNewStageChange,
  onSubmitCreateStage,
  onCancelCreateStage,
  creatingStage,
  loading,
  errorMessage,
  onRetry,
  stages,
  defaultStageColor,
  checklistTemplates,
  checklistTemplateNameById,
  canManageChecklistRules,
  stageRulesByStageId,
  reordering,
  onMoveStage,
  onEditStage,
  onDeleteStage,
  onToggleRuleTemplate,
  onToggleRuleGate,
  onSaveRules,
}) => (
  <Card className="card-border">
    <Card.Header className="bg-transparent d-flex justify-content-between align-items-center gap-2 flex-wrap">
      <h6 className="mb-0">Stage {selectedCategoryName ? `- ${selectedCategoryName}` : ""}</h6>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="d-inline-flex align-items-center gap-2"
        onClick={onToggleCreateForm}
        disabled={!canCreateStage}
      >
        <Plus size={14} />
        Stage
      </Button>
    </Card.Header>
    <Card.Body>
      {showCreateForm && (
        <CreateStageForm
          values={newStage}
          onChange={onNewStageChange}
          checklistTemplates={checklistTemplates}
          onSubmit={onSubmitCreateStage}
          onCancel={onCancelCreateStage}
          saving={creatingStage}
        />
      )}

      {loading && <LoadingState message="Caricamento stage..." />}

      {errorMessage && <ErrorState title="Errore stage" message={errorMessage} onRetry={onRetry} />}

      {!loading && !errorMessage && stages.length === 0 && (
        <Alert variant="warning" className="mb-0 d-flex justify-content-between align-items-center">
          <span>Questa categoria non ha stage, aggiungine uno.</span>
          <Button type="button" variant="outline-warning" size="sm" onClick={onOpenCreateForm}>
            Aggiungi stage
          </Button>
        </Alert>
      )}

      {!loading && !errorMessage && stages.length > 0 && (
        <StageList
          stages={stages}
          defaultStageColor={defaultStageColor}
          checklistTemplateNameById={checklistTemplateNameById}
          checklistTemplates={checklistTemplates}
          canManageChecklistRules={canManageChecklistRules}
          stageRulesByStageId={stageRulesByStageId}
          reordering={reordering}
          onMoveStage={onMoveStage}
          onEditStage={onEditStage}
          onDeleteStage={onDeleteStage}
          onToggleRuleTemplate={onToggleRuleTemplate}
          onToggleRuleGate={onToggleRuleGate}
          onSaveRules={onSaveRules}
        />
      )}
    </Card.Body>
  </Card>
);

export default StagesPanel;
