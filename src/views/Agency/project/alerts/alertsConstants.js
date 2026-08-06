// Etichette e colori degli alert operativi, estratti da AgencyProjectAlertsPage
// il 5/8/2026 quando la scheda "Alert" e' diventata "Da risolvere" e ha assorbito
// i contenuti della vecchia scheda Diagnosis.

export const SEVERITY_LABEL = {
  critical: "Critico",
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  improvement: "Miglioramento",
  strategic: "Strategico",
};

export const SEVERITY_VARIANT = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "secondary",
  improvement: "primary",
  strategic: "success",
};

export const STATUS_LABEL = {
  open: "Da gestire",
  todo: "Da fare",
  in_progress: "In corso",
  review: "In revisione",
  resolved: "Risolto",
  done: "Completato",
};

// Un alert e' "da risolvere prima" se e' critico per gravita' oppure per priorita':
// il dato arriva da due campi diversi a seconda di come e' stato generato.
export const isBlockingAlert = (alert) =>
  alert?.severity === "critical" || alert?.priority === "critical";
