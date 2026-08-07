const MODULES = [
  { key: "overview", label: "Panoramica", active: true },
  { key: "discovery", label: "Brief", active: true },
  { key: "brain", label: "Agency Brain", active: true },
  { key: "web", label: "Contenuti Web", active: true },
  { key: "ads", label: "Campagne ADS", active: false },
  { key: "reports", label: "Report", active: true },
  { key: "opportunities", label: "Opportunita", active: true },
  { key: "memory", label: "Memoria", active: true },
  { key: "assets", label: "Fonti", active: false },
  { key: "tasks", label: "Task", active: true },
];

export const getMockActiveModules = (_projectId) => {
  return MODULES;
};
