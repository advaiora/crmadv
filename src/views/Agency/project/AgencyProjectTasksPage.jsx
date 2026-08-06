import React from "react";
import { Button, Form } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { getAgencyProjectTasks } from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const TEAM_ROLE_OPTIONS = [
  { value: "all", label: "Tutti i reparti" },
  { value: "web", label: "Web" },
  { value: "marketing_strategy_pm", label: "Marketing Strategy PM" },
  { value: "ads_specialist", label: "Ads Specialist" },
  { value: "graphic_adv_social", label: "Graphic ADV Social" },
  { value: "graphic_offline", label: "Graphic Offline" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Tutti gli stati" },
  { value: "todo", label: "Da fare" },
  { value: "in_progress", label: "In corso" },
  { value: "blocked", label: "Bloccato" },
  { value: "review", label: "In revisione" },
  { value: "done", label: "Completato" },
];

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((entry) => [entry.value, entry.label]));

const AgencyProjectTasksPage = () => {
  const { projectId } = useParams();
  const [tasks, setTasks] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [teamRoleFilter, setTeamRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getAgencyProjectTasks(projectId);
      setTasks(entries);
      setDataMeta(readAgencyDataMeta(entries));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      const teamRoleMatch = teamRoleFilter === "all" || task.teamRole === teamRoleFilter;
      const statusMatch = statusFilter === "all" || task.status === statusFilter;
      return teamRoleMatch && statusMatch;
    });
  }, [tasks, teamRoleFilter, statusFilter]);

  return (
    <AgencyProjectPageTemplate
      title="Task"
      subtitle="Le cose da fare sul progetto, filtrabili per reparto e stato."
      dataMeta={dataMeta}
    >
      <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div>
          <Form.Label className="small mb-1">Reparto</Form.Label>
          <Form.Select
            size="sm"
            value={teamRoleFilter}
            onChange={(event) => setTeamRoleFilter(event.target.value)}
          >
            {TEAM_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>
        </div>

        <div>
          <Form.Label className="small mb-1">Stato</Form.Label>
          <Form.Select
            size="sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline-primary"
          onClick={loadTasks}
          disabled={loading}
        >
          {loading ? "Aggiornamento..." : "Rigenera task base"}
        </Button>
      </div>

      <div className="d-flex flex-column gap-2">
        {loading && (
          <p className="mb-0 text-muted small">Caricamento task...</p>
        )}
        {!loading && filteredTasks.length === 0 && (
          <p className="mb-0 text-muted small">Nessun task disponibile con i filtri attuali.</p>
        )}
        {filteredTasks.map((task) => (
          <div key={task.id} className="border rounded-3 p-3">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div className="fw-semibold">{task.title}</div>
                {task.description && (
                  <div className="small text-muted mt-1">{task.description}</div>
                )}
              </div>
              <span className="badge text-bg-light border">{task.priority}</span>
            </div>
            <div className="small text-muted mt-2">
              Reparto: {task.teamRole} - Stato: {STATUS_LABEL[task.status] || task.status || "Da gestire"}
              {import.meta.env.DEV && ` - Fonte: ${task.sourceType || "non indicata"} - Origine: ${task.origin || "non indicata"}`}
            </div>
          </div>
        ))}
      </div>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectTasksPage;
