// Giudizio sulla completezza degli input prima di impostare le campagne:
// quali requisiti minimi mancano, e con che tono comunicarlo.
//
// Due dei sei controlli non guardano un campo dedicato ma CERCANO parole
// chiave dentro il testo libero della Discovery (tracking/pixel/ga4 negli
// aspetti tecnici, geo/area/local nell'acquisizione): e' una euristica, non
// una verifica — il campo strutturato non esiste.
//
// La sorgente dei dati ha la precedenza sul conteggio: se l'output e' una
// bozza salvata solo in locale lo si dichiara comunque, anche a requisiti
// completi, perche' e' l'informazione piu' importante da dare.
export const buildAdsInputCompleteness = (input, dataMeta) => {
  const missing = [];

  if (!input?.discovery?.sections?.target?.trim()) {
    missing.push("target");
  }
  if (!input?.discovery?.sections?.offer?.trim()) {
    missing.push("offerta");
  }
  if (!input?.web?.ctaPrimary?.trim()) {
    missing.push("CTA");
  }
  if (!input?.web?.available) {
    missing.push("output web");
  }
  const technicalText = String(input?.discovery?.sections?.technicalAspects || "").toLowerCase();
  const marketingText = String(input?.discovery?.sections?.marketingAcquisition || "").toLowerCase();
  if (!technicalText.includes("tracking") && !technicalText.includes("pixel") && !technicalText.includes("ga4")) {
    missing.push("tracking");
  }
  if (!marketingText.includes("geo") && !marketingText.includes("area") && !marketingText.includes("local")) {
    missing.push("area geografica");
  }

  const source = typeof dataMeta?.source === "string" ? dataMeta.source : "mock";
  if (source === "local_fallback") {
    return {
      label: "bozza locale",
      tone: "warning",
      missing,
    };
  }

  if (missing.length === 0) {
    return {
      label: "completo",
      tone: "success",
      missing,
    };
  }

  return {
    label: "input parziali",
    tone: "warning",
    missing,
  };
};

export default buildAdsInputCompleteness;
