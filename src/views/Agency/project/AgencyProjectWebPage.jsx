import React from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import { useParams } from "react-router-dom";
import {
  getAgencyProject,
  getAgencyAiStatus,
  getAgencyProjectWeb,
  generateAgencyWebBlockWithAi,
  generateAgencyWebProjectWithAi,
  saveAgencyProjectWeb,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import {
  buildAgencyWebOutputV1,
  buildAgencyWebCopyBlocksV1,
  buildAgencyWebPreviewHtmlBaseV1,
  buildAgencyWebSectionPlanV1,
  buildAgencyWebWireframeV1,
} from "../../../modules/agency-os/web/agencyWebRules";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import AgencySourceReadinessPanel from "./AgencySourceReadinessPanel";
import { getInputQualityTone, readableValue } from "./agencyProjectUx";

const PAGE_TYPE_OPTIONS = [
  { value: "landing", label: "Landing" },
  { value: "website", label: "Sito" },
  { value: "homepage", label: "Homepage" },
  { value: "service_page", label: "Service Page" },
  { value: "ecommerce_lite", label: "Ecommerce Lite" },
];

const WEB_PROJECT_TYPES = [
  { value: "landing", label: "Landing page" },
  { value: "homepage", label: "Homepage" },
  { value: "service_page", label: "Pagina servizio" },
  { value: "ecommerce_page", label: "Pagina ecommerce" },
  { value: "section", label: "Sezione sito" },
];

const WEB_PROJECT_STATUSES = ["draft", "in_progress", "review", "approved"];

const buildWebMissingInputs = (input, output, sourceReadiness) => {
  const missing = [];
  if (!readableValue(input?.discovery?.sections?.target, "")) missing.push("target");
  if (!readableValue(input?.discovery?.sections?.offer, "")) missing.push("offerta");
  if (!readableValue(output?.ctaSet?.primary, "")) missing.push("CTA primaria");
  if (!readableValue(input?.discovery?.sections?.brandCommunication, "")) missing.push("differenzianti/USP");
  if (!readableValue(input?.discovery?.sections?.availableMaterials, "")) missing.push("prove o materiali");
  if (sourceReadiness?.status !== "ready") missing.push("fonti progetto complete");
  return missing;
};

const AgencyProjectWebPage = () => {
  const { projectId } = useParams();
  const [webState, setWebState] = React.useState(null);
  const [project, setProject] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [generatingAi, setGeneratingAi] = React.useState(false);
  const [generatingBlockKey, setGeneratingBlockKey] = React.useState("");
  const [aiStatus, setAiStatus] = React.useState(null);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [generationMessage, setGenerationMessage] = React.useState("");
  const [webProjectDraft, setWebProjectDraft] = React.useState({
    type: "landing",
    name: "",
    goal: "",
    target: "",
    primaryCta: "",
  });

  const loadWeb = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setGenerationMessage("");
    try {
      const [nextProject, payload] = await Promise.all([
        getAgencyProject(projectId).catch(() => null),
        getAgencyProjectWeb(projectId),
      ]);
      setProject(nextProject);
      setWebState(payload);
      setDataMeta(readAgencyDataMeta(payload));
      getAgencyAiStatus().then((status) => setAiStatus(status)).catch(() => setAiStatus(null));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Caricamento modulo Web non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadWeb();
  }, [loadWeb]);

  const setOutputField = (key, value) => {
    setWebState((current) => {
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

  const addWebProject = () => {
    if (!webProjectDraft.name.trim()) {
      setSaveError("Inserisci un nome sub-progetto Web.");
      return;
    }

    const nextProject = {
      id: `web_${Date.now()}`,
      type: webProjectDraft.type,
      name: webProjectDraft.name.trim(),
      goal: webProjectDraft.goal.trim(),
      target: webProjectDraft.target.trim(),
      primaryCta: webProjectDraft.primaryCta.trim(),
      status: "draft",
      sourceRefs: [],
      webOutput: {},
    };

    setWebState((current) => ({
      ...current,
      output: {
        ...current.output,
        webProjects: [...(current.output.webProjects || []), nextProject],
      },
    }));
    setWebProjectDraft({
      type: "landing",
      name: "",
      goal: "",
      target: "",
      primaryCta: "",
    });
    setSaveError("");
  };

  const updateWebProjectStatus = (projectItemId, status) => {
    setWebState((current) => ({
      ...current,
      output: {
        ...current.output,
        webProjects: (current.output.webProjects || []).map((entry) => (
          entry.id === projectItemId ? { ...entry, status } : entry
        )),
      },
    }));
  };

  const generateForWebProject = (projectItem) => {
    setOutputField("pageType", projectItem.type === "ecommerce_page" ? "ecommerce_lite" : projectItem.type);
    setWebState((current) => ({
      ...current,
      output: {
        ...current.output,
        pageGoal: projectItem.goal || current.output.pageGoal,
        targetSummary: projectItem.target || current.output.targetSummary,
        ctaSet: {
          ...current.output.ctaSet,
          primary: projectItem.primaryCta || current.output.ctaSet.primary,
        },
      },
    }));
    setGenerationMessage(`Sub-progetto "${projectItem.name}" impostato come contesto Web corrente. Ora puoi rigenerare struttura/copy.`);
  };

  const handleSave = async () => {
    if (!webState) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const saved = await saveAgencyProjectWeb(projectId, {
        output: webState.output,
      });
      setWebState(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Output Web salvato nel layer Agency."
        : "Output Web salvato localmente per indisponibilita temporanea del layer Agency.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio modulo Web non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateStructure = () => {
    if (!webState) {
      return;
    }

    const generatedSections = buildAgencyWebSectionPlanV1({
      projectTypeKey: webState.input.projectType.key,
      scopePurchased: webState.input.scopePurchased,
      targetSummary: webState.output.targetSummary || webState.input.discovery.sections.target,
      offerSummary: webState.output.offerSummary || webState.input.discovery.sections.offer,
      ctaPrimary: webState.output.ctaSet.primary,
      pageType: webState.output.pageType,
    });

    setWebState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          sectionPlan: generatedSections,
          targetSummary: current.output.targetSummary || current.input.discovery.sections.target || "",
          offerSummary: current.output.offerSummary || current.input.discovery.sections.offer || "",
          pageGoal: current.output.pageGoal || current.input.discovery.sections.projectGoal || current.input.contextSummary || "",
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setGenerationMessage("Struttura pagina generata come bozza base. Verifica fonti, target e offerta prima di usarla con il cliente.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleGenerateCopy = () => {
    if (!webState) {
      return;
    }

    const generatedCopy = buildAgencyWebCopyBlocksV1({
      projectTypeKey: webState.input.projectType.key,
      pageGoal: webState.output.pageGoal || webState.input.discovery.sections.projectGoal,
      targetSummary: webState.output.targetSummary || webState.input.discovery.sections.target,
      offerSummary: webState.output.offerSummary || webState.input.discovery.sections.offer,
      valueProp: webState.output.valueProp,
      ctaPrimary: webState.output.ctaSet.primary,
      discovery: webState.input.discovery.sections,
    });

    setWebState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          ...generatedCopy,
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setGenerationMessage("Copy base generato dai dati disponibili. Completa Discovery e Fonti per renderlo piu specifico.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleGenerateWireframe = () => {
    if (!webState) {
      return;
    }

    const wireframe = buildAgencyWebWireframeV1({
      sectionPlan: webState.output.sectionPlan,
      copyBlocks: webState.output.copyBlocks,
      ctaSet: webState.output.ctaSet,
    });

    setWebState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          wireframe,
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setGenerationMessage("Wireframe testuale generato dal section plan corrente.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleGeneratePreview = () => {
    if (!webState) {
      return;
    }

    const previewHtmlBase = buildAgencyWebPreviewHtmlBaseV1({
      sectionPlan: webState.output.sectionPlan,
      copyBlocks: webState.output.copyBlocks,
      ctaSet: webState.output.ctaSet,
      faqItems: webState.output.faqItems,
      trustElements: webState.output.trustElements,
    });

    setWebState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          previewHtmlBase,
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setGenerationMessage("Preview base generata dal contenuto corrente.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleRegenerateAll = () => {
    if (!webState) {
      return;
    }

    const hasGeneratedOutput = webState.output.sectionPlan.length > 0
      || Boolean(webState.output.copyBlocks.headline)
      || Boolean(webState.output.previewHtmlBase);
    if (hasGeneratedOutput) {
      const shouldProceed = window.confirm(
        "Rigenerare sovrascrivera struttura/copy/wireframe/preview correnti. Continuare?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    const generatedOutput = buildAgencyWebOutputV1({
      projectTypeKey: webState.input.projectType.key,
      scopePurchased: webState.input.scopePurchased,
      pageType: webState.output.pageType,
      pageGoal: webState.output.pageGoal || webState.input.discovery.sections.projectGoal || webState.input.contextSummary,
      targetSummary: webState.output.targetSummary || webState.input.discovery.sections.target,
      offerSummary: webState.output.offerSummary || webState.input.discovery.sections.offer,
      valueProp: webState.output.valueProp,
      ctaPrimary: webState.output.ctaSet.primary,
      discovery: webState.input.discovery.sections,
    });

    setWebState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          ...generatedOutput,
          pageGoal: current.output.pageGoal || current.input.discovery.sections.projectGoal || current.input.contextSummary || "",
          targetSummary: current.output.targetSummary || current.input.discovery.sections.target || "",
          offerSummary: current.output.offerSummary || current.input.discovery.sections.offer || "",
          lastGeneratedAt: new Date().toISOString(),
        },
      };
    });

    setGenerationMessage("Bozza Web rigenerata: struttura, copy, wireframe e preview sono stati aggiornati dai dati disponibili.");
    setSaveMessage("");
    setSaveError("");
  };

  const handleGenerateWithAi = async (projectItem = null) => {
    const targetProject = projectItem || webState?.output?.webProjects?.[0];
    if (!targetProject) {
      setSaveError("Crea prima una landing o pagina Web da generare.");
      return;
    }
    if (aiStatus?.configured === false || aiStatus?.status === "not_configured") {
      setGenerationMessage("AI non configurata lato server. Puoi usare la bozza base oppure completare la configurazione in Impostazioni Agency.");
      return;
    }

    setGeneratingAi(true);
    setSaveError("");
    setSaveMessage("");
    setGenerationMessage("");
    try {
      const generated = await generateAgencyWebProjectWithAi(projectId, targetProject.id);
      if (!generated) {
        setSaveError("Generazione Web AI non riuscita.");
        return;
      }
      setWebState(generated);
      setDataMeta(readAgencyDataMeta(generated));
      setGenerationMessage(generated.aiGeneration?.generated
        ? "Output Web generato con AI usando fonti e Discovery progetto."
        : generated.aiGeneration?.message || "Generazione AI non eseguita.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Generazione Web AI non riuscita.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleGenerateBlockWithAi = async (blockKey, projectItem = null) => {
    const targetProject = projectItem || webState?.output?.webProjects?.[0];
    if (!targetProject) {
      setSaveError("Crea prima una landing o pagina Web da aggiornare.");
      return;
    }
    if (aiStatus?.configured === false || aiStatus?.status === "not_configured") {
      setGenerationMessage("AI non configurata lato server. Puoi usare le azioni bozza base oppure completare la configurazione in Impostazioni Agency.");
      return;
    }

    setGeneratingBlockKey(blockKey);
    setSaveError("");
    setSaveMessage("");
    setGenerationMessage("");
    try {
      const generated = await generateAgencyWebBlockWithAi(projectId, targetProject.id, blockKey);
      if (!generated) {
        setSaveError("Rigenerazione del blocco Web non riuscita.");
        return;
      }
      setWebState(generated);
      setDataMeta(readAgencyDataMeta(generated));
      const wasCached = Boolean(generated.aiGeneration?.cacheHit);
      setGenerationMessage(wasCached
        ? "Blocco Web aggiornato riusando un risultato gia disponibile: nessuna nuova chiamata AI."
        : "Blocco Web rigenerato con AI usando fonti, Discovery e contesto progetto.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione del blocco Web non riuscita.");
    } finally {
      setGeneratingBlockKey("");
    }
  };

  if (loading || !webState) {
    return (
      <AgencyProjectPageTemplate
        title="Web"
        subtitle="Workspace per creare landing e pagine collegate a fonti, Discovery e obiettivi progetto."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento modulo Web...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const { input, output } = webState;
  const webMissingInputs = buildWebMissingInputs(input, output, project?.sourceReadiness);
  const usedSources = Array.isArray(project?.sourceReadiness?.usedSources)
    ? project.sourceReadiness.usedSources
    : [];

  return (
    <AgencyProjectPageTemplate
      title="Web"
      subtitle="Scegli una pagina, controlla la qualita input, genera una bozza e rivedi preview e copy."
      dataMeta={dataMeta}
    >
      <AgencySourceReadinessPanel readiness={project?.sourceReadiness} />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-muted">
          {output.lastGeneratedAt ? `Ultima generazione: ${output.lastGeneratedAt}` : "Nessuna generazione registrata."}
          {webState.lastUpdatedAt && (
            <span className="d-block">Ultimo salvataggio: {webState.lastUpdatedAt}</span>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => handleGenerateWithAi()}
            disabled={generatingAi || aiStatus?.configured === false || aiStatus?.status === "not_configured"}
            title={aiStatus?.configured === false || aiStatus?.status === "not_configured" ? "AI non configurata lato server" : "Genera output Web con AI"}
          >
            {generatingAi
              ? "Generazione AI..."
              : <><i className="bi bi-stars me-1" aria-hidden="true" />Genera con AI</>}
          </Button>
          <Button type="button" size="sm" variant="outline-dark" onClick={handleRegenerateAll}>
            Genera bozza base
          </Button>
          <details className="small">
            <summary className="btn btn-sm btn-outline-secondary">Azioni avanzate</summary>
            <div className="d-flex flex-wrap gap-2 mt-2">
              <Button type="button" size="sm" variant="outline-secondary" onClick={handleGenerateStructure}>
                Struttura
              </Button>
              <Button type="button" size="sm" variant="outline-secondary" onClick={handleGenerateCopy}>
                Copy base
              </Button>
              <Button type="button" size="sm" variant="outline-secondary" onClick={handleGenerateWireframe}>
                Wireframe
              </Button>
              <Button type="button" size="sm" variant="outline-secondary" onClick={handleGeneratePreview}>
                Preview
              </Button>
            </div>
          </details>
          <Button type="button" size="sm" variant="outline-primary" onClick={loadWeb} disabled={loading || saving}>
            Ricarica
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva output Web"}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="alert alert-warning py-2 mb-3" role="alert">{saveError}</div>
      )}
      {saveMessage && (
        <div className="alert alert-success py-2 mb-3" role="status">{saveMessage}</div>
      )}
      {generationMessage && (
        <div className="alert alert-info py-2 mb-3" role="status">{generationMessage}</div>
      )}
      {(aiStatus?.configured === false || aiStatus?.status === "not_configured") && (
        <div className="alert alert-warning py-2 mb-3">
          AI non configurata lato server. Puoi generare una bozza base, ma gli output saranno meno specifici.
        </div>
      )}

      <div className="agency-workflow-steps">
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">1</span>Scegli pagina
          </div>
          <div className="small text-muted mt-1">Landing, pagina servizio o sezione da produrre.</div>
        </div>
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">2</span>Verifica input
          </div>
          <div className="small text-muted mt-1">Target, offerta, CTA e fonti prima di generare.</div>
        </div>
        <div className="agency-workflow-step">
          <div className="small fw-semibold">
            <span className="agency-workflow-step-number">3</span>Genera blocchi
          </div>
          <div className="small text-muted mt-1">Usa AI per singoli blocchi o bozza base completa.</div>
        </div>
      </div>

      <div className="agency-action-strip mb-3">
        <div>
          <strong>Prossima azione:</strong>{" "}
          {output.webProjects?.length
            ? webMissingInputs.length > 0
              ? `Completa ${webMissingInputs.slice(0, 2).join(", ")} prima di consegnare.`
              : "Rigenera il blocco piu importante o salva l'output Web."
            : "Crea la prima landing o pagina da lavorare."}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline-primary" onClick={handleGenerateStructure}>
            Genera struttura base
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva Web"}
          </Button>
        </div>
      </div>

      <Row className="g-3">
        <Col lg={12}>
          <Card className="card-border">
            <Card.Body>
              <h6 className="mb-1">Landing e pagine</h6>
              <p className="small text-muted mb-3">
                Crea una pagina specifica prima di generare struttura, copy e preview.
              </p>
              <Row className="g-2 mb-3">
                <Col md={2}>
                  <Form.Select
                    value={webProjectDraft.type}
                    onChange={(event) => setWebProjectDraft((current) => ({ ...current, type: event.target.value }))}
                  >
                    {WEB_PROJECT_TYPES.map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Control
                    value={webProjectDraft.name}
                    onChange={(event) => setWebProjectDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome, es. Landing consulenza"
                  />
                </Col>
                <Col md={3}>
                  <Form.Control
                    value={webProjectDraft.goal}
                    onChange={(event) => setWebProjectDraft((current) => ({ ...current, goal: event.target.value }))}
                    placeholder="Goal"
                  />
                </Col>
                <Col md={2}>
                  <Form.Control
                    value={webProjectDraft.primaryCta}
                    onChange={(event) => setWebProjectDraft((current) => ({ ...current, primaryCta: event.target.value }))}
                    placeholder="CTA"
                  />
                </Col>
                <Col md={2} className="d-grid">
                  <Button type="button" variant="outline-primary" onClick={addWebProject}>
                    Crea pagina
                  </Button>
                </Col>
              </Row>

              <div className="agency-record-list">
                {(output.webProjects || []).map((entry) => (
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
                        onChange={(event) => updateWebProjectStatus(entry.id, event.target.value)}
                      >
                        {WEB_PROJECT_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </Form.Select>
                      <Button type="button" size="sm" variant="outline-secondary" onClick={() => generateForWebProject(entry)}>
                        Usa come pagina attiva
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-primary"
                        onClick={() => handleGenerateWithAi(entry)}
                        disabled={generatingAi || aiStatus?.configured === false || aiStatus?.status === "not_configured"}
                      >
                        <i className="bi bi-stars me-1" aria-hidden="true" />
                        Genera AI
                      </Button>
                    </div>
                  </div>
                ))}
                {(!output.webProjects || output.webProjects.length === 0) && (
                  <div className="agency-empty-state small">
                    <strong>Nessuna pagina creata.</strong> Crea la prima landing o pagina per generare struttura, copy e preview.
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <div className="agency-panel h-100">
              <h6 className="agency-panel-title">Qualita input</h6>
              <p className="agency-panel-subtitle">Dati usati prima della generazione.</p>
              <div className="small mb-2"><strong>Tipo progetto:</strong> {input.projectType.label}</div>
              <div className="small mb-2"><strong>Contesto:</strong> {readableValue(input.contextSummary)}</div>
              <div className="small mb-2"><strong>Target:</strong> {readableValue(input.discovery.sections.target)}</div>
              <div className="small"><strong>Offerta:</strong> {readableValue(input.discovery.sections.offer)}</div>
              <div className="small mt-2"><strong>CTA:</strong> {readableValue(output.ctaSet.primary, "CTA da completare")}</div>
              <div className="small mt-2"><strong>Fonti usate:</strong> {usedSources.length > 0 ? usedSources.join(", ") : "nessuna fonte cliente reale"}</div>
              {(() => {
                const missingCount = webMissingInputs.length;
                const tone = getInputQualityTone(missingCount);
                return (
                  <div className={`alert alert-${tone.variant} py-2 mt-3 mb-0`}>
                    <strong>{tone.label}.</strong>{" "}
                    {missingCount > 0
                      ? `Completa: ${webMissingInputs.join(", ")}.`
                      : "La pagina ha le informazioni minime per una generazione coerente."}
                  </div>
                );
              })()}
          </div>
        </Col>

        <Col lg={8}>
          <Card className="card-border h-100">
            <Card.Body>
              <h6 className="mb-3">Impostazioni pagina</h6>
              <Row className="g-2">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small mb-1">Obiettivo pagina</Form.Label>
                    <Form.Control
                      value={output.pageGoal}
                      onChange={(event) => setOutputField("pageGoal", event.target.value)}
                      placeholder="Obiettivo pagina"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="small mb-1">Tipo pagina</Form.Label>
                    <Form.Select
                      value={output.pageType}
                      onChange={(event) => setOutputField("pageType", event.target.value)}
                    >
                      {PAGE_TYPE_OPTIONS.map((entry) => (
                        <option key={entry.value} value={entry.value}>{entry.label}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="small mb-1">CTA principale</Form.Label>
                    <Form.Control
                      value={output.ctaSet.primary}
                      onChange={(event) => (
                        setOutputField("ctaSet", {
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
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {[
                    ["hero", "Hero"],
                    ["benefits", "Benefici"],
                    ["faq", "FAQ"],
                    ["cta", "CTA"],
                    ["trust", "Trust"],
                    ["wireframe", "Wireframe"],
                    ["section_plan", "Struttura"],
                  ].map(([blockKey, label]) => (
                    <Button
                      key={blockKey}
                      type="button"
                      size="sm"
                      variant="outline-primary"
                      onClick={() => handleGenerateBlockWithAi(blockKey)}
                      disabled={Boolean(generatingBlockKey) || generatingAi || aiStatus?.configured === false || aiStatus?.status === "not_configured"}
                    >
                      {generatingBlockKey === blockKey
                        ? "Rigenerazione..."
                        : <><i className="bi bi-stars me-1" aria-hidden="true" />{label}</>}
                    </Button>
                  ))}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col lg={12}>
          <div className="agency-panel">
              <h6 className="mb-2">Contratto generazione</h6>
              <Row className="g-2">
                <Col md={3}>
                  <div className="agency-mini-metric small">
                    <strong>Modalita</strong>
                    <div>{aiStatus?.configured ? "AI disponibile" : "Bozza base dichiarata"}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="agency-mini-metric small">
                    <strong>Confidence</strong>
                    <div>{webMissingInputs.length === 0 ? "alta" : webMissingInputs.length <= 2 ? "media" : "bassa"}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="agency-mini-metric small">
                    <strong>Fonti</strong>
                    <div>{usedSources.length > 0 ? usedSources.join(", ") : "fonti mancanti"}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="agency-mini-metric small">
                    <strong>Dati mancanti</strong>
                    <div>{webMissingInputs.length > 0 ? webMissingInputs.join(", ") : "nessun blocco critico"}</div>
                  </div>
                </Col>
              </Row>
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Struttura Pagina</h6>
              <div className="agency-record-list">
                {output.sectionPlan.map((section) => (
                    <div key={section.key} className="agency-record-row">
                      <div className="fw-semibold small">{section.title}</div>
                    <div className="small text-muted">{readableValue(section.objective)}</div>
                  </div>
                ))}
                {output.sectionPlan.length === 0 && (
                  <div className="agency-empty-state small">Nessuna struttura generata. Crea una bozza base o usa AI quando configurata.</div>
                )}
              </div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Copy Base</h6>
              <div className="agency-output-feature mb-2">
                <div className="agency-output-feature-title">{readableValue(output.copyBlocks.headline, "Headline da generare")}</div>
                <div className="agency-output-feature-body">{readableValue(output.copyBlocks.subheadline, "Subheadline da generare")}</div>
              </div>
              <div className="small mb-2"><strong>Intro:</strong> {readableValue(output.copyBlocks.intro)}</div>
              <div className="small mb-2"><strong>Benefici:</strong> {readableValue(output.copyBlocks.benefits)}</div>
              <div className="small"><strong>CTA:</strong> {readableValue(output.ctaSet.primary)}</div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Wireframe</h6>
              {output.wireframe.blocks.length > 0 ? (
                <pre className="small mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {output.wireframe.blocks.join("\n")}
                </pre>
              ) : (
                <div className="agency-empty-state small">Wireframe non ancora generato.</div>
              )}
          </div>
        </Col>

        <Col lg={6}>
          <div className="agency-output-panel">
              <h6 className="mb-2">Preview</h6>
              {output.previewHtmlBase ? (
                <div className="border rounded-3 p-3 bg-light">
                  <div className="small" dangerouslySetInnerHTML={{ __html: output.previewHtmlBase }} />
                </div>
              ) : (
                <div className="agency-empty-state small">Preview base non ancora generata.</div>
              )}
          </div>
        </Col>
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectWebPage;
