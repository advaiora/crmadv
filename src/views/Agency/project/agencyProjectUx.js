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

export const getInputQualityTone = (missingCount) => {
  if (missingCount <= 0) {
    return { label: "Input completi", variant: "success" };
  }
  if (missingCount <= 2) {
    return { label: "Input parziali", variant: "warning" };
  }
  return { label: "Input da completare", variant: "danger" };
};
