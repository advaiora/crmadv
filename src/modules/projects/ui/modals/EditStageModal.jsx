import { Button, Form, Modal } from "react-bootstrap";

// Modal "Modifica stage" delle Impostazioni Pipeline. Controllato dal
// genitore: stage e' l'oggetto in modifica (null = chiuso), onChange riceve
// una patch parziale da fondere nello stato; il salvataggio resta nel
// genitore. Spegnere il gate azzera anche il template collegato (regola UI
// storica, viaggia con la patch).
const EditStageModal = ({ stage, checklistTemplates, defaultColor, onChange, onCancel, onSave, saving }) => (
  <Modal show={Boolean(stage)} onHide={onCancel} centered className="pipeline-modal">
    <Modal.Header closeButton>
      <Modal.Title>Modifica stage</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Form.Group className="mb-3" controlId="edit-stage-name">
        <Form.Label>Nome stage</Form.Label>
        <Form.Control value={stage?.name || ""} onChange={(event) => onChange({ name: event.target.value })} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="edit-stage-color">
        <Form.Label>Colore</Form.Label>
        <Form.Control type="color" value={stage?.color || defaultColor} onChange={(event) => onChange({ color: event.target.value })} />
      </Form.Group>
      <Form.Check
        type="switch"
        id="edit-stage-is-closed"
        label="Stage chiuso"
        checked={Boolean(stage?.isClosed)}
        onChange={(event) => onChange({ isClosed: event.target.checked })}
      />
      <Form.Check
        type="switch"
        id="edit-stage-is-gated"
        label="Checklist gate"
        className="mt-3"
        checked={Boolean(stage?.isGated)}
        onChange={(event) =>
          onChange({
            isGated: event.target.checked,
            ...(event.target.checked ? {} : { gateChecklistTemplateId: "" }),
          })
        }
      />
      <Form.Group className="mt-3" controlId="edit-stage-gate-template">
        <Form.Label>Template gate</Form.Label>
        <Form.Select
          value={stage?.gateChecklistTemplateId || ""}
          disabled={!stage?.isGated}
          onChange={(event) => onChange({ gateChecklistTemplateId: event.target.value })}
        >
          <option value="">Seleziona template</option>
          {checklistTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      <Form.Check
        type="switch"
        id="edit-stage-auto-create"
        className="mt-3"
        label="Auto-create checklist instance"
        checked={Boolean(stage?.autoCreateInstance)}
        disabled={!stage?.isGated}
        onChange={(event) => onChange({ autoCreateInstance: event.target.checked })}
      />
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={onCancel}>
        Annulla
      </Button>
      <Button variant="primary" onClick={onSave} disabled={saving}>
        {saving ? "Salvataggio..." : "Salva"}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default EditStageModal;
