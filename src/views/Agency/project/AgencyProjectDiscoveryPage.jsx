import React from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import {
  getAgencyProjectDiscovery,
  generateAgencyProjectDiscoveryFromSources,
  generateAgencyProjectDiscoverySection,
  saveAgencyProjectDiscovery,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import { useAgencyAiEstimates } from "../../../modules/agency-os/hooks/useAgencyAiEstimates";
import AiCostEstimate from "../AiCostEstimate";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const SECTIONS = [
  { key: "businessContext", title: "Contesto business" },
  { key: "projectGoal", title: "Obiettivo progetto" },
  { key: "target", title: "Target" },
  { key: "offer", title: "Offerta" },
  { key: "brandCommunication", title: "Brand e comunicazione" },
  { key: "availableMaterials", title: "Materiali disponibili" },
  { key: "technicalAspects", title: "Aspetti tecnici" },
  { key: "marketingAcquisition", title: "Marketing e acquisizione" },
];

const REQUIRED_SECTION_KEYS = [
  "businessContext",
  "projectGoal",
  "target",
  "offer",
];

const SECTION_LABEL_MAP = Object.fromEntries(SECTIONS.map((section) => [section.key, section.title]));

const SECTION_HELP_TEXT = {
  businessContext: "Chi e il cliente, mercato, vincoli e contesto operativo.",
  projectGoal: "Obiettivo concreto, KPI, risultato atteso.",
  target: "Audience, segmenti, problemi e criteri decisionali.",
  offer: "Prodotto/servizio, value proposition, prova e condizioni.",
  brandCommunication: "Tone of voice, posizionamento, differenzianti.",
  availableMaterials: "File, asset, prove sociali, accessi e materiali.",
  technicalAspects: "Sito, tracking, CMS, analytics, vincoli tecnici.",
  marketingAcquisition: "Canali, CTA, campagne, funnel e acquisizione.",
};

const SECTION_CLIENT_QUESTIONS = {
  businessContext: "Quali vincoli, mercati o contesti dobbiamo considerare prima di produrre gli output?",
  projectGoal: "Qual e il risultato misurabile piu importante che questo progetto deve generare?",
  target: "Chi deve compiere l'azione e quali problemi concreti sta cercando di risolvere?",
  offer: "Quale offerta, servizio o incentivo vogliamo portare in primo piano?",
  brandCommunication: "Quali differenzianti, tono e prove rendono il cliente riconoscibile?",
  availableMaterials: "Quali materiali, testimonianze, asset o documenti possiamo usare come prove?",
  technicalAspects: "Quali strumenti, CMS, analytics, pixel o vincoli tecnici sono gia presenti?",
  marketingAcquisition: "Quale CTA, canale e percorso di acquisizione devono guidare il progetto?",
};

const getSectionStatus = (value) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return { label: "Da completare", variant: "secondary" };
  }
  if (text.includes("dati insufficienti") || text.includes("da validare")) {
    return { label: "Da validare", variant: "warning" };
  }
  return { label: "Compilata", variant: "success" };
};

const getSectionReliability = (value, sources = []) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text.includes("dati insufficienti")) {
    return "Affidabilita bassa";
  }
  if (Array.isArray(sources) && sources.some((entry) => /file letto|testo manuale|note manuali/i.test(String(entry)))) {
    return "Affidabilita media";
  }
  if (Array.isArray(sources) && sources.length > 1) {
    return "Affidabilita media";
  }
  return "Affidabilita da verificare";
};

const formatConfidence = (value) => {
  if (typeof value === "number") {
    if (value >= 0.75) {
      return "Confidence alta";
    }
    if (value >= 0.45) {
      return "Confidence media";
    }
    return "Confidence bassa";
  }

  const normalized = String(value || "").toLowerCase();
  if (normalized === "high" || normalized === "alta") {
    return "Confidence alta";
  }
  if (normalized === "medium" || normalized === "media") {
    return "Confidence media";
  }
  if (normalized === "low" || normalized === "bassa") {
    return "Confidence bassa";
  }
  return "Confidence da verificare";
};

