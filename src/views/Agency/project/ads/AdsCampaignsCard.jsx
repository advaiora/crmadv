import React from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import { readableValue } from "../agencyProjectUx";
import { ADS_PROJECT_CHANNELS, ADS_PROJECT_STATUSES } from "./adsPageConstants";

// Card "Campagne Ads": il form per crearne una e l'elenco di quelle esistenti.
// A differenza della gemella Web, qui una campagna puo' essere collegata a una
// landing del modulo Web: il menu la elenca e la riga ne mostra il nome.
const AdsCampaignsCard = ({
  draft,
  onDraftChange,
  onAddAdsProject,
  adsProjects,
  webProjects,
  onUpdateStatus,
  onOpenCampaign,
}) => {
  const campagne = adsProjects || [];
  const landing = webProjects || [];
  const nomeLanding = (id) => landing.find((item) => item.id === id)?.name || id;

  return (
    <Card className="card-border">
      <Card.Body>
        <h6 className="mb-1">Campagne Ads</h6>
        <p className="small text-muted mb-3">
          Crea una campagna specifica e, quando possibile, collegala a una landing o pagina Web.
        </p>
        <Row className="g-2 mb-3">
          <Col md={2}>
            <Form.Select
              value={draft.channel}
              onChange={(event) => onDraftChange("channel", event.target.value)}
            >
              {ADS_PROJECT_CHANNELS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Control
              value={draft.campaignType}
              onChange={(event) => onDraftChange("campaignType", event.target.value)}
              placeholder="Tipo campagna"
            />
          </Col>
          <Col md={3}>
            <Form.Control
              value={draft.name}
              onChange={(event) => onDraftChange("name", event.target.value)}
              placeholder="Nome campagna"
            />
          </Col>
          <Col md={2}>
            <Form.Control
              value={draft.goal}
              onChange={(event) => onDraftChange("goal", event.target.value)}
              placeholder="Goal"
            />
          </Col>
          <Col md={2}>
            <Form.Select
              value={draft.linkedWebProjectId}
              onChange={(event) => onDraftChange("linkedWebProjectId", event.target.value)}
            >
              <option value="">Nessuna landing</option>
              {landing.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={1} className="d-grid">
            <Button type="button" variant="outline-primary" onClick={onAddAdsProject}>
              Crea
            </Button>
          </Col>
        </Row>

        <div className="agency-record-list">
          {campagne.map((entry) => (
            <div key={entry.id} className="agency-record-row">
              <div>
                <div className="small fw-semibold">{entry.name}</div>
                <div className="small text-muted">
                  {entry.channel} | {readableValue(entry.campaignType, "Tipo da completare")} | {readableValue(entry.goal, "Goal da completare")}
                  {entry.linkedWebProjectId ? ` | landing: ${nomeLanding(entry.linkedWebProjectId)}` : ""}
                </div>
              </div>
              <div className="d-flex gap-2">
                <Form.Select
                  size="sm"
                  value={entry.status}
                  onChange={(event) => onUpdateStatus(entry.id, event.target.value)}
                >
                  {ADS_PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Form.Select>
                <Button type="button" size="sm" variant="outline-secondary" onClick={() => onOpenCampaign(entry)}>
                  Apri/Genera
                </Button>
              </div>
            </div>
          ))}
          {campagne.length === 0 && (
            <div className="agency-empty-state small">
              <strong>Nessuna campagna creata.</strong> Crea una campagna Google o Meta per generare output specifico.
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default AdsCampaignsCard;
