// Validazione degli indirizzi della pagina Fonti e Materiali. Si accettano
// solo http e https: un indirizzo `mailto:` o `ftp:` si analizza senza errori
// ma non e' una fonte che il sistema sappia leggere.

export const splitCompetitorUrls = (value) => String(value || "")
  .split(/\r?\n|,/)
  .map((entry) => entry.trim())
  .filter(Boolean);

export const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
};

// Le etichette degli indirizzi da correggere prima di salvare. Le righe senza
// indirizzo NON contano come errore: sono righe ancora da compilare.
export const getInvalidUrlLabels = (urls, competitorUrls = []) => {
  const invalidProjectUrls = (urls || [])
    .filter((entry) => entry?.url && !isValidHttpUrl(entry.url))
    .map((entry) => entry.label || entry.url);
  const invalidCompetitorUrls = (competitorUrls || [])
    .filter((entry) => entry && !isValidHttpUrl(entry))
    .map((entry) => `Competitor: ${entry}`);

  return [...invalidProjectUrls, ...invalidCompetitorUrls];
};
