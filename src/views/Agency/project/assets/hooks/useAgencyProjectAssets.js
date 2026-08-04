import { useAgencyProjectAssetsData } from "./useAgencyProjectAssetsData";
import { useAgencyProjectAssetsUrls } from "./useAgencyProjectAssetsUrls";
import { useAgencyProjectAssetsFiles } from "./useAgencyProjectAssetsFiles";
import { useAgencyProjectAssetsUploadQueue } from "./useAgencyProjectAssetsUploadQueue";
import { useAgencyProjectAssetsCompetitors } from "./useAgencyProjectAssetsCompetitors";

// Hook radice della pagina Fonti e Materiali: mette insieme dati, indirizzi,
// materiali e competitor, e calcola i quattro derivati che servono ai riquadri.
//
// Come nelle due pagine sorelle i derivati si calcolano anche mentre la pagina
// carica, quando `sources` e' ancora `null`: nell'originale il caso era
// escluso dal return anticipato.
export const useAgencyProjectAssets = (projectId) => {
  const data = useAgencyProjectAssetsData(projectId);

  const urls = useAgencyProjectAssetsUrls({
    setSources: data.setSources,
    setError: data.setError,
  });

  const files = useAgencyProjectAssetsFiles({
    projectId,
    setSources: data.setSources,
    setError: data.setError,
    setMessage: data.setMessage,
    setSaving: data.setSaving,
    setCompetitorUrlsText: data.setCompetitorUrlsText,
    setDataMeta: data.setDataMeta,
  });

  const uploadQueue = useAgencyProjectAssetsUploadQueue({
    projectId,
    setError: data.setError,
    setMessage: data.setMessage,
    loadSources: data.loadSources,
  });

  const competitors = useAgencyProjectAssetsCompetitors({
    projectId,
    setSources: data.setSources,
    setError: data.setError,
    setMessage: data.setMessage,
  });

  const status = data.sources?.sourceStatus || "missing";
  const competitorRoster = data.sources?.competitors || [];
  const uploadedFiles = data.sources?.uploadedFiles || [];
  const competitorSearchSuggestions = Array.isArray(competitors.competitorSearch?.suggestions)
    ? competitors.competitorSearch.suggestions
    : [];

  // Come nelle sorelle Web e Ads i setter grezzi restano dentro, cosi' le
  // funzioni degli hook restano l'unico posto in cui lo stato cambia.
  //
  // UNICA ECCEZIONE: `setCompetitorUrlsText`, che resta pubblico perche'
  // alimenta una casella di testo libero senza una funzione dedicata. Toglierlo
  // per simmetria con le sorelle romperebbe quella casella.
  const {
    setSources: _setSources,
    setDataMeta: _setDataMeta,
    setSaving: _setSaving,
    setMessage: _setMessage,
    setError: _setError,
    ...datiPubblici
  } = data;

  return {
    ...datiPubblici,
    ...urls,
    ...files,
    ...uploadQueue,
    ...competitors,
    status,
    competitorRoster,
    uploadedFiles,
    competitorSearchSuggestions,
  };
};

export default useAgencyProjectAssets;
