import React from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import {
  formatReportLabel,
  getReportBadgeClass,
} from "../../../../modules/agency-os/reports/reportPresentation";
import { formatDateTime, readableValue } from "../agencyProjectUx";
import { IssueList, ModuleSignalList } from "./DiagnosisLists";

// L'analisi AI dei punti deboli del progetto: era la scheda "Diagnosis", dal
// 5/8/2026 vive dentro "Da risolvere" sotto gli alert operativi. Gli alert dicono
// COSA non va (righe salvate a database); questa dice PERCHE' e cosa farci
// (snapshot generato dal motore di diagnosi). Sono complementari, non doppioni.
const DiagnosisPanel = ({ diagnosis, loading, busy, message, error, onReload, onSave, onRegenerate }) => {
  if (loading) {
    return <p className="mb-0 text-muted small">Caricamento dell'analisi...</p>;
  }

  const output = diagnosis?.output;
  const input = diagnosis?.input;

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <Button type="button" size="sm" variant="outline-secondary" onClick={onReload} disabled={busy}>
          Ricarica
        </Button>
        <Button type="button" size="sm" variant="outline-primary" onClick={onRegenerate} disabled={busy}>
          {busy ? "Rigenerazione..." : "Rigenera analisi"}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={busy || !diagnosis}>
          {busy ? "Salvataggio..." : "Salva analisi"}
        </Button>
      </div>

      {message && <p className="small text-success mb-2" role="status">{message}</p>}
      {error && <p className="small text-danger mb-2" role="alert">{error}</p>}

      <Row className="g-3 mb-3">
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Stato dell'analisi</div>
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
            <div className="fw-semibold mt-1">{formatDateTime(diagnosis?.lastUpdatedAt || output?.evaluatedAt)}</div>
            <div className="small text-muted">Confidence: {formatReportLabel(output?.confidenceLevel)}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Lacune trovate</div>
            <div className="fs-4 fw-semibold mt-1">{output?.gapAnalysis?.length || 0}</div>
            <div className="small text-muted">Di cui critiche: {output?.criticalFindings?.length || 0}</div>
          </div>
        </Col>
        <Col md={6} xl={3}>
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Su cosa si basa</div>
            <div className="fw-semibold mt-1">Moduli attivi del progetto</div>
            <div className="small text-muted">Progetto: {readableValue(input?.projectName)}</div>
          </div>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">In sintesi</div>
              <p className="mb-0 small text-muted">{output?.diagnosisSummary || "Nessuna sintesi disponibile."}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Dati usati</div>
              <div className="small text-muted">Tipo progetto: {readableValue(input?.projectType?.label)}</div>
              <div className="small text-muted">
                Scope: {(input?.scopePurchased || []).filter((entry) => entry.purchased).map((entry) => entry.label).join(" | ") || "Nessuno"}
              </div>
              <div className="small text-muted">
                Moduli attivi: {(input?.activeModules || []).filter((entry) => entry.active).length}
              </div>
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
              <div className="fw-semibold mb-2">Lacune operative</div>
              <IssueList items={output?.gapAnalysis} emptyLabel="Nessuna lacuna operativa rilevata." />
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
              <div className="fw-semibold mb-2">Segnali per modulo</div>
              <ModuleSignalList signals={output?.moduleSignals} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <div className="fw-semibold mb-2">Cosa risulta presente</div>
              <div className="small text-muted">Brief: {output?.sourceSummary?.hasDiscovery ? "presente" : "da completare"}</div>
              <div className="small text-muted">Contenuti Web: {output?.sourceSummary?.hasWeb ? "presenti" : "da completare"}</div>
              <div className="small text-muted">Campagne ADS: {output?.sourceSummary?.hasAds ? "presenti" : "da completare"}</div>
              <div className="small text-muted">Report: {output?.sourceSummary?.hasReport ? "presente" : "da completare"}</div>
              <div className="small text-muted">Segnalazioni: {output?.sourceSummary?.hasAlerts ? "presenti" : "nessuna"}</div>
              <div className="small text-muted">Opportunita: {output?.sourceSummary?.hasOpportunities ? "presenti" : "nessuna"}</div>
              <div className="small text-muted">Task: {output?.sourceSummary?.hasTasks ? "presenti" : "nessuno"}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default DiagnosisPanel;
