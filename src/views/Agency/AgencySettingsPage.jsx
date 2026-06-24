import React from "react";
import { Alert, Badge, Button, Card, Col, Form, Row } from "react-bootstrap";
import {
  getAgencyAiStatus,
  getAgencyCompetitorSearchSettings,
  getAgencyRuntimeSettings,
  saveAgencyRuntimeSettings,
} from "../../modules/agency-os/data/agencyDataAdapter";
import {
  AGENCY_PROJECT_SCOPE_OPTIONS,
  AGENCY_PROJECT_TYPE_OPTIONS,
} from "../../modules/agency-os/projects/agencyProjectsModel";
import AgencyPageShell from "./AgencyPageShell";

const TEAM_ROLES = [
  { key: "web", label: "Web", owner: "Produzione pagine, wireframe, QA tecnico" },
  { key: "marketing_strategy_pm", label: "Marketing Strategy PM", owner: "Brief, priorita, coordinamento e report" },
  { key: "ads_specialist", label: "Ads Specialist", owner: "Google/Meta setup, targeting, tracking readiness" },
  { key: "graphic_adv_social", label: "Graphic ADV Social", owner: "Creativita social e asset Meta" },
  { key: "graphic_offline", label: "Graphic Offline", owner: "Materiali offline e adattamenti brand" },
];

const MODULES = [
  "overview",
  "sources/assets",
  "discovery",
  "web",
  "ads",
  "opportunities",
  "tasks",
  "reports",
  "diagnosis",
  "client_report",
];

const SEARCH_STATUS_LABEL = {
  configured: "Configurata",
  configured_not_active: "Configurata",
  configured_error: "Errore provider",
  not_configured: "Non configurata",
};

const AI_PROVIDER_OPTIONS = [
  { value: "none", label: "Nessuno" },
  { value: "openai", label: "OpenAI" },
];

const SEARCH_PROVIDER_OPTIONS = [
  { value: "none", label: "Nessuno" },
  { value: "openai_web_search", label: "OpenAI web search" },
  { value: "serpapi", label: "SerpAPI" },
  { value: "custom", label: "Custom" },
];

const buildRuntimeForm = (runtimeSettings) => ({
  aiEnabled: Boolean(runtimeSettings?.ai?.enabled),
  aiProvider: runtimeSettings?.ai?.provider || "none",
  aiModel: runtimeSettings?.ai?.model || "gpt-4o-mini",
  aiTimeoutMs: runtimeSettings?.ai?.timeoutMs || 45000,
  aiInputMaxChars: runtimeSettings?.ai?.inputMaxChars || 12000,
  aiStringMaxChars: runtimeSettings?.ai?.stringMaxChars || 1200,
  aiFileTextMaxChars: runtimeSettings?.ai?.fileTextMaxChars || 1800,
  aiMaxOutputTokens: runtimeSettings?.ai?.maxOutputTokens || 1800,
  aiDefaultMode: runtimeSettings?.ai?.defaultMode || "quick",
  aiDebugEnabled: Boolean(runtimeSettings?.ai?.debugEnabled),
  aiFunctionModelsText: JSON.stringify(runtimeSettings?.ai?.functionModels || {}, null, 2),
  openAiApiKey: "",
  clearOpenAiApiKey: false,
  competitorSearchEnabled: Boolean(runtimeSettings?.competitorSearch?.enabled),
  competitorSearchProvider: runtimeSettings?.competitorSearch?.provider || "none",
});

const getProviderSetupMessage = (aiStatus, competitorSearchSettings) => {
  const aiConfigured = Boolean(aiStatus?.configured);
  const competitorStatus = competitorSearchSettings?.status || "not_configured";
  const competitorConfigured = competitorStatus === "configured" || competitorStatus === "configured_not_active";

  if (aiConfigured && competitorConfigured) {
    return "AI generativa e ricerca competitor online sono configurate lato server. Le ricerche useranno OpenAI web search e non genereranno competitor finti.";
  }

  if (aiConfigured) {
    return "AI generativa configurata lato server. La ricerca competitor online e separata: senza provider search puoi inserire competitor manualmente.";
  }

  if (competitorConfigured) {
    return "Ricerca competitor online configurata. AI generativa non configurata: le altre generazioni restano bozze base dichiarate.";
  }

  return "AI generativa e ricerca competitor online non sono configurate. Puoi lavorare con bozze base e competitor manuali.";
};

