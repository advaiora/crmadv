import React from "react";
import { Form } from "react-bootstrap";
import AgencyPageShell from "./AgencyPageShell";
import { getAgencyProjectOpportunities } from "../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../modules/agency-os/data/agencyDataSource";
import {
  collectOpportunityFilterValues,
  filterAgencyOpportunities,
  formatOpportunityLabel,
} from "../../modules/agency-os/opportunities/opportunityPresentation";
import AgencyOpportunityList from "./opportunities/AgencyOpportunityList";

const AgencyOpportunitiesPage = () => {
  const [opportunities, setOpportunities] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [projectFilter, setProjectFilter] = React.useState("all");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getAgencyProjectOpportunities()
      .then((entries) => {
        if (!cancelled) {
          setOpportunities(Array.isArray(entries) ? entries : []);
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

  const projectOptions = React.useMemo(() => {
    return collectOpportunityFilterValues(opportunities, "projectId");
  }, [opportunities]);

  const categoryOptions = React.useMemo(() => {
    return collectOpportunityFilterValues(opportunities, "category");
  }, [opportunities]);

  const filteredOpportunities = React.useMemo(() => {
    return filterAgencyOpportunities(opportunities, {
      type: typeFilter === "all" ? null : typeFilter,
      priority: priorityFilter === "all" ? null : priorityFilter,
      category: categoryFilter === "all" ? null : categoryFilter,
      projectId: projectFilter === "all" ? null : projectFilter,
    });
  }, [opportunities, typeFilter, priorityFilter, categoryFilter, projectFilter]);

  const summary = React.useMemo(() => {
    return {
      total: filteredOpportunities.length,
      highPriority: filteredOpportunities.filter((entry) => ["urgent", "high"].includes(entry?.priority)).length,
      critical: filteredOpportunities.filter((entry) => entry?.type === "critical").length,
      withRationale: filteredOpportunities.filter((entry) => typeof entry?.rationale === "string" && entry.rationale.trim()).length,
    };
  }, [filteredOpportunities]);

  return (
    <AgencyPageShell
      title="Opportunita"
      subtitle="Vista globale Opportunity Engine v2 con filtri minimi per priorita, tipo, categoria e progetto."
      dataMeta={dataMeta}
      breadcrumbs={[
        { label: "Produzione AI", to: "/agency/projects" },
        { label: "Opportunita" },
      ]}
    >
      <div className="row g-2 mb-3">
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Visibili</div>
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

      <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div>
          <Form.Label className="small mb-1">Tipo</Form.Label>
          <Form.Select size="sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Tutti i tipi</option>
            <option value="critical">Critical</option>
            <option value="improvement">Improvement</option>
            <option value="commercial">Commercial</option>
            <option value="strategic">Strategic</option>
          </Form.Select>
        </div>

        <div>
          <Form.Label className="small mb-1">Priorita</Form.Label>
          <Form.Select size="sm" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">Tutte le priorita</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Bassa</option>
          </Form.Select>
        </div>

        <div>
          <Form.Label className="small mb-1">Categoria</Form.Label>
          <Form.Select size="sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Tutte le categorie</option>
            {categoryOptions.map((entry) => (
              <option key={entry} value={entry}>
                {formatOpportunityLabel(entry)}
              </option>
            ))}
          </Form.Select>
        </div>

        <div>
          <Form.Label className="small mb-1">Progetto</Form.Label>
          <Form.Select size="sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">Tutti i progetti</option>
            {projectOptions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </Form.Select>
        </div>
      </div>

      <div className="d-flex flex-column gap-3">
        {loading && (
          <p className="mb-0 text-muted small">Caricamento opportunita...</p>
        )}
        {!loading && filteredOpportunities.length === 0 && (
          <p className="mb-0 text-muted small">Nessuna opportunita corrisponde ai filtri attuali.</p>
        )}
        {!loading && filteredOpportunities.length > 0 && (
          <AgencyOpportunityList
            opportunities={filteredOpportunities}
            groupBy="none"
            showProjectLink
          />
        )}
      </div>
    </AgencyPageShell>
  );
};

export default AgencyOpportunitiesPage;
