import React from "react";
import { useParams } from "react-router-dom";
import { getAgencyProjectOpportunities } from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import {
  sortAgencyOpportunities,
} from "../../../modules/agency-os/opportunities/opportunityPresentation";
import AgencyOpportunityList from "../opportunities/AgencyOpportunityList";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const AgencyProjectOpportunitiesPage = () => {
  const { projectId } = useParams();
  const [opportunities, setOpportunities] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const loadOpportunities = React.useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getAgencyProjectOpportunities(projectId);
      setOpportunities(Array.isArray(entries) ? entries : []);
      setDataMeta(readAgencyDataMeta(entries));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadOpportunities();
  }, [loadOpportunities]);

  const sortedOpportunities = React.useMemo(() => sortAgencyOpportunities(opportunities), [opportunities]);
  const summary = React.useMemo(() => {
    return {
      total: sortedOpportunities.length,
      highPriority: sortedOpportunities.filter((entry) => ["urgent", "high"].includes(entry?.priority)).length,
      critical: sortedOpportunities.filter((entry) => entry?.type === "critical").length,
      withRationale: sortedOpportunities.filter((entry) => typeof entry?.rationale === "string" && entry.rationale.trim()).length,
    };
  }, [sortedOpportunities]);

  return (
    <AgencyProjectPageTemplate
      title="Opportunita Progetto AI"
      subtitle="Opportunity Engine v2 con ordinamento per score, priorita e motivazioni leggibili."
      dataMeta={dataMeta}
    >
      <div className="row g-2 mb-3">
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Totali</div>
            <div className="fs-4 fw-semibold">{summary.total}</div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Alta priorita</div>
            <div className="fs-4 fw-semibold">{summary.highPriority}</div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Critical</div>
            <div className="fs-4 fw-semibold">{summary.critical}</div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Con rationale</div>
            <div className="fs-4 fw-semibold">{summary.withRationale}</div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-column gap-3">
        {loading && (
          <p className="mb-0 text-muted small">Caricamento opportunita...</p>
        )}

        {!loading && sortedOpportunities.length === 0 && (
          <p className="mb-0 text-muted small">Nessuna opportunita disponibile per questo progetto.</p>
        )}
        {!loading && sortedOpportunities.length > 0 && (
          <section className="border rounded-3 p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="mb-0">Categorie</h6>
                <div className="small text-muted">Raggruppamento per categoria, ordinato per score e priorita.</div>
              </div>
            </div>
            <AgencyOpportunityList opportunities={sortedOpportunities} groupBy="category" />
          </section>
        )}
      </div>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectOpportunitiesPage;