const getSectionClientQuestion = (sectionKey, value, missingWarnings = []) => {
  const text = String(value || "").trim().toLowerCase();
  const matchingWarning = missingWarnings.find((entry) => (
    String(entry || "").toLowerCase().includes(sectionKey.toLowerCase())
    || String(entry || "").toLowerCase().includes((SECTION_LABEL_MAP[sectionKey] || "").toLowerCase())
  ));

  if (matchingWarning) {
    return `${matchingWarning} Quale risposta deve darci il cliente per completare questa sezione?`;
  }

  if (text.includes("da validare") || text.includes("dati insufficienti") || !text) {
    return SECTION_CLIENT_QUESTIONS[sectionKey];
  }

  return "";
};

const buildDiscoveryBrief = (formState, notes) => {
  return [
    `Contesto: ${formState.businessContext}`,
    `Obiettivo: ${formState.projectGoal}`,
    `Target: ${formState.target}`,
    `Offerta: ${formState.offer}`,
    `Marketing: ${formState.marketingAcquisition}`,
    `Note operative: ${notes || "Nessuna nota aggiuntiva."}`,
  ].join("\n");
};

const getDiscoveryAlerts = (formState) => {
  const alerts = [];
  const targetText = String(formState.target || "").toLowerCase();
  const offerText = String(formState.offer || "").toLowerCase();
  const goalText = String(formState.projectGoal || "").toLowerCase();
  const brandText = String(formState.brandCommunication || "").toLowerCase();
  const marketingText = String(formState.marketingAcquisition || "").toLowerCase();

  if (!targetText.trim() || targetText.includes("dati insufficienti")) {
    alerts.push("Target non definito: impossibile generare copy Ads preciso.");
  }

  if (!offerText.trim() || offerText.includes("dati insufficienti")) {
    alerts.push("Offerta non chiara: la landing rischia di risultare generica.");
  }

  if (!goalText.trim() || goalText.includes("dati insufficienti")) {
    alerts.push("Obiettivo progetto non definito: manca il criterio di successo.");
  }

  if (!marketingText.includes("cta") && !marketingText.includes("call to action")) {
    alerts.push("CTA mancante: serve definire l'azione primaria.");
  }

  if (!brandText.includes("usp") && !brandText.includes("differenz")) {
    alerts.push("Differenzianti/USP non evidenti nelle fonti disponibili.");
  }

  if (!String(formState.technicalAspects || "").toLowerCase().includes("tracking")) {
    alerts.push("Tracking non esplicitato negli aspetti tecnici.");
  }

  const emptyCount = SECTIONS.reduce((count, section) => {
    return String(formState[section.key] || "").trim() ? count : count + 1;
  }, 0);

  if (emptyCount >= 3) {
    alerts.push("Almeno 3 sezioni discovery sono incomplete.");
  }

  if (alerts.length === 0) {
    alerts.push("Nessun alert bloccante in questa bozza discovery.");
  }

  return alerts;
};

