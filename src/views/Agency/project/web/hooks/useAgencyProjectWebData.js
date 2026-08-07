import React from "react";
import {
  getAgencyProject,
  getAgencyAiStatus,
  getAgencyProjectWeb,
  saveAgencyProjectWeb,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";

// Dati e persistenza del modulo Web di progetto: caricamento, salvataggio e i
// tre messaggi di pagina (errore, salvataggio, generazione), che restano qui
// perche' li scrivono anche gli altri hook della pagina.
export const useAgencyProjectWebData = (projectId) => {
  const [webState, setWebState] = React.useState(null);
  const [project, setProject] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [aiStatus, setAiStatus] = React.useState(null);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [generationMessage, setGenerationMessage] = React.useState("");

  const loadWeb = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setGenerationMessage("");
    try {
      const [nextProject, payload] = await Promise.all([
        getAgencyProject(projectId).catch(() => null),
        getAgencyProjectWeb(projectId),
      ]);
      setProject(nextProject);
      setWebState(payload);
      setDataMeta(readAgencyDataMeta(payload));
      getAgencyAiStatus().then((status) => setAiStatus(status)).catch(() => setAiStatus(null));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Caricamento dei Contenuti Web non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadWeb();
  }, [loadWeb]);

  const setOutputField = (key, value) => {
    setWebState((current) => {
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
    if (!webState) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const saved = await saveAgencyProjectWeb(projectId, {
        output: webState.output,
      });
      setWebState(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Output Web salvato sul server."
        : "Output Web salvato solo su questo dispositivo: il server non e raggiungibile in questo momento.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio modulo Web non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  return {
    webState,
    setWebState,
    project,
    dataMeta,
    setDataMeta,
    loading,
    saving,
    saveMessage,
    setSaveMessage,
    saveError,
    setSaveError,
    generationMessage,
    setGenerationMessage,
    aiStatus,
    loadWeb,
    setOutputField,
    handleSave,
  };
};

export default useAgencyProjectWebData;
