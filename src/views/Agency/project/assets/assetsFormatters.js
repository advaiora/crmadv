import { URL_TYPE_OPTIONS } from "./assetsPageConstants";

// Come si scrivono, in italiano leggibile, le cose tecniche della pagina Fonti
// e Materiali: dimensione di un file, esito del caricamento, esito della
// lettura del contenuto, tipo di link, errore di salvataggio.

export const formatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} byte`;
};

export const getFriendlyFileStatus = (status) => {
  if (status === "uploaded") {
    return "Caricato";
  }
  if (status === "queued") {
    return "In coda";
  }
  if (status === "uploading") {
    return "Caricamento";
  }
  if (status === "failed") {
    return "Errore";
  }
  if (status === "parsed") {
    return "Letto correttamente";
  }
  return "File registrato, contenuto non ancora analizzato";
};

// Attenzione al primo ramo: con `status === "parsed"` ma `parseStatus` diverso
// da "partial" si dichiara "Letto correttamente" comunque. E' il comportamento
// originale, riprodotto tale e quale.
export const getFriendlyParseStatus = (file) => {
  if (file.parseStatus === "parsed" || file.status === "parsed") {
    return file.parseStatus === "partial" ? "Letto parzialmente" : "Letto correttamente";
  }
  if (file.parseStatus === "partial") {
    return "Letto parzialmente";
  }
  if (file.parseStatus === "unsupported") {
    return "Formato non leggibile";
  }
  if (file.parseStatus === "failed") {
    return "Lettura non riuscita";
  }
  if (file.status === "metadata_only") {
    return "File registrato, contenuto non ancora analizzato";
  }
  return "Contenuto non letto";
};

export const createId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const deriveNameFromUrl = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return url;
  }
};

export const getUrlTypeLabel = (type) => URL_TYPE_OPTIONS.find((entry) => entry.value === type)?.label || "Link utile";

export const getFriendlySourcesError = (error, fallback) => {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Invalid Agency project sources payload")) {
    return "Salvataggio fonti non riuscito: alcuni dati non sono nel formato previsto. Controlla URL, file e competitor, poi riprova.";
  }
  return message || fallback;
};
