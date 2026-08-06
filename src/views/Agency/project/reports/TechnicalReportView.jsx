import React from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  formatReportLabel,
  getReportBadgeClass,
} from "../../../../modules/agency-os/reports/reportPresentation";
import AgencyOpportunityList from "../../opportunities/AgencyOpportunityList";
import AgencyProjectPageTemplate from "../AgencyProjectPageTemplate";
import { formatDateTime, readableValue } from "../agencyProjectUx";
import { useAgencyProjectReportTechnical } from "./hooks/useAgencyProjectReportTechnical";
import { renderStringList } from "./reportViewHelpers";
import { reportViewPath } from "./reportViewMode";

const SUBTITLE = "Vista tecnica: i dati interni da cui nasce il report del cliente.";

const renderAlerts = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mb-0 small text-muted">Nessun alert prioritario nel report.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((entry) => (
        <div key={entry.id || entry.title} className="border rounded-3 p-2">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div className="small fw-semibold">{entry.title}</div>
            <span className={`badge ${getReportBadgeClass("priority", entry.severity)}`}>
              {formatReportLabel(entry.severity)}
            </span>
          </div>
          <div className="small text-muted mt-1">
            Stato: {formatReportLabel(entry.status)}
          </div>
          {entry.reason && (
            <div className="small text-muted mt-1">{entry.reason}</div>
          )}
        </div>
      ))}
    </div>
  );
};

const renderTasks = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mb-0 small text-muted">Nessun task prioritario nel report.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((entry) => (
        <div key={entry.id || entry.title} className="border rounded-3 p-2">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div className="small fw-semibold">{entry.title}</div>
            <span className={`badge ${getReportBadgeClass("priority", entry.priority)}`}>
              {formatReportLabel(entry.priority)}
            </span>
          </div>
          <div className="small text-muted mt-1">
            Reparto: {formatReportLabel(entry.teamRole)} | Stato: {formatReportLabel(entry.status)}
          </div>
          {entry.description && (
            <div className="small text-muted mt-1">{entry.description}</div>
          )}
        </div>
      ))}
    </div>
  );
};

const SummaryBlock = ({ title, summary, highlights, status }) => (
  <Card className="h-100">
    <Card.Body className="d-flex flex-column gap-2">
      <div className="d-flex align-items-start justify-content-between gap-2">
        <div className="fw-semibold">{title}</div>
        <span className={`badge ${getReportBadgeClass("reportStatus", status)}`}>
          {formatReportLabel(status)}
        </span>
      </div>
      <p className="small text-muted mb-0">{summary || "Nessuna sintesi disponibile."}</p>
      {renderStringList(highlights, "Nessun highlight disponibile.")}
    </Card.Body>
  </Card>
);

// Striscia in cima che dichiara dove ci si trova e riporta indietro. Serve al
// requisito posto da Jacopo il 6/8/2026: la vista tecnica deve presentarsi come
// una vista DENTRO "Report", e si deve poter tornare alla generale con un pulsante
// esplicito, non col tasto indietro del browser.
const ViewSwitchBar = ({ projectId }) => (
  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded-3 p-2 mb-3">
    <div className="small text-muted">
      Stai guardando la <strong>versione tecnica</strong> del report.
    </div>
    <Button as={Link} to={reportViewPath(projectId)} type="button" size="sm" variant="outline-secondary">
      Torna al report cliente
    </Button>
  </div>
);

