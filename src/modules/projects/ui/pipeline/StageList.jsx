import { Badge, Button, ListGroup } from "react-bootstrap";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import StageChecklistRules from "./StageChecklistRules";

const EMPTY_RULES_STATE = {
  loading: false,
  saving: false,
  error: "",
  rules: [],
};

// Elenco degli stage di una categoria, estratto da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// Le frecce su/giu' spostano lo stage di una posizione: la prima riga non puo'
// salire, l'ultima non puo' scendere, e durante il salvataggio dell'ordine
// sono spente tutte (il riordino e' ottimistico, un secondo click partirebbe
// da un elenco che sta ancora cambiando).
const StageList = ({
  stages,
  defaultStageColor,
  checklistTemplateNameById,
  checklistTemplates,
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
  <ListGroup variant="flush">
    {stages.map((stage, index) => (
      <ListGroup.Item key={stage.id} className="d-flex flex-column gap-2">
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2">
            {stage.color && (
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: stage.color,
                  display: "inline-block",
                }}
              />
            )}
            <span className="fw-semibold">{stage.name}</span>
            {stage.isClosed && <Badge bg="secondary">Chiuso</Badge>}
            {stage.isGated && (
              <Badge bg="warning" text="dark">
                Gated
              </Badge>
            )}
            {stage.isGated && stage.gateChecklistTemplateId && (
              <Badge bg="light" text="dark">
                Template: {checklistTemplateNameById.get(stage.gateChecklistTemplateId) || stage.gateChecklistTemplateId}
              </Badge>
            )}
          </div>

          <div className="d-flex align-items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              aria-label={`Sposta su ${stage.name}`}
              disabled={index === 0 || reordering}
              onClick={() => onMoveStage(index, -1)}
            >
              <ChevronUp size={14} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              aria-label={`Sposta giu ${stage.name}`}
              disabled={index === stages.length - 1 || reordering}
              onClick={() => onMoveStage(index, 1)}
            >
              <ChevronDown size={14} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              aria-label={`Modifica ${stage.name}`}
              onClick={() =>
                onEditStage({
                  id: stage.id,
                  name: stage.name,
                  isClosed: Boolean(stage.isClosed),
                  color: stage.color || defaultStageColor,
                  isGated: Boolean(stage.isGated),
                  gateChecklistTemplateId: stage.gateChecklistTemplateId || "",
                  autoCreateInstance: stage.autoCreateInstance !== false,
                })
              }
            >
              <Pencil size={13} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-danger"
              aria-label={`Elimina ${stage.name}`}
              onClick={() => onDeleteStage(stage)}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        <StageChecklistRules
          stageId={stage.id}
          templates={checklistTemplates}
          state={stageRulesByStageId[stage.id] || EMPTY_RULES_STATE}
          canManage={canManageChecklistRules}
          onToggleTemplate={onToggleRuleTemplate}
          onToggleGate={onToggleRuleGate}
          onSave={onSaveRules}
        />
      </ListGroup.Item>
    ))}
  </ListGroup>
);

export default StageList;
