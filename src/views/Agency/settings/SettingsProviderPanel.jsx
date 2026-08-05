import React from "react";
import { Badge, Button, Col, Form, Row } from "react-bootstrap";
import { PROVIDER_LABELS } from "./settingsPageConstants";

// Riquadro "Provider AI": interruttore delle generazioni, modello preferito,
// le due caselle delle chiavi API e il blocco di rimozione chiavi.
//
// La rimozione sta QUI dentro e non in un riquadro suo perche' nell'originale
// condivide lo stesso bordo: e' separata solo da una riga orizzontale. Farne un
// componente fratello duplicherebbe il bordo o lo farebbe sparire.
const SettingsProviderPanel = ({
  form,
  canManage,
  storageReady,
  saving,
  activeModels,
  activeProviders,
  selectedModelOption,
  aiApiKeyConfigured,
  anthropicApiKeyConfigured,
  onFieldChange,
  onSelectModel,
  clearKeysProvider,
  onClearKeysProviderChange,
  onClearKeys,
}) => (
  <div className="border rounded-3 p-3">
    <h6 className="mb-3">Provider AI</h6>
    <Form.Check
      type="switch"
      id="agency-ai-enabled"
      label="Abilita generazioni AI"
      checked={form.aiEnabled}
      disabled={!canManage || !storageReady}
      onChange={(event) => onFieldChange("aiEnabled", event.target.checked)}
    />
    <div className="small text-muted mt-1">
      Un solo interruttore per entrambi i provider: le generazioni AI sono attive se abilitate e almeno un provider ha la API key.
    </div>

    <Form.Group className="mt-3" controlId="agency-ai-model">
      <Form.Label>Modello preferito</Form.Label>
      <Form.Select
        value={form.aiModel}
        disabled={!canManage || !storageReady || activeModels.length === 0}
        onChange={(event) => onSelectModel(event.target.value)}
      >
        {activeModels.length === 0 ? (
          <option value="">Nessun provider attivo: aggiungi una API key</option>
        ) : (
          activeProviders.map((prov) => (
            <optgroup key={prov} label={PROVIDER_LABELS[prov]}>
              {activeModels
                .filter((entry) => entry.provider === prov)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
            </optgroup>
          ))
        )}
      </Form.Select>
      <Form.Text className="text-muted">
        {activeModels.length === 0
          ? "Il menu elenca solo i modelli dei provider con API key."
          : `Provider scelto dal modello: ${PROVIDER_LABELS[selectedModelOption?.provider] || "-"}${selectedModelOption?.hint ? ` (${selectedModelOption.hint})` : ""}`}
      </Form.Text>
    </Form.Group>

    <Row className="g-3 mt-1">
      <Col md={6}>
        <Form.Group controlId="agency-openai-api-key">
          <Form.Label>
            API key OpenAI{" "}
            <Badge bg={aiApiKeyConfigured ? "success" : "secondary"} className="ms-1">
              {aiApiKeyConfigured ? "presente" : "assente"}
            </Badge>
          </Form.Label>
          <Form.Control
            type="password"
            autoComplete="new-password"
            value={form.openAiApiKey}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("openAiApiKey", event.target.value)}
            placeholder={aiApiKeyConfigured ? "Configurata: inserisci un valore solo per sostituirla" : "Inserisci API key OpenAI"}
          />
          <Form.Text>Campo write-only: il CRM non rilegge mai la chiave in chiaro.</Form.Text>
        </Form.Group>
      </Col>
      <Col md={6}>
        <Form.Group controlId="agency-anthropic-api-key">
          <Form.Label>
            API key Anthropic (Claude){" "}
            <Badge bg={anthropicApiKeyConfigured ? "success" : "secondary"} className="ms-1">
              {anthropicApiKeyConfigured ? "presente" : "assente"}
            </Badge>
          </Form.Label>
          <Form.Control
            type="password"
            autoComplete="new-password"
            value={form.anthropicApiKey}
            disabled={!canManage || !storageReady}
            onChange={(event) => onFieldChange("anthropicApiKey", event.target.value)}
            placeholder={anthropicApiKeyConfigured ? "Configurata: inserisci un valore solo per sostituirla" : "Inserisci API key Anthropic"}
          />
          <Form.Text>Campo write-only. Serve per usare i modelli Claude.</Form.Text>
        </Form.Group>
      </Col>
    </Row>

    <div className="border-top mt-3 pt-3">
      <div className="small fw-semibold mb-1">Rimozione chiavi</div>
      <div className="small text-muted mb-2">
        Il campo chiave e write-only, quindi per cancellare una chiave gia salvata serve un comando esplicito.
      </div>
      <Row className="g-2 align-items-end">
        <Col xs={12} sm="auto">
          <Form.Group controlId="agency-clear-keys-provider">
            <Form.Label className="small text-muted mb-1">Cosa cancellare</Form.Label>
            <Form.Select
              value={clearKeysProvider}
              disabled={!canManage || !storageReady}
              onChange={(event) => onClearKeysProviderChange(event.target.value)}
            >
              <option value="">Tutte le chiavi API</option>
              <option value="openai">Solo OpenAI</option>
              <option value="anthropic">Solo Anthropic</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} sm="auto">
          <Button
            type="button"
            variant="outline-danger"
            disabled={!canManage || !storageReady || saving || (!aiApiKeyConfigured && !anthropicApiKeyConfigured)}
            onClick={onClearKeys}
          >
            Cancella permanentemente le chiavi API dal CRM
          </Button>
        </Col>
      </Row>
    </div>
  </div>
);

export default SettingsProviderPanel;
