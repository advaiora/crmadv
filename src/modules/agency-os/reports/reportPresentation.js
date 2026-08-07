const REPORT_STATUS_ORDER = {
  draft: 1,
  partial: 2,
  ready: 3,
};

const PROJECT_STATUS_ORDER = {
  discovery: 1,
  planning: 2,
  in_progress: 3,
  on_hold: 4,
  completed: 5,
};

// Le parole che arrivano dal server sono chiavi inglesi. Qui si traducono.
// Prima questa funzione si limitava a mettere la maiuscola, quindi a schermo
// comparivano "Draft", "Ready", "Partial" in una pagina per il resto italiana.
//
// Gli stati del progetto (discovery, planning, ...) NON sono in questo elenco
// di proposito: restano in inglese finche' quello stato non diventa
// modificabile dall'utente - vedi la decisione in roadmap.
const READABLE_LABELS = {
  draft: "Bozza",
  partial: "Parziale",
  ready: "Pronto",
  missing: "Assente",
  available: "Disponibile",
  none: "Nessuno",
};

export const formatReportLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "N/A";
  }

  const normalized = value.trim().toLowerCase();
  if (READABLE_LABELS[normalized]) {
    return READABLE_LABELS[normalized];
  }

  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
};

export const getReportBadgeClass = (kind, value) => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";

  if (kind === "reportStatus") {
    if (normalized === "ready") {
      return "text-bg-success";
    }
    if (normalized === "partial") {
      return "text-bg-warning";
    }
    return "text-bg-light border";
  }

  if (kind === "projectStatus") {
    if (normalized === "completed") {
      return "text-bg-success";
    }
    if (normalized === "in_progress") {
      return "text-bg-primary";
    }
    if (normalized === "on_hold") {
      return "text-bg-warning";
    }
    return "text-bg-light border";
  }

  if (kind === "priority") {
    if (["urgent", "high"].includes(normalized)) {
      return "text-bg-danger";
    }
    if (normalized === "medium") {
      return "text-bg-warning";
    }
  }

  return "text-bg-light border";
};

export const collectReportFilterValues = (items, key) => {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((entry) => entry?.[key])
        .filter((entry) => typeof entry === "string" && entry.trim()),
    ),
  ).sort((left, right) => left.localeCompare(right));
};

export const filterAgencyReports = (items, filters = {}) => {
  return (Array.isArray(items) ? items : []).filter((entry) => {
    if (filters.projectStatus && entry?.projectStatus !== filters.projectStatus) {
      return false;
    }
    if (filters.projectTypeLabel && entry?.projectTypeLabel !== filters.projectTypeLabel) {
      return false;
    }
    if (filters.updatedBucket === "updated" && !entry?.updatedAt) {
      return false;
    }
    if (filters.updatedBucket === "stale" && entry?.updatedAt) {
      return false;
    }
    return true;
  });
};

export const sortAgencyReports = (items) => {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const reportDelta = (REPORT_STATUS_ORDER[right?.reportStatus] || 0) - (REPORT_STATUS_ORDER[left?.reportStatus] || 0);
    if (reportDelta !== 0) {
      return reportDelta;
    }

    const projectDelta = (PROJECT_STATUS_ORDER[right?.projectStatus] || 0) - (PROJECT_STATUS_ORDER[left?.projectStatus] || 0);
    if (projectDelta !== 0) {
      return projectDelta;
    }

    const updatedRight = right?.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    const updatedLeft = left?.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    if (updatedRight !== updatedLeft) {
      return updatedRight - updatedLeft;
    }

    return String(left?.projectName || "").localeCompare(String(right?.projectName || ""));
  });
};
