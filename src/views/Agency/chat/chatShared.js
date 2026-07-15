// Utility condivise della chat (Fase 1/2), separate dal componente ChatBubble per
// non rompere il Fast Refresh (un file .jsx dovrebbe esportare solo componenti).
// Usate sia dalla scheda Chat del progetto sia dal popup di Chat globale.

export const formatTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("it-IT");
};

// Data compatta per gli ELENCHI (sessioni AI e conversazioni con le persone):
// l'ora se e' di oggi, altrimenti il giorno. Gli elenchi sono densi (design §3.2):
// la data serve a distinguere le voci, non a datarle al secondo. Condivisa dai due
// mondi di proposito — stanno sotto lo stesso selettore e si sfogliano uguale.
export const formatListDate = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  return sameDay
    ? date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

// Etichetta autore da mostrare sopra la bolla: nome, email o fallback.
export const authorLabel = (message) => {
  if (message.role === "assistant") {
    return "Assistente AI";
  }
  const author = message.author;
  return author?.name || author?.email || "Utente";
};

// Rileva se l'AI e' interpellata via menzione @AI (stessa regola del server).
export const mentionsAi = (text) => /(^|\s)@ai\b/i.test(text || "");

// --- Allegati (Fase 3a) ---

const ENTITY_LABELS = {
  project: "Progetto",
  client: "Cliente",
  source: "Fonte",
  quote: "Preventivo",
};

// Chiave dell'icona: i documenti hanno la loro, gli elementi CRM quella del tipo.
export const attachmentIconKey = (attachment) =>
  attachment?.kind === "entity" ? attachment.entityType || "project" : "file";

// Etichetta del tipo, per tooltip e lettori di schermo.
export const attachmentTypeLabel = (attachment) =>
  attachment?.kind === "entity" ? ENTITY_LABELS[attachment.entityType] || "Elemento" : "Documento";

// Peso del file, solo per i documenti (gli elementi CRM non ne hanno uno).
export const formatAttachmentSize = (attachment) => {
  const bytes = attachment?.fileSize;
  if (typeof bytes !== "number" || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Formati di documento che il server sa leggere (stessa lista dell'estrattore
// delle Fonti). Usata per l'attributo accept del selettore file.
export const ATTACHMENT_FILE_ACCEPT = ".txt,.csv,.md,.docx,.pdf";
