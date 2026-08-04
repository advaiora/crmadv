import React from "react";
import { Col, Row } from "react-bootstrap";

// "Contratto generazione": dichiara in quattro riquadri con che materiale e'
// stato prodotto l'output, cosi' chi lo consegna al cliente sa quanto fidarsi.
const WebGenerationContractPanel = ({ aiConfigured, missingLabels, usedSources }) => {
  const mancanti = missingLabels || [];
  const fonti = usedSources || [];
  const confidence = mancanti.length === 0
    ? "alta"
    : mancanti.length <= 2 ? "media" : "bassa";

  return (
    <div className="agency-panel">
      <h6 className="mb-2">Contratto generazione</h6>
      <Row className="g-2">
        <Col md={3}>
          <div className="agency-mini-metric small">
            <strong>Modalita</strong>
            <div>{aiConfigured ? "AI disponibile" : "Bozza base dichiarata"}</div>
          </div>
        </Col>
        <Col md={3}>
          <div className="agency-mini-metric small">
            <strong>Confidence</strong>
            <div>{confidence}</div>
          </div>
        </Col>
        <Col md={3}>
          <div className="agency-mini-metric small">
            <strong>Fonti</strong>
            <div>{fonti.length > 0 ? fonti.join(", ") : "fonti mancanti"}</div>
          </div>
        </Col>
        <Col md={3}>
          <div className="agency-mini-metric small">
            <strong>Dati mancanti</strong>
            <div>{mancanti.length > 0 ? mancanti.join(", ") : "nessun blocco critico"}</div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default WebGenerationContractPanel;
