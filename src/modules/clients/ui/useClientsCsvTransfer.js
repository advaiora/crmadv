// Import/export CSV della lista clienti, estratti da ClientsList.jsx
// (fase 2 riordino frontend, secondo giro). L'hook possiede gli stati di
// avanzamento e il messaggio d'esito; gli errori risalgono via onError
// (unico canale d'errore della pagina), il refresh post-import via onImported.
import { useState } from "react";
import { exportClients, importClients } from "./clientApi";

export function useClientsCsvTransfer({ onError, onImported } = {}) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const dismissMessage = () => setActionMessage(null);

  const importFromFile = async (file) => {
    setImporting(true);
    onError?.("");
    setActionMessage(null);

    try {
      const csv = await file.text();
      const result = await importClients({
        csv,
        dryRun: false,
      });

      const summary = result.summary || {};
      const failedRows = Number(summary.failedRows || 0);
      const createdRows = Number(summary.createdRows || 0);
      const totalRows = Number(summary.totalRows || 0);
      const errorsPreview = Array.isArray(summary.errors) ? summary.errors.slice(0, 5) : [];

      setActionMessage({
        variant: failedRows > 0 ? "warning" : "success",
        text: `Import completato: ${createdRows} creati, ${failedRows} falliti su ${totalRows} righe.`,
        errors: errorsPreview,
      });

      await onImported?.();
    } catch (importError) {
      onError?.(importError?.message || "Errore durante importazione clienti.");
    } finally {
      setImporting(false);
    }
  };

  const exportWithFilters = async (filters) => {
    if (exporting) {
      return;
    }

    setExporting(true);
    onError?.("");
    setActionMessage(null);

    try {
      const { blob, filename } = await exportClients(filters);

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setActionMessage({
        variant: "success",
        text: `Export completato: file ${filename} scaricato.`,
        errors: [],
      });
    } catch (exportError) {
      onError?.(exportError?.message || "Errore durante esportazione clienti.");
    } finally {
      setExporting(false);
    }
  };

  return { importing, exporting, actionMessage, dismissMessage, importFromFile, exportWithFilters };
}
