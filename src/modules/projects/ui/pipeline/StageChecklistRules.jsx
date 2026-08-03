import { Alert, Button, Form } from "react-bootstrap";

// Blocco "Checklist rules per stage" della riga di uno stage, estratto da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// Componente controllato: la bozza delle regole e il salvataggio stanno nel
// genitore (hook useStageChecklistRules), qui c'e' solo il disegno.
//
// I quattro casi si escludono a vicenda e vengono nell'ordine in cui contano:
// niente permesso, caricamento in corso, nessun template disponibile, elenco.
const StageChecklistRules = ({ stageId, templates, state, canManage, onToggleTemplate, onToggleGate, onSave }) => {
  const ruleByTemplateId = new Map(state.rules.map((rule) => [rule.checklistTemplateId, rule]));

  return (
    <div className="border-top pt-2">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <span className="small text-muted">Checklist rules per stage</span>
        {state.saving && <span className="small text-muted">Salvataggio...</span>}
      </div>

      {!canManage && (
        <div className="small text-muted">Servono permessi `checklists.manage_templates` per modificare le regole.</div>
      )}

      {canManage && state.loading && <div className="small text-muted">Caricamento regole...</div>}

      {canManage && !state.loading && templates.length === 0 && (
        <div className="small text-muted">Nessun template checklist attivo disponibile.</div>
      )}

      {canManage && !state.loading && templates.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {templates.map((template) => {
            const rule = ruleByTemplateId.get(template.id);
            const selected = Boolean(rule);

            return (
              <div key={`${stageId}-${template.id}`} className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <Form.Check
                  type="checkbox"
                  id={`stage-rule-template-${stageId}-${template.id}`}
                  label={template.name}
                  checked={selected}
                  onChange={(event) => onToggleTemplate(stageId, template.id, event.target.checked)}
                  disabled={state.saving}
                />
                <Form.Check
                  type="switch"
                  id={`stage-rule-gate-${stageId}-${template.id}`}
                  label="Gate"
                  checked={rule?.gateEnabled !== false}
                  disabled={!selected || state.saving}
                  onChange={(event) => onToggleGate(stageId, template.id, event.target.checked)}
                />
              </div>
            );
          })}

          {state.error && (
            <Alert variant="danger" className="py-2 mb-0">
              {state.error}
            </Alert>
          )}

          <div className="d-flex justify-content-end">
            <Button
              type="button"
              size="sm"
              variant="outline-primary"
              disabled={state.saving}
              onClick={() => onSave(stageId)}
            >
              Salva regole
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StageChecklistRules;
