import React from "react";
import { saveAgencyRuntimeSettings } from "../../../../modules/agency-os/data/agencyDataAdapter";
import { buildRuntimeForm } from "../settingsFormHelpers";

// Cancellazione delle API key.
//
// Serve un comando dedicato perche' il campo chiave e' write-only ("vuoto = non
// cambiare"): svuotare la casella non cancella niente. Il selettore decide
// quali chiavi togliere, ed e' l'unico stato proprio di questo hook; lo stato
// dell'operazione (`saveState`) e' invece quello condiviso col salvataggio.
export const useAgencySettingsClearKeys = ({
  canManage,
  setSaveState,
  setRuntimeSettings,
  setRuntimeForm,
  refreshSettings,
}) => {
  // "" = tutte, "openai" o "anthropic" = solo una.
  const [clearKeysProvider, setClearKeysProvider] = React.useState("");

  const handleClearKeys = async () => {
    if (!canManage) {
      setSaveState({ status: "error", message: "Solo un Superadmin puo cancellare le API key." });
      return;
    }
    const label = clearKeysProvider === "openai"
      ? "la chiave OpenAI"
      : clearKeysProvider === "anthropic"
        ? "la chiave Anthropic"
        : "tutte le API key";
    if (!window.confirm(`Cancellare permanentemente ${label} dal CRM? Non e' reversibile: per riattivare l'AI dovrai reinserire la chiave.`)) {
      return;
    }
    setSaveState({ status: "saving", message: "Rimozione chiavi in corso..." });
    try {
      const saved = await saveAgencyRuntimeSettings({
        ai: {
          clearOpenAiApiKey: clearKeysProvider === "" || clearKeysProvider === "openai",
          clearAnthropicApiKey: clearKeysProvider === "" || clearKeysProvider === "anthropic",
        },
      });
      setRuntimeSettings(saved);
      setRuntimeForm(buildRuntimeForm(saved));
      await refreshSettings();
      setSaveState({ status: "success", message: `Rimozione completata: ${label} non e' piu' presente nel CRM.` });
    } catch (error) {
      setSaveState({ status: "error", message: error?.message || "Rimozione non riuscita." });
    }
  };

  return { clearKeysProvider, setClearKeysProvider, handleClearKeys };
};

export default useAgencySettingsClearKeys;