const AgencyProjectDiscoveryPage = () => {
  const { projectId } = useParams();
  const aiEstimates = useAgencyAiEstimates();
  const [formState, setFormState] = React.useState(() => ({
    businessContext: "",
    projectGoal: "",
    target: "",
    offer: "",
    brandCommunication: "",
    availableMaterials: "",
    technicalAspects: "",
    marketingAcquisition: "",
  }));
  const [notes, setNotes] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [contextSummary, setContextSummary] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [saveMessage, setSaveMessage] = React.useState("");
  const [dataMeta, setDataMeta] = React.useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState(null);
  const [sourceReliability, setSourceReliability] = React.useState("");
  const [usedSources, setUsedSources] = React.useState([]);
  const [sectionSources, setSectionSources] = React.useState({});
  const [confidenceBySection, setConfidenceBySection] = React.useState({});
  const [missingWarnings, setMissingWarnings] = React.useState([]);
  const [regeneratingSectionKey, setRegeneratingSectionKey] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSaveError("");
    setSaveMessage("");

    getAgencyProjectDiscovery(projectId)
      .then((seed) => {
        if (cancelled || !seed) {
          return;
        }

        setFormState(seed.sections);
        setNotes(seed.notes || "");
        setBrief(seed.brief || buildDiscoveryBrief(seed.sections, seed.notes || ""));
        setContextSummary(seed.contextSummary || "");
        setDataMeta(readAgencyDataMeta(seed));
        setLastUpdatedAt(seed.lastUpdatedAt || null);
        setSourceReliability(seed.sourceReliability || "");
        setUsedSources(Array.isArray(seed.usedSources) ? seed.usedSources : []);
        setSectionSources(seed.sectionSources || {});
        setConfidenceBySection(seed.confidenceBySection || {});
        setMissingWarnings(Array.isArray(seed.missingWarnings) ? seed.missingWarnings : []);
      })
      .catch(() => {
        if (!cancelled) {
          setSaveError("Impossibile caricare Discovery dal backend. Puoi riprovare: i dati gia visibili restano nella schermata.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const completionCount = React.useMemo(() => (
    SECTIONS.reduce((count, section) => (String(formState[section.key] || "").trim() ? count + 1 : count), 0)
  ), [formState]);
  const missingRequiredSections = React.useMemo(() => (
    REQUIRED_SECTION_KEYS.filter((key) => !String(formState[key] || "").trim())
  ), [formState]);
  const missingRequiredSectionLabels = React.useMemo(() => (
    missingRequiredSections.map((key) => SECTION_LABEL_MAP[key] || key)
  ), [missingRequiredSections]);
  const discoveryAlerts = React.useMemo(() => getDiscoveryAlerts(formState), [formState]);

  const handleFieldChange = (key, value) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleRegenerateBrief = async () => {
    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const regenerated = await generateAgencyProjectDiscoveryFromSources(projectId);
      if (!regenerated) {
        setSaveError("Rigenerazione brief non riuscita.");
        return;
      }

      setFormState(regenerated.sections);
      setNotes(regenerated.notes || "");
      setBrief(regenerated.brief || buildDiscoveryBrief(regenerated.sections, regenerated.notes || ""));
      setContextSummary(regenerated.contextSummary || "");
      setDataMeta(readAgencyDataMeta(regenerated));
      setLastUpdatedAt(regenerated.lastUpdatedAt || new Date().toISOString());
      setSourceReliability(regenerated.sourceReliability || "");
      setUsedSources(Array.isArray(regenerated.usedSources) ? regenerated.usedSources : []);
      setSectionSources(regenerated.sectionSources || {});
      setConfidenceBySection(regenerated.confidenceBySection || {});
      setMissingWarnings(Array.isArray(regenerated.missingWarnings) ? regenerated.missingWarnings : []);
      setSaveMessage(regenerated.aiGeneration?.aiConfigured === false
        ? "Brief rigenerato come bozza base: AI non configurata."
        : "Brief rigenerato dalle fonti progetto. Verifica e salva eventuali modifiche.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione brief da fonti non riuscita.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateSection = async (sectionKey) => {
    const currentValue = String(formState[sectionKey] || "").trim();
    if (currentValue && !window.confirm(`Rigenerare "${SECTION_LABEL_MAP[sectionKey]}" dalle fonti? Il testo attuale della sezione verra sostituito.`)) {
      return;
    }

    setRegeneratingSectionKey(sectionKey);
    setSaveError("");
    setSaveMessage("");
    try {
      const regenerated = await generateAgencyProjectDiscoverySection(projectId, sectionKey);
      if (!regenerated) {
        setSaveError("Rigenerazione sezione non riuscita.");
        return;
      }

      setFormState(regenerated.sections);
      setNotes(regenerated.notes || "");
      setBrief(regenerated.brief || buildDiscoveryBrief(regenerated.sections, regenerated.notes || ""));
      setContextSummary(regenerated.contextSummary || "");
      setDataMeta(readAgencyDataMeta(regenerated));
      setLastUpdatedAt(regenerated.lastUpdatedAt || new Date().toISOString());
      setSourceReliability(regenerated.sourceReliability || "");
      setUsedSources(Array.isArray(regenerated.usedSources) ? regenerated.usedSources : []);
      setSectionSources(regenerated.sectionSources || {});
      setConfidenceBySection(regenerated.confidenceBySection || {});
      setMissingWarnings(Array.isArray(regenerated.missingWarnings) ? regenerated.missingWarnings : []);
      setSaveMessage(regenerated.aiGeneration?.aiConfigured === false
        ? `Sezione "${SECTION_LABEL_MAP[sectionKey]}" rigenerata con logica base: AI non configurata.`
        : `Sezione "${SECTION_LABEL_MAP[sectionKey]}" rigenerata dalle fonti progetto.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione sezione da fonti non riuscita.");
    } finally {
      setRegeneratingSectionKey("");
    }
  };

  const handleSave = async () => {
    if (missingRequiredSections.length > 0) {
      setSaveError(`Compila i campi obbligatori: ${missingRequiredSectionLabels.join(", ")}.`);
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const savedDiscovery = await saveAgencyProjectDiscovery(projectId, {
        sections: formState,
        notes,
      });

      setBrief(savedDiscovery.brief);
      setContextSummary(savedDiscovery.contextSummary || "");
      setDataMeta(readAgencyDataMeta(savedDiscovery));
      setLastUpdatedAt(savedDiscovery.lastUpdatedAt || new Date().toISOString());
      setSaveMessage(
        savedDiscovery.persisted
          ? "Discovery salvata su data layer Agency."
          : "Discovery salvata localmente: il salvataggio backend non e disponibile.",
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio Discovery non riuscito.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AgencyProjectPageTemplate
        title="Discovery Progetto AI"
        subtitle="Discovery guidata del progetto Agency."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento Discovery in corso...</p>
      </AgencyProjectPageTemplate>
    );
  }

  return (
    <AgencyProjectPageTemplate
      title="Discovery Progetto AI"
      subtitle="Brief operativo aggiornabile dalle fonti progetto."
      dataMeta={dataMeta}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-muted">
          Completamento: {completionCount}/{SECTIONS.length} sezioni
          {lastUpdatedAt && (
            <span className="d-block">Ultimo aggiornamento: {lastUpdatedAt}</span>
          )}
        </div>
        <div className="d-flex gap-2 align-items-center">
          <AiCostEstimate
            estimate={aiEstimates.byFunction["discovery.generateBrief"]}
            aiConfigured={aiEstimates.aiConfigured}
          />
          <Button
            type="button"
            size="sm"
            variant="outline-primary"
            onClick={handleRegenerateBrief}
            disabled={isSaving}
          >
            <i className="bi bi-stars me-1" aria-hidden="true" />
            AI Rigenera brief
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Salvataggio..." : "Salva Discovery"}
          </Button>
        </div>
      </div>
      {saveError && (
        <div className="alert alert-warning py-2 mb-3" role="alert">{saveError}</div>
      )}
      {saveMessage && (
        <div className="alert alert-success py-2 mb-3" role="status">{saveMessage}</div>
      )}
      {sourceReliability && (
        <div className="alert alert-info py-2 mb-3">
          Affidabilita fonti: <strong>{sourceReliability}</strong>
          {usedSources.length > 0 && <> | Fonti usate: {usedSources.join(", ")}</>}
        </div>
      )}
      {missingWarnings.length > 0 && (
        <Alert variant="warning" className="py-2 mb-3">
          <div className="fw-semibold small mb-1">Alert incompletezza</div>
          <ul className="small mb-0">
            {missingWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}
      {missingRequiredSections.length > 0 && (
        <div className="alert alert-info py-2 mb-3">
          Campi obbligatori mancanti: {missingRequiredSectionLabels.join(", ")}.
        </div>
      )}

      <Row className="g-3">
        <Col lg={8}>
          <div className="d-flex flex-column gap-3">
            {SECTIONS.map((section) => (
              <div className="agency-section-card" key={section.key}>
                <div className="agency-section-card-header">
                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <h6 className="mb-0">{section.title}</h6>
                      {(() => {
                        const status = getSectionStatus(formState[section.key]);
                        return <Badge bg={status.variant}>{status.label}</Badge>;
                      })()}
                    </div>
                    <div className="small text-muted mt-1">{SECTION_HELP_TEXT[section.key]}</div>
                    <div className="agency-section-meta">
                      <Badge bg="light" text="dark" className="border">
                        {getSectionReliability(formState[section.key], sectionSources[section.key])}
                      </Badge>
                      <Badge bg="light" text="dark" className="border">
                        {formatConfidence(confidenceBySection[section.key])}
                      </Badge>
                      {Array.isArray(sectionSources[section.key]) && sectionSources[section.key].length > 0 ? (
                        sectionSources[section.key].slice(0, 4).map((sourceLabel) => (
                          <Badge key={sourceLabel} bg="light" text="dark" className="border">
                            {sourceLabel}
                          </Badge>
                        ))
                      ) : (
                        <Badge bg="light" text="dark" className="border">Fonti non indicate</Badge>
                      )}
                    </div>
                  </div>
                  <div className="d-flex flex-column align-items-end gap-1">
                    <AiCostEstimate
                      estimate={aiEstimates.byFunction["discovery.generateSection"]}
                      aiConfigured={aiEstimates.aiConfigured}
                    />
                    <Button
                    type="button"
                    size="sm"
                    variant="outline-primary"
                    onClick={() => handleRegenerateSection(section.key)}
                    disabled={isSaving || Boolean(regeneratingSectionKey)}
                  >
                    {regeneratingSectionKey === section.key
                      ? <><Spinner animation="border" size="sm" className="me-1" />Rigenero...</>
                      : <><i className="bi bi-stars me-1" aria-hidden="true" />AI sezione</>}
                  </Button>
                  </div>
                </div>
                {getSectionClientQuestion(section.key, formState[section.key], missingWarnings) && (
                  <div className="agency-field-question small mb-2">
                    Domanda cliente consigliata: {getSectionClientQuestion(section.key, formState[section.key], missingWarnings)}
                  </div>
                )}
                <Form.Group className="mb-0">
                  <Form.Label className="visually-hidden">{section.title}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    aria-label={section.title}
                    value={formState[section.key]}
                    onChange={(event) => handleFieldChange(section.key, event.target.value)}
                    placeholder={`Scrivi o rigenera la sezione "${section.title}" dalle fonti progetto.`}
                  />
                </Form.Group>
              </div>
            ))}
          </div>
        </Col>

        <Col lg={4}>
          <div className="d-flex flex-column gap-3">
            <Card className="card-border">
              <Card.Body>
                <h6 className="mb-2">Note operative</h6>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Card.Body>
            </Card>

            <Card className="card-border">
              <Card.Body>
                <h6 className="mb-2">Punti da verificare</h6>
                <ul className="mb-0 small">
                  {discoveryAlerts.map((alertText) => (
                    <li key={alertText}>{alertText}</li>
                  ))}
                </ul>
              </Card.Body>
            </Card>

            <Card className="card-border">
              <Card.Body>
                <h6 className="mb-2">Brief generato</h6>
                {contextSummary && (
                  <p className="small text-muted mb-2">{contextSummary}</p>
                )}
                <pre className="small mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {brief}
                </pre>
              </Card.Body>
            </Card>
          </div>
        </Col>
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectDiscoveryPage;
