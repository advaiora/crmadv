import React from "react";
import { Link, useHistory } from "react-router-dom";
import { rowActivationProps } from "../../../utils/rowActivation";
import {
  formatOpportunityLabel,
  getOpportunityBadgeClass,
  groupAgencyOpportunities,
  sortAgencyOpportunities,
} from "../../../modules/agency-os/opportunities/opportunityPresentation";

const AgencyOpportunityList = ({
  opportunities,
  loading = false,
  emptyMessage = "Nessuna opportunita disponibile.",
  groupBy = "type",
  showProjectLink = false,
}) => {
  const history = useHistory();
  const grouped = React.useMemo(() => {
    if (groupBy === "none") {
      return [
        {
          key: "all",
          label: "Tutte",
          items: sortAgencyOpportunities(opportunities),
        },
      ];
    }

    return groupAgencyOpportunities(opportunities, groupBy);
  }, [groupBy, opportunities]);

  if (loading) {
    return <p className="mb-0 text-muted small">Caricamento opportunita...</p>;
  }

  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return <p className="mb-0 text-muted small">{emptyMessage}</p>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {grouped.map((group) => (
        <div key={group.key} className="d-flex flex-column gap-2">
          {groupBy !== "none" && (
            <div className="d-flex align-items-center justify-content-between">
              <div className="fw-semibold">{group.label}</div>
              <span className="badge text-bg-light border">{group.items.length}</span>
            </div>
          )}

          {group.items.map((entry) => {
            const projectHref = showProjectLink && entry.projectId
              ? `/agency/projects/${encodeURIComponent(entry.projectId)}/opportunities`
              : null;
            return (
            <div
              key={entry.id}
              className={`border rounded-3 p-3${projectHref ? " row-clickable row-clickable-hover" : ""}`}
              aria-label={projectHref ? `Vai al progetto di ${entry.title}` : undefined}
              {...(projectHref ? rowActivationProps(() => history.push(projectHref)) : {})}
            >
              <div className="d-flex flex-column gap-2">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                  <div>
                    <div className="fw-semibold">{entry.title}</div>
                    <div className="small text-muted">
                      Stage: {entry.stage} | Stato: {formatOpportunityLabel(entry.status)}
                      {typeof entry.estimatedValue === "number" ? ` | Valore stimato: EUR ${entry.estimatedValue}` : ""}
                      {showProjectLink && entry.projectId ? ` | Progetto: ${entry.projectId}` : ""}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-1">
                    {entry.priority && (
                      <span className={`badge ${getOpportunityBadgeClass("priority", entry.priority)}`}>
                        P {formatOpportunityLabel(entry.priority)}
                      </span>
                    )}
                    {entry.type && (
                      <span className={`badge ${getOpportunityBadgeClass("type", entry.type)}`}>
                        {formatOpportunityLabel(entry.type)}
                      </span>
                    )}
                    {entry.category && (
                      <span className="badge text-bg-light border">
                        {formatOpportunityLabel(entry.category)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="small text-muted d-flex flex-wrap gap-3">
                  <span>Priorita stimata: {typeof entry.score === "number" ? entry.score : "Da valutare"}</span>
                  <span>Impatto: {formatOpportunityLabel(entry.impactLevel)}</span>
                  <span>Origine: {formatOpportunityLabel(entry.sourceModule || entry.origin)}</span>
                  {entry.suggestedService && <span>Servizio suggerito: {formatOpportunityLabel(entry.suggestedService)}</span>}
                </div>

                {entry.rationale && (
                  <p className="mb-0 small text-muted">{entry.rationale}</p>
                )}

                <div className="small text-muted d-flex flex-wrap gap-3">
                  {entry.sourceSignalKey && <span>Segnale: {entry.sourceSignalKey}</span>}
                  {import.meta.env.DEV && entry.dedupKey && <span>Chiave deduplica: {entry.dedupKey}</span>}
                  {entry.lastEvaluatedAt && (
                    <span>Ultima valutazione: {new Date(entry.lastEvaluatedAt).toLocaleString("it-IT")}</span>
                  )}
                  {showProjectLink && entry.projectId && (
                    <Link to={`/agency/projects/${encodeURIComponent(entry.projectId)}/opportunities`}>
                      Vai al progetto
                    </Link>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default AgencyOpportunityList;
