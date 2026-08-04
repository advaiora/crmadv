// Costanti della pagina Fonti e Materiali: bozze vuote dei form, mappe fra
// stato ed etichetta/colore, opzioni dei menu, limiti di caricamento e passi
// del banner introduttivo.
// Estratte da AgencyProjectAssetsPage.jsx nel giro di spezzatura del 4/8/2026.

export const EMPTY_FILE = {
  name: "",
  type: "",
  notes: "",
};

export const EMPTY_COMPETITOR = {
  name: "",
  url: "",
  reason: "",
};

export const STATUS_VARIANT = {
  missing: "danger",
  partial: "warning",
  ready: "success",
};

export const FILE_STATUS_VARIANT = {
  uploaded: "success",
  parsed: "info",
  partial: "warning",
  failed: "danger",
  metadata_only: "secondary",
  queued: "secondary",
  uploading: "primary",
};

export const ALLOWED_EXTENSIONS_TEXT = "PDF, DOC, DOCX, TXT, CSV, XLSX, PNG, JPG, JPEG";
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const URL_TYPE_OPTIONS = [
  { value: "website", label: "Sito principale" },
  { value: "landing", label: "Landing" },
  { value: "service_page", label: "Pagina servizio" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "google_business", label: "Google Business Profile" },
  { value: "other", label: "Altro link utile" },
];

export const COMPETITOR_STATUS_VARIANT = {
  confirmed: "success",
  suggested: "warning",
  rejected: "secondary",
};

export const SOURCE_STATUS_LABEL = {
  missing: "Fonti da completare",
  partial: "Fonti parziali",
  ready: "Fonti pronte",
};

export const COMPETITOR_SOURCE_LABEL = {
  manual: "Manuale",
  auto_search: "Ricerca automatica",
  ai_search: "Ricerca AI",
  imported: "Importato",
  mock: "Bozza non reale",
};

export const COMPETITOR_STATUS_LABEL = {
  confirmed: "Confermato",
  suggested: "Suggerito",
  rejected: "Rifiutato",
};

export const ASSETS_WORKFLOW_STEPS = [
  { title: "Registra link", description: "Sito, landing, social e pagine servizio." },
  { title: "Carica materiali", description: "File letti quando possibile, oppure testo manuale collegato." },
  { title: "Conferma competitor", description: "Solo competitor manuali o trovati davvero online." },
];
