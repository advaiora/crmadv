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
