import React from "react";
import {
  getAgencyAiStatus,
  getAgencyCompetitorSearchSettings,
  getAgencyRuntimeSettings,
} from "../../../../modules/agency-os/data/agencyDataAdapter";
import { buildRuntimeForm } from "../settingsFormHelpers";

// Dati e derivati della pagina Impostazioni Agency.
//
// `runtimeSettings` e `runtimeForm` vanno SEMPRE aggiornati insieme: il form e'
// ricostruito dalle impostazioni con `buildRuntimeForm`, e il server le
// risincronizza in tre punti diversi (caricamento, salvataggio, cancellazione
// delle chiavi). Chi tocca uno di quei tre punti deve portarsi dietro entrambi.
//
// `saveState` sta qui ed e' uno solo: lo condividono il salvataggio e la
// cancellazione delle chiavi, e lo stesso `status === "saving"` disabilita sia
// il bottone Salva sia quello di cancellazione. Duplicarlo disallineerebbe i
// due bottoni.
//
// I nove valori calcolati in fondo (permessi, chiavi presenti, cataloghi
// modelli) sono DERIVATI da `runtimeSettings`: ricalcolati a ogni render, mai
// tenuti in uno stato proprio, altrimenti dopo un aggiornamento resterebbero
// indietro.
export const useAgencySettingsData = () => {
  const [competitorSearchSettings, setCompetitorSearchSettings] = React.useState({
    status: "not_configured",
    provider: "none",
    message: "Per ricercare competitor online serve un provider configurato lato server.",
    requiredEnv: [],
  });
  const [aiStatus, setAiStatus] = React.useState({
    status: "not_configured",
    configured: false,
    provider: "none",
    model: "",
    message: "AI non configurata. Il sistema usa generatori rule-based dichiarati.",
  });
  const [runtimeSettings, setRuntimeSettings] = React.useState(null);
  const [runtimeForm, setRuntimeForm] = React.useState(buildRuntimeForm(null));
  const [saveState, setSaveState] = React.useState({ status: "idle", message: "" });

  const refreshSettings = React.useCallback(async () => {
    const [competitorResult, aiResult, runtimeResult] = await Promise.allSettled([
      getAgencyCompetitorSearchSettings(),
      getAgencyAiStatus(),
      getAgencyRuntimeSettings(),
    ]);

    if (competitorResult.status === "fulfilled" && competitorResult.value) {
      setCompetitorSearchSettings(competitorResult.value);
    } else {
      setCompetitorSearchSettings((current) => ({
        ...current,
        status: "not_configured",
        provider: "none",
        message: "Stato ricerca non disponibile. Puoi comunque inserire competitor manualmente.",
      }));
    }

    if (aiResult.status === "fulfilled" && aiResult.value) {
      setAiStatus(aiResult.value);
    }

    if (runtimeResult.status === "fulfilled" && runtimeResult.value) {
      setRuntimeSettings(runtimeResult.value);
      setRuntimeForm(buildRuntimeForm(runtimeResult.value));
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void refreshSettings().catch(() => {
      if (!mounted) return;
      setSaveState({
        status: "error",
        message: "Impostazioni runtime non disponibili. Riprova dopo aver verificato il server API.",
      });
    });

    return () => {
      mounted = false;
    };
  }, [refreshSettings]);

  const canManage = Boolean(runtimeSettings?.canManage);
  const storageReady = runtimeSettings?.storageReady !== false;
  const aiApiKeyConfigured = Boolean(runtimeSettings?.ai?.openAiApiKeyConfigured ?? (runtimeSettings?.ai?.apiKeyConfigured || aiStatus?.apiKeyConfigured));
  const anthropicApiKeyConfigured = Boolean(runtimeSettings?.ai?.anthropicApiKeyConfigured);

  // Catalogo modelli dal backend. Il "modello preferito" mostra SOLO i modelli dei
  // provider con una chiave (attivi): scegliere un modello fissa anche il suo provider,
  // cosi' entrambi i provider sono di prima classe e non si digita piu' un id a mano.
  const availableModels = runtimeSettings?.availableModels ?? [];
  const providerHasKey = { openai: aiApiKeyConfigured, anthropic: anthropicApiKeyConfigured };
  const activeProviders = ["openai", "anthropic"].filter((prov) => providerHasKey[prov]);
  const activeModels = availableModels.filter((option) => providerHasKey[option.provider]);
  const selectedModelOption = availableModels.find((option) => option.id === runtimeForm.aiModel) || null;

  const updateFormField = (field, value) => {
    setRuntimeForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Scegliere un modello fissa anche il suo provider: e' una regola sola in due
  // campi, e sta qui perche' il riquadro non debba rifare da solo la ricerca
  // dentro `availableModels`.
  const selectAiModel = (modelId) => {
    const option = availableModels.find((entry) => entry.id === modelId);
    setRuntimeForm((current) => ({
      ...current,
      aiModel: modelId,
      aiProvider: option?.provider ?? current.aiProvider,
    }));
  };

  return {
    competitorSearchSettings,
    aiStatus,
    runtimeSettings,
    setRuntimeSettings,
    runtimeForm,
    setRuntimeForm,
    saveState,
    setSaveState,
    refreshSettings,
    canManage,
    storageReady,
    aiApiKeyConfigured,
    anthropicApiKeyConfigured,
    availableModels,
    activeProviders,
    activeModels,
    selectedModelOption,
    updateFormField,
    selectAiModel,
  };
};

export default useAgencySettingsData;