const AgencySettingsPage = () => {
  const isDev = Boolean(import.meta.env.DEV);
  const [competitorSearchSettings, setCompetitorSearchSettings] = React.useState({
    status: "not_configured",
    provider: "none",
    message: "Per ricercare competitor online serve un provider configurato lato server.",
    requiredEnv: [],
  });
  const [aiStatus, setAiStatus] = React.useState({
    status: "not_configured",
    configured: false,
    provider: "none",
    model: "",
    message: "AI non configurata. Il sistema usa generatori rule-based dichiarati.",
  });
  const [runtimeSettings, setRuntimeSettings] = React.useState(null);
  const [runtimeForm, setRuntimeForm] = React.useState(buildRuntimeForm(null));
  const [saveState, setSaveState] = React.useState({ status: "idle", message: "" });

  const refreshSettings = React.useCallback(async () => {
    const [competitorResult, aiResult, runtimeResult] = await Promise.allSettled([
      getAgencyCompetitorSearchSettings(),
      getAgencyAiStatus(),
      getAgencyRuntimeSettings(),
    ]);

    if (competitorResult.status === "fulfilled" && competitorResult.value) {
      setCompetitorSearchSettings(competitorResult.value);
    } else {
      setCompetitorSearchSettings((current) => ({
        ...current,
        status: "not_configured",
        provider: "none",
        message: "Stato ricerca non disponibile. Puoi comunque inserire competitor manualmente.",
      }));
    }

    if (aiResult.status === "fulfilled" && aiResult.value) {
      setAiStatus(aiResult.value);
    }

    if (runtimeResult.status === "fulfilled" && runtimeResult.value) {
      setRuntimeSettings(runtimeResult.value);
      setRuntimeForm(buildRuntimeForm(runtimeResult.value));
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void refreshSettings().catch(() => {
      if (!mounted) return;
      setSaveState({
        status: "error",
        message: "Impostazioni runtime non disponibili. Riprova dopo aver verificato il server API.",
      });
    });

    return () => {
      mounted = false;
    };
  }, [refreshSettings]);

  const canManage = Boolean(runtimeSettings?.canManage);
  const storageReady = runtimeSettings?.storageReady !== false;
  const aiApiKeyConfigured = Boolean(runtimeSettings?.ai?.apiKeyConfigured || aiStatus?.apiKeyConfigured);

  const updateFormField = (field, value) => {
    setRuntimeForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveRuntimeSettings = async (event) => {
    event.preventDefault();
    if (!canManage) {
      setSaveState({
        status: "error",
        message: "Solo un Superadmin puo modificare AI, ricerca competitor e API key.",
      });
      return;
    }

    setSaveState({ status: "saving", message: "Salvataggio impostazioni in corso..." });
    try {
      let functionModels = {};
      if (runtimeForm.aiFunctionModelsText.trim()) {
        try {
          functionModels = JSON.parse(runtimeForm.aiFunctionModelsText);
        } catch (_error) {
          setSaveState({
            status: "error",
            message: "La configurazione modelli per funzione deve essere un JSON valido.",
          });
          return;
        }
      }
      const payload = {
        ai: {
          enabled: runtimeForm.aiEnabled,
          provider: runtimeForm.aiProvider,
          model: runtimeForm.aiModel,
          timeoutMs: Number(runtimeForm.aiTimeoutMs) || 45000,
          inputMaxChars: Number(runtimeForm.aiInputMaxChars) || 12000,
          stringMaxChars: Number(runtimeForm.aiStringMaxChars) || 1200,
          fileTextMaxChars: Number(runtimeForm.aiFileTextMaxChars) || 1800,
          maxOutputTokens: Number(runtimeForm.aiMaxOutputTokens) || 1800,
          defaultMode: runtimeForm.aiDefaultMode,
          debugEnabled: runtimeForm.aiDebugEnabled,
          functionModels,
          ...(runtimeForm.openAiApiKey.trim()
            ? { openAiApiKey: runtimeForm.openAiApiKey.trim() }
            : {}),
          clearOpenAiApiKey: runtimeForm.clearOpenAiApiKey,
        },
        competitorSearch: {
          enabled: runtimeForm.competitorSearchEnabled,
          provider: runtimeForm.competitorSearchProvider,
        },
      };
      const saved = await saveAgencyRuntimeSettings(payload);
      setRuntimeSettings(saved);
      setRuntimeForm(buildRuntimeForm(saved));
      await refreshSettings();
      setSaveState({
        status: "success",
        message: "Impostazioni salvate. Le generazioni useranno la nuova configurazione lato server.",
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error?.message || "Salvataggio non riuscito. Le modifiche non sono state applicate.",
      });
    }
  };

  return (
    <AgencyPageShell
      title="Impostazioni Agency"
      subtitle="Configurazione operativa Agency AI OS derivata da cataloghi, runtime server e regole di sicurezza."
      breadcrumbs={[
        { label: "Dashboard", to: "/dashboard" },
        { label: "Agency", to: "/agency/projects" },
        { label: "Impostazioni Agency" },
      ]}
    >
      <Row className="g-3">
        <Col lg={12}>
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
                    <div className="fw-semibold">{aiApiKeyConfigured ? "Presente" : "Assente"}</div>
                    <div className="small text-muted">
                      Origine: {runtimeSettings?.ai?.apiKeySource === "db" ? "CRM backend cifrato" : runtimeSettings?.ai?.apiKeySource === "env" ? ".env server" : "non configurata"}
                    </div>
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
                  Storage impostazioni non pronto. Applica la migration Agency runtime settings prima di salvare configurazioni dal CRM.
                </Alert>
              )}

              <Form onSubmit={handleSaveRuntimeSettings}>
                <Row className="g-3">
                  <Col lg={6}>
                    <div className="border rounded-3 p-3 h-100">
                      <h6 className="mb-3">AI generativa</h6>
                      <Form.Check
                        type="switch"
                        id="agency-ai-enabled"
                        label="Abilita generazioni AI"
                        checked={runtimeForm.aiEnabled}
                        disabled={!canManage || !storageReady}
                        onChange={(event) => updateFormField("aiEnabled", event.target.checked)}
                      />
                      <Form.Group className="mt-3" controlId="agency-ai-provider">
                        <Form.Label>Provider AI</Form.Label>
                        <Form.Select
                          value={runtimeForm.aiProvider}
                          disabled={!canManage || !storageReady}
                          onChange={(event) => updateFormField("aiProvider", event.target.value)}
                        >
                          {AI_PROVIDER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mt-3" controlId="agency-ai-model">
                        <Form.Label>Modello</Form.Label>
                        <Form.Control
                          value={runtimeForm.aiModel}
                          disabled={!canManage || !storageReady}
                          onChange={(event) => updateFormField("aiModel", event.target.value)}
                          placeholder="gpt-4o-mini"
                        />
                      </Form.Group>
                    </div>
                  </Col>

                  <Col lg={6}>
                    <div className="border rounded-3 p-3 h-100">
                      <h6 className="mb-3">API key OpenAI</h6>
                      <Form.Group controlId="agency-openai-api-key">
                        <Form.Label>Nuova API key</Form.Label>
                        <Form.Control
                          type="password"
                          autoComplete="new-password"
                          value={runtimeForm.openAiApiKey}
                          disabled={!canManage || !storageReady || runtimeForm.clearOpenAiApiKey}
                          onChange={(event) => updateFormField("openAiApiKey", event.target.value)}
                          placeholder={aiApiKeyConfigured ? "API key gia configurata: inserisci un valore solo per sostituirla" : "Inserisci API key lato server"}
                        />
                        <Form.Text>
                          Campo write-only: il CRM non rilegge mai la chiave in chiaro.
                        </Form.Text>
                      </Form.Group>
                      <Form.Check
                        className="mt-3"
                        type="checkbox"
                        id="agency-openai-clear-key"
                        label="Rimuovi la API key salvata nel CRM"
                        checked={runtimeForm.clearOpenAiApiKey}
                        disabled={!canManage || !storageReady}
                        onChange={(event) => updateFormField("clearOpenAiApiKey", event.target.checked)}
                      />
                    </div>
                  </Col>

                  <Col lg={12}>
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
                              value={runtimeForm.aiTimeoutMs}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("aiTimeoutMs", event.target.value)}
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
                              value={runtimeForm.aiInputMaxChars}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("aiInputMaxChars", event.target.value)}
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
                              value={runtimeForm.aiFileTextMaxChars}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("aiFileTextMaxChars", event.target.value)}
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
                              value={runtimeForm.aiMaxOutputTokens}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("aiMaxOutputTokens", event.target.value)}
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
                              value={runtimeForm.aiStringMaxChars}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("aiStringMaxChars", event.target.value)}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group controlId="agency-ai-default-mode">
                            <Form.Label>Modalita default</Form.Label>
                            <Form.Select
                              value={runtimeForm.aiDefaultMode}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("aiDefaultMode", event.target.value)}
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
                            checked={runtimeForm.aiDebugEnabled}
                            disabled={!canManage || !storageReady}
                            onChange={(event) => updateFormField("aiDebugEnabled", event.target.checked)}
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
                              value={runtimeForm.aiFunctionModelsText}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("aiFunctionModelsText", event.target.value)}
                              placeholder='{"discovery.generateBrief":"gpt-4o-mini","web.generateBlock":"gpt-4o-mini"}'
                            />
                            <Form.Text>
                              JSON opzionale. Esempi funzione: discovery.generateBrief, discovery.generateSection, web.generateProject, web.generateBlock, ads.generateAsset.
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  </Col>

                  <Col lg={12}>
                    <div className="border rounded-3 p-3">
                      <h6 className="mb-3">Ricerca competitor</h6>
                      <Row className="g-3">
                        <Col md={4}>
                          <Form.Check
                            type="switch"
                            id="agency-competitor-enabled"
                            label="Abilita ricerca competitor online"
                            checked={runtimeForm.competitorSearchEnabled}
                            disabled={!canManage || !storageReady}
                            onChange={(event) => updateFormField("competitorSearchEnabled", event.target.checked)}
                          />
                        </Col>
                        <Col md={8}>
                          <Form.Group controlId="agency-competitor-provider">
                            <Form.Label>Provider ricerca</Form.Label>
                            <Form.Select
                              value={runtimeForm.competitorSearchProvider}
                              disabled={!canManage || !storageReady}
                              onChange={(event) => updateFormField("competitorSearchProvider", event.target.value)}
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
                  <Button type="submit" disabled={!canManage || !storageReady || saveState.status === "saving"}>
                    {saveState.status === "saving" ? "Salvataggio..." : "Salva impostazioni runtime"}
                  </Button>
                  <Button type="button" variant="light" className="border" onClick={refreshSettings}>
                    Aggiorna stato
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="card-border h-100">
            <Card.Body>
              <h6 className="mb-3">Project types disponibili</h6>
              <div className="d-flex flex-column gap-2">
                {AGENCY_PROJECT_TYPE_OPTIONS.map((entry) => (
                  <div key={entry.key} className="border rounded-3 p-2">
                    <div className="small fw-semibold">{entry.label}</div>
                    <div className="small text-muted">{entry.key} | {entry.description}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="card-border h-100">
            <Card.Body>
              <h6 className="mb-3">Scope acquistabile</h6>
              <div className="d-flex flex-wrap gap-2">
                {AGENCY_PROJECT_SCOPE_OPTIONS.map((entry) => (
                  <Badge key={entry.key} bg="light" text="dark" className="border">
                    {entry.label} ({entry.key})
                  </Badge>
                ))}
              </div>
              <hr />
              <h6 className="mb-2">Qualita delle fonti</h6>
              <div className="small text-muted">
                Stati operativi: da completare, parziali, pronte. I moduli dichiarano quando lavorano su dati incompleti.
              </div>
              <div className="mt-2">
                <Badge bg={isDev ? "success" : "secondary"}>
                  Dettagli tecnici sorgenti: {isDev ? "visibili in sviluppo" : "nascosti in produzione"}
                </Badge>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="card-border h-100">
            <Card.Body>
              <h6 className="mb-3">Ruoli team</h6>
              <div className="d-flex flex-column gap-2">
                {TEAM_ROLES.map((entry) => (
                  <div key={entry.key} className="border rounded-3 p-2">
                    <div className="small fw-semibold">{entry.label}</div>
                    <div className="small text-muted">{entry.key} | {entry.owner}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="card-border h-100">
            <Card.Body>
              <h6 className="mb-3">Moduli Agency attivi</h6>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {MODULES.map((entry) => (
                  <Badge key={entry} bg="light" text="dark" className="border">
                    {entry}
                  </Badge>
                ))}
              </div>
              <div className="alert alert-info py-2 mb-0">
                Cataloghi consultabili. Le funzioni AI e ricerca sono gestibili dal backend CRM solo da Superadmin.
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AgencyPageShell>
  );
};

export default AgencySettingsPage;
