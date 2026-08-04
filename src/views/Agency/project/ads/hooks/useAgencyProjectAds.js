import { useAgencyAiEstimates } from "../../../../../modules/agency-os/hooks/useAgencyAiEstimates";
import { isAiUnavailable, readableValue } from "../../agencyProjectUx";
import { buildAdsInputCompleteness } from "../buildAdsInputCompleteness";
import { useAgencyProjectAdsData } from "./useAgencyProjectAdsData";
import { useAgencyProjectAdsSubProjects } from "./useAgencyProjectAdsSubProjects";
import { useAgencyProjectAdsDraftGeneration } from "./useAgencyProjectAdsDraftGeneration";
import { useAgencyProjectAdsAiGeneration } from "./useAgencyProjectAdsAiGeneration";

// Hook radice della pagina Ads di progetto: mette insieme dati, campagne,
// bozza base e generazione AI, e calcola i due derivati che servono a piu'
// riquadri (completezza degli input e descrizione della landing collegata).
//
// I derivati si calcolano anche mentre la pagina carica, quando `adsState` e'
// ancora `null`: nell'originale il caso era escluso dal return anticipato.
export const useAgencyProjectAds = (projectId) => {
  const aiEstimates = useAgencyAiEstimates();
  const data = useAgencyProjectAdsData(projectId);

  const subProjects = useAgencyProjectAdsSubProjects({
    setAdsState: data.setAdsState,
    setSaveError: data.setSaveError,
    setRuntimeMessage: data.setRuntimeMessage,
  });

  const draftGeneration = useAgencyProjectAdsDraftGeneration({
    adsState: data.adsState,
    setAdsState: data.setAdsState,
    setSaveMessage: data.setSaveMessage,
    setSaveError: data.setSaveError,
    setRuntimeMessage: data.setRuntimeMessage,
  });

  const aiGeneration = useAgencyProjectAdsAiGeneration({
    projectId,
    aiStatus: data.aiStatus,
    setAdsState: data.setAdsState,
    setDataMeta: data.setDataMeta,
    setSaveError: data.setSaveError,
    setSaveMessage: data.setSaveMessage,
    setRuntimeMessage: data.setRuntimeMessage,
  });

  const input = data.adsState?.input ?? null;
  const output = data.adsState?.output ?? null;
  const completeness = buildAdsInputCompleteness(input, data.dataMeta);
  const linkedLanding = input?.web?.available
    ? `${input.web.pageType || "landing"} | ${readableValue(input.web.pageGoal, "Goal da completare")}`
    : "Nessun output Web persistito";

  // Come nel gemello Web: i setter grezzi restano dentro, cosi' i riduttori
  // restano l'unico posto in cui lo stato della bozza cambia.
  const {
    setAdsState: _setAdsState,
    setDataMeta: _setDataMeta,
    setSaveMessage: _setSaveMessage,
    setSaveError: _setSaveError,
    setRuntimeMessage: _setRuntimeMessage,
    ...datiPubblici
  } = data;

  return {
    ...datiPubblici,
    ...subProjects,
    ...draftGeneration,
    ...aiGeneration,
    aiEstimates,
    input,
    output,
    completeness,
    linkedLanding,
    aiUnavailable: isAiUnavailable(data.aiStatus),
  };
};

export default useAgencyProjectAds;
