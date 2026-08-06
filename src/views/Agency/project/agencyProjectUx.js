export const EMPTY_FIELD_LABEL = "Da completare";

export const readableValue = (value, fallback = EMPTY_FIELD_LABEL) => {
  if (Array.isArray(value)) {
    const cleaned = value.map((entry) => String(entry || "").trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(" | ") : fallback;
  }

  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "n/a") {
    return fallback;
  }

  return text;
};

export const hasReadableValue = (value) => readableValue(value, "") !== "";

// Data e ora leggibili in italiano, con ripiego sul valore grezzo se non e' una data.
// ⚠️ Questa e' la copia BUONA: la stessa funzione esiste duplicata in nove file
// dell'area (censita in roadmap → Debito tecnico → "formatDateTime copiata identica
// in nove file"). Il codice nuovo usa questa; le nove vanno accorpate qui quando si
// aprira' quella voce — verificando prima che siano davvero identiche e non varianti.
// Il `fallback` esiste perche' non tutte le copie dicevano "Da completare": il report
// cliente diceva "Non disponibile", ed e' un testo che l'utente legge (6/8/2026).
export const formatDateTime = (value, fallback = EMPTY_FIELD_LABEL) => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("it-IT");
};

// L'AI non e' disponibile quando il server lo dichiara esplicitamente. Con
// `aiStatus` ancora `null` (stato non ancora arrivato, o chiamata fallita)
// NON si blocca niente: si prova, e semmai fallisce la chiamata vera.
export const isAiUnavailable = (aiStatus) => (
  aiStatus?.configured === false || aiStatus?.status === "not_configured"
);

export const getInputQualityTone = (missingCount) => {
  if (missingCount <= 0) {
    return { label: "Input completi", variant: "success" };
  }
  if (missingCount <= 2) {
    return { label: "Input parziali", variant: "warning" };
  }
  return { label: "Input da completare", variant: "danger" };
};
