import React from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  formatReportLabel,
  getReportBadgeClass,
} from "../../../../modules/agency-os/reports/reportPresentation";
import AgencyProjectPageTemplate from "../AgencyProjectPageTemplate";
import { formatDateTime } from "../agencyProjectUx";
import { useAgencyProjectReportClient } from "./hooks/useAgencyProjectReportClient";
import { renderStringList } from "./reportViewHelpers";
import { technicalViewPath } from "./reportViewMode";

const SUBTITLE = "Versione da condividere e stampare, scritta per il cliente.";
const EMPTY_DATE = "Non disponibile";

// Vista generale della scheda "Report": quella che si vede entrando.
// La vista tecnica sta sullo stesso percorso, dietro il parametro `?vista=tecnica`
// (vedi reportViewMode.js): il pulsante qui sotto e' l'unico modo per aprirla
// dall'interno della scheda.
const ClientReportView = ({ projectId }) => {
  const clientReport = useAgencyProjectReportClient(projectId);
  const { report, loading, saving, downloadingPdf } = clientReport;

  if (loading) {
    return (
      <AgencyProjectPageTemplate title="Report" subtitle={SUBTITLE} dataMeta={clientReport.dataMeta}>
        <p className="mb-0 text-muted small">Caricamento report cliente...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const output = report?.output;
  const input = report?.input;

  return (
    <AgencyProjectPageTemplate title="Report" subtitle={SUBTITLE} dataMeta={clientReport.dataMeta}>
      {/* ⚠️ Unico posto dell'area dove i colori restano scritti a mano, ed e'
          voluto: questo blocco vale SOLO per la stampa. I token del tema seguono
          chiaro/scuro, quindi su carta darebbero un foglio nero se l'utente sta
          lavorando in tema scuro. La stampa vuole nero su bianco sempre. */}
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
        <Button type="button" size="sm" variant="outline-secondary" onClick={clientReport.load} disabled={loading || saving}>
          Ricarica
        </Button>
        <Button type="button" size="sm" variant="outline-primary" onClick={clientReport.regenerate} disabled={saving}>
          {saving ? "Rigenerazione..." : "Rigenera report cliente"}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={clientReport.save} disabled={saving || !report}>
          {saving ? "Salvataggio..." : "Salva report cliente"}
        </Button>
        <Button type="button" size="sm" variant="outline-primary" onClick={clientReport.downloadPdf} disabled={downloadingPdf || !report}>
          {downloadingPdf ? "Preparazione PDF..." : "Scarica PDF"}
        </Button>
        <Button type="button" size="sm" variant="outline-secondary" onClick={clientReport.print}>
          Stampa
        </Button>
        <Button as={Link} to={technicalViewPath(projectId)} type="button" size="sm" variant="outline-secondary">
          Vedi la versione tecnica
        </Button>
      </div>

      {clientReport.saveMessage && <p className="small text-success mb-2 agency-client-report-actions">{clientReport.saveMessage}</p>}
      {clientReport.runtimeMessage && <p className="small text-primary mb-2 agency-client-report-actions" role="status">{clientReport.runtimeMessage}</p>}
      {clientReport.saveError && <p className="small text-danger mb-2 agency-client-report-actions" role="alert">{clientReport.saveError}</p>}

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
            <div className="fw-semibold mt-1">{formatDateTime(report?.lastUpdatedAt || output?.updatedAt, EMPTY_DATE)}</div>
            <div className="small text-muted">Generato: {formatDateTime(output?.generatedAt, EMPTY_DATE)}</div>
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
          <div className="fw-semibold mb-2">Sintesi per il cliente</div>
          <p className="mb-0 small text-muted">{output?.executiveSummary || "Nessuna sintesi disponibile."}</p>
        </Card.Body>
      </Card>

      <Card className="mb-3 agency-client-report-section">
        <Card.Body>
          <div className="fw-semibold mb-2">Stato del progetto</div>
          <p className="mb-0 small text-muted">{output?.projectStatusSummary || "Nessuna sintesi di stato disponibile."}</p>
        </Card.Body>
      </Card>

      <Row className="g-3 agency-client-report-section">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Attivita svolte / impostate</div>
              {renderStringList(output?.workCompletedSummary, "Nessuna attivita consolidata da mostrare.", "agency-client-report-block")}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Elementi da presidiare</div>
              {renderStringList(output?.keyFindings, "Nessuna criticita principale da evidenziare.", "agency-client-report-block")}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mt-1 agency-client-report-section">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Opportunita di miglioramento</div>
              {renderStringList(output?.keyOpportunities, "Nessuna opportunita principale disponibile.", "agency-client-report-block")}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Prossimi step</div>
              {renderStringList(output?.nextStepsSummary, "Nessun next step disponibile.", "agency-client-report-block")}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mt-3 agency-client-report-section agency-client-report-dev">
        <Card.Body>
          <div className="fw-semibold mb-2">Anteprima per la stampa</div>
          <div className="small text-muted mb-2">
            Come viene il documento su carta o in PDF.
          </div>
          <div className="border rounded-3 p-3" dangerouslySetInnerHTML={{ __html: output?.printableHtml || "<p>Nessuna preview disponibile.</p>" }} />
        </Card.Body>
      </Card>
    </AgencyProjectPageTemplate>
  );
};

export default ClientReportView;
