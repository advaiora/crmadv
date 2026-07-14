import React from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import { useParams } from "react-router-dom";
import {
  getAgencyProject,
  getAgencyProjectWeb,
  getAgencyProjectAds,
  getAgencyAiStatus,
  generateAgencyAdsAssetWithAi,
  saveAgencyProjectAds,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import {
  AGENCY_ADS_CAMPAIGN_GOALS,
  AGENCY_ADS_CHANNEL_SCOPES,
} from "../../../modules/agency-os/ads/agencyAdsV1Model";
import {
  buildAgencyAdsOperationalOutputV1,
  buildAgencyGoogleAdsOutputV1,
  buildAgencyMetaAdsOutputV1,
} from "../../../modules/agency-os/ads/agencyAdsRules";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import AgencySourceReadinessPanel from "./AgencySourceReadinessPanel";
import { readableValue } from "./agencyProjectUx";
import { useAgencyAiEstimates } from "../../../modules/agency-os/hooks/useAgencyAiEstimates";
import AiCostEstimate from "../AiCostEstimate";

const CHANNEL_SCOPE_LABELS = {
  google: "Google Ads",
  meta: "Meta Ads",
  both: "Google + Meta",
};

const CAMPAIGN_GOAL_LABELS = {
  lead_generation: "Lead generation",
  sales: "Sales",
  traffic: "Traffic",
  awareness: "Awareness",
};

const ADS_PROJECT_CHANNELS = [
  { value: "google", label: "Google" },
  { value: "meta", label: "Meta" },
];

const ADS_PROJECT_STATUSES = ["draft", "in_progress", "review", "approved"];

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("it-IT");
};

const getInputCompleteness = (input, dataMeta) => {
  const missing = [];

  if (!input?.discovery?.sections?.target?.trim()) {
    missing.push("target");
  }
  if (!input?.discovery?.sections?.offer?.trim()) {
    missing.push("offerta");
  }
  if (!input?.web?.ctaPrimary?.trim()) {
    missing.push("CTA");
  }
  if (!input?.web?.available) {
    missing.push("output web");
  }
  const technicalText = String(input?.discovery?.sections?.technicalAspects || "").toLowerCase();
  const marketingText = String(input?.discovery?.sections?.marketingAcquisition || "").toLowerCase();
  if (!technicalText.includes("tracking") && !technicalText.includes("pixel") && !technicalText.includes("ga4")) {
    missing.push("tracking");
  }
  if (!marketingText.includes("geo") && !marketingText.includes("area") && !marketingText.includes("local")) {
    missing.push("area geografica");
  }

  const source = typeof dataMeta?.source === "string" ? dataMeta.source : "mock";
  if (source === "local_fallback") {
    return {
      label: "bozza locale",
      tone: "warning",
      missing,
    };
  }

  if (missing.length === 0) {
    return {
      label: "completo",
      tone: "success",
      missing,
    };
  }

  return {
    label: "input parziali",
    tone: "warning",
    missing,
  };
};

const renderList = (items, emptyLabel) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">{emptyLabel}</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item, index) => (
        <div key={`${String(item)}-${index}`} className="border rounded-3 p-2 small">
          {item}
        </div>
      ))}
    </div>
  );
};

const renderChecklist = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">Checklist launch non ancora disponibile.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item) => (
        <div key={item.key} className="border rounded-3 p-2">
          <div className="small fw-semibold">{item.label}</div>
          <div className="small text-muted">
            Canale: {readableValue(item.channel, "condiviso")} | Stato: {readableValue(item.status, "da fare")}
          </div>
        </div>
      ))}
    </div>
  );
};

const renderAdGroups = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">Ad group non ancora definiti.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item) => (
        <div key={item.name} className="border rounded-3 p-2">
          <div className="small fw-semibold">{item.name}</div>
          <div className="small text-muted mb-1">{readableValue(item.intent, "Intent da completare")}</div>
          <div className="small">
            <strong>Keyword:</strong> {readableValue(item.keywords)}
          </div>
        </div>
      ))}
    </div>
  );
};

