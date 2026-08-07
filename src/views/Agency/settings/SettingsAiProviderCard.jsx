import React from "react";
import { Alert, Badge, Button, Card, Col, Form, Row } from "react-bootstrap";
import { SEARCH_STATUS_LABEL } from "./settingsPageConstants";
import { getProviderSetupMessage } from "./settingsFormHelpers";
import SettingsProviderPanel from "./SettingsProviderPanel";
import SettingsAiLimitsPanel from "./SettingsAiLimitsPanel";
import SettingsCompetitorSearchPanel from "./SettingsCompetitorSearchPanel";

// Card "AI e Ricerca Competitor": lo stato in cima, i tre riquadri del form e i
// due bottoni in fondo.
//
// I tre riquadri stanno dentro UN SOLO <Form> e condividono lo stesso bottone
// Salva: e' la differenza rispetto alle pagine di progetto, dove ogni riquadro
// e' una Card autonoma che si salva da sola.
const SettingsAiProviderCard = ({
  aiStatus,
  competitorSearchSettings,
  form,
  canManage,
  storageReady,
  saveState,
  activeModels,
  activeProviders,
  selectedModelOption,
  aiApiKeyConfigured,
  anthropicApiKeyConfigured,
  onFieldChange,
  onSelectModel,
  onSubmit,
  onRefresh,
  clearKeysProvider,
  onClearKeysProviderChange,
  onClearKeys,
}) => {
  const saving = saveState.status === "saving";

  return (
    <Card className="card-border">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h6 className="mb-1">AI e Ricerca Competitor</h6>
            <div className="small text-muted">
              Gestione lato server. La API key e salvata come secret cifrato e non viene mai mostrata in chiaro.
            </div>
          </div>
          <Badge bg={competitorSearchSettings.status === "configured" ? "success" : "warning"}>
            {SEARCH_STATUS_LABEL[competitorSearchSettings.status] || "Non configurata"}
          </Badge>
        </div>

        <Row className="g-3 mb-3">
          <Col md={4}>
            <div className="border rounded-3 p-2 h-100">
              <div className="small text-muted">AI generativa</div>
              <div className="fw-semibold">{aiStatus.configured ? "Configurata" : "Non configurata"}</div>
              <div className="small text-muted">{aiStatus.provider || "none"} {aiStatus.model ? `| ${aiStatus.model}` : ""}</div>
            </div>
          </Col>
          <Col md={4}>
            <div className="border rounded-3 p-2 h-100">
              <div className="small text-muted">API key</div>
              <div className="fw-semibold">OpenAI: {aiApiKeyConfigured ? "presente" : "assente"}</div>
              <div className="fw-semibold">Anthropic: {anthropicApiKeyConfigured ? "presente" : "assente"}</div>
            </div>
          </Col>
          <Col md={4}>
            <div className="border rounded-3 p-2 h-100">
              <div className="small text-muted">Ricerca competitor</div>
              <div className="fw-semibold">{competitorSearchSettings.provider || "none"}</div>
              <div className="small text-muted">{competitorSearchSettings.message}</div>
            </div>
          </Col>
        </Row>

        <Alert variant="info" className="py-2">
          {getProviderSetupMessage(aiStatus, competitorSearchSettings)}
        </Alert>

        {!canManage && (
          <Alert variant="warning" role="alert" className="py-2">
            Accesso in sola lettura. Per modificare queste funzioni serve un account Superadmin.
          </Alert>
        )}

        {!storageReady && (
          <Alert variant="warning" role="alert" className="py-2">
            Le impostazioni non si possono ancora salvare: sul database manca la tabella che le conserva.
            Serve applicare la migrazione <code>agency runtime settings</code> prima di configurare l&apos;AI da qui.
          </Alert>
        )}

        <Form onSubmit={onSubmit}>
          <Row className="g-3">
            <Col lg={12}>
              <SettingsProviderPanel
                form={form}
                canManage={canManage}
                storageReady={storageReady}
                saving={saving}
                activeModels={activeModels}
                activeProviders={activeProviders}
                selectedModelOption={selectedModelOption}
                aiApiKeyConfigured={aiApiKeyConfigured}
                anthropicApiKeyConfigured={anthropicApiKeyConfigured}
                onFieldChange={onFieldChange}
                onSelectModel={onSelectModel}
                clearKeysProvider={clearKeysProvider}
                onClearKeysProviderChange={onClearKeysProviderChange}
                onClearKeys={onClearKeys}
              />
            </Col>

            <Col lg={12}>
              <SettingsAiLimitsPanel
                form={form}
                canManage={canManage}
                storageReady={storageReady}
                onFieldChange={onFieldChange}
              />
            </Col>

            <Col lg={12}>
              <SettingsCompetitorSearchPanel
                form={form}
                canManage={canManage}
                storageReady={storageReady}
                onFieldChange={onFieldChange}
              />
            </Col>
          </Row>

          {saveState.message && (
            <Alert
              variant={saveState.status === "error" ? "danger" : saveState.status === "success" ? "success" : "info"}
              className="py-2 mt-3"
              role={saveState.status === "error" ? "alert" : "status"}
            >
              {saveState.message}
            </Alert>
          )}

          <div className="d-flex gap-2 mt-3">
            <Button type="submit" disabled={!canManage || !storageReady || saving}>
              {saving ? "Salvataggio..." : "Salva impostazioni"}
            </Button>
            <Button type="button" variant="light" className="border" onClick={onRefresh}>
              Aggiorna stato
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default SettingsAiProviderCard;
