import React from "react";
import { Badge, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { SEVERITY_LABEL, SEVERITY_VARIANT, STATUS_LABEL, isBlockingAlert } from "./alertsConstants";

// Gli alert operativi veri e propri: righe salvate a database (tabella ProjectAlert),
// non generate dall'AI. Sono la meta' "cosa c'e' da sistemare" della scheda
// "Da risolvere"; l'altra meta' e' l'analisi AI (DiagnosisPanel).
const AlertsOperativeList = ({ alerts, projectId, loading }) => {
  const briefPath = `/agency/projects/${encodeURIComponent(projectId)}/discovery`;
  const blocking = alerts.filter(isBlockingAlert);
  const others = alerts.filter((entry) => !isBlockingAlert(entry));

  if (!loading && alerts.length === 0) {
    return (
      <div className="border rounded-3 p-3 agency-tile">
        <h6 className="mb-1">Niente da risolvere</h6>
        <p className="mb-2 text-muted small">
          Quando mancano target, offerta, CTA, tracking o materiali, le segnalazioni appariranno qui.
        </p>
        <Button as={Link} to={briefPath} size="sm" variant="primary">
          Controlla il Brief
        </Button>
      </div>
    );
  }

  return (
    <>
      {blocking.length > 0 && (
        <section className="mb-3">
          <h6 className="mb-2">Da risolvere prima di generare o consegnare</h6>
          <div className="d-flex flex-column gap-2">
            {blocking.map((alert) => (
              <div key={alert.id} className="border rounded-3 p-3 agency-tile">
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <div className="fw-semibold">{alert.title}</div>
                    {alert.reason && <div className="small text-muted mt-1">{alert.reason}</div>}
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Badge bg={SEVERITY_VARIANT[alert.severity] || "secondary"}>
                      {SEVERITY_LABEL[alert.severity] || "Priorita"}
                    </Badge>
                    <Badge bg="light" text="dark" className="border">
                      {STATUS_LABEL[alert.status] || "Da gestire"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h6 className="mb-2">Le altre segnalazioni</h6>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Titolo</th>
                  <th>Priorita</th>
                  <th>Stato</th>
                  <th>Prossima azione</th>
                </tr>
              </thead>
              <tbody>
                {others.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <div className="fw-semibold">{alert.title}</div>
                      {alert.reason && <div className="small text-muted">{alert.reason}</div>}
                    </td>
                    <td>{SEVERITY_LABEL[alert.severity] || "Media"}</td>
                    <td>{STATUS_LABEL[alert.status] || "Da gestire"}</td>
                    <td>
                      <Button as={Link} to={briefPath} size="sm" variant="outline-secondary">
                        Apri il Brief
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
};

export default AlertsOperativeList;
