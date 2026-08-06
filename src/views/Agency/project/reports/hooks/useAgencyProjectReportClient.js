import React from "react";
import {
  getAgencyProjectClientReport,
  saveAgencyProjectClientReport,
} from "../../../../../modules/agency-os/data/agencyDataAdapter";
import { fetchAgencyProjectClientReportPdfBlob } from "../../../../../modules/agency-os/api/agency.api";
import { readAgencyDataMeta } from "../../../../../modules/agency-os/data/agencyDataSource";

// Carica, salva, rigenera, stampa e scarica in PDF il report destinato al cliente:
// la vista generale della scheda "Report". Estratto da AgencyProjectClientReportPage
// il 6/8/2026 quando la vista tecnica e' confluita nella stessa scheda — lo stato
// resta separato fra le due viste, come lo era quando erano due pagine distinte.
export const useAgencyProjectReportClient = (projectId) => {
  const [report, setReport] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [runtimeMessage, setRuntimeMessage] = React.useState("");
  const [saveError, setSaveError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setSaveError("");
    setRuntimeMessage("");
    try {
      const payload = await getAgencyProjectClientReport(projectId);
      setReport(payload);
      setDataMeta(readAgencyDataMeta(payload));
    } catch (loadError) {
      setSaveError(loadError instanceof Error ? loadError.message : "Caricamento report cliente non riuscito.");
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
      const saved = await saveAgencyProjectClientReport(projectId, { output: report.output });
      setReport(saved);
      setDataMeta(readAgencyDataMeta(saved));
      setSaveMessage(saved.persisted
        ? "Report cliente salvato nel layer Agency."
        : "Report cliente salvato localmente: il backend Agency non ha confermato la persistenza.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Salvataggio report cliente non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    // Si chiede conferma solo se un report c'e' gia': rigenerare sovrascrive.
    if (report?.output?.generatedAt) {
      const shouldProceed = window.confirm(
        "Rigenerare il report cliente a partire dal report tecnico e dall'analisi dei punti deboli correnti?",
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
      const regenerated = await saveAgencyProjectClientReport(projectId, {});
      setReport(regenerated);
      setDataMeta(readAgencyDataMeta(regenerated));
      setRuntimeMessage(regenerated.persisted
        ? "Report cliente rigenerato e persistito."
        : "Report cliente rigenerato localmente: il backend Agency non ha confermato la persistenza.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rigenerazione report cliente non riuscita.");
    } finally {
      setSaving(false);
    }
  };

  const print = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    setSaveError("");
    setRuntimeMessage("");
    try {
      const { blob, filename } = await fetchAgencyProjectClientReportPdfBlob(projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || `report_cliente_${projectId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setRuntimeMessage("PDF del report cliente scaricato.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Download PDF non riuscito.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return {
    report,
    dataMeta,
    loading,
    saving,
    downloadingPdf,
    saveMessage,
    runtimeMessage,
    saveError,
    load,
    save,
    regenerate,
    print,
    downloadPdf,
  };
};
