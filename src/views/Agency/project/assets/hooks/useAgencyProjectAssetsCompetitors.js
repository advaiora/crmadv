import React from "react";
import { searchAgencyProjectCompetitors } from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { createId, deriveNameFromUrl } from "../assetsFormatters";
import {
  getFriendlyCompetitorSearchMessage,
  mergeCompetitorsFromUrls,
} from "../assetsCompetitorHelpers";
import { EMPTY_COMPETITOR } from "../assetsPageConstants";

// I competitor: quelli scritti a mano, quelli proposti dalla ricerca AI, e la
// ricerca stessa.
//
// Nota volutamente NON uniformata: aggiungendone uno a mano la fusione riceve
// una lista vuota di indirizzi rapidi, mentre confermando un suggerimento AI
// riceve `competitorUrls`. Sono due comportamenti diversi gia' nell'originale.
//
// Questo hook non restituisce nessuna chiave `competitors`: l'elenco vero e'
// un derivato di `sources`, e due nomi uguali per due cose diverse sarebbero
// un errore che non si vede.
export const useAgencyProjectAssetsCompetitors = ({
  projectId,
  setSources,
  setError,
  setMessage,
}) => {
  const [competitorDraft, setCompetitorDraft] = React.useState(EMPTY_COMPETITOR);
  const [competitorSearch, setCompetitorSearch] = React.useState(null);
  const [searching, setSearching] = React.useState(false);

  const addManualCompetitor = () => {
    const url = competitorDraft.url.trim();
    if (!url) {
      setError("Inserisci almeno l'URL competitor.");
      return;
    }

    setError("");
    setSources((current) => ({
      ...(current || {}),
      competitors: mergeCompetitorsFromUrls([
        ...((current?.competitors || [])),
        {
          id: createId("cmp"),
          name: competitorDraft.name.trim() || deriveNameFromUrl(url),
          url,
          source: "manual",
          status: "confirmed",
          reason: competitorDraft.reason.trim() || "Inserito manualmente.",
          addedAt: new Date().toISOString(),
        },
      ], []),
    }));
    setCompetitorDraft(EMPTY_COMPETITOR);
  };

  const addSuggestedCompetitor = (suggestion) => {
    const url = String(suggestion?.url || "").trim();
    if (!url) {
      return;
    }

    setError("");
    setSources((current) => ({
      ...(current || {}),
      competitors: mergeCompetitorsFromUrls([
        ...((current?.competitors || [])),
        {
          id: suggestion.id || createId("cmp_ai"),
          name: String(suggestion.name || "").trim() || deriveNameFromUrl(url),
          url,
          source: suggestion.source || "ai_search",
          status: "confirmed",
          reason: String(suggestion.reason || "").trim() || "Confermato da suggerimento AI.",
          addedAt: suggestion.addedAt || new Date().toISOString(),
        },
      ], current?.competitorUrls || []),
    }));
    setMessage("Competitor aggiunto alla lista. Salva le fonti per renderlo permanente.");
  };

  const updateCompetitorStatus = (competitorId, status) => {
    setSources((current) => ({
      ...(current || {}),
      competitors: (current?.competitors || []).map((entry) => (
        entry.id === competitorId ? { ...entry, status } : entry
      )),
    }));
  };

  const removeCompetitor = (competitorId) => {
    setSources((current) => ({
      ...(current || {}),
      competitors: (current?.competitors || []).filter((entry) => entry.id !== competitorId),
    }));
  };

  const runCompetitorSearch = async () => {
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const result = await searchAgencyProjectCompetitors(projectId);
      setCompetitorSearch(result);
      setMessage(getFriendlyCompetitorSearchMessage(result));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Ricerca competitor non riuscita.");
    } finally {
      setSearching(false);
    }
  };

  return {
    competitorDraft,
    setCompetitorDraft,
    competitorSearch,
    searching,
    addManualCompetitor,
    addSuggestedCompetitor,
    updateCompetitorStatus,
    removeCompetitor,
    runCompetitorSearch,
  };
};

export default useAgencyProjectAssetsCompetitors;
