// Il vocabolario italiano di stati, gravita e priorita dell'area Produzione AI.
//
// Perche' sta qui e non sparso: le stesse parole arrivano dal server come chiavi
// inglesi e finiscono in almeno quattro posti diversi (scheda Da risolvere,
// Report tecnico, elenco Report, Opportunita). Prima ogni posto aveva la sua
// idea: la scheda Da risolvere diceva "Da gestire / Alta", il Report tecnico
// diceva "Open / High" per lo stesso identico alert.
//
// ⚠️ I valori sono presi dagli enum di prisma/schema.prisma, non a memoria:
//   ProjectAlertSeverity   LOW MEDIUM HIGH
//   ProjectAlertStatus     OPEN MONITORING RESOLVED SUGGESTED
//   ProjectOpportunityStatus  OPEN PROPOSED WON LOST SUGGESTED
//   AgencyPriority         LOW MEDIUM HIGH URGENT
// piu' gli stati che il motore a regole scrive come stringa libera (todo,
// in_progress, review, done, blocked, needs_review) e quelli dei moduli e delle
// fonti (ready, partial, missing, active, included, inactive, none).
//
// Chi aggiunge un valore nuovo lato server lo aggiunga anche qui, o tornera' a
// leggersi in inglese in mezzo all'italiano.

const READABLE_LABELS = {
  // Stato di un alert, di un task, di un'opportunita
  open: "Da gestire",
  monitoring: "Da tenere d'occhio",
  resolved: "Risolto",
  suggested: "Proposto",
  proposed: "Proposto",
  won: "Vinta",
  lost: "Persa",
  todo: "Da fare",
  in_progress: "In corso",
  review: "In revisione",
  needs_review: "Da rivedere",
  done: "Completato",
  completed: "Completato",
  blocked: "Bloccato",
  on_hold: "In pausa",

  // Gravita e priorita. Sono femminili perche' i sostantivi a cui si
  // accompagnano lo sono: "Gravita: Alta", "Priorita: Alta", "Confidence: Alta".
  critical: "Critica",
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Bassa",

  // Tipi di opportunita
  improvement: "Miglioramento",
  commercial: "Commerciale",
  strategic: "Strategica",

  // Stato di un report, di un modulo, di una fonte
  draft: "Bozza",
  partial: "Parziale",
  ready: "Pronto",
  missing: "Assente",
  available: "Disponibile",
  none: "Nessuno",
  active: "Attivo",
  inactive: "Non attivo",
  included: "Incluso",
};

// L'impatto e' maschile ("Impatto: Alto"), quindi non puo' passare dal
// dizionario qui sopra senza sbagliare la concordanza.
const IMPACT_LABELS = {
  critical: "Critico",
  urgent: "Urgente",
  high: "Alto",
  medium: "Medio",
  low: "Basso",
};

const normalize = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

// Il ripiego per i valori sconosciuti resta quello di prima: si mette la
// maiuscola e si mostra. Meglio una parola inglese di un dato che sparisce.
const capitalizeWords = (value) =>
  value
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");

export const toReadableLabel = (value, fallback = "N/A") => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return READABLE_LABELS[normalize(value)] || capitalizeWords(value);
};

export const toImpactLabel = (value, fallback = "N/A") => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return IMPACT_LABELS[normalize(value)] || capitalizeWords(value);
};
