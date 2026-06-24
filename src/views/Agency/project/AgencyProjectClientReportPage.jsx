import React from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import {
  getAgencyProjectClientReport,
  saveAgencyProjectClientReport,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import {
  formatReportLabel,
  getReportBadgeClass,
} from "../../../modules/agency-os/reports/reportPresentation";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const formatDateTime = (value) => {
  if (!value) {
    return "Non disponibile";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("it-IT");
};

const renderStringList = (items, emptyLabel) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mb-0 small text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((entry, index) => (
        <div key={`${entry}-${index}`} className="border rounded-3 p-2 small agency-client-report-block">
          {entry}
        </div>
      ))}
    </div>
  );
};

const AgencyProjectClientReportPage = () => {
  const { projectId } = useParams();
  const [clientReportState, setClientReportState] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [runtimeMessage, setRuntimeMessage] = React.useState("");

  const loadClientReport = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setRuntimeMessage("");
    try {
      const payload = await getAgencyProjectClientReport(projectId);
      setClientReportState(payload);
      setDataMeta(readAgencyDataMeta(payload));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Caricamento report cliente non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadClientReport();
  }, [loadClientReport]);

  const handleSave = async () => {
    if (!clientReportState) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");

    try {
      const saved = await saveAgencyProjectClientReport(projectId, {
        output: clientReportState.output,
      });
      setClientReportState(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Report cliente salvato nel layer Agency."
        : "Report cliente salvato localmente: il backend Agency non ha confermato la persistenza.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio report cliente non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (clientReportState?.output?.generatedAt) {
      const shouldProceed = window.confirm(
        "Rigenerare il report cliente a partire dal report interno e dalla diagnosis correnti?",
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
      const regenerated = await saveAgencyProjectClientReport(projectId, {});
      setClientReportState(regenerated);
      setDataMeta(readAgencyDataMeta(regenerated));
      setRuntimeMessage(regenerated.persisted
        ? "Report cliente rigenerato e persistito."
        : "Report cliente rigenerato localmente: il backend Agency non ha confermato la persistenza.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione report cliente non riuscita.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <AgencyProjectPageTemplate
        title="Report Cliente"
        subtitle="Versione cliente-friendly del report progetto, orientata a condivisione e stampa."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento report cliente...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const output = clientReportState?.output;
  const input = clientReportState?.input;

  return (
    <AgencyProjectPageTemplate
      title="Report Cliente"
      subtitle="Versione cliente-friendly del report progetto, orientata a condivisione e stampa."
      dataMeta={dataMeta}
    >
      <style>{`
        @media print {
          .agency-client-report-actions,
          .agency-client-report-dev,
          .btn,
          .badge[data-source-debug] { display: none !important; }
          .container-fluid, .card, .card-body { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .agency-client-report-section { break-inside: avoid; margin-bottom: 16px; }
          .agency-client-report-block { border: 1px solid #d8d8d8 !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3 agency-client-report-actions">
        <Button type="button" size="sm" variant="outline-secondary" onClick={loadClientReport} disabled={loading || saving}>
          Ricarica
        </Button>
        <Button type="button" size="sm" variant="outline-primary" onClick={handleRegenerate} disabled={saving}>
          {saving ? "Rigenerazione..." : "Rigenera report cliente"}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={handleSave} disabled={saving || !clientReportState}>
          {saving ? "Salvataggio..." : "Salva report cliente"}
        </Button>
        <Button type="button" size="sm" variant="outline-dark" onClick={handlePrint}>
          Stampa / Esporta PDF
        </Button>
        <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/reports`} type="button" size="sm" variant="outline-secondary">
          Report tecnico
        </Button>
      </div>

      {saveMessage && <p className="small text-success mb-2 agency-client-report-actions">{saveMessage}</p>}
      {runtimeMessage && <p className="small text-primary mb-2 agency-client-report-actions">{runtimeMessage}</p>}
      {saveError && <p className="small text-danger mb-2 agency-client-report-actions">{saveError}</p>}

      <Row className="g-3 mb-3 agency-client-report-section">
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Stato report cliente</div>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className={`badge ${getReportBadgeClass("reportStatus", output?.clientReportStatus === "needs_review" ? "partial" : output?.clientReportStatus)}`}>
                {formatReportLabel(output?.clientReportStatus)}
              </span>
              <span className={`badge ${getReportBadgeClass("projectStatus", input?.projectStatus)}`}>
                {formatReportLabel(input?.projectStatus)}
              </span>
            </div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Ultimo aggiornamento</div>
            <div className="fw-semibold mt-1">{formatDateTime(clientReportState?.lastUpdatedAt || output?.updatedAt)}</div>
            <div className="small text-muted">Generato: {formatDateTime(output?.generatedAt)}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Progetto</div>
            <div className="fw-semibold mt-1">{input?.projectName || projectId}</div>
            <div className="small text-muted">Tipo: {input?.projectTypeLabel || "Marketing Full"}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Perimetro</div>
            <div className="small mt-1">{(input?.scopeSummary || []).join(" | ") || "Nessun perimetro disponibile"}</div>
          </div>
        </Col>
      </Row>

      <Card className="mb-3 agency-client-report-section">
        <Card.Body>
          <div className="fw-semibold mb-2">Executive Summary</div>
          <p className="mb-0 small text-muted">{output?.executiveSummary || "Nessuna sintesi disponibile."}</p>
        </Card.Body>
      </Card>

      <Card className="mb-3 agency-client-report-section">
        <Card.Body>
          <div className="fw-semibold mb-2">Stato Progetto</div>
          <p className="mb-0 small text-muted">{output?.projectStatusSummary || "Nessuna sintesi di stato disponibile."}</p>
        </Card.Body>
      </Card>

      <Row className="g-3 agency-client-report-section">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Attivita svolte / impostate</div>
              {renderStringList(output?.workCompletedSummary, "Nessuna attivita consolidata da mostrare.")}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Elementi da presidiare</div>
              {renderStringList(output?.keyFindings, "Nessuna criticita principale da evidenziare.")}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mt-1 agency-client-report-section">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Opportunita di miglioramento</div>
              {renderStringList(output?.keyOpportunities, "Nessuna opportunita principale disponibile.")}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Prossimi step</div>
              {renderStringList(output?.nextStepsSummary, "Nessun next step disponibile.")}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mt-3 agency-client-report-section agency-client-report-dev">
        <Card.Body>
          <div className="fw-semibold mb-2">Preview Print-Friendly</div>
          <div className="small text-muted mb-2">
            HTML base pronto per browser print/PDF. Utile come base tecnica per export futuri.
          </div>
          <div className="border rounded-3 p-3" dangerouslySetInnerHTML={{ __html: output?.printableHtml || "<p>Nessuna preview disponibile.</p>" }} />
        </Card.Body>
      </Card>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectClientReportPage;
