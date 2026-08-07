// Le etichette leggibili di stato e priorita di un progetto di Produzione AI.
//
// Vivevano dentro AgencyProjectsListPage.jsx, quindi le altre pagine mostravano
// il valore grezzo del database ("Stato: discovery", "Priorita: high"). Stanno
// qui perche' le usa piu di una vista.
//
// Nota sullo stato: i sette valori restano in inglese di proposito. Oggi lo
// stato non e' modificabile da nessuna parte dell'interfaccia (nasce sempre
// "discovery" alla creazione del progetto), quindi tradurlo darebbe un nome
// italiano a un dato che non dice niente. La decisione sui nomi italiani si
// riapre solo quando quello stato diventera' modificabile - vedi roadmap.

const normalize = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const STATUS_LABELS = {
  discovery: "Discovery",
  planning: "Planning",
  production: "Production",
  review: "Review",
  live: "Live",
  paused: "Paused",
  archived: "Archived",
};

const PRIORITY_LABELS = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

// Lo stato di lavorazione di una pagina web o di una campagna. Nei menu a
// tendina si leggevano le chiavi grezze: "draft", "in_progress", "review".
const WORK_STATUS_LABELS = {
  draft: "Bozza",
  in_progress: "In corso",
  review: "In revisione",
  approved: "Approvato",
};

export const toStatusLabel = (value) => {
  const normalized = normalize(value);
  return STATUS_LABELS[normalized] || normalized || "n/a";
};

export const toPriorityLabel = (value) => {
  const normalized = normalize(value);
  return PRIORITY_LABELS[normalized] || normalized || "n/a";
};

export const toWorkStatusLabel = (value) => {
  const normalized = normalize(value);
  return WORK_STATUS_LABELS[normalized] || normalized || "n/a";
};
