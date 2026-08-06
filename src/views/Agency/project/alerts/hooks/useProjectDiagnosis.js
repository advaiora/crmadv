import React from "react";
import {
  getAgencyProjectDiagnosis,
  saveAgencyProjectDiagnosis,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";

// Carica, salva e rigenera l'analisi AI dei punti deboli (la vecchia "Diagnosis",
// confluita nella scheda "Da risolvere" il 5/8/2026). Rigenerazione e salvataggio
// sono stati mantenuti: la riorganizzazione sposta i contenuti, non toglie funzioni.
export const useProjectDiagnosis = (projectId) => {
  const [diagnosis, setDiagnosis] = React.useState(null);
  const [meta, setMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = await getAgencyProjectDiagnosis(projectId);
      setDiagnosis(payload);
      setMeta(readAgencyDataMeta(payload));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Caricamento dell'analisi non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!diagnosis) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const saved = await saveAgencyProjectDiagnosis(projectId, { output: diagnosis.output });
      setDiagnosis(saved);
      setMeta(readAgencyDataMeta(saved));
      setMessage(saved.persisted
        ? "Analisi salvata."
        : "Analisi salvata solo in locale: il salvataggio sul server non era disponibile.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Salvataggio dell'analisi non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    // Si chiede conferma solo se c'e' gia' un'analisi: rigenerare sovrascrive.
    if (diagnosis?.output?.evaluatedAt) {
      const shouldProceed = window.confirm(
        "Rigenerare l'analisi usando i dati correnti di Brief, Contenuti Web, Campagne ADS, Report e segnali del progetto?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const regenerated = await saveAgencyProjectDiagnosis(projectId, {});
      setDiagnosis(regenerated);
      setMeta(readAgencyDataMeta(regenerated));
      setMessage(regenerated.persisted
        ? "Analisi rigenerata dai dati correnti."
        : "Analisi rigenerata solo in locale: il salvataggio sul server non era disponibile.");
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "Rigenerazione dell'analisi non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  return { diagnosis, meta, loading, busy, message, error, load, save, regenerate };
};
