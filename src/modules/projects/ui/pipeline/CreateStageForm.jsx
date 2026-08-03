import { Alert, Button, Card, Col, Form, Row } from "react-bootstrap";

// Modulo "Nuovo stage" delle Impostazioni Pipeline, estratto da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// Controllato dal genitore con lo stesso patto di EditStageModal: `values` e'
// la bozza, `onChange` riceve una patch parziale. Spegnere il gate azzera
// anche il template collegato (regola UI storica, viaggia con la patch).
//
// Gli id dei campi hanno tutti il prefisso `create-stage-`: il modulo puo'
// stare in pagina insieme al modal di modifica (`edit-stage-`), e due campi
// con lo stesso id romperebbero il legame etichetta-campo di entrambi.
const CreateStageForm = ({ values, onChange, checklistTemplates, onSubmit, onCancel, saving }) => {
  const hasTemplates = checklistTemplates.length > 0;

  return (
    <Card className="card-border mb-3">
      <Card.Body>
        <Form onSubmit={onSubmit}>
          <Row className="g-2">
            <Col md={6}>
              <Form.Group controlId="create-stage-name">
                <Form.Label>Nome stage</Form.Label>
                <Form.Control
                  value={values.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  placeholder="Nome stage"
                  disabled={saving}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="create-stage-color">
                <Form.Label>Colore</Form.Label>
                <Form.Control
                  type="color"
                  value={values.color}
                  onChange={(event) => onChange({ color: event.target.value })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="h-100 d-flex align-items-end">
                <Form.Check
                  type="switch"
                  id="create-stage-is-closed"
                  label="Chiuso"
                  checked={values.isClosed}
                  onChange={(event) => onChange({ isClosed: event.target.checked })}
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="h-100 d-flex align-items-end">
                <Form.Check
                  type="switch"
                  id="create-stage-is-gated"
                  label="Checklist gate"
                  checked={values.isGated}
                  onChange={(event) =>
                    onChange({
                      isGated: event.target.checked,
                      ...(event.target.checked ? {} : { gateChecklistTemplateId: "" }),
                    })
                  }
                  disabled={saving}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="create-stage-gate-template">
                <Form.Label>Template Gate</Form.Label>
                <Form.Select
                  value={values.gateChecklistTemplateId}
                  onChange={(event) => onChange({ gateChecklistTemplateId: event.target.value })}
                  disabled={!values.isGated || saving}
                >
                  <option value="">Seleziona template</option>
                  {checklistTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="h-100 d-flex align-items-end">
                <Form.Check
                  type="switch"
                  id="create-stage-autocreate-checklist"
                  label="Auto-create instance"
                  checked={values.autoCreateInstance}
                  onChange={(event) => onChange({ autoCreateInstance: event.target.checked })}
                  disabled={!values.isGated || saving}
                />
              </Form.Group>
            </Col>
          </Row>

          {values.isGated && (
            <Alert variant={hasTemplates ? "info" : "warning"} className="mt-3 mb-0 py-2">
              {hasTemplates
                ? "Gate attivo: lo stage richiedera il completamento checklist prima del passaggio."
                : "Per usare il gate, crea prima almeno un template checklist attivo."}
            </Alert>
          )}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button type="button" variant="outline-secondary" onClick={onCancel} disabled={saving}>
              Annulla
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Creazione..." : "Crea stage"}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default CreateStageForm;