const renderRsaIdeas = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="small text-muted mb-0">RSA ideas non ancora disponibili.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((item, index) => (
        <div key={`rsa-${index}`} className="border rounded-3 p-2">
          <div className="small fw-semibold mb-1">RSA Idea {index + 1}</div>
          <div className="small mb-1">
            <strong>Headline:</strong> {readableValue(item.headlines)}
          </div>
          <div className="small">
            <strong>Description:</strong> {readableValue(item.descriptions)}
          </div>
        </div>
      ))}
    </div>
  );
};

const AgencyProjectAdsPage = () => {
  const { projectId } = useParams();
  const aiEstimates = useAgencyAiEstimates();
  const [adsState, setAdsState] = React.useState(null);
  const [project, setProject] = React.useState(null);
  const [webProjects, setWebProjects] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [aiStatus, setAiStatus] = React.useState(null);
  const [generatingAssetKey, setGeneratingAssetKey] = React.useState("");
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [runtimeMessage, setRuntimeMessage] = React.useState("");
  const [adsProjectDraft, setAdsProjectDraft] = React.useState({
    channel: "google",
    campaignType: "",
    name: "",
    goal: "",
    linkedWebProjectId: "",
  });

  const loadAds = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setRuntimeMessage("");
    try {
      const [nextProject, webPayload, payload, nextAiStatus] = await Promise.all([
        getAgencyProject(projectId).catch(() => null),
        getAgencyProjectWeb(projectId).catch(() => null),
        getAgencyProjectAds(projectId),
        getAgencyAiStatus().catch(() => null),
      ]);
      setProject(nextProject);
      setWebProjects(Array.isArray(webPayload?.output?.webProjects) ? webPayload.output.webProjects : []);
      setAdsState(payload);
      setDataMeta(readAgencyDataMeta(payload));
      setAiStatus(nextAiStatus);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Caricamento modulo Ads non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadAds();
  }, [loadAds]);

  const setOutputField = (key, value) => {
    setAdsState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          [key]: value,
        },
      };
    });
  };

  const addAdsProject = () => {
    if (!adsProjectDraft.name.trim()) {
      setSaveError("Inserisci un nome campagna/sub-progetto Ads.");
      return;
    }

    const nextProject = {
      id: `ads_${Date.now()}`,
      channel: adsProjectDraft.channel,
      campaignType: adsProjectDraft.campaignType.trim(),
      name: adsProjectDraft.name.trim(),
      goal: adsProjectDraft.goal.trim(),
      linkedWebProjectId: adsProjectDraft.linkedWebProjectId,
      status: "draft",
      sourceRefs: [],
      adsOutput: {},
    };

    setAdsState((current) => ({
      ...current,
      output: {
        ...current.output,
        adsProjects: [...(current.output.adsProjects || []), nextProject],
      },
    }));
    setAdsProjectDraft({
      channel: "google",
      campaignType: "",
      name: "",
      goal: "",
      linkedWebProjectId: "",
    });
    setSaveError("");
  };

  const updateAdsProjectStatus = (projectItemId, status) => {
    setAdsState((current) => ({
      ...current,
      output: {
        ...current.output,
        adsProjects: (current.output.adsProjects || []).map((entry) => (
          entry.id === projectItemId ? { ...entry, status } : entry
        )),
      },
    }));
  };

  const generateForAdsProject = (projectItem) => {
    setAdsState((current) => ({
      ...current,
      output: {
        ...current.output,
        channelScope: projectItem.channel,
        campaignGoal: projectItem.goal ? current.output.campaignGoal : current.output.campaignGoal,
        offerAngle: projectItem.goal || current.output.offerAngle,
      },
    }));
    setRuntimeMessage(`Campagna "${projectItem.name}" impostata come contesto Ads corrente. Ora puoi generare Google, Meta o checklist.`);
  };

  const handleSave = async () => {
    if (!adsState) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");

    try {
      const saved = await saveAgencyProjectAds(projectId, {
        output: adsState.output,
      });
      setAdsState(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Output Ads salvato nel layer Agency."
        : "Output Ads salvato localmente per indisponibilita temporanea del layer Agency.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio modulo Ads non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateGoogleAds = () => {
    if (!adsState) {
      return;
    }

    const hasExistingGoogleOutput = Boolean(adsState.output.googleAds.campaignType)
      || adsState.output.googleAds.adGroups.length > 0
      || adsState.output.googleAds.keywordSeeds.length > 0;
    if (hasExistingGoogleOutput) {
      const shouldProceed = window.confirm(
        "Sovrascrivere l'output Google Ads corrente con una nuova bozza base?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    const generated = buildAgencyGoogleAdsOutputV1({
      projectTypeKey: adsState.input.projectType.key,
      scopePurchased: adsState.input.scopePurchased,
      discovery: adsState.input.discovery.sections,
      contextSummary: adsState.input.contextSummary,
      offerSummary: adsState.output.offerAngle || adsState.input.web.offerSummary || adsState.input.discovery.sections.offer,
      targetSummary: adsState.output.targetingSummary || adsState.input.web.targetSummary || adsState.input.discovery.sections.target,
      ctaPrimary: adsState.input.web.ctaPrimary,
      web: adsState.input.web,
    });

    setAdsState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          ...generated,
          adCopyBlocks: {
            ...current.output.adCopyBlocks,
            google: generated.adCopyBlocks.google,
          },
          googleAds: generated.googleAds,
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setRuntimeMessage("Bozza Google Ads generata dai dati disponibili. Verifica target, offerta, CTA e tracking prima del setup.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleGenerateMetaAds = () => {
    if (!adsState) {
      return;
    }

    const hasExistingMetaOutput = Boolean(adsState.output.metaAds.campaignAngle)
      || adsState.output.metaAds.primaryTexts.length > 0
      || adsState.output.metaAds.assetRequests.length > 0;
    if (hasExistingMetaOutput) {
      const shouldProceed = window.confirm(
        "Sovrascrivere l'output Meta Ads corrente con una nuova bozza base?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    const generated = buildAgencyMetaAdsOutputV1({
      projectTypeKey: adsState.input.projectType.key,
      discovery: adsState.input.discovery.sections,
      contextSummary: adsState.input.contextSummary,
      offerSummary: adsState.output.offerAngle || adsState.input.web.offerSummary || adsState.input.discovery.sections.offer,
      targetSummary: adsState.output.targetingSummary || adsState.input.web.targetSummary || adsState.input.discovery.sections.target,
      ctaPrimary: adsState.input.web.ctaPrimary,
      web: adsState.input.web,
    });

    setAdsState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          ...generated,
          adCopyBlocks: {
            ...current.output.adCopyBlocks,
            meta: generated.adCopyBlocks.meta,
          },
          metaAds: generated.metaAds,
          messageHooks: generated.messageHooks,
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setRuntimeMessage("Bozza Meta Ads generata dai dati disponibili. Verifica audience, offerta, creativita e tracking prima del setup.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleGenerateOperationalPlan = () => {
    if (!adsState) {
      return;
    }

    const generated = buildAgencyAdsOperationalOutputV1({
      channelScope: adsState.output.channelScope,
      projectTypeKey: adsState.input.projectType.key,
      discovery: adsState.input.discovery.sections,
      web: adsState.input.web,
      googleAds: adsState.output.googleAds,
      metaAds: adsState.output.metaAds,
      ctaPrimary: adsState.input.web.ctaPrimary,
    });

    setAdsState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          ...generated,
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setRuntimeMessage("Checklist e richieste asset generate dai dati Ads correnti.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleRegeneratePlaceholder = () => {
    if (!adsState) {
      return;
    }

    const shouldProceed = window.confirm(
      "Rigenerare sovrascrivera Google Ads, Meta Ads, checklist e asset requests correnti. Continuare?",
    );
    if (!shouldProceed) {
      return;
    }

    const googleOutput = buildAgencyGoogleAdsOutputV1({
      projectTypeKey: adsState.input.projectType.key,
      scopePurchased: adsState.input.scopePurchased,
      discovery: adsState.input.discovery.sections,
      contextSummary: adsState.input.contextSummary,
      offerSummary: adsState.output.offerAngle || adsState.input.web.offerSummary || adsState.input.discovery.sections.offer,
      targetSummary: adsState.output.targetingSummary || adsState.input.web.targetSummary || adsState.input.discovery.sections.target,
      ctaPrimary: adsState.input.web.ctaPrimary,
      web: adsState.input.web,
    });
    const metaOutput = buildAgencyMetaAdsOutputV1({
      projectTypeKey: adsState.input.projectType.key,
      discovery: adsState.input.discovery.sections,
      contextSummary: adsState.input.contextSummary,
      offerSummary: adsState.output.offerAngle || adsState.input.web.offerSummary || adsState.input.discovery.sections.offer,
      targetSummary: adsState.output.targetingSummary || adsState.input.web.targetSummary || adsState.input.discovery.sections.target,
      ctaPrimary: adsState.input.web.ctaPrimary,
      web: adsState.input.web,
    });
    const operationalOutput = buildAgencyAdsOperationalOutputV1({
      channelScope: adsState.output.channelScope,
      projectTypeKey: adsState.input.projectType.key,
      discovery: adsState.input.discovery.sections,
      web: adsState.input.web,
      googleAds: googleOutput.googleAds,
      metaAds: metaOutput.metaAds,
      ctaPrimary: adsState.input.web.ctaPrimary,
    });

    setAdsState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          ...googleOutput,
          ...metaOutput,
          ...operationalOutput,
          adCopyBlocks: {
            ...current.output.adCopyBlocks,
            google: googleOutput.adCopyBlocks.google,
            meta: metaOutput.adCopyBlocks.meta,
          },
          googleAds: googleOutput.googleAds,
          metaAds: metaOutput.metaAds,
          messageHooks: metaOutput.messageHooks,
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setRuntimeMessage("Output Ads rigenerato: Google, Meta, checklist e asset requests aggiornati.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleGenerateAdsAssetWithAi = async (assetKey) => {
    if (aiStatus?.configured === false || aiStatus?.status === "not_configured") {
      setRuntimeMessage("AI non configurata lato server. Puoi usare le bozze base oppure completare la configurazione in Impostazioni Agency.");
      return;
    }

    setGeneratingAssetKey(assetKey);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");
    try {
      const generated = await generateAgencyAdsAssetWithAi(projectId, assetKey);
      if (!generated) {
        setSaveError("Rigenerazione asset Ads non riuscita.");
        return;
      }
      setAdsState(generated);
      setDataMeta(readAgencyDataMeta(generated));
      const wasCached = Boolean(generated.aiGeneration?.cacheHit);
      setRuntimeMessage(wasCached
        ? "Asset Ads aggiornato riusando un risultato gia disponibile: nessuna nuova chiamata AI."
        : "Asset Ads rigenerato con AI usando fonti, Discovery e output Web disponibili.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione asset Ads non riuscita.");
    } finally {
      setGeneratingAssetKey("");
    }
  };

  if (loading || !adsState) {
    return (
      <AgencyProjectPageTemplate
        title="Ads"
        subtitle="Workspace campagne per Google, Meta e checklist operative."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento modulo Ads...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const { input, output } = adsState;
  const completeness = getInputCompleteness(input, dataMeta);
  const linkedLanding = input.web.available
    ? `${input.web.pageType || "landing"} | ${readableValue(input.web.pageGoal, "Goal da completare")}`
    : "Nessun output Web persistito";

  return (
    <AgencyProjectPageTemplate
      title="Ads"
      subtitle="Crea campagne collegate a landing, brief, target e offerta."
      dataMeta={dataMeta}
    >
      <AgencySourceReadinessPanel readiness={project?.sourceReadiness} />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-muted">
          {output.lastGeneratedAt
            ? `Ultima generazione: ${formatDateTime(output.lastGeneratedAt)}`
            : "Nessuna generazione registrata."}
          {adsState.lastUpdatedAt && (
            <span className="d-block">Ultimo salvataggio: {formatDateTime(adsState.lastUpdatedAt)}</span>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline-secondary" onClick={handleGenerateGoogleAds}>
            Genera Google Ads
          </Button>
          <Button type="button" size="sm" variant="outline-secondary" onClick={handleGenerateMetaAds}>
            Genera Meta Ads
          </Button>
          <Button type="button" size="sm" variant="outline-secondary" onClick={handleGenerateOperationalPlan}>
            Genera checklist
          </Button>
          <Button type="button" size="sm" variant="outline-dark" onClick={handleRegeneratePlaceholder}>
            Rigenerazione controllata
          </Button>
          <details className="small">
            <summary className="btn btn-sm btn-outline-primary">
              <i className="bi bi-stars me-1" aria-hidden="true" />Rigenera asset AI
            </summary>
            <div className="mt-2">
              <AiCostEstimate
                estimate={aiEstimates.byFunction["ads.generateAsset"]}
                aiConfigured={aiEstimates.aiConfigured}
              />
            </div>
            <div className="d-flex flex-wrap gap-2 mt-2">
              {[
                ["headlines", "Headline"],
                ["primary_texts", "Primary text"],
                ["keywords", "Keyword"],
                ["creative_angles", "Angoli creativi"],
                ["angle", "Angolo offerta"],
                ["sitelinks", "Sitelink/callout"],
              ].map(([assetKey, label]) => (
                <Button
                  key={assetKey}
                  type="button"
                  size="sm"
                  variant="outline-primary"
                  onClick={() => handleGenerateAdsAssetWithAi(assetKey)}
                  disabled={Boolean(generatingAssetKey) || aiStatus?.configured === false || aiStatus?.status === "not_configured"}
                >
                  {generatingAssetKey === assetKey ? "Rigenerazione..." : label}
                </Button>
              ))}
            </div>
          </details>
          <Button type="button" size="sm" variant="outline-primary" onClick={loadAds} disabled={loading || saving}>
            Ricarica
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva output Ads"}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="alert alert-warning py-2 mb-3" role="alert">{saveError}</div>
      )}
      {saveMessage && (
        <div className="alert alert-success py-2 mb-3" role="status">{saveMessage}</div>
      )}
      {runtimeMessage && (
        <div className="alert alert-info py-2 mb-3" role="status">{runtimeMessage}</div>
      )}
      <div className={`alert alert-${completeness.tone} py-2 mb-3`}>
        <strong>Qualita input Ads:</strong> {completeness.label}
        {completeness.missing.length > 0 && (
          <span> | Mancano o sono deboli: {completeness.missing.join(", ")}</span>
        )}
      </div>

      <div className="agency-workflow-steps">
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">1</span>Scegli campagna
          </div>
          <div className="small text-muted mt-1">Google, Meta o campagna collegata a una landing.</div>
        </div>
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">2</span>Verifica requisiti
          </div>
          <div className="small text-muted mt-1">Target, offerta, tracking e landing collegata.</div>
        </div>
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">3</span>Genera asset
          </div>
          <div className="small text-muted mt-1">Crea bozze o rigenera singoli asset AI.</div>
        </div>
      </div>

      <div className="agency-action-strip mb-3">
        <div>
          <strong>Prossima azione:</strong>{" "}
          {output.adsProjects?.length
            ? completeness.missing.length > 0
              ? `Completa ${completeness.missing.slice(0, 2).join(", ")} prima del setup.`
              : "Genera asset specifici o salva la campagna."
            : "Crea la prima campagna Ads collegata al progetto."}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline-primary" onClick={handleGenerateOperationalPlan}>
            Genera checklist
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva Ads"}
          </Button>
        </div>
      </div>

      <Row className="g-3">
        <Col lg={12}>
          <Card className="card-border">
            <Card.Body>
              <h6 className="mb-1">Campagne Ads</h6>
              <p className="small text-muted mb-3">
                Crea una campagna specifica e, quando possibile, collegala a una landing o pagina Web.
              </p>
              <Row className="g-2 mb-3">
                <Col md={2}>
                  <Form.Select
                    value={adsProjectDraft.channel}
                    onChange={(event) => setAdsProjectDraft((current) => ({ ...current, channel: event.target.value }))}
                  >
                    {ADS_PROJECT_CHANNELS.map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Control
                    value={adsProjectDraft.campaignType}
                    onChange={(event) => setAdsProjectDraft((current) => ({ ...current, campaignType: event.target.value }))}
                    placeholder="Tipo campagna"
                  />
                </Col>
                <Col md={3}>
                  <Form.Control
                    value={adsProjectDraft.name}
                    onChange={(event) => setAdsProjectDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome campagna"
                  />
                </Col>
                <Col md={2}>
                  <Form.Control
                    value={adsProjectDraft.goal}
                    onChange={(event) => setAdsProjectDraft((current) => ({ ...current, goal: event.target.value }))}
                    placeholder="Goal"
                  />
                </Col>
                <Col md={2}>
                  <Form.Select
                    value={adsProjectDraft.linkedWebProjectId}
                    onChange={(event) => setAdsProjectDraft((current) => ({ ...current, linkedWebProjectId: event.target.value }))}
                  >
                    <option value="">Nessuna landing</option>
                    {webProjects.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={1} className="d-grid">
                  <Button type="button" variant="outline-primary" onClick={addAdsProject}>
                    Crea
                  </Button>
                </Col>
              </Row>

              <div className="agency-record-list">
                {(output.adsProjects || []).map((entry) => (
                  <div key={entry.id} className="agency-record-row">
                    <div>
                      <div className="small fw-semibold">{entry.name}</div>
                      <div className="small text-muted">
                        {entry.channel} | {readableValue(entry.campaignType, "Tipo da completare")} | {readableValue(entry.goal, "Goal da completare")}
                        {entry.linkedWebProjectId ? ` | landing: ${webProjects.find((item) => item.id === entry.linkedWebProjectId)?.name || entry.linkedWebProjectId}` : ""}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <Form.Select
                        size="sm"
                        value={entry.status}
                        onChange={(event) => updateAdsProjectStatus(entry.id, event.target.value)}
                      >
                        {ADS_PROJECT_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </Form.Select>
                      <Button type="button" size="sm" variant="outline-secondary" onClick={() => generateForAdsProject(entry)}>
                        Apri/Genera
                      </Button>
                    </div>
                  </div>
                ))}
                {(!output.adsProjects || output.adsProjects.length === 0) && (
                  <div className="agency-empty-state small">
                    <strong>Nessuna campagna creata.</strong> Crea una campagna Google o Meta per generare output specifico.
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <div className="agency-panel h-100">
              <h6 className="agency-panel-title">Qualita input</h6>
              <p className="agency-panel-subtitle">Requisiti minimi prima del setup.</p>
              <div className="small mb-2"><strong>Tipo progetto:</strong> {input.projectType.label}</div>
              <div className="small mb-2"><strong>Contesto:</strong> {readableValue(input.contextSummary)}</div>
              <div className="small mb-2"><strong>Target:</strong> {readableValue(input.discovery.sections.target)}</div>
              <div className="small mb-2"><strong>Offerta:</strong> {readableValue(input.discovery.sections.offer)}</div>
              <div className="small mb-2"><strong>Moduli attivi:</strong> {readableValue(input.activeModules.filter((item) => item.active).map((item) => item.label))}</div>
              <div className="small"><strong>Landing/Web:</strong> {linkedLanding}</div>
          </div>
        </Col>

        <Col lg={8}>
          <Card className="card-border h-100">
            <Card.Body>
              <h6 className="mb-3">Impostazioni campagna</h6>
              <Row className="g-2">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="small mb-1">Canale</Form.Label>
                    <Form.Select
                      value={output.channelScope}
                      onChange={(event) => setOutputField("channelScope", event.target.value)}
                    >
                      {AGENCY_ADS_CHANNEL_SCOPES.map((entry) => (
                        <option key={entry} value={entry}>{CHANNEL_SCOPE_LABELS[entry] || entry}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="small mb-1">Obiettivo campagna</Form.Label>
                    <Form.Select
                      value={output.campaignGoal}
                      onChange={(event) => setOutputField("campaignGoal", event.target.value)}
                    >
                      {AGENCY_ADS_CAMPAIGN_GOALS.map((entry) => (
                        <option key={entry} value={entry}>{CAMPAIGN_GOAL_LABELS[entry] || entry}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="small mb-1">CTA principale</Form.Label>
                    <Form.Control
                      value={readableValue(input.web.ctaPrimary)}
                      readOnly
                      plaintext={false}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small mb-1">Sintesi targeting</Form.Label>
                    <Form.Control
                      value={output.targetingSummary}
                      onChange={(event) => setOutputField("targetingSummary", event.target.value)}
                      placeholder="Segmenti, geo, interessi, intent"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small mb-1">Angolo offerta</Form.Label>
                    <Form.Control
                      value={output.offerAngle}
                      onChange={(event) => setOutputField("offerAngle", event.target.value)}
                      placeholder="Taglio dell'offerta per Ads"
                    />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="small mb-1">Landing collegata</Form.Label>
                    <Form.Control value={linkedLanding} readOnly plaintext={false} />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Google Ads</h6>
              <div className="small mb-2"><strong>Tipo campagna:</strong> {readableValue(output.googleAds.campaignType)}</div>
              <div className="small mb-2"><strong>Struttura:</strong> {readableValue(output.googleAds.campaignStructure)}</div>
              <div className="small mb-2"><strong>Keyword seed:</strong> {readableValue(output.googleAds.keywordSeeds)}</div>
              <div className="small mb-2"><strong>Negative seed:</strong> {readableValue(output.googleAds.negativeSeeds)}</div>
              <div className="small mb-2"><strong>Estensioni:</strong> {readableValue(output.googleAds.extensionsIdeas)}</div>
              <div className="small mb-3"><strong>Raccomandazione landing:</strong> {readableValue(output.googleAds.landingRecommendation || input.web.landingRecommendationBase)}</div>
              <h6 className="small mb-2">Ad Groups</h6>
              {renderAdGroups(output.googleAds.adGroups)}
              <div className="mt-3">
                <h6 className="small mb-2">RSA Ideas</h6>
                {renderRsaIdeas(output.googleAds.rsaIdeas)}
              </div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Meta Ads</h6>
              <div className="small mb-2"><strong>Angolo campagna:</strong> {readableValue(output.metaAds.campaignAngle)}</div>
              <div className="small mb-2"><strong>Audience:</strong> {readableValue(output.metaAds.audienceIdeas)}</div>
              <div className="small mb-2"><strong>Angoli creativi:</strong> {readableValue(output.metaAds.creativeAngles)}</div>
              <div className="small mb-2"><strong>Hook:</strong> {readableValue(output.metaAds.hooks)}</div>
              <div className="small mb-2"><strong>Primary text:</strong> {readableValue(output.metaAds.primaryTexts)}</div>
              <div className="small mb-2"><strong>Headline:</strong> {readableValue(output.metaAds.headlines)}</div>
              <div className="small"><strong>CTA:</strong> {readableValue(output.metaAds.ctaIdeas)}</div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Richieste asset</h6>
              {renderList(output.assetRequests, "Nessuna richiesta asset ancora generata.")}
              <div className="mt-3">
                <h6 className="small mb-2">Asset Meta dedicati</h6>
                {renderList(output.metaAds.assetRequests, "Nessun asset Meta specifico ancora disponibile.")}
              </div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Checklist lancio</h6>
              {renderChecklist(output.launchChecklist)}
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Hook messaggio</h6>
              {renderList(output.messageHooks, "Nessun hook messaggio ancora generato.")}
              <div className="mt-3">
                <h6 className="small mb-2">Blocchi copy Ads</h6>
                <div className="small mb-2"><strong>Google:</strong></div>
                {renderList(output.adCopyBlocks.google, "Nessun blocco copy Google disponibile.")}
                <div className="small mt-3 mb-2"><strong>Meta:</strong></div>
                {renderList(output.adCopyBlocks.meta, "Nessun blocco copy Meta disponibile.")}
              </div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Segnali operativi</h6>
              <div className="small mb-2"><strong>Canale attivo:</strong> {CHANNEL_SCOPE_LABELS[output.channelScope] || output.channelScope}</div>
              <div className="small mb-2"><strong>Goal campagna:</strong> {CAMPAIGN_GOAL_LABELS[output.campaignGoal] || output.campaignGoal}</div>
              <div className="small mb-2"><strong>Qualita input:</strong> {completeness.label}</div>
              <div className="small mb-2"><strong>Alert disponibili:</strong> {input.alerts.length}</div>
              <div className="small mb-2"><strong>Opportunita disponibili:</strong> {input.opportunities.length}</div>
              <div className="small mb-3"><strong>Output Web disponibile:</strong> {input.web.available ? "Si" : "No"}</div>
              <Form.Group>
                <Form.Label className="small mb-1">Note modulo Ads</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={output.notes}
                  onChange={(event) => setOutputField("notes", event.target.value)}
                  placeholder="Note operative per marketing, ads specialist o grafica."
                />
              </Form.Group>
          </div>
        </Col>
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectAdsPage;