// Vista tecnica della scheda "Report" (era la scheda separata "Reports tecnici").
// Vive sullo stesso percorso della vista cliente, dietro `?vista=tecnica`.
const TechnicalReportView = ({ projectId }) => {
  const technicalReport = useAgencyProjectReportTechnical(projectId);
  const { report, loading, saving } = technicalReport;

  if (loading) {
    return (
      <AgencyProjectPageTemplate title="Report" subtitle={SUBTITLE} dataMeta={technicalReport.dataMeta}>
        <ViewSwitchBar projectId={projectId} />
        <p className="mb-0 text-muted small">Caricamento report progetto...</p>
      </AgencyProjectPageTemplate>
    );
  }

  const output = report?.output;
  const input = report?.input;
  const activeModulesCount = Array.isArray(output?.moduleStatus)
    ? output.moduleStatus.filter((entry) => entry.active).length
    : 0;
  const coveredModulesCount = Array.isArray(output?.moduleStatus)
    ? output.moduleStatus.filter((entry) => entry.active || entry.included || entry.suggested).length
    : 0;

  return (
    <AgencyProjectPageTemplate title="Report" subtitle={SUBTITLE} dataMeta={technicalReport.dataMeta}>
      {/* Il pannello sullo stato delle fonti NON si ripete qui: lo disegna gia' il
          template per ogni scheda tranne "Fonti". Prima della fusione compariva due
          volte su questa pagina. */}
      <ViewSwitchBar projectId={projectId} />

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <Button type="button" size="sm" variant="outline-secondary" onClick={technicalReport.load} disabled={loading || saving}>
          Ricarica
        </Button>
        <Button type="button" size="sm" variant="outline-primary" onClick={technicalReport.regenerate} disabled={saving}>
          {saving ? "Rigenerazione..." : "Rigenera snapshot"}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={technicalReport.save} disabled={saving || !report}>
          {saving ? "Salvataggio..." : "Salva snapshot"}
        </Button>
      </div>

      {technicalReport.saveMessage && <p className="small text-success mb-2">{technicalReport.saveMessage}</p>}
      {technicalReport.runtimeMessage && <p className="small text-primary mb-2" role="status">{technicalReport.runtimeMessage}</p>}
      {technicalReport.saveError && <p className="small text-danger mb-2" role="alert">{technicalReport.saveError}</p>}

      <Row className="g-3 mb-3">
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Stato report</div>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className={`badge ${getReportBadgeClass("reportStatus", output?.reportStatus)}`}>
                {formatReportLabel(output?.reportStatus)}
              </span>
              <span className={`badge ${getReportBadgeClass("projectStatus", output?.projectSnapshot?.projectStatus)}`}>
                {formatReportLabel(output?.projectSnapshot?.projectStatus)}
              </span>
            </div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Ultimo aggiornamento</div>
            <div className="fw-semibold mt-1">{formatDateTime(report?.lastUpdatedAt || output?.updatedAt)}</div>
            <div className="small text-muted">Generato: {formatDateTime(output?.generatedAt)}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Moduli coperti</div>
            <div className="fs-4 fw-semibold mt-1">{coveredModulesCount}</div>
            <div className="small text-muted">Attivi: {activeModulesCount}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Segnali top</div>
            <div className="small mt-1">
              Alert: {output?.topAlerts?.length || 0} | Opp: {output?.topOpportunities?.length || 0} | Task: {output?.topTasks?.length || 0}
            </div>
          </div>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={7}>
          <Card className="h-100">
            <Card.Body className="d-flex flex-column gap-2">
              <div className="fw-semibold">Project Snapshot</div>
              <div className="small text-muted">
                Progetto: <strong>{readableValue(output?.projectSnapshot?.projectName || input?.projectName || projectId)}</strong>
              </div>
              <div className="small text-muted">
                Tipo: {readableValue(output?.projectSnapshot?.projectTypeLabel || input?.projectType?.label, "Tipo da completare")} | Priorita: {formatReportLabel(output?.projectSnapshot?.projectPriority || input?.projectPriority)}
              </div>
              <div className="small text-muted">
                Scope acquistato: {readableValue(output?.projectSnapshot?.scopeSummary, "Nessuno")}
              </div>
              <p className="mb-0 small">{output?.projectSnapshot?.contextSummary || "Nessun contesto consolidato."}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="h-100">
            <Card.Body className="d-flex flex-column gap-2">
              <div className="fw-semibold">Stato moduli</div>
              <div className="d-flex flex-wrap gap-2">
                {(output?.moduleStatus || []).map((entry) => (
                  <span key={entry.key} className={`badge ${getReportBadgeClass("reportStatus", entry.status === "active" ? "ready" : entry.status === "included" ? "partial" : "draft")}`}>
                    {entry.label}: {formatReportLabel(entry.status)}
                  </span>
                ))}
                {(!output?.moduleStatus || output.moduleStatus.length === 0) && (
                  <span className="small text-muted">Nessun modulo disponibile.</span>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={4}>
          <SummaryBlock {...output?.discoverySummary} />
        </Col>
        <Col lg={4}>
          <SummaryBlock {...output?.webSummary} />
        </Col>
        <Col lg={4}>
          <SummaryBlock {...output?.adsSummary} />
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Top Alert</div>
              {renderAlerts(output?.topAlerts)}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Top Opportunities</div>
              <AgencyOpportunityList
                opportunities={output?.topOpportunities || []}
                groupBy="none"
                emptyMessage="Nessuna opportunita prioritaria nel report."
              />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Top Tasks</div>
              {renderTasks(output?.topTasks)}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <div className="fw-semibold mb-2">Next Steps</div>
          {renderStringList(output?.nextSteps, "Nessun next step disponibile nello snapshot corrente.")}
        </Card.Body>
      </Card>
    </AgencyProjectPageTemplate>
  );
};

export default TechnicalReportView;
