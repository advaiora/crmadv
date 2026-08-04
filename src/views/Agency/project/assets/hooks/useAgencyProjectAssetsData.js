import React from "react";
import {
  getAgencyProjectSources,
  saveAgencyProjectSources,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";
import { getFriendlySourcesError, getUrlTypeLabel } from "../assetsFormatters";
import { getInvalidUrlLabels, splitCompetitorUrls } from "../assetsUrlValidation";
import { mergeCompetitorsFromUrls } from "../assetsCompetitorHelpers";

// Dati e persistenza della pagina Fonti e Materiali.
//
// Qui vive anche `competitorUrlsText`, la casella di testo libero dei
// competitor, che a prima vista sembrerebbe roba dell'hook competitor: il
// server la RISINCRONIZZA insieme a `sources` e `dataMeta` in tre punti
// diversi (caricamento, salvataggio, rimozione di un file caricato). Tenerla
// altrove costringerebbe a far girare quel terzetto fra due hook.
//
// Anche `saving` sta qui ed e' uno solo: lo condividono il salvataggio e la
// rimozione di un file gia' caricato, che e' anch'essa un'operazione col
// server. Duplicarlo spegnerebbe lo spinner di uno dei due.
export const useAgencyProjectAssetsData = (projectId) => {
  const [sources, setSources] = React.useState(null);
  const [competitorUrlsText, setCompetitorUrlsText] = React.useState("");
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const loadSources = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextSources = await getAgencyProjectSources(projectId);
      setSources(nextSources);
      setCompetitorUrlsText((nextSources.competitorUrls || []).join("\n"));
      setDataMeta(readAgencyDataMeta(nextSources));
    } catch (loadError) {
      setError(getFriendlySourcesError(loadError, "Impossibile caricare le fonti progetto."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const updateSourceField = (key, value) => {
    setSources((current) => ({
      ...(current || {}),
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const competitorUrls = splitCompetitorUrls(competitorUrlsText);
      const urls = (sources?.urls || [])
        .map((entry) => ({
          ...entry,
          label: String(entry?.label || "").trim() || getUrlTypeLabel(entry?.type),
          url: String(entry?.url || "").trim(),
          notes: String(entry?.notes || "").trim(),
          status: entry?.status === "ignored" ? "ignored" : "active",
        }))
        .filter((entry) => entry.url);
      const primaryWebsiteUrl = String(sources?.primaryWebsiteUrl || sources?.websiteUrl || "").trim();
      const resolvedPrimaryUrl = primaryWebsiteUrl && urls.some((entry) => entry.url === primaryWebsiteUrl)
        ? primaryWebsiteUrl
        : urls.find((entry) => entry.type === "website" && entry.status === "active")?.url || urls.find((entry) => entry.status === "active")?.url || "";
      const invalidUrlLabels = getInvalidUrlLabels(urls, competitorUrls);
      if (invalidUrlLabels.length > 0) {
        setError(`Controlla questi URL prima di salvare: ${invalidUrlLabels.slice(0, 4).join(", ")}. Usa link completi, ad esempio https://cliente.it.`);
        return;
      }
      const saved = await saveAgencyProjectSources(projectId, {
        ...sources,
        urls,
        primaryWebsiteUrl: resolvedPrimaryUrl,
        websiteUrl: resolvedPrimaryUrl,
        competitorUrls,
        competitors: mergeCompetitorsFromUrls(sources?.competitors || [], competitorUrls),
      });
      setSources(saved);
      setCompetitorUrlsText((saved.competitorUrls || []).join("\n"));
      setDataMeta(readAgencyDataMeta(saved));
      setMessage("Fonti progetto aggiornate e ricaricabili.");
    } catch (saveError) {
      setError(getFriendlySourcesError(saveError, "Salvataggio fonti non riuscito."));
    } finally {
      setSaving(false);
    }
  };

  return {
    sources,
    setSources,
    competitorUrlsText,
    setCompetitorUrlsText,
    dataMeta,
    setDataMeta,
    loading,
    saving,
    setSaving,
    message,
    setMessage,
    error,
    setError,
    loadSources,
    updateSourceField,
    handleSave,
  };
};

export default useAgencyProjectAssetsData;
