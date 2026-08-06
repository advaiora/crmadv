import React from "react";
import { generateAgencyAdsAssetWithAi } from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";
import { isAiUnavailable } from "../../agencyProjectUx";

// Generazione con AI di un singolo asset (headline, primary text, keyword...).
// A differenza della pagina Web non esiste un "genera tutto con AI": su Ads
// l'AI lavora sempre per asset.
export const useAgencyProjectAdsAiGeneration = ({
  projectId,
  aiStatus,
  setAdsState,
  setDataMeta,
  setSaveError,
  setSaveMessage,
  setRuntimeMessage,
}) => {
  const [generatingAssetKey, setGeneratingAssetKey] = React.useState("");

  const handleGenerateAdsAssetWithAi = async (assetKey) => {
    if (isAiUnavailable(aiStatus)) {
      setRuntimeMessage("AI non configurata lato server. Puoi usare le bozze base oppure completare la configurazione in Impostazioni AI.");
      return;
    }

    setGeneratingAssetKey(assetKey);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");
    try {
      const generated = await generateAgencyAdsAssetWithAi(projectId, assetKey);
      if (!generated) {
        setSaveError("Rigenerazione asset Ads non riuscita.");
        return;
      }
      setAdsState(generated);
      setDataMeta(readAgencyDataMeta(generated));
      const wasCached = Boolean(generated.aiGeneration?.cacheHit);
      setRuntimeMessage(wasCached
        ? "Asset Ads aggiornato riusando un risultato gia disponibile: nessuna nuova chiamata AI."
        : "Asset Ads rigenerato con AI usando fonti, Brief e output Web disponibili.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione asset Ads non riuscita.");
    } finally {
      setGeneratingAssetKey("");
    }
  };

  return {
    generatingAssetKey,
    handleGenerateAdsAssetWithAi,
  };
};

export default useAgencyProjectAdsAiGeneration;
