import React from "react";
import {
  getAgencyProject,
  getAgencyProjectWeb,
  getAgencyProjectAds,
  getAgencyAiStatus,
  saveAgencyProjectAds,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";

// Dati e persistenza del modulo Ads di progetto.
//
// Due differenze volute rispetto al gemello Web, entrambe gia' presenti prima
// della spezzatura e da NON allineare per simmetria:
// - si carica anche il modulo Web, perche' una campagna puo' essere collegata
//   a una landing e il menu deve poterle elencare;
// - lo stato dell'AI si aspetta dentro il caricamento (in Web invece arriva
//   dopo): qui la pagina risulta pronta solo quando si sa gia' se l'AI c'e'.
export const useAgencyProjectAdsData = (projectId) => {
  const [adsState, setAdsState] = React.useState(null);
  const [project, setProject] = React.useState(null);
  const [webProjects, setWebProjects] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [aiStatus, setAiStatus] = React.useState(null);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [runtimeMessage, setRuntimeMessage] = React.useState("");

  const loadAds = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setRuntimeMessage("");
    try {
      const [nextProject, webPayload, payload, nextAiStatus] = await Promise.all([
        getAgencyProject(projectId).catch(() => null),
        getAgencyProjectWeb(projectId).catch(() => null),
        getAgencyProjectAds(projectId),
        getAgencyAiStatus().catch(() => null),
      ]);
      setProject(nextProject);
      setWebProjects(Array.isArray(webPayload?.output?.webProjects) ? webPayload.output.webProjects : []);
      setAdsState(payload);
      setDataMeta(readAgencyDataMeta(payload));
      setAiStatus(nextAiStatus);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Caricamento modulo Ads non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadAds();
  }, [loadAds]);

  const setOutputField = (key, value) => {
    setAdsState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        output: {
          ...current.output,
          [key]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!adsState) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");

    try {
      const saved = await saveAgencyProjectAds(projectId, {
        output: adsState.output,
      });
      setAdsState(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Output Ads salvato nel layer Agency."
        : "Output Ads salvato localmente per indisponibilita temporanea del layer Agency.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio modulo Ads non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  return {
    adsState,
    setAdsState,
    project,
    webProjects,
    dataMeta,
    setDataMeta,
    loading,
    saving,
    saveMessage,
    setSaveMessage,
    saveError,
    setSaveError,
    runtimeMessage,
    setRuntimeMessage,
    aiStatus,
    loadAds,
    setOutputField,
    handleSave,
  };
};

export default useAgencyProjectAdsData;
