import React from "react";
import {
  getAgencyProjectReport,
  saveAgencyProjectReport,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";

// Carica, salva e rigenera lo snapshot tecnico del progetto: la vista interna della
// scheda "Report" (era la scheda separata "Reports tecnici", assorbita il 6/8/2026).
//
// ⚠️ Qui NON si carica il progetto. La vecchia pagina lo faceva per disegnarsi da
// sola il pannello sullo stato delle fonti, ma quel pannello lo disegna gia'
// AgencyProjectPageTemplate per ogni scheda: sulla vecchia pagina compariva due
// volte, e la chiamata a `getAgencyProject` era la stessa che fa gia' il template.
export const useAgencyProjectReportTechnical = (projectId) => {
  const [report, setReport] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [runtimeMessage, setRuntimeMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setRuntimeMessage("");
    try {
      const payload = await getAgencyProjectReport(projectId);
      setReport(payload);
      setDataMeta(readAgencyDataMeta(payload));
    } catch (loadError) {
      setSaveError(loadError instanceof Error ? loadError.message : "Caricamento report non riuscito.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!report) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");

    try {
      const saved = await saveAgencyProjectReport(projectId, { output: report.output });
      setReport(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Snapshot report salvata nel layer Agency."
        : "Snapshot report salvata localmente per indisponibilita temporanea del layer Agency.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio report non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    // Si chiede conferma solo se uno snapshot c'e' gia': rigenerare sovrascrive.
    if (report?.output?.generatedAt) {
      const shouldProceed = window.confirm(
        "Rigenerare lo snapshot report usando i dati correnti dei moduli Agency?",
      );
      if (!shouldProceed) {
        return;
      }
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    setRuntimeMessage("");

    try {
      const regenerated = await saveAgencyProjectReport(projectId, {});
      setReport(regenerated);
      setDataMeta(readAgencyDataMeta(regenerated));
      setRuntimeMessage(regenerated.persisted
        ? "Snapshot report rigenerata dai dati correnti e persistita."
        : "Snapshot report rigenerata localmente per indisponibilita temporanea del layer Agency.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione report non riuscita.");
    } finally {
      setSaving(false);
    }
  };

  return {
    report,
    dataMeta,
    loading,
    saving,
    saveMessage,
    runtimeMessage,
    saveError,
    load,
    save,
    regenerate,
  };
};
