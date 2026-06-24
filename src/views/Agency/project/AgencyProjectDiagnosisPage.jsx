import React from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { useParams } from "react-router-dom";
import {
  getAgencyProject,
  getAgencyProjectDiagnosis,
  saveAgencyProjectDiagnosis,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import {
  formatReportLabel,
  getReportBadgeClass,
} from "../../../modules/agency-os/reports/reportPresentation";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import AgencySourceReadinessPanel from "./AgencySourceReadinessPanel";
import { readableValue } from "./agencyProjectUx";

const formatDateTime = (value) => {
  if (!value) {
    return "Da completare";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("it-IT");
};

const IssueList = ({ items, emptyLabel }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mb-0 small text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((entry) => (
        <div key={entry.key || entry.title} className="border rounded-3 p-2">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div>
              <div className="small fw-semibold">{entry.title}</div>
              <div className="small text-muted mt-1">{entry.summary}</div>
            </div>
            <div className="d-flex flex-column align-items-end gap-1">
              <span className={`badge ${getReportBadgeClass("priority", entry.priority)}`}>
                {formatReportLabel(entry.priority)}
              </span>
              <span className="badge text-bg-light border">{formatReportLabel(entry.module)}</span>
            </div>
          </div>
          <div className="small text-muted mt-1">
            Categoria: {formatReportLabel(entry.category)}
          </div>
          {Array.isArray(entry.evidence) && entry.evidence.length > 0 && (
            <div className="small text-muted mt-1">Evidenze: {entry.evidence.join(" | ")}</div>
          )}
        </div>
      ))}
    </div>
  );
};

const ModuleSignalList = ({ signals }) => {
  const entries = Object.entries(signals || {});
  if (entries.length === 0) {
    return <p className="mb-0 small text-muted">Nessun segnale modulo disponibile.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="border rounded-3 p-2">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div className="small fw-semibold">{formatReportLabel(key)}</div>
            <span className={`badge ${getReportBadgeClass("reportStatus", value?.status)}`}>
              {formatReportLabel(value?.status)}
            </span>
          </div>
          <div className="small text-muted mt-1">{value?.summary || "Nessuna sintesi disponibile."}</div>
        </div>
      ))}
    </div>
  );
};

