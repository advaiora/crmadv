import React from "react";
import { Card, Col, Form, Row } from "react-bootstrap";
import AiCostEstimate from "../../AiCostEstimate";
import AiBlockRegenerationButtons from "../shared/AiBlockRegenerationButtons";
import { PAGE_TYPE_OPTIONS, WEB_AI_BLOCKS } from "./webPageConstants";

// Card "Impostazioni pagina": i tre campi che guidano la generazione
// (obiettivo, tipo pagina, CTA) e sotto la rigenerazione di un singolo blocco.
const WebPageSettingsCard = ({
  output,
  onFieldChange,
  estimate,
  aiConfigured,
  generatingBlockKey,
  aiBusy,
  onGenerateBlock,
}) => (
  <Card className="card-border h-100">
    <Card.Body>
      <h6 className="mb-3">Impostazioni pagina</h6>
      <Row className="g-2">
        <Col md={6}>
          <Form.Group controlId="web-page-goal">
            <Form.Label className="small mb-1">Obiettivo pagina</Form.Label>
            <Form.Control
              value={output.pageGoal}
              onChange={(event) => onFieldChange("pageGoal", event.target.value)}
              placeholder="Obiettivo pagina"
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group controlId="web-page-type">
            <Form.Label className="small mb-1">Tipo pagina</Form.Label>
            <Form.Select
              value={output.pageType}
              onChange={(event) => onFieldChange("pageType", event.target.value)}
            >
              {PAGE_TYPE_OPTIONS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group controlId="web-page-cta">
            <Form.Label className="small mb-1">CTA principale</Form.Label>
            <Form.Control
              value={output.ctaSet.primary}
              onChange={(event) => (
                onFieldChange("ctaSet", {
                  ...output.ctaSet,
                  primary: event.target.value,
                })
              )}
              placeholder="Es. Prenota call"
            />
          </Form.Group>
        </Col>
      </Row>
      <div className="border-top mt-3 pt-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <div className="fw-semibold small">Rigenera un blocco</div>
            <div className="small text-muted">Usa AI su una singola parte per consumare meno token e lavorare piu velocemente.</div>
          </div>
          <AiCostEstimate estimate={estimate} aiConfigured={aiConfigured} />
        </div>
        <AiBlockRegenerationButtons
          blocks={WEB_AI_BLOCKS}
          generatingKey={generatingBlockKey}
          onGenerate={onGenerateBlock}
          disabled={aiBusy}
        />
      </div>
    </Card.Body>
  </Card>
);

export default WebPageSettingsCard;
