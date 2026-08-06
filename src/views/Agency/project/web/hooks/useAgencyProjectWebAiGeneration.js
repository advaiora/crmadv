import React from "react";
import {
  generateAgencyWebBlockWithAi,
  generateAgencyWebProjectWithAi,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";
import { isAiUnavailable } from "../../agencyProjectUx";

// Generazione con AI: pagina intera (`handleGenerateWithAi`) o singolo blocco
// (`handleGenerateBlockWithAi`). Entrambe lavorano sul primo sub-progetto Web,
// salvo che il chiamante ne indichi un altro.
export const useAgencyProjectWebAiGeneration = ({
  projectId,
  webState,
  aiStatus,
  setWebState,
  setDataMeta,
  setSaveError,
  setSaveMessage,
  setGenerationMessage,
}) => {
  const [generatingAi, setGeneratingAi] = React.useState(false);
  const [generatingBlockKey, setGeneratingBlockKey] = React.useState("");

  const resolveTargetProject = (projectItem) => projectItem || webState?.output?.webProjects?.[0];

  const handleGenerateWithAi = async (projectItem = null) => {
    const targetProject = resolveTargetProject(projectItem);
    if (!targetProject) {
      setSaveError("Crea prima una landing o pagina Web da generare.");
      return;
    }
    if (isAiUnavailable(aiStatus)) {
      setGenerationMessage("AI non configurata lato server. Puoi usare la bozza base oppure completare la configurazione in Impostazioni AI.");
      return;
    }

    setGeneratingAi(true);
    setSaveError("");
    setSaveMessage("");
    setGenerationMessage("");
    try {
      const generated = await generateAgencyWebProjectWithAi(projectId, targetProject.id);
      if (!generated) {
        setSaveError("Generazione Web AI non riuscita.");
        return;
      }
      setWebState(generated);
      setDataMeta(readAgencyDataMeta(generated));
      setGenerationMessage(generated.aiGeneration?.generated
        ? "Output Web generato con AI usando fonti e Discovery progetto."
        : generated.aiGeneration?.message || "Generazione AI non eseguita.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Generazione Web AI non riuscita.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleGenerateBlockWithAi = async (blockKey, projectItem = null) => {
    const targetProject = resolveTargetProject(projectItem);
    if (!targetProject) {
      setSaveError("Crea prima una landing o pagina Web da aggiornare.");
      return;
    }
    if (isAiUnavailable(aiStatus)) {
      setGenerationMessage("AI non configurata lato server. Puoi usare le azioni bozza base oppure completare la configurazione in Impostazioni AI.");
      return;
    }

    setGeneratingBlockKey(blockKey);
    setSaveError("");
    setSaveMessage("");
    setGenerationMessage("");
    try {
      const generated = await generateAgencyWebBlockWithAi(projectId, targetProject.id, blockKey);
      if (!generated) {
        setSaveError("Rigenerazione del blocco Web non riuscita.");
        return;
      }
      setWebState(generated);
      setDataMeta(readAgencyDataMeta(generated));
      const wasCached = Boolean(generated.aiGeneration?.cacheHit);
      setGenerationMessage(wasCached
        ? "Blocco Web aggiornato riusando un risultato gia disponibile: nessuna nuova chiamata AI."
        : "Blocco Web rigenerato con AI usando fonti, Discovery e contesto progetto.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione del blocco Web non riuscita.");
    } finally {
      setGeneratingBlockKey("");
    }
  };

  return {
    generatingAi,
    generatingBlockKey,
    handleGenerateWithAi,
    handleGenerateBlockWithAi,
  };
};

export default useAgencyProjectWebAiGeneration;
