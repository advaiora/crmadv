import React from "react";
import AgencyPageShell from "./AgencyPageShell";
import { getAgencyProjectAlerts } from "../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../modules/agency-os/data/agencyDataSource";

const AgencyAlertsPage = () => {
  const [alerts, setAlerts] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getAgencyProjectAlerts()
      .then((entries) => {
        if (!cancelled) {
          setAlerts(entries);
          setDataMeta(readAgencyDataMeta(entries));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AgencyPageShell
      title="Da risolvere"
      subtitle="Cosa sistemare nei progetti prima di generare contenuti o consegnare al cliente."
      dataMeta={dataMeta}
      breadcrumbs={[
        { label: "Produzione AI", to: "/agency/projects" },
        { label: "Da risolvere" },
      ]}
    >
      <div className="d-flex flex-column gap-2">
        {loading && (
          <p className="mb-0 text-muted small">Caricamento alert...</p>
        )}
        {alerts.map((entry) => (
          <div key={entry.id} className="border rounded-3 p-2">
            <div className="fw-semibold">{entry.title}</div>
            <div className="small text-muted">
              Priorita: {entry.severity || "Da valutare"} - Stato: {entry.status || "Da gestire"} - Progetto: {entry.projectId}
              {import.meta.env.DEV && ` - Origine: ${entry.origin || "Non disponibile"}`}
            </div>
          </div>
        ))}
      </div>
    </AgencyPageShell>
  );
};

export default AgencyAlertsPage;
