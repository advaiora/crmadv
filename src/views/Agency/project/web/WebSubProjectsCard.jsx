import React from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import { readableValue } from "../agencyProjectUx";
import { toWorkStatusLabel } from "../../../../modules/agency-os/projects/agencyProjectLabels";
import { WEB_PROJECT_STATUSES, WEB_PROJECT_TYPES } from "./webPageConstants";

// Card "Landing e pagine": il form per creare una pagina e l'elenco di quelle
// gia' create, ognuna con stato, scelta come pagina attiva e generazione AI.
const WebSubProjectsCard = ({
  draft,
  onDraftChange,
  onAddWebProject,
  webProjects,
  onUpdateStatus,
  onUseAsActive,
  onGenerateAi,
  generatingAi,
  aiUnavailable,
}) => {
  const pagine = webProjects || [];

  return (
    <Card className="card-border">
      <Card.Body>
        <h6 className="mb-1">Landing e pagine</h6>
        <p className="small text-muted mb-3">
          Crea una pagina specifica prima di generare struttura, copy e preview.
        </p>
        <Row className="g-2 mb-3">
          <Col md={2}>
            <Form.Select
              value={draft.type}
              onChange={(event) => onDraftChange("type", event.target.value)}
            >
              {WEB_PROJECT_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Control
              value={draft.name}
              onChange={(event) => onDraftChange("name", event.target.value)}
              placeholder="Nome, es. Landing consulenza"
            />
          </Col>
          <Col md={3}>
            <Form.Control
              value={draft.goal}
              onChange={(event) => onDraftChange("goal", event.target.value)}
              placeholder="Goal"
            />
          </Col>
          <Col md={2}>
            <Form.Control
              value={draft.primaryCta}
              onChange={(event) => onDraftChange("primaryCta", event.target.value)}
              placeholder="CTA"
            />
          </Col>
          <Col md={2} className="d-grid">
            <Button type="button" variant="outline-primary" onClick={onAddWebProject}>
              Crea pagina
            </Button>
          </Col>
        </Row>

        <div className="agency-record-list">
          {pagine.map((entry) => (
            <div key={entry.id} className="agency-record-row">
              <div>
                <div className="small fw-semibold">{entry.name}</div>
                <div className="small text-muted">
                  {entry.type} | {readableValue(entry.goal, "Goal da completare")} | CTA: {readableValue(entry.primaryCta, "CTA da completare")}
                </div>
              </div>
              <div className="d-flex gap-2">
                <Form.Select
                  size="sm"
                  value={entry.status}
                  onChange={(event) => onUpdateStatus(entry.id, event.target.value)}
                >
                  {WEB_PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>{toWorkStatusLabel(status)}</option>
                  ))}
                </Form.Select>
                <Button type="button" size="sm" variant="outline-secondary" onClick={() => onUseAsActive(entry)}>
                  Usa come pagina attiva
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-primary"
                  onClick={() => onGenerateAi(entry)}
                  disabled={generatingAi || aiUnavailable}
                >
                  <i className="bi bi-stars me-1" aria-hidden="true" />
                  Genera AI
                </Button>
              </div>
            </div>
          ))}
          {pagine.length === 0 && (
            <div className="agency-empty-state small">
              <strong>Nessuna pagina creata.</strong> Crea la prima landing o pagina per generare struttura, copy e preview.
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default WebSubProjectsCard;
