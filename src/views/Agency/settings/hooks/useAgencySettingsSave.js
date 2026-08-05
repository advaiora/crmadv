import { saveAgencyRuntimeSettings } from "../../../../modules/agency-os/data/agencyDataAdapter";
import { buildRuntimeForm } from "../settingsFormHelpers";

// Salvataggio delle impostazioni runtime.
//
// Riceve dall'hook dei dati i tre setter che deve toccare (`setSaveState`,
// `setRuntimeSettings`, `setRuntimeForm`) invece di tenere uno stato proprio:
// `saveState` e' condiviso con la cancellazione delle chiavi, e le impostazioni
// vanno risincronizzate insieme al form.
export const useAgencySettingsSave = ({
  runtimeForm,
  canManage,
  setSaveState,
  setRuntimeSettings,
  setRuntimeForm,
  refreshSettings,
}) => {
  const handleSaveRuntimeSettings = async (event) => {
    event.preventDefault();
    if (!canManage) {
      setSaveState({
        status: "error",
        message: "Solo un Superadmin puo modificare AI, ricerca competitor e API key.",
      });
      return;
    }

    setSaveState({ status: "saving", message: "Salvataggio impostazioni in corso..." });
    try {
      let functionModels = {};
      if (runtimeForm.aiFunctionModelsText.trim()) {
        try {
          functionModels = JSON.parse(runtimeForm.aiFunctionModelsText);
        } catch (_error) {
          // Uscita anticipata: il JSON scritto a mano non e' valido, quindi non
          // si manda niente al server. Lo stato resta "error", non "saving".
          setSaveState({
            status: "error",
            message: "La configurazione modelli per funzione deve essere un JSON valido.",
          });
          return;
        }
      }
      const payload = {
        ai: {
          enabled: runtimeForm.aiEnabled,
          provider: runtimeForm.aiProvider,
          model: runtimeForm.aiModel,
          timeoutMs: Number(runtimeForm.aiTimeoutMs) || 45000,
          inputMaxChars: Number(runtimeForm.aiInputMaxChars) || 12000,
          stringMaxChars: Number(runtimeForm.aiStringMaxChars) || 1200,
          fileTextMaxChars: Number(runtimeForm.aiFileTextMaxChars) || 1800,
          maxOutputTokens: Number(runtimeForm.aiMaxOutputTokens) || 1800,
          defaultMode: runtimeForm.aiDefaultMode,
          debugEnabled: runtimeForm.aiDebugEnabled,
          functionModels,
          // Campo write-only: la chiave finisce nel payload SOLO se e' stata
          // digitata. Mandare una stringa vuota cancellerebbe quella salvata.
          ...(runtimeForm.openAiApiKey.trim()
            ? { openAiApiKey: runtimeForm.openAiApiKey.trim() }
            : {}),
          ...(runtimeForm.anthropicApiKey.trim()
            ? { anthropicApiKey: runtimeForm.anthropicApiKey.trim() }
            : {}),
        },
        competitorSearch: {
          enabled: runtimeForm.competitorSearchEnabled,
          provider: runtimeForm.competitorSearchProvider,
        },
      };
      const saved = await saveAgencyRuntimeSettings(payload);
      setRuntimeSettings(saved);
      setRuntimeForm(buildRuntimeForm(saved));
      await refreshSettings();
      setSaveState({
        status: "success",
        message: "Impostazioni salvate. Le generazioni useranno la nuova configurazione lato server.",
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error?.message || "Salvataggio non riuscito. Le modifiche non sono state applicate.",
      });
    }
  };

  return { handleSaveRuntimeSettings };
};

export default useAgencySettingsSave;
