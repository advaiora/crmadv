const MODULES = [
  { key: "overview", label: "Overview", active: true },
  { key: "discovery", label: "Discovery", active: true },
  { key: "brain", label: "Brain", active: true },
  { key: "web", label: "Web", active: true },
  { key: "ads", label: "Ads", active: false },
  { key: "reports", label: "Report AI", active: true },
  { key: "opportunities", label: "Opportunita", active: true },
  { key: "memory", label: "Memory", active: true },
  { key: "assets", label: "Assets", active: false },
  { key: "tasks", label: "Tasks", active: true },
];

export const getMockActiveModules = (_projectId) => {
  return MODULES;
};
