import React from "react";
import { useParams } from "react-router-dom";
import {
  getAgencyProjectBrain,
  getAgencyProjectDiagnosis,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import { sortAgencyOpportunities } from "../../../modules/agency-os/opportunities/opportunityPresentation";
import AgencyOpportunityList from "../opportunities/AgencyOpportunityList";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const AgencyProjectBrainPage = () => {
  const { projectId } = useParams();
  const [brain, setBrain] = React.useState(null);
  const [diagnosis, setDiagnosis] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const topOpportunities = React.useMemo(
    () => sortAgencyOpportunities(brain?.suggestedOpportunities || []).slice(0, 3),
    [brain],
  );

  React.useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    Promise.all([
      getAgencyProjectBrain(projectId),
      getAgencyProjectDiagnosis(projectId).catch(() => null),
    ])
      .then(([nextBrain, nextDiagnosis]) => {
        if (!isCancelled) {
          setBrain(nextBrain);
          setDiagnosis(nextDiagnosis);
          setDataMeta(readAgencyDataMeta(nextBrain));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  if (loading || !brain) {
    return (
      <AgencyProjectPageTemplate
        title="Brain Progetto AI"
        subtitle="Sintesi operativa del progetto, utile per capire priorita e segnali."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento dati brain...</p>
      </AgencyProjectPageTemplate>
    );
  }

  return (
    <AgencyProjectPageTemplate
      title="Brain Progetto AI"
      subtitle="Sintesi operativa del progetto, utile per capire priorita e segnali."
      dataMeta={dataMeta}
    >
      <div className="row g-3 mt-1">
        <div className="col-12">
          <div className="border rounded-3 p-3">
            <h6 className="mb-2">Sintesi contesto</h6>
            <p className="mb-0 text-muted">{brain.contextSummary}</p>
          </div>
        </div>

        <div className="col-12">
          <div className="border rounded-3 p-3">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <h6 className="mb-0">Segnali diagnosi</h6>
              <span className="badge text-bg-light border">
                Critici: {diagnosis?.output?.criticalFindings?.length || 0}
              </span>
            </div>
            <p className="mb-1 text-muted small">
              {diagnosis?.output?.diagnosisSummary || "Diagnosis non ancora disponibile."}
            </p>
            <div className="small text-muted">
              Priorita intervento: {diagnosis?.output?.interventionPriority || "Da valutare"} | Affidabilita: {diagnosis?.output?.confidenceLevel || "Da valutare"}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="border rounded-3 p-3 h-100">
            <h6 className="mb-2">Tipo progetto</h6>
            <div className="fw-semibold">{brain.projectType.label}</div>
            <div className="small text-muted">{brain.projectType.description}</div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="border rounded-3 p-3 h-100">
            <h6 className="mb-2">Scope acquistato</h6>
            <ul className="mb-0 small">
              {brain.scopePurchased.map((entry) => (
                <li key={entry.key}>
                  {entry.label}: {entry.purchased ? "SI" : "NO"}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="border rounded-3 p-3 h-100">
            <h6 className="mb-2">Moduli attivi</h6>
            <ul className="mb-0 small">
              {brain.activeModules.map((entry) => (
                <li key={entry.key}>
                  {entry.label}: attivo {entry.active ? "SI" : "NO"} - incluso {entry.included ? "SI" : "NO"} - suggerito {entry.suggested ? "SI" : "NO"}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="border rounded-3 p-3 h-100">
            <h6 className="mb-2">Alert Suggeriti</h6>
            <div className="d-flex flex-column gap-2">
              {brain.suggestedAlerts.map((entry) => (
                <div key={entry.id} className="border rounded-2 p-2">
                  <div className="fw-semibold small">{entry.title}</div>
                  <div className="small text-muted">
                    Priorita: {entry.severity || "Da valutare"} - Stato: {entry.status || "Da gestire"}
                    {import.meta.env.DEV && ` - Origine: ${entry.origin || "Non disponibile"}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="border rounded-3 p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h6 className="mb-0">Opportunita principali</h6>
              <span className="badge text-bg-light border">{brain.suggestedOpportunities.length}</span>
            </div>
            <AgencyOpportunityList
              opportunities={topOpportunities}
              emptyMessage="Nessuna opportunita disponibile."
              groupBy="none"
            />
          </div>
        </div>
      </div>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectBrainPage;
