import React from "react";
import { Button } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { getAgencyProjectAlerts } from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";
import AlertsOperativeList from "./alerts/AlertsOperativeList";
import DiagnosisPanel from "./alerts/DiagnosisPanel";
import { useProjectDiagnosis } from "./alerts/hooks/useProjectDiagnosis";

// Scheda "Da risolvere" (era "Alert"). Dal 5/8/2026 tiene insieme due cose che
// prima stavano su schede separate e si rispondevano a distanza:
//  - le segnalazioni operative (righe salvate a database): COSA non va;
//  - l'analisi AI dei punti deboli (era "Diagnosis"): PERCHE' e cosa farci.
const AgencyProjectAlertsPage = () => {
  const { projectId } = useParams();
  const [alerts, setAlerts] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const diagnosis = useProjectDiagnosis(projectId);

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

  return (
    <AgencyProjectPageTemplate
      title="Da risolvere"
      subtitle="Cosa sistemare prima di generare contenuti o consegnare al cliente, e l'analisi che spiega perche'."
      dataMeta={dataMeta}
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="small text-muted">
          {loading ? "Caricamento segnalazioni..." : `${alerts.length} segnalazioni sul progetto`}
        </div>
        <Button type="button" size="sm" variant="outline-primary" onClick={loadAlerts} disabled={loading}>
          Aggiorna
        </Button>
      </div>

      <AlertsOperativeList alerts={alerts} projectId={projectId} loading={loading} />

      <hr className="my-4" />

      <h6 className="mb-1">Analisi dei punti deboli</h6>
      <p className="small text-muted mb-3">
        Generata dai dati del progetto: spiega le cause dietro le segnalazioni e cosa conviene fare.
      </p>

      <DiagnosisPanel
        diagnosis={diagnosis.diagnosis}
        loading={diagnosis.loading}
        busy={diagnosis.busy}
        message={diagnosis.message}
        error={diagnosis.error}
        onReload={diagnosis.load}
        onSave={diagnosis.save}
        onRegenerate={diagnosis.regenerate}
      />
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectAlertsPage;
