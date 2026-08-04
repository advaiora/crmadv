import { useAgencyAiEstimates } from "../../../../../modules/agency-os/hooks/useAgencyAiEstimates";
import { buildWebMissingInputs } from "../buildWebMissingInputs";
import { useAgencyProjectWebData } from "./useAgencyProjectWebData";
import { useAgencyProjectWebSubProjects } from "./useAgencyProjectWebSubProjects";
import { useAgencyProjectWebDraftGeneration } from "./useAgencyProjectWebDraftGeneration";
import { isAiUnavailable, useAgencyProjectWebAiGeneration } from "./useAgencyProjectWebAiGeneration";

// Hook radice della pagina Web di progetto: mette insieme dati, sub-progetti,
// bozza base e generazione AI, e calcola i due derivati che servono a piu'
// riquadri (dati mancanti e fonti usate). La pagina non tiene piu' stato suo.
//
// Nota: i derivati si calcolano anche mentre la pagina sta caricando, quando
// `webState` e' ancora `null` — nell'originale il caso era escluso dal return
// anticipato, qui serve la guardia esplicita.
export const useAgencyProjectWeb = (projectId) => {
  const aiEstimates = useAgencyAiEstimates();
  const data = useAgencyProjectWebData(projectId);

  const subProjects = useAgencyProjectWebSubProjects({
    setWebState: data.setWebState,
    setOutputField: data.setOutputField,
    setSaveError: data.setSaveError,
    setGenerationMessage: data.setGenerationMessage,
  });

  const draftGeneration = useAgencyProjectWebDraftGeneration({
    webState: data.webState,
    setWebState: data.setWebState,
    setSaveMessage: data.setSaveMessage,
    setSaveError: data.setSaveError,
    setGenerationMessage: data.setGenerationMessage,
  });

  const aiGeneration = useAgencyProjectWebAiGeneration({
    projectId,
    webState: data.webState,
    aiStatus: data.aiStatus,
    setWebState: data.setWebState,
    setDataMeta: data.setDataMeta,
    setSaveError: data.setSaveError,
    setSaveMessage: data.setSaveMessage,
    setGenerationMessage: data.setGenerationMessage,
  });

  const input = data.webState?.input ?? null;
  const output = data.webState?.output ?? null;
  const webMissingInputs = buildWebMissingInputs(input, output, data.project?.sourceReadiness);
  const usedSources = Array.isArray(data.project?.sourceReadiness?.usedSources)
    ? data.project.sourceReadiness.usedSources
    : [];

  // I setter grezzi (`setWebState`, `setDataMeta`, i tre dei messaggi) NON
  // escono di qui: servono solo a cucire fra loro gli hook interni. Se
  // uscissero, domani si potrebbe scrivere direttamente nello stato della
  // bozza aggirando i riduttori, che smetterebbero di essere l'unico posto
  // in cui quello stato cambia.
  const {
    setWebState: _setWebState,
    setDataMeta: _setDataMeta,
    setSaveMessage: _setSaveMessage,
    setSaveError: _setSaveError,
    setGenerationMessage: _setGenerationMessage,
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
    webMissingInputs,
    usedSources,
    aiUnavailable: isAiUnavailable(data.aiStatus),
  };
};

export default useAgencyProjectWeb;
