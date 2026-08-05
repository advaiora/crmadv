import React from "react";
import { Col, Form, Row } from "react-bootstrap";
import { SEARCH_PROVIDER_OPTIONS } from "./settingsPageConstants";

// Riquadro "Ricerca competitor": interruttore e provider della ricerca online.
const SettingsCompetitorSearchPanel = ({ form, canManage, storageReady, onFieldChange }) => (
  <div className="border rounded-3 p-3">
    <h6 className="mb-3">Ricerca competitor</h6>
    <Row className="g-3">
      <Col md={4}>
        <Form.Check
          type="switch"
          id="agency-competitor-enabled"
          label="Abilita ricerca competitor online"
          checked={form.competitorSearchEnabled}
          disabled={!canManage || !storageReady}
          onChange={(event) => onFieldChange("competitorSearchEnabled", event.target.checked)}
        />
      </Col>
      <Col md={8}>
        <Form.Group controlId="agency-competitor-provider">
          <Form.Label>Provider ricerca</Form.Label>
          <Form.Select
            value={form.competitorSearchProvider}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("competitorSearchProvider", event.target.value)}
          >
            {SEARCH_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Form.Select>
          <Form.Text>
            Con OpenAI web search attivo il CRM cerca competitor reali online. Se il provider non risponde, non vengono creati competitor finti.
          </Form.Text>
        </Form.Group>
      </Col>
    </Row>
  </div>
);

export default SettingsCompetitorSearchPanel;