const AgencyProjectDiagnosisPage = () => {
  const { projectId } = useParams();
  const [diagnosisState, setDiagnosisState] = React.useState(null);
  const [project, setProject] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [runtimeMessage, setRuntimeMessage] = React.useState("");

  const loadDiagnosis = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setRuntimeMessage("");
    try {
      const [nextProject, payload] = await Promise.all([
        getAgencyProject(projectId).catch(() => null),
        getAgencyProjectDiagnosis(projectId),
      ]);
      setProject(nextProject);
      setDiagnosisState(payload);
      setDataMeta(readAgencyDataMeta(payload));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Caricamento diagnosis non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadDiagnosis();
  }, [loadDiagnosis]);

  const handleSaveDiagnosis = async () => {
    if (!diagnosisState) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");

    try {
      const saved = await saveAgencyProjectDiagnosis(projectId, {
        output: diagnosisState.output,
      });
      setDiagnosisState(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Diagnosis salvata nel layer Agency."
        : "Diagnosis salvata localmente per indisponibilita temporanea del layer Agency.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio diagnosis non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (diagnosisState?.output?.evaluatedAt) {
      const shouldProceed = window.confirm(
        "Rigenerare la diagnosis usando i dati correnti di Discovery, Web, Ads, Reporting e segnali Agency?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");

    try {
      const regenerated = await saveAgencyProjectDiagnosis(projectId, {});
      setDiagnosisState(regenerated);
      setDataMeta(readAgencyDataMeta(regenerated));
      setRuntimeMessage(regenerated.persisted
        ? "Diagnosis rigenerata dai dati correnti e persistita."
        : "Diagnosis rigenerata localmente per indisponibilita temporanea del layer Agency.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione diagnosis non riuscita.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AgencyProjectPageTemplate
        title="Diagnosis Progetto"
        subtitle="Analisi dei punti deboli del progetto Agency."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento diagnosis progetto...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const output = diagnosisState?.output;
  const input = diagnosisState?.input;

  return (
    <AgencyProjectPageTemplate
      title="Diagnosis Progetto"
      subtitle="Analisi dei punti deboli basata su fonti, Discovery, Web, Ads e Reporting."
      dataMeta={dataMeta}
    >
      <AgencySourceReadinessPanel readiness={project?.sourceReadiness} compact />

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <Button type="button" size="sm" variant="outline-secondary" onClick={loadDiagnosis} disabled={loading || saving}>
          Ricarica
        </Button>
        <Button type="button" size="sm" variant="outline-primary" onClick={handleRegenerate} disabled={saving}>
          {saving ? "Rigenerazione..." : "Rigenera diagnosis"}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={handleSaveDiagnosis} disabled={saving || !diagnosisState}>
          {saving ? "Salvataggio..." : "Salva diagnosis"}
        </Button>
      </div>

      {saveMessage && <p className="small text-success mb-2">{saveMessage}</p>}
      {runtimeMessage && <p className="small text-primary mb-2" role="status">{runtimeMessage}</p>}
      {saveError && <p className="small text-danger mb-2" role="alert">{saveError}</p>}

      <Row className="g-3 mb-3">
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Stato diagnosis</div>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className={`badge ${getReportBadgeClass("reportStatus", output?.diagnosisStatus)}`}>
                {formatReportLabel(output?.diagnosisStatus)}
              </span>
              <span className={`badge ${getReportBadgeClass("priority", output?.interventionPriority)}`}>
                {formatReportLabel(output?.interventionPriority)}
              </span>
            </div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Ultima valutazione</div>
            <div className="fw-semibold mt-1">{formatDateTime(diagnosisState?.lastUpdatedAt || output?.evaluatedAt)}</div>
            <div className="small text-muted">Confidence: {formatReportLabel(output?.confidenceLevel)}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Gap e finding</div>
            <div className="fs-4 fw-semibold mt-1">{output?.gapAnalysis?.length || 0}</div>
            <div className="small text-muted">Critici: {output?.criticalFindings?.length || 0}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Base dati</div>
            <div className="fw-semibold mt-1">Moduli Agency correnti</div>
            <div className="small text-muted">Progetto: {input?.projectName || projectId}</div>
          </div>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Sintesi diagnosis</div>
              <p className="mb-0 small text-muted">{output?.diagnosisSummary || "Nessuna sintesi disponibile."}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Input consolidati</div>
              <div className="small text-muted">Tipo progetto: {readableValue(input?.projectType?.label)}</div>
              <div className="small text-muted">Scope: {(input?.scopePurchased || []).filter((entry) => entry.purchased).map((entry) => entry.label).join(" | ") || "Nessuno"}</div>
              <div className="small text-muted">Moduli attivi: {(input?.activeModules || []).filter((entry) => entry.active).length}</div>
              <div className="small text-muted">Report: {formatReportLabel(input?.report?.reportStatus)}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Criticita principali</div>
              <IssueList items={output?.criticalFindings} emptyLabel="Nessuna criticita prioritaria rilevata." />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Cause probabili</div>
              <IssueList items={output?.probableCauses} emptyLabel="Nessuna causa probabile rilevata." />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Gap operativi</div>
              <IssueList items={output?.gapAnalysis} emptyLabel="Nessun gap operativo rilevato." />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Azioni consigliate</div>
              <IssueList items={output?.recommendedActions} emptyLabel="Nessuna azione prioritaria suggerita." />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Segnali moduli</div>
              <ModuleSignalList signals={output?.moduleSignals} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Fonti modulo</div>
              <div className="small text-muted">Discovery: {output?.sourceSummary?.hasDiscovery ? "presente" : "da completare"}</div>
              <div className="small text-muted">Web: {output?.sourceSummary?.hasWeb ? "presente" : "da completare"}</div>
              <div className="small text-muted">Ads: {output?.sourceSummary?.hasAds ? "presente" : "da completare"}</div>
              <div className="small text-muted">Report: {output?.sourceSummary?.hasReport ? "presente" : "da completare"}</div>
              <div className="small text-muted">Alert: {output?.sourceSummary?.hasAlerts ? "presenti" : "nessuno"}</div>
              <div className="small text-muted">Opportunita: {output?.sourceSummary?.hasOpportunities ? "presenti" : "nessuna"}</div>
              <div className="small text-muted">Task: {output?.sourceSummary?.hasTasks ? "presenti" : "nessuno"}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectDiagnosisPage;
