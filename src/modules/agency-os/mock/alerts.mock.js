const ALERTS = [
  {
    id: "alr-001",
    title: "Budget Ads vicino al limite",
    severity: "high",
    status: "open",
    projectId: "PRJ-001",
  },
  {
    id: "alr-002",
    title: "Landing con calo conversione",
    severity: "medium",
    status: "open",
    projectId: "PRJ-002",
  },
  {
    id: "alr-003",
    title: "Tracking evento checkout assente",
    severity: "high",
    status: "open",
    projectId: "PRJ-001",
  },
  {
    id: "alr-004",
    title: "Report settimanale non validato",
    severity: "low",
    status: "monitoring",
    projectId: "PRJ-003",
  },
];

export const listMockAgencyAlerts = (projectId) => {
  if (!projectId) {
    return ALERTS;
  }

  return ALERTS.filter((entry) => entry.projectId === projectId);
};
