import React from "react";
import { Alert, Badge, Button, Spinner, Table } from "react-bootstrap";
import { Link, useHistory } from "react-router-dom";
import { getAgencyProjects } from "../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../modules/agency-os/data/agencyDataSource";
import { visibleActiveModules } from "../../modules/agency-os/brain/moduleVisibility";
import AgencyPageShell from "./AgencyPageShell";
import AgencyDataSourceBadge from "./AgencyDataSourceBadge";
import { rowActivationProps } from "../../utils/rowActivation";
import { askAiRowProps } from "./chat/askAi";

const PROJECT_TYPE_LABEL_FALLBACK = "Non definito";

const formatDateTime = (value) => {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const toStatusLabel = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (normalized) {
    case "discovery":
      return "Discovery";
    case "planning":
      return "Planning";
    case "production":
      return "Production";
    case "review":
      return "Review";
    case "live":
      return "Live";
    case "paused":
      return "Paused";
    case "archived":
      return "Archived";
    default:
      return normalized || "n/a";
  }
};

const toPriorityLabel = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (normalized) {
    case "low":
      return "Bassa";
    case "medium":
      return "Media";
    case "high":
      return "Alta";
    case "urgent":
      return "Urgente";
    default:
      return normalized || "n/a";
  }
};

const AgencyProjectsListPage = () => {
  const history = useHistory();
  const [projects, setProjects] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadProjects = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getAgencyProjects()
      .then((entries) => {
        if (!cancelled) {
          setProjects(Array.isArray(entries) ? entries : []);
          setDataMeta(readAgencyDataMeta(entries));
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setProjects([]);
          setDataMeta(null);
          setError(nextError?.message || "Impossibile caricare i progetti.");
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

  React.useEffect(() => {
    const cleanup = loadProjects();
    return cleanup;
  }, [loadProjects]);

  return (
    <AgencyPageShell
      title="Progetti"
      subtitle="I progetti su cui stai lavorando con l'AI."
      breadcrumbs={[
        { label: "Produzione AI", to: "/agency/projects" },
        { label: "Progetti" },
      ]}
      dataMeta={dataMeta}
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="small text-muted">
          Progetti trovati: <strong>{projects.length}</strong>
        </div>
        <div className="d-flex gap-2">
          <Button type="button" variant="outline-secondary" size="sm" onClick={loadProjects} disabled={loading}>
            {loading ? "Aggiornamento..." : "Ricarica"}
          </Button>
          <Button as={Link} to="/agency/projects/new" size="sm">
            Nuovo progetto
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      {loading && (
        <div className="d-flex align-items-center gap-2 text-muted small">
          <Spinner animation="border" size="sm" />
          Caricamento progetti...
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="border rounded-3 p-4 text-center">
          <h6 className="mb-2">Nessun progetto disponibile</h6>
          <p className="text-muted mb-3">
            Crea il primo progetto per iniziare a produrre con l'AI.
          </p>
          <Button as={Link} to="/agency/projects/new">
            Crea progetto
          </Button>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="table-responsive">
          <Table hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Progetto</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Stato</th>
                <th>Priorita</th>
                <th>Moduli attivi</th>
                <th>Ultimo aggiornamento</th>
                <th>Source</th>
                <th className="text-end">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const activeModules = visibleActiveModules(project.activeModules);

                return (
                  <tr
                    key={project.id}
                    className="row-clickable"
                    aria-label={`Apri progetto ${project.name || ""}`}
                    {...askAiRowProps("project", project)}
                    {...rowActivationProps(() =>
                      history.push(`/agency/projects/${encodeURIComponent(project.id)}/overview`),
                      { role: "row" },
                    )}
                  >
                    <td>
                      <div className="fw-semibold">{project.name || "Progetto senza nome"}</div>
                      <div className="small text-muted">{project.goal || "Goal non ancora definito"}</div>
                    </td>
                    <td>{project.clientName || <span className="text-muted">Non assegnato</span>}</td>
                    <td>{project.projectType?.label || PROJECT_TYPE_LABEL_FALLBACK}</td>
                    <td>
                      <Badge bg="light" text="dark" className="border">
                        {toStatusLabel(project.statusAgency)}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg="light" text="dark" className="border">
                        {toPriorityLabel(project.priorityAgency)}
                      </Badge>
                    </td>
                    <td>
                      <div className="small fw-semibold">{activeModules.length}</div>
                      <div className="small text-muted">
                        {activeModules.slice(0, 3).map((entry) => entry.label).join(", ") || "Nessuno"}
                      </div>
                    </td>
                    <td className="small text-muted">{formatDateTime(project.updatedAt)}</td>
                    <td>
                      <AgencyDataSourceBadge meta={{ source: project.source || dataMeta?.source || "mock" }} />
                    </td>
                    <td className="text-end">
                      <Button
                        as={Link}
                        to={`/agency/projects/${encodeURIComponent(project.id)}/overview`}
                        size="sm"
                        variant="outline-primary"
                      >
                        Apri progetto
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </AgencyPageShell>
  );
};

export default AgencyProjectsListPage;
