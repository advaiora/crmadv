import React from "react";
import { Col, Form, Row } from "react-bootstrap";

// Riquadro "Limiti AI, cache e costi": timeout, tetti di caratteri e token,
// modalita predefinita, dettagli tecnici e i modelli per singola funzione.
const SettingsAiLimitsPanel = ({ form, canManage, storageReady, onFieldChange }) => (
  <div className="border rounded-3 p-3">
    <h6 className="mb-3">Limiti AI, cache e costi</h6>
    <Row className="g-3">
      <Col md={3}>
        <Form.Group controlId="agency-ai-timeout">
          <Form.Label>Timeout chiamata</Form.Label>
          <Form.Control
            type="number"
            min="5000"
            step="1000"
            value={form.aiTimeoutMs}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("aiTimeoutMs", event.target.value)}
          />
          <Form.Text>Millisecondi prima di interrompere la richiesta.</Form.Text>
        </Form.Group>
      </Col>
      <Col md={3}>
        <Form.Group controlId="agency-ai-input-limit">
          <Form.Label>Max input</Form.Label>
          <Form.Control
            type="number"
            min="2000"
            step="500"
            value={form.aiInputMaxChars}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("aiInputMaxChars", event.target.value)}
          />
          <Form.Text>Caratteri massimi inviati al provider.</Form.Text>
        </Form.Group>
      </Col>
      <Col md={3}>
        <Form.Group controlId="agency-ai-file-limit">
          <Form.Label>Max testo file</Form.Label>
          <Form.Control
            type="number"
            min="500"
            step="250"
            value={form.aiFileTextMaxChars}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("aiFileTextMaxChars", event.target.value)}
          />
          <Form.Text>Estratti file inclusi nel contesto AI.</Form.Text>
        </Form.Group>
      </Col>
      <Col md={3}>
        <Form.Group controlId="agency-ai-output-limit">
          <Form.Label>Max output token</Form.Label>
          <Form.Control
            type="number"
            min="300"
            step="100"
            value={form.aiMaxOutputTokens}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("aiMaxOutputTokens", event.target.value)}
          />
          <Form.Text>Limite risposta per ridurre costi e attese.</Form.Text>
        </Form.Group>
      </Col>
      <Col md={3}>
        <Form.Group controlId="agency-ai-string-limit">
          <Form.Label>Max campo testuale</Form.Label>
          <Form.Control
            type="number"
            min="300"
            step="100"
            value={form.aiStringMaxChars}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("aiStringMaxChars", event.target.value)}
          />
        </Form.Group>
      </Col>
      <Col md={3}>
        <Form.Group controlId="agency-ai-default-mode">
          <Form.Label>Modalita default</Form.Label>
          <Form.Select
            value={form.aiDefaultMode}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("aiDefaultMode", event.target.value)}
          >
            <option value="quick">Rapida</option>
            <option value="deep">Profonda</option>
          </Form.Select>
        </Form.Group>
      </Col>
      <Col md={6}>
        <Form.Check
          type="switch"
          id="agency-ai-debug-enabled"
          label="Mostra dettagli tecnici solo in modalita debug"
          checked={form.aiDebugEnabled}
          disabled={!canManage || !storageReady}
          onChange={(event) => onFieldChange("aiDebugEnabled", event.target.checked)}
        />
        <div className="small text-muted mt-2">
          Le generazioni usano cache con hash input e blocco anti doppio click lato server.
        </div>
      </Col>
      <Col md={12}>
        <Form.Group controlId="agency-ai-function-models">
          <Form.Label>Modelli per funzione</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={form.aiFunctionModelsText}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("aiFunctionModelsText", event.target.value)}
            placeholder='{"discovery.generateBrief":"gpt-4o-mini","web.generateBlock":"gpt-4o-mini"}'
          />
          <Form.Text>
            JSON opzionale. Esempi funzione: discovery.generateBrief, discovery.generateSection, web.generateProject, web.generateBlock, ads.generateAsset.
          </Form.Text>
        </Form.Group>
      </Col>
    </Row>
  </div>
);

export default SettingsAiLimitsPanel;
