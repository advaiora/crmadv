import { useAgencySettingsData } from "./useAgencySettingsData";
import { useAgencySettingsSave } from "./useAgencySettingsSave";
import { useAgencySettingsClearKeys } from "./useAgencySettingsClearKeys";

// Hook radice della pagina Impostazioni Agency: mette insieme i dati con i loro
// derivati, il salvataggio e la cancellazione delle chiavi.
//
// Le due azioni ricevono i setter dei dati per parametro: `saveState` e' uno
// solo per tutte e due (lo stesso "saving" disabilita entrambi i bottoni), e
// impostazioni e form si risincronizzano sempre in coppia.
export const useAgencySettings = () => {
  const data = useAgencySettingsData();

  const save = useAgencySettingsSave({
    runtimeForm: data.runtimeForm,
    canManage: data.canManage,
    setSaveState: data.setSaveState,
    setRuntimeSettings: data.setRuntimeSettings,
    setRuntimeForm: data.setRuntimeForm,
    refreshSettings: data.refreshSettings,
  });

  const clearKeys = useAgencySettingsClearKeys({
    canManage: data.canManage,
    setSaveState: data.setSaveState,
    setRuntimeSettings: data.setRuntimeSettings,
    setRuntimeForm: data.setRuntimeForm,
    refreshSettings: data.refreshSettings,
  });

  // I tre setter grezzi restano dentro: li cambiano solo le funzioni degli
  // hook, cosi' non c'e' un secondo posto da cui possono cambiare. La pagina
  // usa `updateFormField` e `selectAiModel`, non `setRuntimeForm`.
  const {
    setRuntimeSettings: _setRuntimeSettings,
    setRuntimeForm: _setRuntimeForm,
    setSaveState: _setSaveState,
    ...datiPubblici
  } = data;

  return {
    ...datiPubblici,
    ...save,
    ...clearKeys,
  };
};

export default useAgencySettings;
