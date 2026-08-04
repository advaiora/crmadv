import { createId, deriveNameFromUrl } from "./assetsFormatters";

// I competitor: come si fondono quelli gia' presenti con quelli scritti a mano
// nella casella rapida, e come si racconta l'esito di una ricerca online.
//
// Il messaggio, il titolo e il colore dell'avviso di ricerca sono tre funzioni
// separate perche' non seguono lo stesso taglio: la ricerca riuscita davvero
// (`realSearch`) vince sul titolo e sul colore, ma non sul messaggio, dove
// contano prima gli stati di errore del servizio.

export const mergeCompetitorsFromUrls = (competitors, urls) => {
  const merged = [];
  const seen = new Set();

  for (const competitor of competitors || []) {
    if (!competitor?.url) {
      continue;
    }
    const key = competitor.url.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(competitor);
    }
  }

  for (const url of urls) {
    const key = url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        id: createId("cmp"),
        name: deriveNameFromUrl(url),
        url,
        source: "manual",
        status: "confirmed",
        reason: "Inserito da URL manuale.",
        addedAt: new Date().toISOString(),
      });
    }
  }

  return merged;
};

export const getFriendlyCompetitorSearchMessage = (result) => {
  const rawMessage = String(result?.message || "").trim();
  if (result?.providerStatus === "configured_error") {
    return rawMessage || "Ricerca online configurata, ma il servizio non ha risposto correttamente. Verifica chiave, modello e limiti API in Impostazioni Agency.";
  }
  if (result?.providerStatus === "configured_timeout") {
    return rawMessage || "La ricerca online ha richiesto troppo tempo. Riprova tra poco o scegli un modello piu veloce in Impostazioni Agency.";
  }
  if (result?.providerStatus === "configured" && !result?.realSearch) {
    return rawMessage || "Ricerca competitor configurata lato server.";
  }
  if (!result?.realSearch) {
    return "Ricerca automatica non configurata. Puoi inserire competitor manualmente oppure configurare la ricerca online in Impostazioni Agency.";
  }
  return rawMessage || "Ricerca competitor completata.";
};

export const getCompetitorSearchAlertTitle = (result) => {
  if (result?.realSearch) {
    return "Ricerca automatica completata.";
  }
  if (result?.providerStatus === "configured_error") {
    return "Ricerca non riuscita.";
  }
  if (result?.providerStatus === "configured_timeout") {
    return "Ricerca interrotta per timeout.";
  }
  if (result?.providerStatus === "configured") {
    return "Ricerca configurata.";
  }
  return "Ricerca automatica non configurata.";
};

export const getCompetitorSearchAlertVariant = (result) => {
  if (result?.realSearch) {
    return "info";
  }
  if (result?.providerStatus === "configured_error") {
    return "danger";
  }
  if (result?.providerStatus === "configured_timeout") {
    return "warning";
  }
  if (result?.providerStatus === "configured") {
    return "success";
  }
  return "warning";
};
