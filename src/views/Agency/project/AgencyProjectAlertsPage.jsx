import React from "react";
import { Badge, Button } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { getAgencyProjectAlerts } from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const SEVERITY_LABEL = {
  critical: "Critico",
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  improvement: "Miglioramento",
  strategic: "Strategico",
};

const SEVERITY_VARIANT = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "secondary",
  improvement: "primary",
  strategic: "success",
};

const STATUS_LABEL = {
  open: "Da gestire",
  todo: "Da fare",
  in_progress: "In corso",
  review: "In revisione",
  resolved: "Risolto",
  done: "Completato",
};

const AgencyProjectAlertsPage = () => {
  const { projectId } = useParams();
  const [alerts, setAlerts] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const loadAlerts = React.useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getAgencyProjectAlerts(projectId);
      setAlerts(Array.isArray(entries) ? entries : []);
      setDataMeta(readAgencyDataMeta(entries));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const criticalAlerts = alerts.filter((entry) => entry.severity === "critical" || entry.priority === "critical");
  const otherAlerts = alerts.filter((entry) => !criticalAlerts.includes(entry));

  return (
    <AgencyProjectPageTemplate
      title="Alert progetto"
      subtitle="Segnali operativi da risolvere prima di generare output o consegnare al cliente."
      dataMeta={dataMeta}
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="small text-muted">
          {loading ? "Caricamento alert..." : `${alerts.length} alert progetto`}
        </div>
        <Button type="button" size="sm" variant="outline-primary" onClick={loadAlerts} disabled={loading}>
          Aggiorna alert
        </Button>
      </div>

      {!loading && alerts.length === 0 && (
        <div className="border rounded-3 p-3 agency-tile">
          <h6 className="mb-1">Nessun alert aperto</h6>
          <p className="mb-2 text-muted small">
            Quando mancano target, offerta, CTA, tracking o materiali, gli alert appariranno qui.
          </p>
          <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/discovery`} size="sm" variant="primary">
            Controlla Discovery
          </Button>
        </div>
      )}

      {criticalAlerts.length > 0 && (
        <section className="mb-3">
          <h6 className="mb-2">Da risolvere prima</h6>
          <div className="d-flex flex-column gap-2">
            {criticalAlerts.map((alert) => (
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

      {otherAlerts.length > 0 && (
        <section>
          <h6 className="mb-2">Altri alert</h6>
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
                {otherAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <div className="fw-semibold">{alert.title}</div>
                      {alert.reason && <div className="small text-muted">{alert.reason}</div>}
                    </td>
                    <td>{SEVERITY_LABEL[alert.severity] || "Media"}</td>
                    <td>{STATUS_LABEL[alert.status] || "Da gestire"}</td>
                    <td>
                      <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/discovery`} size="sm" variant="outline-secondary">
                        Apri Discovery
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectAlertsPage;
